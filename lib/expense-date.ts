export function isLedgerDate(value: string): boolean {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function ledgerToday(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: process.env.TZ || "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"].map(key => parts.find(p => p.type === key)?.value).join("-");
}
