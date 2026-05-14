import { Activity, Hash, Coins } from 'lucide-react';
import { useStore } from '../store/useStore';

function formatBigNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (n >= 100) return `¥${n.toFixed(0)}`;
  if (n >= 1) return `¥${n.toFixed(2)}`;
  if (n >= 0.01) return `¥${n.toFixed(4)}`;
  return `¥${n.toFixed(6)}`;
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  todayValue: string;
  monthValue: string;
}

function MetricRow({ icon, label, todayValue, monthValue }: MetricRowProps) {
  return (
    <div className="flex-1 glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">今日</span>
          <span className="text-2xl font-bold text-white tabular-nums leading-none">
            {todayValue}
          </span>
        </div>
        <div className="h-8 w-px bg-white/5" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">本月</span>
          <span className="text-lg text-slate-400 tabular-nums leading-none">
            {monthValue}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function KeyMetrics() {
  const { todayStats, monthStats } = useStore();

  return (
    <div className="flex gap-3">
      <MetricRow
        icon={<Activity className="w-4 h-4 text-flash" />}
        label="API 请求次数"
        todayValue={formatBigNum(todayStats.requests)}
        monthValue={formatBigNum(monthStats.requests)}
      />
      <MetricRow
        icon={<Hash className="w-4 h-4 text-pro" />}
        label="Total Tokens"
        todayValue={formatBigNum(todayStats.totalTokens)}
        monthValue={formatBigNum(monthStats.totalTokens)}
      />
      <MetricRow
        icon={<Coins className="w-4 h-4 text-accent" />}
        label="费用"
        todayValue={formatCost(todayStats.cost)}
        monthValue={formatCost(monthStats.cost)}
      />
    </div>
  );
}
