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

## 每周怎么用

1. 先在 Chrome 里打开 **ads.tiktok.com** 并**登录**（建议用单独的 business 账号，别用发视频的主账号）。
2. 点工具栏的 **Rythmix 热点收集器** 图标。
3. 选时间范围（默认 7 天）、前几名（默认 15），点 **开始抓取**。
   - 它会在后台开一个标签页，自动轮流切 12 个国家读榜，**别关浏览器**，约 1–2 分钟。
4. 跑完点 **📋 复制到剪贴板**（同时也会自动下载一份 `input-keywords.md`）。
5. 打开 Claude，**Ctrl+V 粘贴**，说一句 **「出本周周报」** → 拿到挖掘表 + `ideas.csv` 导飞书。

---

## 改国家清单

国家列表写在 `background.js` 顶部的 `COUNTRIES`，照着格式增删即可，改完在 `chrome://extensions` 点一下插件的「刷新」。

---

## 出问题

- **某个国家抓到的是空的 / 失败**：多半是那国当时没加载出来，重抓一次；或手动补几个，或直接发给 Claude。
- **完全抓不到**：确认你在 ads.tiktok.com 是登录状态；还不行就是 TikTok 改了页面，把情况发给 Claude，我更新插件里的读取规则。
- **不想用插件**：随时可退回"手动看榜把词发给 Claude"，分析照样全自动。
