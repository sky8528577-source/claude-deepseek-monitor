import { create } from 'zustand';
import { ApiCall, BalanceSnapshot, DailySummary, DailyStats, TimeRange } from '../../shared/types';

const emptyStats = (): DailyStats => ({
  requests: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, totalTokens: 0, cost: 0,
});

function isFlash(model: string) { return model === 'deepseek-chat'; }

interface AppState {
  balance: BalanceSnapshot | null;
  previousBalance: BalanceSnapshot | null;
  setBalance: (current: BalanceSnapshot | null, previous?: BalanceSnapshot | null) => void;

  recentCalls: ApiCall[];
  setRecentCalls: (calls: ApiCall[]) => void;

  todayStats: DailyStats;
  setTodayStats: (s: DailyStats) => void;
  monthStats: DailyStats;
  setMonthStats: (s: DailyStats) => void;

  flashToday: DailyStats;
  flashMonth: DailyStats;
  proToday: DailyStats;
  proMonth: DailyStats;
  setFlashToday: (s: DailyStats) => void;
  setFlashMonth: (s: DailyStats) => void;
  setProToday: (s: DailyStats) => void;
  setProMonth: (s: DailyStats) => void;

  dailySummaries: DailySummary[];
  setDailySummaries: (s: DailySummary[]) => void;

  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;

  hasApiKey: boolean;
  setHasApiKey: (v: boolean) => void;

  sessionStart: string;

  error: string | null;
  setError: (e: string | null) => void;
  warning: string | null;
  setWarning: (w: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  sessionStart: new Date().toISOString(),

  error: null,
  setError: (e) => set({ error: e }),
  warning: null,
  setWarning: (w) => set({ warning: w }),
  balance: null,
  previousBalance: null,
  setBalance: (current, previous) =>
    set((state) => ({ balance: current, previousBalance: previous ?? state.balance })),

  recentCalls: [],
  setRecentCalls: (calls) => set({ recentCalls: calls }),

  todayStats: emptyStats(),
  setTodayStats: (s) => set({ todayStats: s }),
  monthStats: emptyStats(),
  setMonthStats: (s) => set({ monthStats: s }),

  flashToday: emptyStats(),
  flashMonth: emptyStats(),
  proToday: emptyStats(),
  proMonth: emptyStats(),
  setFlashToday: (s) => set({ flashToday: s }),
  setFlashMonth: (s) => set({ flashMonth: s }),
  setProToday: (s) => set({ proToday: s }),
  setProMonth: (s) => set({ proMonth: s }),

  dailySummaries: [],
  setDailySummaries: (s) => set({ dailySummaries: s }),

  timeRange: '7d',
  setTimeRange: (r) => set({ timeRange: r }),

  hasApiKey: false,
  setHasApiKey: (v) => set({ hasApiKey: v }),
}));
