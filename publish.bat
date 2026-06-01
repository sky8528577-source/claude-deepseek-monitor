@echo off
cd /d "C:\Users\95454\Desktop\deepseek用量显示"
set PATH=C:\Users\95454\.workbuddy\binaries\node\versions\node-v22.14.0-win-x64;%PATH%
set PATH=C:\Program Files\Git\bin;%PATH%

echo [1/3] Commit and push code...
git add -A
git commit -m "fix: use 1st of current month to fix cross-month API data fetch"
git push

echo [2/3] Build renderer...
call npx vite build
call npx tsc -p tsconfig.node.json

echo [3/3] Package exe installer (needs admin)...
call npx electron-builder --win nsis

echo.
echo Done! Installer at: release\Claude-DeepSeek Monitor Setup 1.0.0.exe
echo Upload it to: https://github.com/sky8528577-source/claude-deepseek-monitor/releases/edit/v1.0
pause
