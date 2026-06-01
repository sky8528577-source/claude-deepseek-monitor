import { net, BrowserWindow } from 'electron';
import { getConfig, updateConfig } from './config';
import { insertApiCall, deleteByRequestId } from './database';
import { ApiCall } from '../shared/types';

let csvInterval: ReturnType<typeof setInterval> | null = null;
let lastFetchInfo = { time: '', count: 0 };

// Download usage CSV using Electron's net (shares session cookies)
async function downloadCSV(
  startDate: string,
  endDate: string
): Promise<Buffer | null> {
  const d = new Date(startDate);
  const month = (d.getMonth() + 1).toString();
  const year = d.getFullYear().toString();

  // Use Amount API for daily token counts
  return await tryDownload(`/api/v0/usage/amount?month=${month}&year=${year}`);
}

async function getCostData(month: string, year: string): Promise<{
  models: { model: string; cost: number }[];
  dailyMap: Map<string, Map<string, number>>;
}> {
  const buf = await tryDownload(`/api/v0/usage/cost?month=${month}&year=${year}`);
  if (!buf) return { models: [], dailyMap: new Map() };
  try {
    const json = JSON.parse(buf.toString('utf8'));
    const items = json.data?.biz_data || [];
    const models: { model: string; cost: number }[] = [];
    const dailyMap = new Map<string, Map<string, number>>();
    const item = items[0]; // Use first item only
    if (item) {
      if (item.days) {
        // Debug: check for duplicate model names in first day
        const firstDay = item.days[0];
        if (firstDay) {
          console.log(`[CSV] Cost daily models for ${firstDay.date}: ${(firstDay.data || []).map((d: { model: string }) => d.model).join(', ')}`);
        }
        for (const day of item.days) {
          const date = day.date;
          for (const modelData of day.data || []) {
            const rawModel = modelData.model || '';
            if (rawModel.includes('&')) continue; // Skip combined models like "deepseek-chat & deepseek-reasoner"
            const mapped = rawModel.includes('pro') || rawModel.includes('reasoner')
              ? 'deepseek-reasoner' : 'deepseek-chat';
            let dayCost = 0;
            for (const u of modelData.usage || []) dayCost += parseFloat(u.amount) || 0;
            if (!dailyMap.has(date)) dailyMap.set(date, new Map());
            dailyMap.get(date)!.set(mapped, (dailyMap.get(date)!.get(mapped) || 0) + dayCost);
          }
        }
      }
      for (const t of item.total || []) {
        let totalCost = 0;
        for (const u of t.usage || []) totalCost += parseFloat(u.amount) || 0;
        const mapped = (t.model || '').includes('pro') || (t.model || '').includes('reasoner')
          ? 'deepseek-reasoner' : 'deepseek-chat';
        models.push({ model: mapped, cost: totalCost });
      }
    }
    return { models, dailyMap };
  } catch { return { models: [], dailyMap: new Map() }; }
}

function tryDownload(path: string): Promise<Buffer | null> {
  const config = getConfig();
  const token = (config as unknown as Record<string, unknown>).platform_cookie as string || '';

  const headers: Record<string, string> = {
    Accept: 'application/json, text/csv, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DeepSeek-Monitor',
    Referer: 'https://platform.deepseek.com/usage',
  };

  if (token.startsWith('Bearer ')) {
    headers['Authorization'] = token;
  } else if (token.length > 10) {
    headers['Cookie'] = token;
  }

  return net.fetch(`https://platform.deepseek.com${path}`, {
    method: 'GET',
    headers,
  }).then(async (res) => {
    const ctype = res.headers.get('content-type') || '';
    console.log(`[API] ${path} -> ${res.status} (${ctype})`);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log(`[CSV] Error: ${text.substring(0, 200)}`);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50) {
      console.log(`[CSV] Small response: ${buf.toString('utf8')}`);
    } else {
      console.log(`[CSV] Got ${buf.length} bytes, starts: ${buf.toString('utf8').substring(0, 200)}`);
    }
    return buf.length > 10 ? buf : null;
  }).catch((err) => {
    console.log(`[CSV] Error: ${err.message}`);
    return null;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'; i++;
        } else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

// Parse CSV and import into database
export function parseAndImport(csvText: string): number {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return 0;

  const header = lines[0].toLowerCase();
  const columns = header.split(',').map((h: string) => h.trim().replace(/"/g, ''));

  const idx = (...names: string[]): number => {
    for (const n of names) {
      const i = columns.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const timeIdx = idx('timestamp', 'time', 'date', 'created_at', 'created');
  const modelIdx = idx('model_name', 'model', 'model_id');
  const promptIdx = idx('prompt_tokens', 'input_tokens', 'prompt');
  const compIdx = idx('completion_tokens', 'output_tokens', 'completion');
  const totalIdx = idx('total_tokens', 'tokens', 'total');
  const costIdx = idx('cost_in_cents', 'cost_cny', 'cost', 'amount', 'price');
  const requestIdx = idx('request_id', 'id', 'record_id');
  const statusIdx = idx('status', 'state');

  let inserted = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const vals = parseCSVLine(line);
      if (vals.length === 0) continue;

      const get = (idx: number): string => (idx >= 0 ? vals[idx]?.replace(/"/g, '') || '' : '');

      const timestamp = get(timeIdx);
      const model = get(modelIdx) || 'deepseek-chat';
      const promptTokens = parseInt(get(promptIdx)) || 0;
      const completionTokens = parseInt(get(compIdx)) || 0;
      const totalTokens = parseInt(get(totalIdx)) || promptTokens + completionTokens;
      const costStr = get(costIdx);
      const requestId = get(requestIdx);
      const status = get(statusIdx) || 'success';

      let costCny = parseFloat(costStr) || 0;
      if (costStr && costCny > 0 && costCny < 0.01) costCny = costCny / 100;

      const mappedModel = model.includes('pro') || model.includes('reasoner')
        ? 'deepseek-reasoner' : 'deepseek-chat';

      const call: Omit<ApiCall, 'id'> = {
        timestamp: timestamp || new Date().toISOString(),
        model: mappedModel,
        request_type: 'chat',
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cache_hit_tokens: 0,
        cache_miss_tokens: promptTokens,
        total_tokens: totalTokens,
        cost_cny: costCny,
        latency_ms: undefined,
        is_thinking: false,
        status: status.includes('fail') || status.includes('error') ? 'error' : 'success',
        error_message: undefined,
        request_id: requestId,
        source: 'csv-import',
      } as unknown as Omit<ApiCall, 'id'>;

      insertApiCall(call, requestId || undefined);
      inserted++;
    } catch { /* skip */ }
  }

  return inserted;
}

async function extractZip(buffer: Buffer): Promise<string | null> {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    let target: { getData?: () => Buffer; entryName?: string } | null = null;
    for (const entry of entries) {
      const name: string = entry.entryName.toLowerCase();
      if (!name.includes('amount') && name.endsWith('.csv')) {
        target = entry;
        break;
      }
    }
    if (!target) {
      for (const entry of entries) {
        if (entry.entryName.toLowerCase().endsWith('.csv')) {
          target = entry; break;
        }
      }
    }

    if (target?.getData) return target.getData().toString('utf8');
    return null;
  } catch {
    return null;
  }
}

// Main fetch function
export async function fetchCSVUsage(): Promise<number> {
  const config = getConfig();
  const token = (config as unknown as Record<string, unknown>).platform_cookie as string || '';

  const today = new Date();
  // Use 1st of current month to ensure correct month/year in API call
  const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const endStr = today.toISOString().slice(0, 10);

  let result = 0;

  const data = await downloadCSV(startStr, endStr);
  if (!data) {
    result = token ? 0 : -1;
  } else {
    result = await importResponse(data);
  }

  lastFetchInfo = { time: new Date().toISOString(), count: result };
  return result;
}

async function importResponse(data: Buffer): Promise<number> {

  console.log(`[CSV] Downloaded ${data.length} bytes`);

  // Try ZIP
  const csvText = await extractZip(data);
  if (csvText) return parseAndImport(csvText);

  // Try direct CSV
  const text = data.toString('utf8').trim();

  // JSON response - use Amount API + Cost API together
  if (text.startsWith('{')) {
    return importAmountWithCost(text);
  }

  // Direct CSV
  if (text.includes(',')) return parseAndImport(text);

  return 0;
}

async function importAmountWithCost(amountText: string): Promise<number> {
  try {
    const json = JSON.parse(amountText);
    if (json.code !== 0 || !json.data?.biz_data) return 0;

    const bizData = json.data.biz_data;
    const days: Array<{
      date: string;
      data: Array<{ model: string; usage: Array<{ type: string; amount: string }> }>;
    }> = bizData.days || [];
    if (days.length === 0) return 0;

    // Build monthly token totals per model from Amount API (SUM for same mapped model)
    const monthlyToks = new Map<string, number>();
    for (const item of bizData.total || []) {
      const mapped = (item.model || '').includes('pro') || (item.model || '').includes('reasoner')
        ? 'deepseek-reasoner' : 'deepseek-chat';
      let toks = 0;
      for (const u of item.usage || []) {
        const t = u.type;
        if (t !== 'REQUEST') toks += parseInt(u.amount) || 0;
      }
      monthlyToks.set(mapped, (monthlyToks.get(mapped) || 0) + toks);
    }

    // Get correct monthly costs from Cost API (SUM for same mapped model)
    const d = new Date();
    const costData = await getCostData((d.getMonth() + 1).toString(), d.getFullYear().toString());
    const monthlyCost = new Map<string, number>();
    for (const mc of costData.models) {
      monthlyCost.set(mc.model, (monthlyCost.get(mc.model) || 0) + mc.cost);
    }
    console.log(`[CSV] Monthly costs: ${JSON.stringify([...monthlyCost])}`);
    console.log(`[CSV] Monthly tokens: ${JSON.stringify([...monthlyToks])}`);
    // Debug daily costs
    const today = new Date().toISOString().slice(0, 10);
    const todayCosts = costData.dailyMap.get(today);
    if (todayCosts) console.log(`[CSV] Today costs: ${JSON.stringify([...todayCosts])}`);
    else console.log(`[CSV] No daily costs for today (${today})`);
    console.log(`[CSV] Daily map dates: ${[...costData.dailyMap.keys()].slice(0, 5).join(', ')}...`);

    // Log first day's usage types for debugging
    if (days.length > 0) {
      const firstModelData = days[0].data?.[0];
      if (firstModelData) {
        console.log(`[CSV] Amount daily types for ${days[0].date}/${firstModelData.model}: ${(firstModelData.usage || []).map((u: { type: string }) => u.type).join(', ')}`);
      }
    }

    let inserted = 0;

    for (const day of days) {
      const dateStr = day.date;

      for (const modelData of day.data) {
        const modelName = modelData.model || '';
        if (modelName.includes('&')) continue;
        const mapped = modelName.includes('pro') || modelName.includes('reasoner')
          ? 'deepseek-reasoner' : 'deepseek-chat';

        let cacheHit = 0, cacheMiss = 0, responseTokens = 0, requests = 0;
        for (const u of modelData.usage || []) {
          const val = parseInt(u.amount) || 0;
          switch (u.type) {
            case 'PROMPT_CACHE_HIT_TOKEN': cacheHit = val; break;
            case 'PROMPT_CACHE_MISS_TOKEN': cacheMiss = val; break;
            case 'RESPONSE_TOKEN':
            case 'COMPLETION_TOKEN': responseTokens = val; break;
            case 'REQUEST': requests = val; break;
            default:
              if (u.type && responseTokens === 0) responseTokens = parseInt(u.amount) || 0;
          }
        }

        const dayTotalToks = cacheHit + cacheMiss + responseTokens;
        // Use exact daily cost from Cost API
        const exactCost = costData.dailyMap.get(dateStr)?.get(mapped) || 0;
        const rid = `api-${dateStr}-${modelName}`;
        deleteByRequestId(rid);

        const call: Omit<ApiCall, 'id'> = {
          timestamp: `${dateStr}T12:00:00.000Z`,
          model: mapped,
          request_type: 'chat',
          prompt_tokens: cacheHit + cacheMiss,
          completion_tokens: responseTokens,
          cache_hit_tokens: cacheHit,
          cache_miss_tokens: cacheMiss,
          total_tokens: dayTotalToks,
          cost_cny: Number(exactCost.toFixed(8)),
          latency_ms: requests,
          is_thinking: false, status: 'success',
          error_message: undefined,
          request_id: rid,
          source: 'csv-import',
        } as unknown as Omit<ApiCall, 'id'>;
        insertApiCall(call, rid);
        inserted++;
      }
    }

    console.log(`[CSV] Imported ${inserted} daily records`);
    return inserted;
  } catch (e) {
    console.log('[CSV] Import error:', e);
    return 0;
  }
}

export function getLastFetchInfo() { return lastFetchInfo; }

function setLastFetch(count: number): number {
  lastFetchInfo = { time: new Date().toISOString(), count };
  return count;
}

// Auto-fetch every 60 seconds
export function startCSVAutoFetch(): void {
  stopCSVAutoFetch();

  csvInterval = setInterval(() => {
    fetchCSVUsage().then((count) => {
      if (count >= 0) console.log(`CSV auto-fetch: ${count} records`);
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('data-updated'));
    });
  }, 60_000);
}

export function stopCSVAutoFetch(): void {
  if (csvInterval) { clearInterval(csvInterval); csvInterval = null; }
}

export function setPlatformCookie(cookie: string): void {
  const config = getConfig();
  (config as unknown as Record<string, unknown>).platform_cookie = cookie;
  updateConfig(config);
}
