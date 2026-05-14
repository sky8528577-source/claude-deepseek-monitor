import { useMemo } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line,
} from 'recharts';
import { useStore } from '../store/useStore';
import { TimeRange, DailySummary } from '../../shared/types';

const TIME_RANGES: { label: string; value: TimeRange; days: number }[] = [
  { label: '7天', value: '7d', days: 7 },
  { label: '30天', value: '30d', days: 30 },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <div className="text-slate-300 font-medium mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-400 w-10">{p.name}</span>
          <span className="text-white tabular-nums">{formatTokens(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function TokenChart() {
  const { dailySummaries, timeRange, setTimeRange } = useStore();

  const chartData = useMemo(() => {
    const dayCount = TIME_RANGES.find((r) => r.value === timeRange)?.days || 7;
    const map = new Map<string, DailySummary[]>();
    for (const s of dailySummaries) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    const result = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const items = map.get(key) || [];
      result.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        prompt: items.reduce((a, s) => a + s.total_prompt_tokens, 0),
        completion: items.reduce((a, s) => a + s.total_completion_tokens, 0),
      });
    }
    return result;
  }, [dailySummaries, timeRange]);

  return (
    <div className="h-full glass-card p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h2 className="text-sm font-semibold">Token 消耗</h2>
        <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={`px-3 py-1 rounded-md text-xs transition-all ${
                timeRange === r.value
                  ? 'bg-flash/30 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} dy={8} />
              <YAxis yAxisId="left" tick={{ fill: '#3b82f6', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatTokens} width={50} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#8b5cf6', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatTokens} width={50} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="rect" iconSize={8} />
              <Bar yAxisId="left" dataKey="prompt" name="输入" fill="#3b82f6" maxBarSize={36} radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" dataKey="completion" name="输出" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
