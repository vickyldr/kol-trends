#!/usr/bin/env node
/**
 * 生成本周文件夹 + 空白输入表（按 config/countries.json 自动分国家节）。
 * 用法:
 *   node tiktok-trends/scripts/new-week.mjs            # 用当前 ISO 周
 *   node tiktok-trends/scripts/new-week.mjs 2026-W30   # 指定周
 *   node tiktok-trends/scripts/new-week.mjs --force     # 覆盖已存在的输入表
 * 零依赖，任何装了 Node 的环境都能跑。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const force = args.includes('--force');
const weekArg = args.find((a) => /^\d{4}-W\d{2}$/.test(a));

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const now = new Date();
const WEEK = weekArg || isoWeek(now);
const DATE = now.toISOString().slice(0, 10);

const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'countries.json'), 'utf8'));
const topN = cfg.top_n ?? 10;
const period = cfg.period_days ?? 7;

const sections = cfg.countries
  .map((c) => {
    const lines = Array.from({ length: topN }, (_, i) => `${i + 1}. `).join('\n');
    return `## ${c.name} (${c.code})\n${lines}\n`;
  })
  .join('\n');

const input = `<!--
本周各国 TikTok 热搜词输入表（由 new-week.mjs 按 config/countries.json 生成）。
用法：打开 https://ads.tiktok.com/creative/creativeCenter/trends ，选国家，把前 ${topN}（热点少就前 15）的词贴到对应国家下，一行一个。
原样贴即可，AI 会自己翻译/查证。
-->

# 本周 TikTok 热搜词 — ${WEEK}

- 抓取日期: ${DATE}
- 周期: 最近 ${period} 天
- 榜单类型: 热搜词 (Trends/Keywords)  <!-- 或 Hashtags / Songs -->

---

${sections}`;

const weekDir = join(ROOT, 'weeks', WEEK);
mkdirSync(weekDir, { recursive: true });

const inputPath = join(weekDir, 'input-keywords.md');
if (existsSync(inputPath) && !force) {
  console.log(`已存在（跳过，加 --force 覆盖）: ${inputPath}`);
} else {
  writeFileSync(inputPath, input);
  console.log(`✅ 生成输入表: ${inputPath}`);
}

const reportPath = join(weekDir, 'report.md');
if (!existsSync(reportPath)) {
  let tpl = readFileSync(join(ROOT, 'templates', 'report.md'), 'utf8');
  tpl = tpl.replaceAll('{{WEEK}}', WEEK).replaceAll('{{DATE}}', DATE)
           .replaceAll('{{COUNTRY_COUNT}}', String(cfg.countries.length));
  writeFileSync(reportPath, tpl);
  console.log(`✅ 生成周报骨架: ${reportPath}`);
}

const csvPath = join(weekDir, 'ideas.csv');
if (!existsSync(csvPath)) {
  copyFileSync(join(ROOT, 'templates', 'ideas.csv'), csvPath);
  console.log(`✅ 生成 CSV 表头: ${csvPath}`);
}

console.log(`\n下一步：把各国前 ${topN} 词贴进 ${inputPath}，然后让 AI 按 prompts/analyze-week.md 出 report.md + ideas.csv。`);
