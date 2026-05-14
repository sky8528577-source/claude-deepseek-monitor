import https from 'https';
import { getConfig } from './config';
import { insertBalanceSnapshot } from './database';
import { BalanceSnapshot } from '../shared/types';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startBalancePolling(): void {
  const config = getConfig();

  // Fetch immediately on start
  fetchBalance();

  intervalId = setInterval(() => {
    fetchBalance();
  }, config.balance.refresh_interval_seconds * 1000);
}

export function stopBalancePolling(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function fetchBalance(): Promise<BalanceSnapshot | null> {
  const config = getConfig();

  if (!config.balance.api_key) {
    return null;
  }

  return new Promise((resolve) => {
    const url = new URL('https://api.deepseek.com/user/balance');
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: '/user/balance',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.balance.api_key}`,
        'User-Agent': 'DeepSeek-Monitor',
        Accept: 'application/json',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString();
          const data = JSON.parse(body);

          if (data.balance_infos && data.balance_infos.length > 0) {
            const info = data.balance_infos[0];
            const snapshot: Omit<BalanceSnapshot, 'id'> = {
              timestamp: new Date().toISOString(),
              total_balance: parseFloat(info.total_balance || '0'),
              granted_balance: parseFloat(info.granted_balance || '0'),
              topped_up_balance: parseFloat(info.topped_up_balance || '0'),
              currency: info.currency || 'CNY',
              is_available: data.is_available === true,
            };

            insertBalanceSnapshot(snapshot);
            resolve(snapshot as BalanceSnapshot);
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('Balance parsing error:', err);
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Balance fetch error:', err);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}
