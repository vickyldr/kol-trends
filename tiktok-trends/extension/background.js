// Rythmix 热点收集器 —— 后台逻辑
// 在你已登录的 Chrome 里，依次打开各国 Hashtag 榜（后台标签页，不打扰你），
// 读取页面上渲染出来的前 N 个 hashtag，整理成 input-keywords.md 文本。
// 若设置了 Anthropic API key（B 档），抓完会直接调 Claude 出报告 + ideas.csv。
importScripts('prompt.js');

const COUNTRIES = [
  { code: 'US', name: '美国' }, { code: 'TR', name: '土耳其' }, { code: 'IT', name: '意大利' },
  { code: 'FR', name: '法国' }, { code: 'DE', name: '德国' }, { code: 'BR', name: '巴西' },
  { code: 'MX', name: '墨西哥' }, { code: 'TW', name: '台湾' }, { code: 'JP', name: '日本' },
  { code: 'KR', name: '韩国' }, { code: 'TH', name: '泰国' }, { code: 'UA', name: '乌克兰' },
  { code: 'SA', name: '沙特阿拉伯' }, { code: 'CA', name: '加拿大' }, { code: 'GB', name: '英国' },
];

const urlFor = (region, period) =>
  `https://ads.tiktok.com/creative/creativeCenter/trends/hashtag?period=${period}&region=${region}`;

function waitComplete(tabId, timeout = 30000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    function listener(id, info) { if (id === tabId && info.status === 'complete') finish(); }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeout);
  });
}

// 注入到页面里执行：滚动/点 View more，直到拿到 wantN 个 #hashtag
function scrapePage(wantN) {
  return new Promise((resolve) => {
    const getTags = () => [...new Set(
      [...document.querySelectorAll('*')]
        .map((e) => (e.childElementCount === 0 ? (e.textContent || '').trim() : ''))
        .filter((t) => /^#[A-Za-z0-9_À-￿]{2,30}$/.test(t))
    )];
    let tries = 0, last = 0, stable = 0;
    const iv = setInterval(() => {
      tries++;
      const tags = getTags();
      if (tags.length >= wantN || tries > 22 || stable > 5) { clearInterval(iv); resolve(tags.slice(0, wantN)); return; }
      if (tags.length === last) stable++; else stable = 0;
      last = tags.length;
      const vm = [...document.querySelectorAll('button,a,div,span')]
        .find((e) => e.childElementCount === 0 && /^view more$/i.test((e.textContent || '').trim()));
      if (vm) vm.click(); else window.scrollBy(0, 2200);
    }, 1200);
  });
}

async function run({ period, topN }, progress) {
  const tab = await chrome.tabs.create({ url: urlFor(COUNTRIES[0].code, period), active: false });
  const blocks = [];
  for (let i = 0; i < COUNTRIES.length; i++) {
    const c = COUNTRIES[i];
    progress(`抓取 ${c.name} (${c.code}) … ${i + 1}/${COUNTRIES.length}`);
    try {
      await chrome.tabs.update(tab.id, { url: urlFor(c.code, period) });
      await waitComplete(tab.id);
      await new Promise((r) => setTimeout(r, 2500));
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapePage, args: [topN] });
      const tags = (res && res.result) || [];
      const numbered = tags.length
        ? tags.map((w, j) => `${j + 1}. ${w}`).join('\n')
        : Array.from({ length: 10 }, (_, j) => `${j + 1}. `).join('\n');
      blocks.push(`## ${c.name} (${c.code})\n${numbered}\n`);
    } catch (e) {
      blocks.push(`## ${c.name} (${c.code})\n（抓取失败，请手动补）\n`);
    }
  }
  try { await chrome.tabs.remove(tab.id); } catch {}
  const date = new Date().toISOString().slice(0, 10);
  return `# 本周 TikTok 热搜词\n\n- 抓取日期: ${date}\n- 周期: 最近 ${period} 天\n- 榜单类型: Hashtags (Creative Center)\n\n---\n\n` + blocks.join('\n');
}

// B 档：调 Anthropic API 出报告（含 web 搜索）
async function generateReport(inputMd) {
  const { apiKey, baseUrl, model, useSearch } = await chrome.storage.local.get(['apiKey', 'baseUrl', 'model', 'useSearch']);
  const base = (baseUrl || 'https://api.anthropic.com').trim().replace(/\/+$/, '');
  const viaProxy = !base.includes('api.anthropic.com'); // 走你 VPS 代理（推荐）
  if (!viaProxy && !apiKey) throw new Error('未填 API key');
  const isOAuth = (apiKey || '').startsWith('sk-ant-oat'); // 直连官方时：订阅令牌走 OAuth

  const body = {
    model: model || 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: self.RYTHMIX_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: self.buildRythmixUserPrompt(inputMd) }],
  };
  // 联网搜索：走 VPS 代理(最终转给官方,支持) 或 直连官方时都带上
  if (useSearch !== false) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 20 }];
  }

  const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (viaProxy) {
    // VPS 代理负责真正的鉴权 + Claude Code 身份；这里把 key 当作可选的“代理密钥”
    if (apiKey) headers['x-proxy-secret'] = apiKey;
  } else {
    // 直连官方（仅当你的组织允许浏览器直连时才行）
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    if (isOAuth) {
      body.system = [{ type: 'text', text: "You are Claude Code, Anthropic's official CLI for Claude." }, { type: 'text', text: self.RYTHMIX_SYSTEM_PROMPT }];
      headers['authorization'] = 'Bearer ' + apiKey;
      headers['anthropic-beta'] = 'oauth-2025-04-20';
    } else {
      headers['x-api-key'] = apiKey;
    }
  }

  const r = await fetch(base + '/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error('API ' + r.status + '：' + ((data.error && data.error.message) || JSON.stringify(data).slice(0, 200)));
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// 从报告文本里抽出 ```csv 代码块
function extractCsv(text) {
  const m = text.match(/```csv\s*([\s\S]*?)```/i);
  return m ? m[1].trim() + '\n' : '';
}

function download(filename, text, mime) {
  const url = 'data:' + (mime || 'text/plain') + ';charset=utf-8,' + encodeURIComponent(text);
  chrome.downloads.download({ url, filename, saveAs: false }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'start') {
    const period = msg.period || 7;
    const topN = msg.topN || 15;
    chrome.storage.local.set({ status: 'running' });
    run({ period, topN }, (text) => {
      chrome.storage.local.set({ progress: text });
      chrome.runtime.sendMessage({ type: 'progress', text }).catch(() => {});
    })
      .then(async (md) => {
        chrome.storage.local.set({ lastResult: md });
        download('input-keywords.md', md, 'text/markdown');
        if (msg.generate) {
          chrome.runtime.sendMessage({ type: 'progress', text: '抓取完成，正在让 Claude 出报告（含联网查证，约 1-2 分钟）…' }).catch(() => {});
          try {
            const report = await generateReport(md);
            const csv = extractCsv(report);
            chrome.storage.local.set({ report, csv, status: 'reportDone' });
            download('report.md', report, 'text/markdown');
            if (csv) download('ideas.csv', csv, 'text/csv');
            chrome.runtime.sendMessage({ type: 'reportDone', report, csv }).catch(() => {});
          } catch (e) {
            chrome.storage.local.set({ status: 'genError', genErrorText: String(e) });
            chrome.runtime.sendMessage({ type: 'genError', text: String(e), md }).catch(() => {});
          }
        } else {
          chrome.storage.local.set({ status: 'done' });
          chrome.runtime.sendMessage({ type: 'done', md }).catch(() => {});
        }
      })
      .catch((e) => {
        chrome.storage.local.set({ status: 'error', error: String(e) });
        chrome.runtime.sendMessage({ type: 'error', text: String(e) }).catch(() => {});
      });
    sendResponse({ ok: true });
    return true;
  }
});
