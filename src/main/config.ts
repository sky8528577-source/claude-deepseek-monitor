import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import yaml from 'js-yaml';
import { AppConfig } from '../shared/types';

function getDataDir(): string {
  try {
    return app.getPath('userData');
  } catch {
    return process.cwd();
  }
}

function getConfigPath(): string {
  // In dev mode, use CWD for easy editing. In production, use userData.
  if (process.env.VITE_DEV_SERVER_URL || !app.isPackaged) {
    return path.join(process.cwd(), 'config.yaml');
  }
  return path.join(getDataDir(), 'config.yaml');
}

const defaultConfig: AppConfig = {
  proxy: { port: 9090, upstream: 'https://api.deepseek.com' },
  websocket: { port: 9091 },
  balance: { refresh_interval_seconds: 60, api_key: '' },
  database: { path: './data/monitor.db' },
  pricing: {
    'deepseek-chat': { input: 0.5, output: 2.0, cache_hit: 0.07 },
    'deepseek-reasoner': { input: 4.0, output: 16.0, cache_hit: 1.0 },
  },
  aggregation: { daily_cron: '5 0 * * *' },
};

let config: AppConfig = JSON.parse(JSON.stringify(defaultConfig));

export function loadConfig(): AppConfig {
  const cfgPath = getConfigPath();
  try {
    if (fs.existsSync(cfgPath)) {
      const fileContent = fs.readFileSync(cfgPath, 'utf8');
      const loaded = yaml.load(fileContent) as Record<string, unknown>;
      config = deepMerge(JSON.parse(JSON.stringify(defaultConfig)), loaded) as unknown as AppConfig;
    }
  } catch (err) {
    console.error('Failed to load config, using defaults:', err);
  }
  return config;
}

export function getConfig(): AppConfig {
  return config;
}

export function updateConfig(updates: Partial<AppConfig>): AppConfig {
  config = deepMerge(config as unknown as Record<string, unknown>, updates as unknown as Record<string, unknown>) as unknown as AppConfig;
  try {
    fs.writeFileSync(getConfigPath(), yaml.dump(config), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
  return config;
}

export function setApiKey(key: string): void {
  config.balance.api_key = key;
  try {
    fs.writeFileSync(getConfigPath(), yaml.dump(config), 'utf8');
  } catch (err) {
    console.error('Failed to save API key:', err);
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(
        (result[key] as Record<string, unknown>) || {},
        source[key] as Record<string, unknown>
      );
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
