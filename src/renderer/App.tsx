import { useEffect } from 'react';
import { useStore } from './store/useStore';
import Header from './components/Header';
import BalanceCard from './components/BalanceCard';
import FlashCard from './components/FlashCard';
import ProCard from './components/ProCard';
import KeyMetrics from './components/KeyMetrics';
import TokenChart from './components/TokenChart';
import RequestLog from './components/RequestLog';
import SetupWizard from './components/SetupWizard';
import MiniWidget from './components/MiniWidget';
import StatusBar from './components/StatusBar';
import { DailyStats, ApiCall, BalanceSnapshot, DailySummary } from '../shared/types';

declare global {
  interface Window {
    electronAPI?: {
      getConfig: () => Promise<{ balance: { api_key: string } }>;
      getBalance: () => Promise<{ latest: BalanceSnapshot | null; previous: BalanceSnapshot | null }>;
      getRecentCalls: (limit?: number) => Promise<ApiCall[]>;
      getTodayStats: () => Promise<DailyStats>;
      getMonthStats: () => Promise<DailyStats>;
      getTodayModelStats: (model: string) => Promise<DailyStats>;
      getMonthModelStats: (model: string) => Promise<DailyStats>;
      getDailySummaries: (days: number) => Promise<DailySummary[]>;
      fetchBalance: () => Promise<BalanceSnapshot | null>;
      setApiKey: (key: string) => Promise<boolean>;
      csvFetch: () => Promise<number>;
      csvSetCookie: (cookie: string) => Promise<boolean>;
      csvLogin: () => Promise<string | null>;
      csvLastFetch: () => Promise<{ time: string; count: number }>;
      exportData: (format: 'csv' | 'json', startDate?: string, endDate?: string) => Promise<string>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      toggleMiniMode: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      findCCDir: () => Promise<string | null>;
      setCCDir: (dir: string) => Promise<boolean>;
      csvLastFetch: () => Promise<{ time: string; count: number }>;
      onDataUpdated: (cb: () => void) => () => void;
      cleanupRecords: (days: number) => Promise<number>;
    };
  }
}

export default function App() {
  const {
    hasApiKey, setHasApiKey,
    setBalance, setRecentCalls,
    setTodayStats, setMonthStats,
    setFlashToday, setFlashMonth, setProToday, setProMonth,
    setDailySummaries,
  } = useStore();

  useEffect(() => {
    const reload = async () => {
      const api = window.electronAPI;
      if (!api) return;

      const config = await api.getConfig();
      if (config?.balance?.api_key) setHasApiKey(true);

      const b = await api.getBalance();
      if (b?.latest) setBalance(b.latest, b.previous || null);

      const calls = await api.getRecentCalls(50);
      if (calls) setRecentCalls(calls);
      // Warn if no CC logs found (request stream will be empty) - only once
      if (calls && calls.length === 0 && !useStore.getState().warning) {
        useStore.getState().setWarning(
          '实时请求流需要 Claude Code 本地日志。若已安装 CC 并使用 DeepSeek，数据会自动出现。未安装？访问 https://docs.anthropic.com 获取。费用和 Token 统计不受影响。'
        );
      }

      setTodayStats(await api.getTodayStats());
      setMonthStats(await api.getMonthStats());
      setFlashToday(await api.getTodayModelStats('deepseek-chat'));
      setFlashMonth(await api.getMonthModelStats('deepseek-chat'));
      setProToday(await api.getTodayModelStats('deepseek-reasoner'));
      setProMonth(await api.getMonthModelStats('deepseek-reasoner'));
      setDailySummaries(await api.getDailySummaries(30));

      // Check CSV fetch status
      const fetchInfo = await api.csvLastFetch().catch(() => null);
      if (fetchInfo) {
        const { setError, setWarning } = useStore.getState();
        if (fetchInfo.count === -1) {
          setWarning('CSV 数据源未配置 — 请点击一键登录获取 Token');
        } else if (fetchInfo.count === 0 && Date.now() - new Date(fetchInfo.time).getTime() > 120000) {
          setWarning('CSV 数据拉取失败 — Token 可能已过期，请重新登录');
        } else {
          setWarning(null);
          setError(null);
        }
      }
    };

    reload();
    if (window.location.hash !== '#mini') {
      setTimeout(reload, 5000);
      setTimeout(reload, 12000);
    }
    const timer = setInterval(reload, 60_000);
    const unsub = window.electronAPI?.onDataUpdated?.(() => reload());
    return () => { clearInterval(timer); unsub?.(); };
  }, []);

  if (window.location.hash === '#mini') {
    document.body.style.setProperty('background', 'transparent', 'important');
    return (
      <div className="h-screen flex items-center justify-center overflow-hidden" style={{ background: 'transparent' }}>
        <MiniWidget />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-slate-200 overflow-hidden">
      <Header />
      <StatusBar />
      {!hasApiKey ? (
        <SetupWizard />
      ) : (
        <main className="flex-1 grid grid-cols-[400px_1fr] gap-4 p-4 min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 overflow-y-auto pr-0.5">
            <BalanceCard />
            <FlashCard />
            <ProCard />
          </div>
          <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
            <KeyMetrics />
            <div className="flex-1 min-h-0"><TokenChart /></div>
            <div className="h-[300px] flex-shrink-0"><RequestLog /></div>
          </div>
        </main>
      )}
    </div>
  );
}
