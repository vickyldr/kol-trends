const $ = (id) => document.getElementById(id);
const go = $('go'), copyBtn = $('copy'), status = $('status');
let result = '';

function showDone(md) {
  result = md;
  go.disabled = false;
  go.textContent = '重新抓取';
  copyBtn.style.display = 'block';
  const countries = (md.match(/^## /gm) || []).length;
  const tags = (md.match(/^\d+\.\s+#/gm) || []).length;
  status.textContent = `✅ 完成：${countries} 个国家，共 ${tags} 个热点词。\n点下面「复制」，去 Claude 粘贴说「出本周周报」。`;
}

// 进来先看有没有上次结果
chrome.storage.local.get(['lastResult', 'status'], (d) => {
  if (d.lastResult && d.status === 'done') showDone(d.lastResult);
});

go.addEventListener('click', () => {
  go.disabled = true;
  go.textContent = '抓取中…';
  copyBtn.style.display = 'none';
  status.textContent = '开始…（请勿关闭浏览器；后台标签页会自动切换各国）';
  const period = Number($('period').value);
  const topN = Number($('topN').value) || 15;
  chrome.runtime.sendMessage({ type: 'start', period, topN });
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(result);
    copyBtn.textContent = '✅ 已复制！去 Claude 粘贴';
    setTimeout(() => (copyBtn.textContent = '📋 复制到剪贴板'), 2500);
  } catch (e) {
    status.textContent = '复制失败，已自动下载 input-keywords.md，用那个文件即可。';
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') status.textContent = msg.text;
  else if (msg.type === 'done') showDone(msg.md);
  else if (msg.type === 'error') {
    go.disabled = false; go.textContent = '重试';
    status.textContent = '出错了：' + msg.text + '\n把这条发给 Claude 即可。';
  }
});
