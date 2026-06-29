const $ = (id) => document.getElementById(id);
const go = $('go'), status = $('status');
const dlReport = $('dlReport'), dlCsv = $('dlCsv'), copyBtn = $('copy');
let state = { input: '', report: '', csv: '' };

function download(name, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function showCollected(md) {
  state.input = md;
  go.disabled = false; go.textContent = '重新抓取';
  copyBtn.style.display = 'block';
  copyBtn.textContent = '📋 复制热点词（粘给 Claude）';
  const countries = (md.match(/^## /gm) || []).length;
  const tags = (md.match(/^\d+\.\s+#/gm) || []).length;
  status.textContent = `✅ 抓到 ${countries} 国、${tags} 个词。\n（没填 API key，复制后粘给 Claude 说「出本周周报」）`;
}

function showReport(report, csv) {
  state.report = report; state.csv = csv;
  go.disabled = false; go.textContent = '重新抓取';
  dlReport.style.display = 'block';
  if (csv) dlCsv.style.display = 'block';
  copyBtn.style.display = 'block';
  copyBtn.textContent = '📋 复制周报';
  status.innerHTML = '<span class="ok">✅ 报告已生成并自动下载（report.md + ideas.csv）。把 ideas.csv 导入飞书即可。</span>';
}

// 载入已保存设置 + 上次结果
chrome.storage.local.get(['apiKey', 'model', 'useSearch', 'lastResult', 'report', 'csv', 'status'], (d) => {
  if (d.apiKey) $('apiKey').value = d.apiKey;
  if (d.model) $('model').value = d.model;
  $('useSearch').checked = d.useSearch !== false;
  if (!d.apiKey) $('settings').open = true;
  if (d.status === 'reportDone' && d.report) showReport(d.report, d.csv || '');
  else if (d.lastResult) showCollected(d.lastResult);
});

$('save').addEventListener('click', () => {
  chrome.storage.local.set({
    apiKey: $('apiKey').value.trim(),
    model: $('model').value,
    useSearch: $('useSearch').checked,
  }, () => { $('save').textContent = '✅ 已保存'; setTimeout(() => ($('save').textContent = '保存设置'), 1500); });
});

go.addEventListener('click', () => {
  // 保存最新设置，确保用到
  chrome.storage.local.set({ apiKey: $('apiKey').value.trim(), model: $('model').value, useSearch: $('useSearch').checked });
  go.disabled = true; go.textContent = '抓取中…';
  [dlReport, dlCsv, copyBtn].forEach((b) => (b.style.display = 'none'));
  const hasKey = !!$('apiKey').value.trim();
  status.textContent = hasKey ? '开始抓取…（抓完会自动出报告，别关浏览器）' : '开始抓取…（别关浏览器）';
  chrome.runtime.sendMessage({ type: 'start', period: Number($('period').value), topN: Number($('topN').value) || 15, generate: hasKey });
});

copyBtn.addEventListener('click', async () => {
  const text = state.report || state.input;
  try { await navigator.clipboard.writeText(text); copyBtn.textContent = '✅ 已复制'; setTimeout(() => (copyBtn.textContent = state.report ? '📋 复制周报' : '📋 复制热点词（粘给 Claude）'), 2000); }
  catch { status.textContent = '复制失败，用下载的文件即可。'; }
});

dlReport.addEventListener('click', () => download('report.md', state.report, 'text/markdown'));
dlCsv.addEventListener('click', () => download('ideas.csv', state.csv, 'text/csv'));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') status.textContent = msg.text;
  else if (msg.type === 'done') showCollected(msg.md);
  else if (msg.type === 'reportDone') showReport(msg.report, msg.csv || '');
  else if (msg.type === 'genError') { showCollected(msg.md); status.textContent = '抓取成功，但出报告失败：' + msg.text + '\n（可检查 API key / 余额；数据已复制可粘给 Claude）'; }
  else if (msg.type === 'error') { go.disabled = false; go.textContent = '重试'; status.textContent = '出错了：' + msg.text; }
});
