import cron from "node-cron";
import { syncRates } from "./rates";

const state = globalThis as typeof globalThis & { ledgerJobsStarted?: boolean };
export function startJobs() {
  if (state.ledgerJobsStarted) return;
  const timezone = process.env.TZ || "Asia/Shanghai";
  const jobs: [string, string, () => Promise<unknown>][] = [
    ["更新汇率", process.env.FX_CRON || "15 9 * * *", () => syncRates()],
  ];
  for (const [name, expression] of jobs) {
    if (!cron.validate(expression)) throw new Error(name + "的 cron 表达式无效");
  }
  new Intl.DateTimeFormat("zh-CN", { timeZone: timezone });
  for (const [name, expression, job] of jobs) {
    cron.schedule(expression, async () => {
      try { await job(); }
      catch (error) { console.error(name + "失败", error instanceof Error ? error.message : "未知错误"); }
    }, { name, timezone, noOverlap: true });
  }
  state.ledgerJobsStarted = true;
}
