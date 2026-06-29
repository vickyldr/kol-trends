#!/usr/bin/env node
/**
 * 本地爬虫（在你自己电脑跑）：用你的真 Chrome + 持久登录，自动抓各国 Hashtag 榜前十/十五，
 * 填好本周 input-keywords.md，并顺手抓 TikTok 单条视频链接。
 *
 * 风险最低的姿势：真浏览器 + 家里 IP + 每周一次 + 登录态记住（第一次登录一次，之后自动）。
 * ⚠️ 用一个【单独的 business 账号】登录 Creative Center，别用你发视频的主账号。
 *
 * 一般你不用直接敲命令——双击 run-windows.bat（或 run-mac.command）即可。
 * 手动跑：node tiktok-trends/scripts/scrape-creative-center.mjs [2026-W30]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

// 把文本复制到系统剪贴板（Win: clip / Mac: pbcopy / Linux: xclip）
function copyToClipboard(text) {
  const cmd = process.platform === 'win32' ? 'clip'
    : process.platform === 'darwin' ? 'pbcopy'
    : 'xclip';
  return new Promise((res) => {
    try {
      const args = process.platform === 'linux' ? ['-selection', 'clipboard'] : [];
      const p = spawn(cmd, args);
      p.on('error', () => res(false));
      p.on('close', () => res(true));
      p.stdin.end(text);
    } catch { res(false); }
  });
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('缺少 playwright。先在本机跑：npm i playwright && npx playwright install chromium');
  process.exit(1);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const weekArg = args.find((a) => /^\d{4}-W\d{2}$/.test(a));

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function pause(msg) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, () => { rl.close(); res(); });
  });
}

const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'countries.json'), 'utf8'));
const topN = cfg.top_n ?? 10;
const want = cfg.top_n_if_dull ?? 15; // 多抓几个备用
const period = cfg.period_days ?? 7;
const WEEK = weekArg || isoWeek(new Date());
const DATE = new Date().toISOString().slice(0, 10);
const URL_TEMPLATE = cfg.source?.url_template ||
  'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?period={period}&region={region}';
const PAGE_URL = (region) => URL_TEMPLATE.replace('{period}', period).replace('{region}', region);

const VIDEO_RE = /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/g;
const videoSink = new Set();

// 抓页面上所有形如 #xxx 的 hashtag 文本（去重）
const getTags = (page) =>
  page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('*')]
        .map((e) => (e.childElementCount === 0 ? (e.textContent || '').trim() : ''))
        .filter((t) => /^#[A-Za-z0-9_À-￿]{2,30}$/.test(t))
    )]
  );

async function loadCountry(page, region) {
  await page.goto(PAGE_URL(region), { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  // 不断点 "View more" / 滚动，直到拿到 want 个或不再增长
  let last = 0;
  for (let i = 0; i < 12; i++) {
    const tags = await getTags(page);
    if (tags.length >= want) break;
    if (tags.length === last && i > 1) {
      const vm = page.getByText('View more', { exact: true }).first();
      if (await vm.count().catch(() => 0)) await vm.click({ timeout: 3000 }).catch(() => {});
      else await page.mouse.wheel(0, 3000);
    } else {
      await page.mouse.wheel(0, 3000);
    }
    last = tags.length;
    await page.waitForTimeout(1800);
  }
  return (await getTags(page)).slice(0, want);
}

// ---- 启动持久浏览器（记住登录），优先用你装的真 Chrome ----
const userDataDir = join(ROOT, '.tt-profile');
const firstRun = !existsSync(userDataDir);
mkdirSync(userDataDir, { recursive: true });

async function launch() {
  const common = { headless: false, viewport: { width: 1366, height: 900 } };
  for (const opt of [{ channel: 'chrome' }, { channel: 'msedge' }, {}]) {
    try { return await chromium.launchPersistentContext(userDataDir, { ...common, ...opt }); }
    catch { /* try next */ }
  }
  throw new Error('启动浏览器失败：试试先 npx playwright install chromium');
}

const ctx = await launch();
ctx.on('response', async (res) => {
  try {
    const ct = res.headers()['content-type'] || '';
    if (/json|text|javascript/.test(ct)) (String(await res.text()).match(VIDEO_RE) || []).forEach((v) => videoSink.add(v.split('?')[0]));
  } catch {}
});
const page = ctx.pages()[0] || (await ctx.newPage());

// 第一次：让用户登录一次
const first = cfg.countries[0];
await page.goto(PAGE_URL(first.code), { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
if (firstRun) {
  console.log('\n================ 第一次使用：请登录一次 ================');
  console.log('1) 在弹出的浏览器窗口里，点右上角 Log in，登录 Creative Center');
  console.log('   （建议用单独的 business 账号，别用发视频的主账号）');
  console.log('2) 看到 Hashtag 榜能正常显示一长串后，回到这个黑框，按【回车】继续。');
  console.log('   （登录会被记住，以后再跑就不用登了）');
  await pause('\n登录好后按回车 > ');
}

// ---- 逐国抓 ----
const blocks = [];
for (const c of cfg.countries) {
  process.stdout.write(`抓取 ${c.name} (${c.code}) ... `);
  let tags = [];
  try { tags = await loadCountry(page, c.code); } catch {}
  console.log(tags.length ? `${tags.length} 个` : '未拿到（手动补）');
  const numbered = tags.length
    ? tags.map((w, i) => `${i + 1}. ${w}`).join('\n')
    : Array.from({ length: topN }, (_, i) => `${i + 1}. `).join('\n');
  blocks.push(`## ${c.name} (${c.code})\n${numbered}\n`);
}

await ctx.close();

const md = `<!-- 由 scrape-creative-center.mjs 本地抓取。空的国家请手动补。 -->

# 本周 TikTok 热搜词 — ${WEEK}

- 抓取日期: ${DATE}
- 周期: 最近 ${period} 天
- 榜单类型: Hashtags (Creative Center)

---

${blocks.join('\n')}`;

const weekDir = join(ROOT, 'weeks', WEEK);
mkdirSync(weekDir, { recursive: true });
const outPath = join(weekDir, 'input-keywords.md');
writeFileSync(outPath, md);
console.log(`\n✅ 已写入 ${outPath}`);

if (videoSink.size) {
  writeFileSync(join(weekDir, 'scraped-videos.txt'), [...videoSink].join('\n') + '\n');
  console.log(`✅ 顺手抓到 ${videoSink.size} 条 TikTok 视频链接`);
}

const copied = await copyToClipboard(md);
if (copied) console.log('\n📋 本周词已复制到剪贴板！去 Claude 直接 Ctrl+V 粘贴，说「出本周周报」即可。');
else console.log(`\n下一步：打开 ${outPath}，复制内容发给 Claude，说「出本周周报」即可。`);
