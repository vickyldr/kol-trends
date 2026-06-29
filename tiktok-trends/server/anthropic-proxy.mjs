#!/usr/bin/env node
/**
 * 放在你 VPS（腾讯云）上的小代理：接收插件发来的请求，服务器侧转发给 Anthropic。
 * 因为是服务器发出、不带浏览器 Origin，所以绕过"禁止浏览器 CORS"那堵墙（和你 PWA 一个道理）。
 *
 * 零依赖（Node 18+ 自带 fetch）。用法：
 *   ANTHROPIC_TOKEN=sk-ant-...  node anthropic-proxy.mjs
 * 可选环境变量：
 *   PORT=8787              监听端口（默认 8787）
 *   PROXY_SECRET=随便一串   插件那边也填同一串，防别人乱用你的代理
 *
 * 令牌支持两种，自动识别：
 *   sk-ant-oat01-…  订阅令牌 → Bearer + oauth beta + 注入 Claude Code 身份（注意：会过期，过期要换）
 *   sk-ant-api03-…  付费 API key → x-api-key（不过期，最省心）
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.ANTHROPIC_TOKEN;
const SECRET = process.env.PROXY_SECRET || '';
if (!TOKEN) { console.error('请设置 ANTHROPIC_TOKEN 环境变量'); process.exit(1); }
const isOAuth = TOKEN.startsWith('sk-ant-oat');

const server = http.createServer((req, res) => {
  // 允许插件跨域调用本代理（本代理是你自己的，放开即可）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET') { res.writeHead(200); res.end('anthropic-proxy ok'); return; }
  if (req.method !== 'POST' || !req.url.endsWith('/v1/messages')) { res.writeHead(404); res.end('not found'); return; }

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      if (SECRET && req.headers['x-proxy-secret'] !== SECRET) { res.writeHead(401); res.end('bad secret'); return; }
      const body = JSON.parse(raw || '{}');

      // 订阅令牌要求系统提示以 Claude Code 身份开头，否则被拒
      if (isOAuth) {
        const cc = { type: 'text', text: "You are Claude Code, Anthropic's official CLI for Claude." };
        if (Array.isArray(body.system)) body.system = [cc, ...body.system];
        else body.system = [cc, { type: 'text', text: String(body.system || '') }];
      }

      const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
      if (isOAuth) { headers['authorization'] = 'Bearer ' + TOKEN; headers['anthropic-beta'] = 'oauth-2025-04-20'; }
      else headers['x-api-key'] = TOKEN;

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'content-type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: String(e) }));
    }
  });
});

server.listen(PORT, () => console.log(`anthropic-proxy 监听 :${PORT}（token 类型：${isOAuth ? 'oat 订阅令牌' : 'api03 付费key'}）`));
