#!/usr/bin/env node
/**
 * 可选：从 TikTok Creative Center 自动抓各国趋势，填进本周 input-keywords.md。
 *
 * ⚠️ 在【你自己的电脑】上跑，不要在 Claude Code 云沙箱里跑：
 *    云沙箱的出口代理与 Chromium 的 TLS 握手不兼容（ClientHello 阶段被断连），跑不通。
 *    普通电脑没有这个代理，正常。
 *
 * 准备:
 *   npm i playwright && npx playwright install chromium
 * 用法:
 *   node tiktok-trends/scripts/scrape-creative-center.mjs            # 当前 ISO 周
 *   node tiktok-trends/scripts/scrape-creative-center.mjs 2026-W30   # 指定周
 *   HEADFUL=1 node ...   # 显示浏览器窗口（首次调试/可能要手动过验证时用）
 *
 * 说明: Creative Center 偶尔改接口/版式。脚本同时尝试 (a) 拦截 creative_radar_api 的 JSON，
 *       (b) 兜底读渲染后的 DOM。哪个拿到就用哪个；都拿不到会在该国留空并提示手动补。
 *       它抓的是 Hashtag 榜（最稳定的公开榜）。要换"热搜词"榜，调整 PAGE_URL 即可。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('缺少 playwright。先在本机: npm i playwright && npx playwright install chromium');
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

const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'countries.json'), 'utf8'));
const topN = cfg.top_n ?? 10;
const period = cfg.period_days ?? 7;
const WEEK = weekArg || isoWeek(new Date());
const DATE = new Date().toISOString().slice(0, 10);

// 目标榜单 URL 来自 config.source.url_template（确认是哪个榜后只改配置，不动代码）。
const URL_TEMPLATE =
  cfg.source?.url_template ||
  'https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?period={period}&region={region}';
const PAGE_URL = (region) =>
  URL_TEMPLATE.replace('{period}', period).replace('{region}', region);

// 从拦截到的 JSON 里尽量挖出榜单条目的名字
function extractFromJson(obj) {
  const out = [];
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(visit);
    const name = n.hashtag_name || n.keyword || n.title || n.name || n.word;
    if (typeof name === 'string' && name.trim()) out.push(name.trim());
    Object.values(n).forEach(visit);
  };
  visit(obj);
  return out;
}

// 顺手收集任何出现的 TikTok 单条视频 permalink（给「视频链接」当候选）
const VIDEO_RE = /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/g;
function extractVideoLinks(text) {
  return (String(text).match(VIDEO_RE) || []).map((u) => u.split('?')[0]);
}

async function scrapeCountry(ctx, region, videoSink) {
  const page = await ctx.newPage();
  const captured = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (!/creative_radar_api|popular_trend|trending/i.test(u)) return;
    try {
      if ((res.headers()['content-type'] || '').includes('json')) {
        const txt = await res.text();
        captured.push(...extractFromJson(JSON.parse(txt)));
        extractVideoLinks(txt).forEach((v) => videoSink.add(v));
      }
    } catch {}
  });

  try {
    await page.goto(PAGE_URL(region), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000); // 等 XHR
  } catch (e) {
    console.error(`  [${region}] 打开失败: ${e.message.split('\n')[0]}`);
  }

  // 兜底：读 DOM 里看起来像 hashtag 的文本
  let domWords = [];
  try {
    domWords = await page.$$eval('span, a, h3', (els) =>
      els
        .map((e) => e.textContent.trim())
        .filter((t) => /^#?[\p{L}\p{N}_]{2,40}$/u.test(t) && t.startsWith('#'))
    );
  } catch {}

  await page.close();

  const seen = new Set();
  const merged = [...captured, ...domWords]
    .map((w) => w.replace(/^#/, '').trim())
    .filter((w) => w && !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()));
  return merged.slice(0, Math.max(topN, 15));
}

const browser = await chromium.launch({ headless: !process.env.HEADFUL });
const ctx = await browser.newContext({
  locale: 'en-US',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
});

const videoSink = new Set();
const blocks = [];
for (const c of cfg.countries) {
  process.stdout.write(`抓取 ${c.name} (${c.code}) ... `);
  const words = await scrapeCountry(ctx, c.code, videoSink);
  console.log(words.length ? `${words.length} 条` : '未拿到（请手动补）');
  const numbered = words.length
    ? words.map((w, i) => `${i + 1}. ${w}`).join('\n')
    : Array.from({ length: topN }, (_, i) => `${i + 1}. `).join('\n');
  blocks.push(`## ${c.name} (${c.code})\n${numbered}\n`);
}

await browser.close();

const md = `<!-- 由 scrape-creative-center.mjs 自动抓取。空的国家请手动补，AI 会翻译/查证。 -->

# 本周 TikTok 热搜词 — ${WEEK}

- 抓取日期: ${DATE}
- 周期: 最近 ${period} 天
- 榜单类型: Hashtags (Creative Center)

---

${blocks.join('\n')}`;

const weekDir = join(ROOT, 'weeks', WEEK);
mkdirSync(weekDir, { recursive: true });
const outPath = join(weekDir, 'input-keywords.md');
if (existsSync(outPath)) {
  writeFileSync(outPath.replace(/\.md$/, `.scraped.md`), md);
  console.log(`\n已存在 input-keywords.md，结果另存为 input-keywords.scraped.md（自行合并）。`);
} else {
  writeFileSync(outPath, md);
  console.log(`\n✅ 写入 ${outPath}`);
}

// 把抓到的 TikTok 单条视频链接存一份，给「视频链接」当候选
if (videoSink.size) {
  const vp = join(weekDir, 'scraped-videos.txt');
  writeFileSync(vp, [...videoSink].join('\n') + '\n');
  console.log(`✅ 顺手抓到 ${videoSink.size} 条 TikTok 视频链接 → ${vp}`);
} else {
  console.log(`（本次没抓到单条视频链接；视频链接用聚合页或 INS/YT 退路）`);
}

console.log(`下一步：让 AI 按 prompts/analyze-week.md 出 report.md + ideas.csv。`);
