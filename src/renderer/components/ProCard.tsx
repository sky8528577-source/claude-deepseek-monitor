import { useMemo } from 'react';
import { Brain, ArrowDown, ArrowUp } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function ProCard() {
  const { proToday, proMonth, recentCalls, monthStats, sessionStart } = useStore();

  const proStream = useMemo(
    () => recentCalls.filter((c) => c.model === 'deepseek-reasoner' && c.source !== 'csv-import' && c.timestamp > sessionStart).slice(0, 5),
    [recentCalls, sessionStart]
  );

  const cacheRate = useMemo(() => {
    const totalPrompt = proMonth.promptTokens;
    if (totalPrompt <= 0) return 0;
    return (proMonth.cacheHitTokens / totalPrompt) * 100;
  }, [proMonth]);

  const cacheMissToday = proToday.promptTokens - proToday.cacheHitTokens;
  const cacheMissMonth = proMonth.promptTokens - proMonth.cacheHitTokens;

  const efficiency = useMemo(() => {
    if (proMonth.cost <= 0) return 0;
    return proMonth.totalTokens / proMonth.cost;
  }, [proMonth]);

  const totalPercent = useMemo(() => {
    if (monthStats.cost <= 0) return 0;
    return (proMonth.cost / monthStats.cost) * 100;
  }, [proMonth.cost, monthStats.cost]);

  return (
    <div className="glass-card p-4 border-l-2 border-pro">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-pro" />
        <h2 className="text-sm font-semibold">V4 Pro</h2>
        <span className="text-xs text-slate-500 ml-auto">deepseek-reasoner</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <span className="text-xs text-slate-500">今日 Tokens</span>
          <p className="text-lg font-bold text-white">{proToday.totalTokens.toLocaleString()}</p>
          <span className="text-xs text-slate-600">{proMonth.totalTokens.toLocaleString()} 本月</span>
        </div>
        <div>
          <span className="text-xs text-slate-500">今日费用</span>
          <p className="text-lg font-bold text-pro">¥{proToday.cost.toFixed(6)}</p>
          <span className="text-xs text-slate-600">¥{proMonth.cost.toFixed(4)} 本月</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">今日缓存</span>
          <span className="text-white">命中 {proToday.cacheHitTokens.toLocaleString()} / 未命中 {cacheMissToday.toLocaleString()}</span>
        </div>
        <div className="space-y-1 mb-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">缓存命中率</span>
            <span className="text-emerald-400">{cacheRate.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(cacheRate, 100)}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">吞吐量</span>
          <span className="text-white">
            {efficiency > 0 ? `${(efficiency / 1000).toFixed(0)}K tokens/¥` : '---'}
          </span>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">占总消耗</span>
            <span className="text-pro">{totalPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-pro rounded-full transition-all duration-500"
              style={{ width: `${Math.min(totalPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div>
        <span className="text-xs text-slate-500">实时请求流</span>
        <div className="mt-1 space-y-1 max-h-[100px] overflow-y-auto">
          {proStream.length === 0 ? (
            <div className="flex items-center text-xs py-0.5 gap-2 text-slate-600">
              <span className="w-14 flex-shrink-0 text-right">--:--:--</span>
              <span className="w-20 flex-shrink-0 text-right">-</span>
              <span className="flex-1">等待新请求...</span>
              <span className="w-12 flex-shrink-0 text-right">-</span>
            </div>
          ) : (
            proStream.map((call, i) => (
              <div key={`${call.id}-${i}`} className="flex items-center text-xs py-0.5 gap-2">
                <span className="w-14 text-slate-500 flex-shrink-0 text-right tabular-nums">
                  {new Date(call.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="w-20 text-slate-400 flex-shrink-0 text-right tabular-nums">{call.total_tokens.toLocaleString()}</span>
                <span className="flex-1 text-slate-500">
                  <ArrowDown className="w-3 h-3 inline text-blue-400" />{call.prompt_tokens.toLocaleString()} <ArrowUp className="w-3 h-3 inline text-purple-400" />{call.completion_tokens.toLocaleString()}
                </span>
                <span className="w-12 text-emerald-500 flex-shrink-0 text-right tabular-nums">
                  {call.cache_hit_tokens > 0 ? `${((call.cache_hit_tokens / call.prompt_tokens) * 100).toFixed(1)}%` : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
