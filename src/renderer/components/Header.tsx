import { useState, useCallback, useEffect } from 'react';
import { Zap, RefreshCw, Download, Settings, Minus, Square, X, CloudDownload, PanelBottom } from 'lucide-react';
import { useStore } from '../store/useStore';
import SettingsModal from './SettingsModal';

export default function Header() {
  const { setRecentCalls, setTodayStats, setMonthStats, setFlashToday, setFlashMonth, setProToday, setProMonth } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const reloadAllStats = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setRecentCalls(await api.getRecentCalls(50));
    setTodayStats(await api.getTodayStats());
    setMonthStats(await api.getMonthStats());
    setFlashToday(await api.getTodayModelStats('deepseek-chat'));
    setFlashMonth(await api.getMonthModelStats('deepseek-chat'));
    setProToday(await api.getTodayModelStats('deepseek-reasoner'));
    setProMonth(await api.getMonthModelStats('deepseek-reasoner'));
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const info = await window.electronAPI?.csvLastFetch();
        if (info?.time) {
          const d = new Date(info.time);
          setLastSync(`${d.toLocaleDateString('zh-CN')} ${d.toLocaleTimeString('zh-CN')}`);
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      if (window.electronAPI) {
        const count = await window.electronAPI.csvFetch();
        await window.electronAPI.fetchBalance();
        await reloadAllStats();
        const now = new Date();
        setLastSync(`${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString('zh-CN')}`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    if (!window.electronAPI) return;
    const data = await window.electronAPI.exportData(format);
    const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `deepseek-usage.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  return (
    <header className="h-12 flex items-center justify-between pl-4 border-b border-white/5 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-3">
        <Zap className="w-5 h-5 text-flash" />
        <h1 className="text-sm font-semibold tracking-wide">Claude-DeepSeek Monitor</h1>
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={async () => { await window.electronAPI?.fetchBalance(); const b = await window.electronAPI?.getBalance(); if (b?.latest) useStore.getState().setBalance(b.latest, b.previous); }} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="刷新余额">
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>

        <div className="flex items-center gap-1">
          <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50" title="数据同步">
            <CloudDownload className={`w-4 h-4 text-green-400 ${syncing ? 'animate-spin' : ''}`} />
            <span className="text-xs text-green-400">{syncing ? '拉取中' : '数据同步'}</span>
          </button>
          {lastSync && (
            <span className="text-[10px] text-slate-600 whitespace-nowrap">{lastSync}</span>
          )}
        </div>

        <div className="relative group">
          <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="导出数据">
            <Download className="w-4 h-4 text-slate-400" />
          </button>
          <div className="absolute right-0 top-full mt-1 py-1 w-28 glass-card opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <button onClick={() => handleExport('csv')} className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 transition-colors">导出 CSV</button>
            <button onClick={() => handleExport('json')} className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 transition-colors">导出 JSON</button>
          </div>
        </div>

        <button onClick={() => window.electronAPI?.toggleMiniMode()} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="迷你模式">
          <PanelBottom className="w-4 h-4 text-slate-400" />
        </button>

        <button onClick={() => setSettingsOpen(true)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="设置">
          <Settings className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="flex items-stretch h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={() => window.electronAPI?.minimizeWindow()} className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors"><Minus className="w-3.5 h-3.5 text-slate-400" /></button>
        <button onClick={() => window.electronAPI?.maximizeWindow()} className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors"><Square className="w-3 h-3 text-slate-400" /></button>
        <button onClick={() => window.electronAPI?.closeWindow()} className="w-10 h-full flex items-center justify-center hover:bg-danger/20 transition-colors"><X className="w-4 h-4 text-slate-400 hover:text-danger" /></button>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
