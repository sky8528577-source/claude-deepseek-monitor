import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ApiCall } from '../../shared/types';

export default function RequestLog() {
  const { recentCalls } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const displayCalls = useMemo(() => {
    let filtered = recentCalls.slice(0, 50);
    if (modelFilter !== 'all') {
      filtered = filtered.filter((c) => c.model === modelFilter);
    }
    if (filter) {
      const lower = filter.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.model.toLowerCase().includes(lower) ||
          String(c.cost_cny).includes(lower) ||
          String(c.total_tokens).includes(lower)
      );
    }
    return filtered;
  }, [recentCalls, modelFilter, filter]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [displayCalls.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop } = scrollRef.current;
    setAutoScroll(scrollTop < 20);
  };

  return (
    <div className="h-full glass-card flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <h2 className="text-sm font-semibold">实时请求日志</h2>
        <div className="flex items-center gap-2">
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-slate-400 outline-none"
          >
            <option value="all">全部模型</option>
            <option value="deepseek-chat">Flash</option>
            <option value="deepseek-reasoner">Pro</option>
          </select>
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索..."
              className="w-32 pl-6 pr-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-slate-300 outline-none focus:border-white/20"
            />
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pb-3 min-h-0"
      >
        {displayCalls.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-slate-600">
            等待 API 请求...
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Header */}
            <div className="flex items-center text-xs text-slate-500 py-1 border-b border-white/5 sticky top-0 bg-bg/95 backdrop-blur">
              <span className="w-20 flex-shrink-0">时间</span>
              <span className="w-16 flex-shrink-0">模型</span>
              <span className="w-28 flex-shrink-0 text-right">Tokens</span>
              <span className="w-28 flex-shrink-0 text-right">缓存命中</span>
              <span className="w-12 flex-shrink-0 text-center">状态</span>
              <span className="w-4" />
            </div>

            {displayCalls.map((call, i) => (
              <LogRow
                key={call.id || i}
                call={call}
                isExpanded={expandedId === call.id}
                onToggle={() => setExpandedId(expandedId === call.id ? null : call.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({
  call,
  isExpanded,
  onToggle,
}: {
  call: ApiCall;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isFlash = call.model === 'deepseek-chat';
  const modelLabel = isFlash ? 'Flash' : call.model === 'deepseek-reasoner' ? 'Pro' : call.model;
  const modelColor = isFlash ? 'text-flash' : 'text-pro';

  return (
    <>
      <div
        className={`flex items-center text-xs py-1 rounded cursor-pointer transition-colors hover:bg-white/[0.02] ${
          isExpanded ? 'bg-white/[0.03]' : ''
        }`}
        onClick={onToggle}
      >
        <span className="w-20 flex-shrink-0 text-slate-500">
          {new Date(call.timestamp).toLocaleTimeString('zh-CN')}
        </span>
        <span className={`w-16 flex-shrink-0 ${modelColor}`}>{modelLabel}</span>
        <span className="w-28 flex-shrink-0 text-right text-slate-300 tabular-nums">
          {call.total_tokens >= 1000
            ? `${(call.total_tokens / 1000).toFixed(1)}K`
            : call.total_tokens.toLocaleString()}
        </span>
        <span className="w-28 flex-shrink-0 text-right text-emerald-400 tabular-nums">
          {call.cache_hit_tokens > 0
            ? `${((call.cache_hit_tokens / call.prompt_tokens) * 100).toFixed(1)}% (${call.cache_hit_tokens >= 1000 ? (call.cache_hit_tokens / 1000).toFixed(1) + 'K' : call.cache_hit_tokens})`
            : '-'}
        </span>
        <span className="w-12 flex-shrink-0 text-center">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              call.status === 'success' ? 'bg-success' : 'bg-danger'
            }`}
          />
        </span>
        <span className="w-4 flex-shrink-0 text-slate-600">
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </div>

      {isExpanded && (
        <div className="ml-4 mb-1 p-2 bg-white/[0.02] rounded text-xs text-slate-500 space-y-0.5">
          <div className="flex gap-4">
            <span>Prompt: {call.prompt_tokens.toLocaleString()}</span>
            <span>Completion: {call.completion_tokens.toLocaleString()}</span>
            <span>Cache Hit: {call.cache_hit_tokens.toLocaleString()}</span>
            <span>Cache Miss: {call.cache_miss_tokens.toLocaleString()}</span>
          </div>
          {call.error_message && (
            <div className="text-danger">Error: {call.error_message}</div>
          )}
        </div>
      )}
    </>
  );
}
