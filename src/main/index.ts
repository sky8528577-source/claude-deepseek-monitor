import { app, BrowserWindow, Tray, Menu, nativeImage, Notification } from 'electron';
import path from 'path';
import { loadConfig } from './config';
import { initDatabase, getLatestBalance, runDailyAggregation } from './database';
import { startBalancePolling, stopBalancePolling } from './balance-poller';
import { startCSVAutoFetch, stopCSVAutoFetch, fetchCSVUsage } from './api-fetcher';
import { scanCCLogs } from './cc-log-parser';
import { setMainWindow, toggleMiniMode } from './mini-window';
import { startScheduler, stopScheduler } from './scheduler';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f0f1a',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTrayIcon() {
  // Create a 16x16 tray icon with a colored dot
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2, r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        canvas[i] = 59;     // R
        canvas[i + 1] = 130; // G
        canvas[i + 2] = 246; // B (blue)
        canvas[i + 3] = 255; // A
      } else if (dist <= r + 1) {
        canvas[i] = 30;
        canvas[i + 1] = 64;
        canvas[i + 2] = 175;
        canvas[i + 3] = 200;
      } else {
        canvas[i + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Claude-DeepSeek Monitor');
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  updateTrayMenu();
  setInterval(updateTrayMenu, 60_000);
}

function updateTrayMenu(): void {
  if (!tray) return;
  const balance = getLatestBalance();
  const { getMonthStats, getTodayStats } = require('./database');
  const month = getMonthStats();
  const today = getTodayStats();

  const balText = balance ? `¥${balance.total_balance.toFixed(2)}` : '---';
  const monthText = month.cost > 0 ? `¥${month.cost.toFixed(2)}` : '---';
  const todayText = today.cost > 0 ? `¥${today.cost.toFixed(4)}` : '---';

  tray.setToolTip(`余额 ${balText} | 本月 ${monthText} | 今日 ${todayText}`);

  const menu = Menu.buildFromTemplate([
    { label: `余额: ${balText}`, enabled: false },
    { label: `本月消费: ${monthText}`, enabled: false },
    { label: `今日费用: ${todayText}`, enabled: false },
    { type: 'separator' },
    { label: '显示主窗口', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: '切换迷你窗', click: () => { if (mainWindow) toggleMiniMode(); } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function checkBalanceThreshold(): void {
  const balance = getLatestBalance();
  if (balance && balance.total_balance < 10) {
    new Notification({
      title: 'DeepSeek Monitor',
      body: `Current balance: ${balance.total_balance.toFixed(2)}`,
    }).show();
  }
}

process.on('unhandledRejection', (err) => { console.error('Unhandled:', err); });

app.whenReady().then(async () => {
  loadConfig();
  initDatabase();
  registerIpcHandlers();

  startBalancePolling();
  startScheduler();

  // Load all data before opening window
  const ccCount = scanCCLogs(7);
  console.log('CC scan: ' + ccCount + ' records');
  fetchCSVUsage().catch(e => console.error('CSV fetch error:', e?.message || e));
  // Periodic CC re-scan for new requests (every 60s)
  setInterval(() => {
    const n = scanCCLogs(1);
    if (n > 0) console.log(`CC delta scan: ${n} new records`);
  }, 60_000);

  startCSVAutoFetch();

  createWindow();
  console.log('Window created, mainWindow=', !!mainWindow);
  if (mainWindow) setMainWindow(mainWindow);
  createTray();
  console.log('Tray created');
  setTimeout(checkBalanceThreshold, 5000);
  console.log('Startup complete');


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBalancePolling();
  stopCSVAutoFetch();
  stopScheduler();
});

app.commandLine.appendSwitch('no-sandbox');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
