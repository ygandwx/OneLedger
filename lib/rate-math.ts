import { MoneyDecimal, isCurrency } from "./money";

export type RatePoint = { date: string; base: string; quote: string; rate: string; source: string };

// Each cross rate uses quotes from a single observation day. A weekend never
// borrows a later business day's observation.
export function resolveRate(points: RatePoint[], date: string, from: string, to: string): string | null {
  if (!isCurrency(from) || !isCurrency(to)) throw new Error("不支持该币种");
  if (from === to) return "1";
  const byDay = new Map<string, RatePoint[]>();
  for (const point of points) {
    if (point.date > date) continue;
    const group = byDay.get(point.date) ?? [];
    group.push(point);
    byDay.set(point.date, group);
  }
  for (const day of [...byDay.keys()].sort().reverse()) {
    const rows = byDay.get(day)!;
    const edge = (a: string, b: string) => {
      for (const source of ["手动", "自动"]) {
        const exact = rows.find(r => r.source === source && r.base === a && r.quote === b);
        if (exact) return new MoneyDecimal(exact.rate);
        const inverse = rows.find(r => r.source === source && r.quote === a && r.base === b);
        if (inverse) return new MoneyDecimal(1).div(inverse.rate);
      }
      return null;
    };
    const direct = edge(from, to);
    if (direct) return direct.toFixed();
    for (const via of new Set(["EUR", ...rows.map(r => r.base), ...rows.map(r => r.quote)])) {
      if (via === from || via === to) continue;
      const first = edge(from, via);
      const second = edge(via, to);
      if (first && second) return first.mul(second).toFixed();
    }
  }
  return null;
}
