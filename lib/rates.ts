import { db } from "./db";
import { isLedgerDate } from "./expense-date";
import { CURRENCIES, isCurrency, normalizeRate } from "./money";
import { resolveRate } from "./rate-math";

export async function lookupRate(date: string, from: string, to: string): Promise<string | null> {
  if (!isLedgerDate(date)) throw new Error("无效的交易日期");
  if (from === to && isCurrency(from)) return "1";
  const points = await db.exchangeRate.findMany({
    where: { date: { lte: date }, OR: [{ base: { in: [from, to] } }, { quote: { in: [from, to] } }] },
  });
  return resolveRate(points, date, from, to);
}

export async function syncRates(date?: string): Promise<number> {
  if (date && !isLedgerDate(date)) throw new Error("无效的报价日期");
  const endpoint = new URL("https://api.frankfurter.dev/v2/rates");
  endpoint.searchParams.set("base", "EUR");
  endpoint.searchParams.set("quotes", CURRENCIES.filter(c => c !== "EUR").join(","));
  if (date) endpoint.searchParams.set("date", date);
  const read = async (): Promise<unknown[]> => {
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error("Frankfurter 汇率服务暂时不可用");
    const result: unknown = await response.json();
    if (!Array.isArray(result)) throw new Error("汇率服务响应格式无效");
    return result;
  };
  let rows = await read();
  if (date && !rows.length) {
    // Some providers publish only on business days. Import the preceding
    // month when the requested observation day has no quotes.
    const prior = new Date(date + "T00:00:00Z");
    prior.setUTCDate(prior.getUTCDate() - 31);
    endpoint.searchParams.delete("date");
    endpoint.searchParams.set("from", prior.toISOString().slice(0, 10));
    endpoint.searchParams.set("to", date);
    rows = await read();
  }
  const points = rows.map(row => {
    if (!row || typeof row !== "object" || !("base" in row) || !("quote" in row) || !("date" in row) || !("rate" in row) || row.base !== "EUR" || typeof row.quote !== "string" || !isCurrency(row.quote) ||
        row.quote === row.base || typeof row.date !== "string" || !isLedgerDate(row.date) ||
        (date && row.date > date) || (typeof row.rate !== "number" && typeof row.rate !== "string")) {
      throw new Error("汇率服务返回无效报价");
    }
    return { date: row.date as string, base: "EUR", quote: row.quote as string, rate: normalizeRate(String(row.rate)), source: "自动" };
  });
  if (!points.length) throw new Error("该日期没有可用报价");
  // An atomic conditional write preserves a user's manual quote if a cron
  // refresh and the settings form run concurrently.
  await db.$transaction(points.map(p => db.$executeRaw`
    INSERT INTO "ExchangeRate" ("id", "date", "base", "quote", "rate", "source")
    VALUES (${crypto.randomUUID()}, ${p.date}, ${p.base}, ${p.quote}, ${p.rate}, '自动')
    ON CONFLICT ("date", "base", "quote") DO UPDATE SET "rate" = excluded."rate"
    WHERE "ExchangeRate"."source" = '自动'`));
  return points.length;
}
