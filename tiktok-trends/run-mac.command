#!/bin/bash
# Mac 用户：双击本文件即可（第一次可能要在"系统设置 > 隐私与安全性"里允许运行）。
cd "$(dirname "$0")/.." || exit 1

echo "============================================"
echo "  Rythmix 每周热点抓取（本地）"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] 你还没装 Node.js。我帮你打开下载页，装好 LTS 版再双击本文件。"
  open "https://nodejs.org/zh-cn/download"
  read -r -p "按回车退出 "; exit 1
fi

if [ ! -d node_modules/playwright ]; then
  echo "[*] 第一次使用，正在准备环境，几分钟，请耐心等..."
  npm i playwright
  npx playwright install chromium
  echo
fi

node tiktok-trends/scripts/new-week.mjs
node tiktok-trends/scripts/scrape-creative-center.mjs || { echo "[!] 抓取出错，把报错发给 Claude"; read -r -p "回车退出 "; exit 1; }

echo
echo "完成！本周词已复制到剪贴板。去 Claude 按 Cmd+V 粘贴，说「出本周周报」。"
open "tiktok-trends/weeks"
read -r -p "按回车退出 "
