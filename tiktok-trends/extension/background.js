// Rythmix 热点收集器 —— 后台逻辑
// 在你已登录的 Chrome 里，依次打开各国 Hashtag 榜（后台标签页，不打扰你），
// 读取页面上渲染出来的前 N 个 hashtag，整理成 input-keywords.md 文本。

const COUNTRIES = [
  { code: 'US', name: '美国' }, { code: 'GB', name: '英国' }, { code: 'CA', name: '加拿大' },
  { code: 'AU', name: '澳大利亚' }, { code: 'DE', name: '德国' }, { code: 'FR', name: '法国' },
  { code: 'ID', name: '印尼' }, { code: 'PH', name: '菲律宾' }, { code: 'VN', name: '越南' },
  { code: 'TH', name: '泰国' }, { code: 'MY', name: '马来西亚' }, { code: 'SG', name: '新加坡' },
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'start') {
    const period = msg.period || 7;
    const topN = msg.topN || 15;
    chrome.storage.local.set({ status: 'running' });
    run({ period, topN }, (text) => {
      chrome.storage.local.set({ progress: text });
      chrome.runtime.sendMessage({ type: 'progress', text }).catch(() => {});
    })
      .then((md) => {
        chrome.storage.local.set({ lastResult: md, status: 'done' });
        const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
        chrome.downloads.download({ url: dataUrl, filename: 'input-keywords.md', saveAs: false }).catch(() => {});
        chrome.runtime.sendMessage({ type: 'done', md }).catch(() => {});
      })
      .catch((e) => {
        chrome.storage.local.set({ status: 'error', error: String(e) });
        chrome.runtime.sendMessage({ type: 'error', text: String(e) }).catch(() => {});
      });
    sendResponse({ ok: true });
    return true;
  }
});
