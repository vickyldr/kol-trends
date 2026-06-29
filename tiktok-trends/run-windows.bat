@echo off
chcp 65001 >nul
title Rythmix 热点抓取
cd /d "%~dp0\.."

echo ============================================
echo   Rythmix 每周热点抓取（本地）
echo ============================================
echo.

REM 1) 检查 Node
where node >nul 2>nul
if errorlevel 1 (
  echo [!] 你还没装 Node.js。
  echo     我帮你打开下载页，下载 LTS 版，一路下一步装好，再双击本文件。
  start https://nodejs.org/zh-cn/download
  pause
  exit /b
)

REM 2) 第一次准备环境（装浏览器驱动）
if not exist node_modules\playwright (
  echo [*] 第一次使用，正在准备环境，大概几分钟，请耐心等...
  call npm i playwright
  call npx playwright install chromium
  echo.
)

REM 3) 建本周文件夹
node tiktok-trends\scripts\new-week.mjs

REM 4) 抓榜（第一次会弹浏览器让你登录一次）
node tiktok-trends\scripts\scrape-creative-center.mjs
if errorlevel 1 (
  echo.
  echo [!] 抓取出错了。把上面的报错截图发给 Claude 即可。
  pause
  exit /b
)

echo.
echo ============================================
echo   完成！本周热点词已复制到剪贴板。
echo   去 Claude 对话框按 Ctrl+V 粘贴，说「出本周周报」。
echo ============================================
start "" "tiktok-trends\weeks"
pause
