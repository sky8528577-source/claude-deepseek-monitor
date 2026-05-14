import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (u: unknown) => ipcRenderer.invoke('update-config', u),
  setApiKey: (k: string) => ipcRenderer.invoke('set-api-key', k),

  getBalance: () => ipcRenderer.invoke('get-balance'),
  fetchBalance: () => ipcRenderer.invoke('fetch-balance'),

  getRecentCalls: (limit?: number) => ipcRenderer.invoke('get-recent-calls', limit),
  getTodayStats: () => ipcRenderer.invoke('get-today-stats'),
  getMonthStats: () => ipcRenderer.invoke('get-month-stats'),
  getTodayModelStats: (m: string) => ipcRenderer.invoke('get-today-model-stats', m),
  getMonthModelStats: (m: string) => ipcRenderer.invoke('get-month-model-stats', m),
  getDailySummaries: (d: number) => ipcRenderer.invoke('get-daily-summaries', d),

  exportData: (f: 'csv' | 'json', s?: string, e?: string) => ipcRenderer.invoke('export-data', f, s, e),
  cleanupRecords: (d: number) => ipcRenderer.invoke('cleanup-records', d),

  csvFetch: () => ipcRenderer.invoke('csv-fetch'),
  csvSetCookie: (c: string) => ipcRenderer.invoke('csv-set-cookie', c),
  csvLastFetch: () => ipcRenderer.invoke('csv-last-fetch'),
  csvLogin: () => ipcRenderer.invoke('csv-login'),

  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  toggleMiniMode: () => ipcRenderer.invoke('toggle-mini-mode'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  findCCDir: () => ipcRenderer.invoke('find-cc-dir'),
  setCCDir: (dir: string) => ipcRenderer.invoke('set-cc-dir', dir),
  onDataUpdated: (cb: () => void) => {
    ipcRenderer.on('data-updated', () => cb());
    return () => { ipcRenderer.removeAllListeners('data-updated'); };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
