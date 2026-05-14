import cron from 'node-cron';
import { getConfig } from './config';
import { runDailyAggregation } from './database';

let dailyTask: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  const config = getConfig();
  const cronExpr = config.aggregation.daily_cron || '5 0 * * *';

  dailyTask = cron.schedule(cronExpr, () => {
    runDailyAggregation();
  });
}

export function stopScheduler(): void {
  if (dailyTask) {
    dailyTask.stop();
    dailyTask = null;
  }
}
