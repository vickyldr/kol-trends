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
├── config/
│   └── countries.json         # 要追踪的国家清单（可改）
├── templates/
│   ├── input-keywords.md      # 「贴名单」用的输入模板
│   └── report.md              # 周报输出模板
├── prompts/
│   └── analyze-week.md        # 给 AI 的主提示词（喂它输入 → 出周报）
├── scripts/
│   ├── new-week.mjs           # 一键生成本周文件夹 + 空白输入（零依赖 Node）
│   └── scrape-creative-center.mjs  # 可选：本地跑的爬虫（在你自己电脑上跑）
└── weeks/
    └── 2026-W27/              # 每周一个文件夹
        ├── input-keywords.md  # 各国前十词贴这里
        └── report.md          # AI 产出的周报
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
| **A. 手动贴**（默认/最省事） | 照旧打开 [Creative Center Trends](https://ads.tiktok.com/creative/creativeCenter/trends)，把各国前十/前十五的词复制进 `input-keywords.md` 对应国家下 | 任何环境，零维护 |
| **B. 本地爬虫** | 在**你自己电脑**上 `node scripts/scrape-creative-center.mjs`，自动填 `input-keywords.md` | 想全自动、能在本机跑脚本 |
| **C. 联网搜索近似** | 让 AI 用 WebSearch + 第三方趋势站凑近似榜 | 临时、手头没榜单时 |

> ⚠️ 为什么不能在云端（Claude Code web）直接爬：Creative Center 的趋势接口要浏览器签名，
> 且本云沙箱的 Chromium 走不通出口代理（TLS 握手被代理在 ClientHello 阶段断连，属基础设施限制）。
> 在**普通电脑**上没有这个代理，方式 B 可正常跑。

### Step 2 — 让 AI 出周报
把 [`prompts/analyze-week.md`](./prompts/analyze-week.md) 连同本周 `input-keywords.md` 交给 Claude，
它会按 playbook 生成 `report.md`。在 Claude Code 里直接说：

> "按 tiktok-trends/prompts/analyze-week.md 分析 weeks/2026-W27/input-keywords.md，写出 report.md"

---

## 老实说能自动到什么程度

| 环节 | 自动化程度 | 说明 |
|------|-----------|------|
| 各国热搜词获取 | 🟡 半自动 | 云端爬不了；本机爬虫可以，或手动贴（最稳） |
| 逐词翻译 | 🟢 全自动 | AI |
| "这词在 TT 上到底在火什么" | 🟢 多数自动 | AI + 联网搜索；冷门词偶尔要人工补一句 |
| 想 Rythmix 蹭法（AI MV / 大字报 / 翻跳 / 口播） | 🟢 全自动 | AI 按 playbook |
| 版权红线检查 | 🟢 全自动初筛 | AI 初筛 + 高风险项标红给人复核 |
| 出周报 | 🟢 全自动 | |

→ 结论：**能靠 AI + 代码运作**。人只需要每周贴一次榜单（约 5 分钟）+ 复核高风险项，
其余交给流程。

详细玩法见 [`RYTHMIX_PLAYBOOK.md`](./RYTHMIX_PLAYBOOK.md)。
