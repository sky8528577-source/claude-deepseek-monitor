import fs from 'fs';
import os from 'os';
import path from 'path';
import { insertApiCall } from './database';
import { getConfig } from './config';
import { ApiCall } from '../shared/types';

interface CCMessage {
  type: string;
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
  timestamp?: string;
  sessionId?: string;
}

function getCCDir(): string {
  const config = getConfig();
  const custom = (config as unknown as Record<string, string>).cc_data_dir;
  if (custom && fs.existsSync(custom)) return custom;
  return path.join(os.homedir(), '.claude', 'projects');
}

function mapModel(model: string): string {
  if (model.includes('pro') || model.includes('reasoner')) return 'deepseek-reasoner';
  return 'deepseek-chat';
}

export function scanCCLogs(sinceDays: number = 3): number {
  const ccDir = getCCDir();
  if (!fs.existsSync(ccDir)) return 0;

  let totalInserted = 0;
  const seenMsgIds = new Set<string>();

  function walkDir(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...walkDir(fullPath));
        } else if (entry.name.endsWith('.jsonl')) {
          results.push(fullPath);
        }
      }
    } catch { /* skip */ }
    return results;
  }

  const jsonlFiles = walkDir(ccDir);
  const cutoff = Date.now() - sinceDays * 86400000;

  for (const file of jsonlFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const msg: CCMessage = JSON.parse(line);
          if (msg.type !== 'assistant' || !msg.message?.model) continue;
          if (!msg.message.model.startsWith('deepseek')) continue;

          const msgId = msg.message.id;
          if (msgId && seenMsgIds.has(msgId)) continue;
          if (msgId) seenMsgIds.add(msgId);

          const usage = msg.message.usage;
          if (!usage) continue;

          const ts = new Date(msg.timestamp || Date.now()).getTime();
          if (ts < cutoff) continue;

          const model = mapModel(msg.message.model);
          const promptTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
          const completionTokens = usage.output_tokens || 0;
          const cacheHitTokens = usage.cache_read_input_tokens || 0;
          const totalTokens = promptTokens + completionTokens;

          // Cost = 0 for CC logs (monthly cost from API takes priority)
          const requestId = `${msg.sessionId || 'cc'}-${ts}-${msgId || ''}`;

          const call: Omit<ApiCall, 'id'> = {
            timestamp: msg.timestamp || new Date().toISOString(),
            model,
            request_type: 'chat',
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            cache_hit_tokens: cacheHitTokens,
            cache_miss_tokens: Math.max(0, promptTokens - cacheHitTokens),
            total_tokens: totalTokens,
            cost_cny: 0, // Cost from API, CC logs provide per-request token counts
            latency_ms: undefined,
            is_thinking: false,
            status: 'success',
            error_message: undefined,
            request_id: requestId,
            source: 'cc-log',
          } as unknown as Omit<ApiCall, 'id'>;

          insertApiCall(call, requestId);
          totalInserted++;
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return totalInserted;
}
