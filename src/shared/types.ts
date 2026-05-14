export interface ApiCall {
  id: number;
  timestamp: string;
  model: string;
  request_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  total_tokens: number;
  cost_cny: number;
  latency_ms: number;
  is_thinking: boolean;
  status: string;
  error_message?: string;
  request_id?: string;
  source?: string;
}

export interface BalanceSnapshot {
  id: number;
  timestamp: string;
  total_balance: number;
  granted_balance: number;
  topped_up_balance: number;
  currency: string;
  is_available: boolean;
}

export interface DailySummary {
  date: string;
  model: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_cny: number;
  avg_latency_ms: number;
}

export interface PricingConfig {
  input: number;
  output: number;
  cache_hit: number;
}

export interface AppConfig {
  proxy: { port: number; upstream: string };
  websocket: { port: number };
  balance: { refresh_interval_seconds: number; api_key: string };
  database: { path: string };
  pricing: Record<string, PricingConfig>;
  aggregation: { daily_cron: string };
}

export interface WSMessage {
  type: 'new_call' | 'balance_update' | 'proxy_status' | 'error';
  data: unknown;
}

export interface DailyStats {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cacheHitTokens: number;
  totalTokens: number;
  cost: number;
}

export type TimeRange = '7d' | '30d';
