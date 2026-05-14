import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import { ApiCall, BalanceSnapshot, DailySummary, DailyStats } from '../shared/types';

let db: Database.Database;

export function initDatabase(): void {
  const config = getConfig();
  let dbPath = config.database.path;
  if (!path.isAbsolute(dbPath) && !process.env.VITE_DEV_SERVER_URL) {
    try {
      const { app } = require('electron');
      if (app.isPackaged) dbPath = path.join(app.getPath('userData'), dbPath);
    } catch {}
  }
  dbPath = path.resolve(dbPath);
  const dir = path.dirname(dbPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Migrate existing tables
  try { db.exec('ALTER TABLE api_calls ADD COLUMN request_id TEXT'); } catch { /* exists */ }
  try { db.exec('ALTER TABLE api_calls ADD COLUMN source TEXT DEFAULT \'proxy\''); } catch { /* exists */ }
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_api_calls_request_id ON api_calls(request_id) WHERE request_id IS NOT NULL'); } catch { /* ok */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      model TEXT NOT NULL,
      request_type TEXT DEFAULT 'chat',
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      cache_hit_tokens INTEGER DEFAULT 0,
      cache_miss_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_cny REAL DEFAULT 0,
      latency_ms INTEGER,
      is_thinking INTEGER DEFAULT 0,
      status TEXT DEFAULT 'success',
      error_message TEXT,
      request_id TEXT,
      source TEXT DEFAULT 'proxy'
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_api_calls_request_id ON api_calls(request_id) WHERE request_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_balance REAL,
      granted_balance REAL,
      topped_up_balance REAL,
      currency TEXT DEFAULT 'CNY',
      is_available INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS daily_summary (
      date DATE NOT NULL,
      model TEXT NOT NULL,
      total_requests INTEGER DEFAULT 0,
      total_prompt_tokens INTEGER DEFAULT 0,
      total_completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      total_cost_cny REAL DEFAULT 0,
      avg_latency_ms REAL DEFAULT 0,
      PRIMARY KEY (date, model)
    );
  `);
}

export function deleteByRequestId(requestId: string): void {
  db.prepare('DELETE FROM api_calls WHERE request_id = ?').run(requestId);
}

export function insertApiCall(call: Omit<ApiCall, 'id'>, requestId?: string): void {
  // Deduplicate by request_id
  if (requestId) {
    const exists = db.prepare('SELECT id FROM api_calls WHERE request_id = ?').get(requestId);
    if (exists) return;
  }

  const stmt = db.prepare(`
    INSERT INTO api_calls (timestamp, model, request_type, prompt_tokens, completion_tokens,
      cache_hit_tokens, cache_miss_tokens, total_tokens, cost_cny, latency_ms, is_thinking, status, error_message, request_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    call.timestamp || new Date().toISOString(),
    call.model,
    call.request_type || 'chat',
    call.prompt_tokens,
    call.completion_tokens,
    call.cache_hit_tokens,
    call.cache_miss_tokens,
    call.total_tokens,
    call.cost_cny,
    call.latency_ms,
    call.is_thinking ? 1 : 0,
    call.status || 'success',
    call.error_message || null,
    requestId || null,
    (call as Record<string, unknown>).source || 'proxy'
  );
}

export function insertBalanceSnapshot(snapshot: Omit<BalanceSnapshot, 'id'>): void {
  const stmt = db.prepare(`
    INSERT INTO balance_snapshots (timestamp, total_balance, granted_balance, topped_up_balance, currency, is_available)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    snapshot.timestamp || new Date().toISOString(),
    snapshot.total_balance,
    snapshot.granted_balance,
    snapshot.topped_up_balance,
    snapshot.currency || 'CNY',
    snapshot.is_available ? 1 : 0
  );
}

export function getLatestBalance(): BalanceSnapshot | null {
  const row = db.prepare(`
    SELECT * FROM balance_snapshots ORDER BY id DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined;
  return row ? rowToBalance(row) : null;
}

export function getPreviousBalance(): BalanceSnapshot | null {
  const row = db.prepare(`
    SELECT * FROM balance_snapshots ORDER BY id DESC LIMIT 1 OFFSET 1
  `).get() as Record<string, unknown> | undefined;
  return row ? rowToBalance(row) : null;
}

export function getRecentCalls(limit = 50): ApiCall[] {
  const rows = db.prepare(`
    SELECT * FROM api_calls WHERE total_tokens > 0 AND source = 'cc-log' ORDER BY timestamp DESC LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.map(rowToCall);
}

export function getTodayStats(): DailyStats {
  return getStatsForDate(new Date().toISOString().slice(0, 10));
}

export function getMonthStats(): DailyStats {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  return getStatsForRange(start, end);
}

export function getStatsForDate(date: string): DailyStats {
  const raw = db.prepare(`
    SELECT
      COALESCE(SUM(latency_ms), 0) as requests,
      COALESCE(SUM(prompt_tokens), 0) as promptTokens,
      COALESCE(SUM(completion_tokens), 0) as completionTokens,
      COALESCE(SUM(cache_hit_tokens), 0) as cacheHitTokens,
      COALESCE(SUM(total_tokens), 0) as totalTokens,
      COALESCE(SUM(cost_cny), 0) as cost
    FROM api_calls WHERE date(timestamp) = ? AND source != 'cc-log'
  `).get(date) as Record<string, number>;

  if (!raw) return { requests: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, totalTokens: 0, cost: 0 };

  return {
    requests: raw.requests as number,
    promptTokens: raw.promptTokens as number,
    completionTokens: raw.completionTokens as number,
    cacheHitTokens: raw.cacheHitTokens as number,
    totalTokens: raw.totalTokens as number,
    cost: raw.cost as number,
  };
}

export function getStatsForRange(start: string, end: string): DailyStats {
  const raw = db.prepare(`
    SELECT
      COALESCE(SUM(latency_ms), 0) as requests,
      COALESCE(SUM(prompt_tokens), 0) as promptTokens,
      COALESCE(SUM(completion_tokens), 0) as completionTokens,
      COALESCE(SUM(cache_hit_tokens), 0) as cacheHitTokens,
      COALESCE(SUM(total_tokens), 0) as totalTokens,
      COALESCE(SUM(cost_cny), 0) as cost
    FROM api_calls WHERE date(timestamp) >= ? AND date(timestamp) <= ? AND source != 'cc-log'
  `).get(start, end) as Record<string, number>;

  if (!raw) return { requests: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, totalTokens: 0, cost: 0 };

  return {
    requests: raw.requests as number,
    promptTokens: raw.promptTokens as number,
    completionTokens: raw.completionTokens as number,
    cacheHitTokens: raw.cacheHitTokens as number,
    totalTokens: raw.totalTokens as number,
    cost: raw.cost as number,
  };
}

export function getModelStatsForDate(model: string, date: string): DailyStats {
  const raw = db.prepare(`
    SELECT
      COALESCE(SUM(latency_ms), 0) as requests,
      COALESCE(SUM(prompt_tokens), 0) as promptTokens,
      COALESCE(SUM(completion_tokens), 0) as completionTokens,
      COALESCE(SUM(cache_hit_tokens), 0) as cacheHitTokens,
      COALESCE(SUM(total_tokens), 0) as totalTokens,
      COALESCE(SUM(cost_cny), 0) as cost
    FROM api_calls WHERE date(timestamp) = ? AND source != 'cc-log' AND model = ?
  `).get(date, model) as Record<string, number>;

  if (!raw) return { requests: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, totalTokens: 0, cost: 0 };

  return {
    requests: raw.requests as number,
    promptTokens: raw.promptTokens as number,
    completionTokens: raw.completionTokens as number,
    cacheHitTokens: raw.cacheHitTokens as number,
    totalTokens: raw.totalTokens as number,
    cost: raw.cost as number,
  };
}

export function getModelStatsForRange(model: string, start: string, end: string): DailyStats {
  const raw = db.prepare(`
    SELECT
      COALESCE(SUM(latency_ms), 0) as requests,
      COALESCE(SUM(prompt_tokens), 0) as promptTokens,
      COALESCE(SUM(completion_tokens), 0) as completionTokens,
      COALESCE(SUM(cache_hit_tokens), 0) as cacheHitTokens,
      COALESCE(SUM(total_tokens), 0) as totalTokens,
      COALESCE(SUM(cost_cny), 0) as cost
    FROM api_calls WHERE date(timestamp) >= ? AND date(timestamp) <= ? AND source != 'cc-log' AND model = ?
  `).get(start, end, model) as Record<string, number>;

  if (!raw) return { requests: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, totalTokens: 0, cost: 0 };

  return {
    requests: raw.requests as number,
    promptTokens: raw.promptTokens as number,
    completionTokens: raw.completionTokens as number,
    cacheHitTokens: raw.cacheHitTokens as number,
    totalTokens: raw.totalTokens as number,
    cost: raw.cost as number,
  };
}export function getTodayModelStats(model: string): DailyStats {
  return getModelStatsForDate(model, new Date().toISOString().slice(0, 10));
}

export function getMonthModelStats(model: string): DailyStats {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return getModelStatsForRange(model, start, now.toISOString().slice(0, 10));
}

export function getDailySummaries(days: number): DailySummary[] {
  const rows = db.prepare(`
    SELECT date(timestamp) as d, model,
      COUNT(*) as total_requests,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(cost_cny) as total_cost_cny,
      0 as avg_latency_ms
    FROM api_calls
    WHERE d >= date('now', ?) AND source != 'cc-log'
    GROUP BY d, model
    ORDER BY d DESC
  `).all(`-${days} days`) as Record<string, unknown>[];
  return rows.map(row => ({
    date: row.d as string,
    model: row.model as string,
    total_requests: row.total_requests as number,
    total_prompt_tokens: row.total_prompt_tokens as number,
    total_completion_tokens: row.total_completion_tokens as number,
    total_tokens: row.total_tokens as number,
    total_cost_cny: row.total_cost_cny as number,
    avg_latency_ms: row.avg_latency_ms as number,
  }));
}

export function runDailyAggregation(): void {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = yesterday.toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT model,
      COUNT(*) as total_requests,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(cost_cny) as total_cost_cny,
      AVG(latency_ms) as avg_latency_ms
    FROM api_calls
    WHERE date(timestamp) = ?
    GROUP BY model
  `).all(date) as Record<string, number>[];

  const upsert = db.prepare(`
    INSERT INTO daily_summary (date, model, total_requests, total_prompt_tokens,
      total_completion_tokens, total_tokens, total_cost_cny, avg_latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, model) DO UPDATE SET
      total_requests = excluded.total_requests,
      total_prompt_tokens = excluded.total_prompt_tokens,
      total_completion_tokens = excluded.total_completion_tokens,
      total_tokens = excluded.total_tokens,
      total_cost_cny = excluded.total_cost_cny,
      avg_latency_ms = excluded.avg_latency_ms
  `);

  const tx = db.transaction(() => {
    for (const row of rows) {
      upsert.run(
        date, row.model,
        row.total_requests, row.total_prompt_tokens,
        row.total_completion_tokens, row.total_tokens,
        row.total_cost_cny, row.avg_latency_ms
      );
    }
  });
  tx();
}

export function cleanupOldRecords(days = 90): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  const result = db.prepare('DELETE FROM api_calls WHERE timestamp < ?').run(cutoffStr);
  return result.changes;
}

export function exportData(format: 'csv' | 'json', startDate?: string, endDate?: string): string {
  let rows: Record<string, unknown>[];
  if (startDate && endDate) {
    rows = db.prepare(`
      SELECT * FROM api_calls WHERE date(timestamp) >= ? AND date(timestamp) <= ? ORDER BY id
    `).all(startDate, endDate) as Record<string, unknown>[];
  } else {
    rows = db.prepare('SELECT * FROM api_calls ORDER BY id').all() as Record<string, unknown>[];
  }

  if (format === 'csv') {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(r => headers.map(h => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
    return [headers.join(','), ...csvRows].join('\n');
  }

  return JSON.stringify(rows, null, 2);
}

function rowToBalance(row: Record<string, unknown>): BalanceSnapshot {
  return {
    id: row.id as number,
    timestamp: row.timestamp as string,
    total_balance: row.total_balance as number,
    granted_balance: row.granted_balance as number,
    topped_up_balance: row.topped_up_balance as number,
    currency: row.currency as string,
    is_available: Boolean(row.is_available),
  };
}

function rowToCall(row: Record<string, unknown>): ApiCall {
  return {
    id: row.id as number,
    timestamp: row.timestamp as string,
    model: row.model as string,
    request_type: (row.request_type as string) || 'chat',
    prompt_tokens: (row.prompt_tokens as number) || 0,
    completion_tokens: (row.completion_tokens as number) || 0,
    cache_hit_tokens: (row.cache_hit_tokens as number) || 0,
    cache_miss_tokens: (row.cache_miss_tokens as number) || 0,
    total_tokens: (row.total_tokens as number) || 0,
    cost_cny: (row.cost_cny as number) || 0,
    latency_ms: row.latency_ms as number,
    is_thinking: Boolean(row.is_thinking),
    status: (row.status as string) || 'success',
    error_message: row.error_message as string,
    source: row.source as string,
    request_id: row.request_id as string,
  };
}
