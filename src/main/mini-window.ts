import { BrowserWindow, screen } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow) {
  mainWindow = win;
}

export function toggleMiniMode(): void {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  const ww = 700, wh = 58;
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close();
    miniWindow = null;
    mainWindow?.show();
    mainWindow?.focus();
    return;
  }

  const devUrl = 'http://127.0.0.1:5173';
  miniWindow = new BrowserWindow({
    width: ww,
    height: wh,
    x: sw - ww - 20,
    y: 20,
    frame: false,
    alwaysOnTop: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  miniWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: 'mini' });

  mainWindow?.hide();

  miniWindow.on('closed', () => {
    miniWindow = null;
    mainWindow?.show();
    mainWindow?.focus();
  });
}
