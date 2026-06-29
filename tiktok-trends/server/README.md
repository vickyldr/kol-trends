# VPS 代理（让插件能出报告，绕过浏览器 CORS 墙）

你的 Anthropic 组织禁止"浏览器直连"，所以插件直连会被拒。把这个小代理放你**腾讯云 VPS** 上，
插件改为发给它、它服务器侧转发给 Anthropic（和你 PWA 能连一个道理）。

## 在 VPS 上跑（一次）

```bash
# 1. 把 server/anthropic-proxy.mjs 传到 VPS（scp 或直接 git clone 仓库）
# 2. 确保 VPS 有 Node 18+：  node -v
# 3. 启动（把 token 换成你的；oat 订阅令牌或 api03 付费 key 都行）
ANTHROPIC_TOKEN=sk-ant-xxxxx PROXY_SECRET=你随便起一串密码 PORT=8787 node anthropic-proxy.mjs
```

让它常驻（关掉 ssh 也不停）二选一：
```bash
# 简单：
nohup env ANTHROPIC_TOKEN=sk-ant-xxxxx PROXY_SECRET=你的密码 PORT=8787 node anthropic-proxy.mjs > proxy.log 2>&1 &
# 或用 pm2：
pm2 start anthropic-proxy.mjs --name rythmix-proxy --update-env
```

**开放端口**：在腾讯云安全组放行 `8787`（TCP）。
**验证**：浏览器访问 `http://你的VPS_IP:8787/` 应显示 `anthropic-proxy ok`。

## 插件那边设置

- **API 网址 base URL**：`http://你的VPS_IP:8787`
- **API key**：填你在上面设的 `PROXY_SECRET`（没设 secret 就留空）
- 保存 → 点开始 → 抓完自动发给 VPS 出报告。

## 关于令牌过期

- 用 **`sk-ant-api03-…`（付费 key）**：永不过期，最省心，强烈推荐放 VPS 上。
- 用 **`sk-ant-oat01-…`（订阅令牌）**：能用，但会过期（几小时～一天），过期后要在 VPS 上换新的 token 重启。
  （要做成自动刷新需要 refresh token，复杂，先不做。）

## 安全

- 一定设 `PROXY_SECRET`，否则别人知道你 IP 就能白嫖你的额度。
- 有域名+HTTPS 更好；只用 IP+http 也能跑（插件后台请求不受混合内容限制）。
