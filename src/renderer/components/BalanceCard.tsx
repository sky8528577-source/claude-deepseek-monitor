import { useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function BalanceCard() {
  const { balance, previousBalance, flashMonth, proMonth } = useStore();

  const trend = useMemo(() => {
    if (!balance || !previousBalance) return null;
    const diff = balance.total_balance - previousBalance.total_balance;
    if (Math.abs(diff) < 0.001) return 'flat';
    return diff > 0 ? 'up' : 'down';
  }, [balance, previousBalance]);

  const balanceDiff = useMemo(() => {
    if (!balance || !previousBalance) return 0;
    return balance.total_balance - previousBalance.total_balance;
  }, [balance, previousBalance]);

  const totalMonth = flashMonth.cost + proMonth.cost;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold">财务概览</h2>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">账户余额</span>
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-success" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-danger" />}
          {trend === 'flat' && <Minus className="w-3 h-3 text-slate-500" />}
        </div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-2xl font-bold text-white">
            {balance ? `¥${balance.total_balance.toFixed(2)}` : '---'}
          </span>
          {trend && balanceDiff !== 0 && (
            <span className={`text-xs ${balanceDiff > 0 ? 'text-success' : 'text-danger'}`}>
              {balanceDiff > 0 ? '+' : ''}{balanceDiff.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex gap-4 mt-1 text-xs text-slate-500">
          <span>充值: ¥{balance?.topped_up_balance?.toFixed(2) || '---'}</span>
          <span>赠送: ¥{balance?.granted_balance?.toFixed(2) || '---'}</span>
        </div>
      </div>

      <div>
        <span className="text-xs text-slate-400">本月消费</span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold text-accent">¥{totalMonth.toFixed(4)}</span>
        </div>
        <div className="flex gap-4 mt-1 text-xs">
          <span className="text-flash">Flash: ¥{flashMonth.cost.toFixed(4)}</span>
          <span className="text-pro">Pro: ¥{proMonth.cost.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}
