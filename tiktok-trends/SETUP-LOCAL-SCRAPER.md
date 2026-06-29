# 本地爬虫 Setup（一页跑通）

在**你自己的电脑**上跑（不是 Claude Code 云端——云端浏览器被代理挡死）。
目标：自动抓各国 Hashtag 榜前十，填好本周 `input-keywords.md`，再让 AI 出周报 + CSV。

> 已确认数据源：**Hashtag 榜**（你界面上的 `ads.tiktok.com/creative/creativeCenter/trends/hashtag`）。
> 公开可见、**不用登录**。

---

## 一次性准备（装环境）

需要 Node 18+。在仓库根目录执行：

```bash
# 1. 拿到代码
git clone https://github.com/vickyldr/kol-trends.git
cd kol-trends

# 2. 装 playwright（爬虫用）
npm init -y            # 如果还没有 package.json
npm i playwright
npx playwright install chromium
```

---

## 每周三步

```bash
# Step 1 建本周文件夹（按 ISO 周，自动分好 12 国）
node tiktok-trends/scripts/new-week.mjs

# Step 2 抓榜单（第一次建议加 HEADFUL=1 看着浏览器跑，确认没弹窗/区域选择挡住）
HEADFUL=1 node tiktok-trends/scripts/scrape-creative-center.mjs
#   产物：
#   - weeks/<本周>/input-keywords.md      各国前十 Hashtag（自动填）
#   - weeks/<本周>/scraped-videos.txt     顺手抓到的 TikTok 单条视频链接（当「视频链接」候选）
#   跑顺了之后，平时直接 node ...（不加 HEADFUL）后台跑即可

# Step 3 让 AI 出周报 + CSV（在 Claude Code 里说这句）
#   "按 tiktok-trends/prompts/analyze-week.md 分析 weeks/<本周>/input-keywords.md，写出 report.md 和 ideas.csv"
```

最后把 `weeks/<本周>/ideas.csv` 导入飞书挖掘表即可。

---

## 配置（都在 config/countries.json）

- **国家清单**：`countries` 增删。
- **榜单/时间**：`top_n`（前几）、`period_days`（7/30/120）。
- **换榜单**：改 `source.url_template`（`candidates` 里有 hashtag / song 备选）。现在锁定 Hashtag。

---

## 单条视频链接（视觉参考）怎么来

优先级 **TikTok > Instagram > YouTube**。

- 爬虫会把 listing 接口里出现的 TikTok 单条链接存进 `scraped-videos.txt`。
- 想要**每个 Hashtag 一条样板视频**：在榜单里点该 Hashtag 的 **See analytics**，下面有 related videos，复制一条链接最准（5 秒/条）。
- AI 出周报时也会按上面的优先级联网补单条链接，找不到才退聚合页（会标「聚合·进去挑一条」）。

---

## 跑不出来时（troubleshooting）

1. **抓到 0 条**：加 `HEADFUL=1` 重跑，看浏览器里是不是有 cookie 同意 / 区域选择弹窗挡住；
   手动点掉一次后通常就正常（脚本等待 8 秒加载 XHR，网慢可改大 `waitForTimeout`）。
2. **某些国家空**：脚本会在该国留空并提示，手动把那国前十补进 `input-keywords.md` 即可。
3. **TikTok 改了版式/接口**：脚本用「拦截 `creative_radar_api` 的 JSON」+「读 DOM 里 # 开头文本」双兜底；
   若两者都失效，多半是字段名变了——把 `HEADFUL=1` 跑时的接口返回发我，我更新 `extractFromJson` 的字段。
4. **想要更稳**：直接用方式 A（手动把那一屏的词贴进 `input-keywords.md`）——下游分析照样全自动。
