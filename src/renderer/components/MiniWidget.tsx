import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { ArrowUp, ArrowDown, Minus, X, Maximize, Zap, Brain } from 'lucide-react';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function MiniWidget() {
  const { balance, previousBalance, flashMonth, proMonth, flashToday, proToday, todayStats } = useStore();

  const balanceTrend = useMemo(() => {
    if (!balance || !previousBalance) return 'flat';
    const diff = balance.total_balance - previousBalance.total_balance;
    if (Math.abs(diff) < 0.001) return 'flat';
    return diff > 0 ? 'up' : 'down';
  }, [balance, previousBalance]);

  const monthTotal = flashMonth.cost + proMonth.cost;
  const todayTotal = flashToday.cost + proToday.cost;
  const hasFlash = flashToday.totalTokens > 0;
  const hasPro = proToday.totalTokens > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl select-none"
         style={{
           WebkitAppRegion: 'drag',
           background: 'rgba(22, 22, 42, 0.94)',
           border: '1px solid rgba(255,255,255,0.08)',
         } as React.CSSProperties}>

      {/* Balance */}
      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[10px] text-slate-500">余额</span>
        <span className="text-sm font-bold text-white tabular-nums">
          ¥{balance?.total_balance?.toFixed(2) || '---'}
        </span>
        {balanceTrend === 'up' && <ArrowUp className="w-3 h-3 text-green-400" />}
        {balanceTrend === 'down' && <ArrowDown className="w-3 h-3 text-red-400" />}
        {balanceTrend === 'flat' && <Minus className="w-3 h-3 text-slate-500" />}
      </div>

      <span className="w-px h-5 bg-white/8" />

      {/* Today */}
      <div className="flex flex-col items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[10px] text-slate-500">今日</span>
        <span className="text-sm font-bold text-flash tabular-nums">¥{todayTotal.toFixed(2)}</span>
      </div>

      {/* Month */}
      <div className="flex flex-col items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[10px] text-slate-500">本月</span>
        <span className="text-sm font-bold text-accent tabular-nums">¥{monthTotal.toFixed(2)}</span>
      </div>

      <span className="w-px h-5 bg-white/8" />

      {/* Pro Stats */}
      {hasPro && (
        <>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">今日Pro</span>
              <Brain className="w-2.5 h-2.5 text-pro" />
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-pro font-bold tabular-nums">{fmtTokens(proToday.totalTokens)}</span>
              {proMonth.promptTokens > 0 && (
                <span className="text-[10px] text-emerald-400">
                  命中{((proMonth.cacheHitTokens / proMonth.promptTokens) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <span className="w-px h-5 bg-white/8" />
        </>
      )}

      {/* Flash Stats */}
      {hasFlash && (
        <>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">今日Flash</span>
              <Zap className="w-2.5 h-2.5 text-flash" />
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-flash font-bold tabular-nums">{fmtTokens(flashToday.totalTokens)}</span>
              {flashMonth.promptTokens > 0 && (
                <span className="text-[10px] text-emerald-400">
                  命中{((flashMonth.cacheHitTokens / flashMonth.promptTokens) * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <span className="w-px h-5 bg-white/8" />
        </>
      )}

      {/* Requests */}
      <div className="flex flex-col items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <span className="text-[10px] text-slate-500">请求</span>
        <span className="text-sm font-bold text-slate-300 tabular-nums">{todayStats.requests}</span>
      </div>

      <span className="w-px h-5 bg-white/8" />

      {/* Controls */}
      <button onClick={() => window.electronAPI?.toggleMiniMode()} className="p-1 hover:bg-white/5 rounded transition-colors" title="还原主窗口" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Maximize className="w-3.5 h-3.5 text-slate-500" />
      </button>
      <button onClick={() => window.electronAPI?.closeWindow()} className="p-1 hover:bg-white/5 rounded transition-colors" title="关闭" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <X className="w-3.5 h-3.5 text-slate-500" />
      </button>
    </div>
  );
}
