# Rythmix 热点收集器（Chrome 插件）

一键在你**已登录的 Chrome** 里抓各国 Hashtag 前十，整理好复制到剪贴板，粘给 Claude 出周报。
不用装 Node、不用敲命令、不用单独登录——用的就是你平时浏览的会话，账号风险最低。

---

## 怎么装（只做一次，2 分钟）

1. 下载本项目（GitHub 仓库页 **Code → Download ZIP**，解压）。
2. Chrome 地址栏输入 `chrome://extensions` 回车。
3. 打开右上角 **开发者模式（Developer mode）**。
4. 点 **加载已解压的扩展程序（Load unpacked）**，选这个 `tiktok-trends/extension` 文件夹。
5. 工具栏会出现 "Rythmix 热点收集器" 图标（找不到就点拼图图标把它固定上来）。

> Edge 浏览器同理：`edge://extensions` → 开发者模式 → 加载解压缩的扩展。

---

## 两种用法

### B 档·全自动（填一次 API key，点一下出报告）— 推荐

1. 点插件图标 → 展开 **⚙️ 设置** → 填 **Anthropic API key**（`sk-ant-…`，console.anthropic.com 申请；就是 Claude Code 用的那种），选模型，**保存**。
   - key 只存你**本地浏览器**，不进仓库、不外发。
2. 先在 **ads.tiktok.com 登录**（建议单独 business 账号）。
3. 点 **开始** → 它后台抓完 12 国 → **自动调 Claude（带联网查证+找参考视频）出报告** → 自动下载 `report.md` 和 `ideas.csv`。
4. 把 `ideas.csv` 导入飞书挖掘表即可。**全程不用碰对话框。**

> 💰 成本：一周一次、十几个国家，Sonnet 4.6 一次约几分钱~两三毛（开了联网搜索会高些）；想最省可关掉联网搜索，想最好选 Opus 4.8。

### A 档·只收集（不填 key）

不填 API key 时，点 **开始** 只抓数据并**复制到剪贴板**（也下载 `input-keywords.md`）。
然后打开 Claude **Ctrl+V 粘贴**，说 **「出本周周报」** → 我来出报告。

---

## 改国家清单

国家列表写在 `background.js` 顶部的 `COUNTRIES`，照着格式增删即可，改完在 `chrome://extensions` 点一下插件的「刷新」。

---

## 出问题

- **某个国家抓到的是空的 / 失败**：多半是那国当时没加载出来，重抓一次；或手动补几个，或直接发给 Claude。
- **完全抓不到**：确认你在 ads.tiktok.com 是登录状态；还不行就是 TikTok 改了页面，把情况发给 Claude，我更新插件里的读取规则。
- **不想用插件**：随时可退回"手动看榜把词发给 Claude"，分析照样全自动。
