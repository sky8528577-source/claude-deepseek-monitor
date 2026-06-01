@echo off
cd /d "%~dp0"
set "PATH=C:\Users\95454\.workbuddy\binaries\node\versions\node-v22.14.0-win-x64;%PATH%"
set "PATH=C:\Program Files\Git\bin;%PATH%"

echo [1/3] Push code...
git add -A
git commit -m "v1.1.0: fix cross-month API data fetch"
git push

echo [2/3] Build...
call npx.cmd tsc -p tsconfig.node.json
call npx.cmd vite build

echo [3/3] Package installer (needs admin)...
call npx.cmd electron-builder --win nsis

echo.
echo Done! Upload: release\Claude-DeepSeek Monitor Setup 1.1.0.exe
echo Release page: https://github.com/sky8528577-source/claude-deepseek-monitor/releases/new
pause
