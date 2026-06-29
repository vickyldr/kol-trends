/**
 * Cloudflare Worker：免费、网页部署、海外节点（不被 Anthropic 地区屏蔽）。
 * 作用：接收插件发来的请求，转发给 Anthropic，绕过浏览器 CORS + 地区限制。
 *
 * 部署见 tiktok-trends/server/README.md 的「Cloudflare Worker」一节。
 * 需要在 Worker 的 Settings → Variables 里设两个变量：
 *   ANTHROPIC_TOKEN  你的 sk-ant-oat01-… 或 sk-ant-api03-…（建议设为 Secret/加密）
 *   PROXY_SECRET     你自己起的一串密码（插件 API key 栏填同一串）
 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') return new Response('anthropic-proxy ok', { headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.endsWith('/v1/messages'))
      return new Response('not found', { status: 404, headers: cors });

    const SECRET = env.PROXY_SECRET || '';
    if (SECRET && request.headers.get('x-proxy-secret') !== SECRET)
      return new Response('bad secret', { status: 401, headers: cors });

    const TOKEN = env.ANTHROPIC_TOKEN;
    if (!TOKEN) return new Response(JSON.stringify({ error: 'Worker 未设置 ANTHROPIC_TOKEN' }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } });
    const isOAuth = TOKEN.startsWith('sk-ant-oat');

    let body;
    try { body = await request.json(); } catch { return new Response('bad json', { status: 400, headers: cors }); }

    // 订阅令牌要求系统提示以 Claude Code 身份开头
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
    return new Response(text, { status: upstream.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};
