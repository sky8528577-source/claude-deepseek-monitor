import { getConfig } from './config';

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cacheHitTokens: number
): number {
  const config = getConfig();
  const pricing = config.pricing[model] || config.pricing['deepseek-chat'];

  if (!pricing) return 0;

  const cacheMissTokens = Math.max(0, promptTokens - cacheHitTokens);
  const inputCost = (cacheMissTokens / 1_000_000) * pricing.input +
                    (cacheHitTokens / 1_000_000) * pricing.cache_hit;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
