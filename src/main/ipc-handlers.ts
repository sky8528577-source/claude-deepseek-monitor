import { ipcMain, BrowserWindow, shell } from 'electron';
import { getConfig, updateConfig, setApiKey } from './config';
import {
  getLatestBalance, getPreviousBalance, getRecentCalls,
  getTodayStats, getMonthStats, getTodayModelStats, getMonthModelStats,
  getDailySummaries, getStatsForRange,
  exportData, runDailyAggregation, cleanupOldRecords,
} from './database';
import { fetchBalance } from './balance-poller';
import { fetchCSVUsage, setPlatformCookie, parseAndImport, getLastFetchInfo } from './api-fetcher';
import { toggleMiniMode } from './mini-window';

export function registerIpcHandlers(): void {
  ipcMain.handle('get-config', () => getConfig());
  ipcMain.handle('update-config', (_e, u) => updateConfig(u));
  ipcMain.handle('set-api-key', (_e, key: string) => { setApiKey(key); return true; });

  ipcMain.handle('get-balance', () => ({ latest: getLatestBalance(), previous: getPreviousBalance() }));
  ipcMain.handle('fetch-balance', () => fetchBalance());

  ipcMain.handle('get-recent-calls', (_e, limit?: number) => getRecentCalls(limit || 50));
  ipcMain.handle('get-today-stats', () => getTodayStats());
  ipcMain.handle('get-month-stats', () => getMonthStats());
  ipcMain.handle('get-today-model-stats', (_e, model: string) => getTodayModelStats(model));
  ipcMain.handle('get-month-model-stats', (_e, model: string) => getMonthModelStats(model));
  ipcMain.handle('get-stats-range', (_e, start: string, end: string) => getStatsForRange(start, end));
  ipcMain.handle('get-daily-summaries', (_e, days: number) => getDailySummaries(days || 30));

  ipcMain.handle('run-aggregation', () => { runDailyAggregation(); return true; });
  ipcMain.handle('export-data', (_e, format: 'csv' | 'json', startDate?: string, endDate?: string) =>
    exportData(format, startDate, endDate));
  ipcMain.handle('cleanup-records', (_e, days: number) => cleanupOldRecords(days || 90));

  ipcMain.handle('csv-fetch', () => fetchCSVUsage());
  ipcMain.handle('csv-set-cookie', (_e, cookie: string) => { setPlatformCookie(cookie); return true; });
  ipcMain.handle('csv-last-fetch', () => getLastFetchInfo());

  ipcMain.handle('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.isMaximized() ? win.unmaximize() : win?.maximize();
  });
  ipcMain.handle('window-close', () => BrowserWindow.getFocusedWindow()?.close());
  ipcMain.handle('window-is-maximized', () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false);
  ipcMain.handle('toggle-mini-mode', () => { toggleMiniMode(); });
  ipcMain.handle('open-external', (_e, url: string) => { shell.openExternal(url); });
  ipcMain.handle('set-cc-dir', (_e, dir: string) => {
    const config = getConfig();
    (config as unknown as Record<string, string>).cc_data_dir = dir;
    updateConfig(config);
    return true;
  });

  ipcMain.handle('find-cc-dir', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const home = os.homedir();
    const dir = path.join(home, '.claude', 'projects');
    try { if (fs.existsSync(dir)) return dir; } catch {}
    const dir2 = path.join(home, '.claude');
    try { if (fs.existsSync(dir2)) return dir2; } catch {}
    return null;
  });

  // Open login window - intercept downloaded CSV when user clicks Export
  ipcMain.handle('csv-login', async () => {
    return new Promise<string | null>((resolve) => {
      const loginWin = new BrowserWindow({
        width: 900,
        height: 700,
        title: '登录 DeepSeek 平台',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      let resolved = false;
      const logs: string[] = [];
      const logTimer = setInterval(() => { if (logs.length > 0) console.log(logs.join('\n')); logs.length = 0; }, 3000);

      // Intercept downloads
      loginWin.webContents.session.on('will-download', (_event, item) => {
        const filename = item.getFilename();
        console.log(`[CSV Login] DOWNLOAD: ${filename}`);

        // Save to temp dir
        const tmpPath = require('path').join(require('os').tmpdir(), filename);
        item.setSavePath(tmpPath);

        item.on('done', async (_e, state) => {
          if (state !== 'completed') return;
          try {
            const fs = require('fs');
            const buf = fs.readFileSync(tmpPath);
            console.log(`[CSV Login] Read ${buf.length} bytes from ${filename}`);

            // Parse and import
            let csvText = '';
            try {
              const AdmZip = require('adm-zip');
              const zip = new AdmZip(buf);
              for (const entry of zip.getEntries()) {
                if (entry.entryName.endsWith('.csv') && !entry.entryName.includes('amount')) {
                  csvText = entry.getData().toString('utf8');
                  break;
                }
              }
              if (!csvText) {
                // Fallback to any CSV
                for (const entry of zip.getEntries()) {
                  if (entry.entryName.endsWith('.csv')) {
                    const text = entry.getData().toString('utf8');
                    if (text.length > csvText.length) csvText = text;
                  }
                }
              }
            } catch {
              csvText = buf.toString('utf8');
            }

            if (csvText && csvText.includes(',')) {
              const lines = csvText.trim().split('\n');
              console.log(`[CSV Login] CSV: ${lines.length} lines, header: ${lines[0]?.substring(0, 100)}`);

              // Import via main process
              const imported = parseAndImport(csvText);
              console.log(`[CSV Login] Imported ${imported} records`);

              // Also save session cookies for auto-fetch
              const cookies = await loginWin.webContents.session.cookies.get({ url: 'https://platform.deepseek.com' });
              if (cookies.length > 0) {
                const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
                setPlatformCookie(cookieStr);
              }

              if (imported > 0 && !resolved) {
                resolved = true;
                clearInterval(logTimer);
                if (!loginWin.isDestroyed()) loginWin.close();
                resolve('imported');
              }
            }
          } catch (e) {
            console.log(`[CSV Login] Import error:`, e);
          }
        });
      });

      // Capture real API URLs and headers
      let capturedToken = '';

      loginWin.webContents.session.webRequest.onBeforeSendHeaders(
        { urls: ['https://platform.deepseek.com/api/*'] },
        (details, callback) => {
          const auth = details.requestHeaders['authorization'] || details.requestHeaders['Authorization'];
          if (auth && auth.startsWith('Bearer ') && !capturedToken) {
            capturedToken = auth;
            console.log(`[CSV Login] Captured token: ${auth.substring(0, 50)}...`);
            // Save token immediately
            setPlatformCookie(capturedToken);
          }
          callback({ requestHeaders: details.requestHeaders });
        }
      );

      // Also log XHR/fetch for debugging
      loginWin.webContents.on('did-finish-load', async () => {
        try {
          await loginWin.webContents.executeJavaScript(`
            window.__ds = [];
            const _f = window.fetch; window.fetch = function(...a){ window.__ds.push('F '+a[0]); return _f.apply(this,a) };
            const _x = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(m,u){ window.__ds.push('X '+u); return _x.apply(this,arguments) };
          `);
        } catch {}
        // Log any captured URLs
        try {
          const urls = await loginWin.webContents.executeJavaScript('JSON.stringify(window.__ds||[])');
          if (urls && urls.length > 2) logs.push(`[CSV Login] API calls: ${urls}`);
        } catch {}
      });

      loginWin.on('close', () => {
        clearInterval(logTimer);
        if (!resolved) resolve(null);
      });
      loginWin.loadURL('https://platform.deepseek.com/usage');

      setTimeout(() => {
        if (!resolved) { resolved = true; clearInterval(logTimer); if (!loginWin.isDestroyed()) loginWin.close(); resolve(null); }
      }, 300000);
    });
  });
}
