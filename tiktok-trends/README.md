# TikTok Trends → Rythmix 蹭点工作流

把你每周一的人工活儿（看十几个国家的 TikTok 热搜词前十 → 找 Rythmix 能蹭的点）变成
**「数据进来 → AI 分析 → 出周报」** 的半自动流程。

> 最花时间的不是看那张榜单，而是逐词查"这到底在火什么"+ 想"我们怎么用 AI 音乐 / AI MV 蹭"。
> 这部分正好是 AI 的强项，已经做成自动的了。

---

## 这套东西是怎么运作的

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│ 1. 拿到各国热搜词 │ →  │ 2. AI 逐词分析+出蹭点  │ →  │ 3. 周报 report.md │
│   (贴名单/爬虫)   │    │  (翻译·查证·Rythmix方案) │    │   (可直接执行)    │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

- **第 1 步** 有三种拿数据的方式，见下方「数据怎么进来」。
- **第 2 步** 是核心，由 AI 按 [`RYTHMIX_PLAYBOOK.md`](./RYTHMIX_PLAYBOOK.md) 的规则跑，含**版权红线检查**。
- **第 3 步** 输出结构化周报，每个热点给出：是什么 / TT 上在聊什么 / Rythmix 怎么蹭 / 版权风险 / 优先级。

---

## 目录结构

```
tiktok-trends/
├── README.md                  # 本文件
├── RYTHMIX_PLAYBOOK.md        # ★ 核心：把热点变成 Rythmix 内容的规则 + 版权红线
├── extension/                 # ★ Chrome 插件（最方便）：点一下抓各国前十 → 复制 → 粘给 Claude
├── SETUP-LOCAL-SCRAPER.md     # 本地·双击版教程（不想用插件时的备选）
├── run-windows.bat            # Windows：双击运行（抓榜）
├── run-mac.command            # Mac：双击运行（抓榜）
├── config/
│   └── countries.json         # 要追踪的国家清单（可改）
├── templates/
│   ├── input-keywords.md      # 「贴名单」用的输入模板
│   ├── report.md              # 周报输出模板（对齐挖掘表「0 总填写表」）
│   └── ideas.csv              # 可直接导入飞书挖掘表的 CSV 表头
├── prompts/
│   └── analyze-week.md        # 给 AI 的主提示词（喂它输入 → 出周报）
├── scripts/
│   ├── new-week.mjs           # 一键生成本周文件夹 + 空白输入（零依赖 Node）
│   └── scrape-creative-center.mjs  # 可选：本地跑的爬虫（在你自己电脑上跑）
└── weeks/
    └── 2026-W27/              # 每周一个文件夹
        ├── input-keywords.md  # 各国前十词贴这里
        ├── report.md          # AI 产出的周报（含「挖掘表」主表）
        └── ideas.csv          # AI 产出的可导入 CSV（对齐飞书挖掘表列）
```

---

## 每周怎么用（3 步）

### Step 0 — 建本周文件夹
```bash
node tiktok-trends/scripts/new-week.mjs
```
会按当前 ISO 周生成 `weeks/<年-W周>/input-keywords.md`（空白模板，已按国家清单分好节）。

### Step 1 — 把各国前十词弄进来（三选一）

| 方式 | 怎么做 | 适合 |
|------|--------|------|
| **A. Chrome 插件**（✅ 最方便/推荐） | 装一次 [`extension/`](./extension/) → 点工具栏图标 → 自动抓 12 国前十、复制到剪贴板 → 粘给 Claude。用你已登录的浏览器，免装 Node、风险最低 | 日常首选 |
| **B. 本地双击脚本** | 双击 `run-windows.bat`（Mac: `run-mac.command`），第一次登录一次。教程 [`SETUP-LOCAL-SCRAPER.md`](./SETUP-LOCAL-SCRAPER.md) | 不想装插件时 |
| **C. 手动贴** | 照旧打开 Creative Center，把各国前十复制进 `input-keywords.md` | 临时/兜底 |
| **D. 联网搜索近似** | 让 AI 用 WebSearch + 第三方趋势站凑近似榜 | 手头没榜单时 |

> ⚠️ 为什么不能在云端（Claude Code web）直接爬：Creative Center 的趋势接口要浏览器签名，
> 且本云沙箱的 Chromium 走不通出口代理（TLS 握手被代理在 ClientHello 阶段断连，属基础设施限制）。
> 在**普通电脑**上没有这个代理，方式 B 可正常跑。
>
> 🔧 **爬虫目标榜单是配置驱动的**：改 `config/countries.json` 的 `source.url_template` 即可切换
> （Hashtags / Songs / Trends 中心页等，`candidates` 里有备选）。先确认你每周看的是哪个榜再跑。
> 参考视频链接优先级：**TikTok > Instagram > YouTube**，优先单条 permalink。

### Step 2 — 让 AI 出周报
把 [`prompts/analyze-week.md`](./prompts/analyze-week.md) 连同本周 `input-keywords.md` 交给 Claude，
它会按 playbook 生成 `report.md`（含「挖掘表」主表）和 `ideas.csv`（可直接导入飞书挖掘表）。
在 Claude Code 里直接说：

> "按 tiktok-trends/prompts/analyze-week.md 分析 weeks/2026-W27/input-keywords.md，写出 report.md 和 ideas.csv"

**输出字段对齐你们的挖掘表「0 总填写表」**：来源国家 · 投放地区 · idea描述 · 主推功能点
(文生音乐/AI mv/AI驱动/音色克隆) · 修改要点及数量 · 音频风格 · 视频链接 · 版权。
执行/运营列（设计直用·KOL选用·Fiverr采买·缩略图·附件·填写人·竞品·渠道·进度·时间）落地时再填，不输出。

---

## 老实说能自动到什么程度

| 环节 | 自动化程度 | 说明 |
|------|-----------|------|
| 各国热搜词获取 | 🟡 半自动 | 云端爬不了；本机爬虫可以，或手动贴（最稳） |
| 逐词翻译 | 🟢 全自动 | AI |
| "这词在 TT 上到底在火什么" | 🟢 多数自动 | AI + 联网搜索；冷门词偶尔要人工补一句 |
| 想 Rythmix 蹭法（AI MV / 大字报 / 翻跳 / 口播 / 音色克隆） | 🟢 全自动 | AI 按 playbook（6 种蹭法） |
| 每个方案配一个具体参考视频 | 🟡 多数自动 | AI 联网找 TT/YT/IG 单条样板；偶尔退到聚合页需人工替换 |
| 版权红线检查 | 🟢 全自动初筛 | AI 初筛 + 高风险项标红给人复核 |
| 出周报 | 🟢 全自动 | |

→ 结论：**能靠 AI + 代码运作**。人只需要每周贴一次榜单（约 5 分钟）+ 复核高风险项，
其余交给流程。

详细玩法见 [`RYTHMIX_PLAYBOOK.md`](./RYTHMIX_PLAYBOOK.md)。
