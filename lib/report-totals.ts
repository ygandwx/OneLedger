import { convertMinor, MoneyDecimal } from "./money"

export type Dimension = { id: string; label: string }
type Total = Dimension & { currency: string; amount: bigint }
type Input = {
  status: string; deleted: boolean; bookedAmount: bigint; fee: bigint; settled: boolean;
  payer: Dimension; owner: Dimension; group: Dimension; date: string; bookedCurrency: string; originalCurrency?: string; rateOverride?: string | null
}

export function includedInReport(row: Pick<Input, "status" | "deleted">) {
  return !row.deleted && (row.status === "已入账" || row.status === "已退款")
}

function add(map: Map<string, Total>, dim: Dimension, currency: string, amount: bigint) {
  const key = JSON.stringify([dim.id, currency])
  const prior = map.get(key)
  if (prior) prior.amount += amount
  else map.set(key, { ...dim, currency, amount })
}

/** All conversion and rounding is done once per posted line, after adding the booked fee. */
export async function calculateReport(
  rows: Input[],
  by: "owner" | "payer",
  split: boolean,
  target: string | null,
  exchange: (amount: bigint, date: string, from: string, to: string) => Promise<bigint | null>,
) {
  const totals = new Map<string, Total>()
  const breakdown = new Map<string, Total & { group: Dimension; subject: Dimension }>()
  const trend = new Map<string, Total & { month: string; subject: Dimension }>()
  const advances = new Map<string, Total>()
  const missing = new Set<string>()
  for (const row of rows) {
    if (!includedInReport(row)) continue
    const currency = target || row.bookedCurrency
    const net = row.bookedAmount + row.fee
    let amount: bigint | null = net
    if (currency !== row.bookedCurrency) {
      if (currency === row.originalCurrency && row.rateOverride) {
        const inverse = new MoneyDecimal(1).div(row.rateOverride).toFixed()
        amount = convertMinor(net, row.bookedCurrency, currency, inverse)
      } else amount = await exchange(net, row.date, row.bookedCurrency, currency)
    }
    if (amount === null) {
      missing.add(`${row.date}  ${row.bookedCurrency} → ${currency}`)
      continue
    }
    const subject = split ? row[by] : { id: "*", label: "合计" }
    add(totals, subject, currency, amount)
    const grouped = JSON.stringify([row.group.id, subject.id, currency])
    const group = breakdown.get(grouped)
    if (group) group.amount += amount
    else breakdown.set(grouped, { ...row.group, group: row.group, subject, currency, amount })
    const month = row.date.slice(0, 7)
    const trendKey = JSON.stringify([month, subject.id, currency])
    const point = trend.get(trendKey)
    if (point) point.amount += amount
    else trend.set(trendKey, { id: month, label: month, month, subject, currency, amount })
    if (!row.settled && row.payer.id !== row.owner.id) {
      const pair = { id: JSON.stringify([row.payer.id, row.owner.id]), label: `${row.payer.label} → ${row.owner.label}` }
      add(advances, pair, currency, amount)
    }
  }
  return { totals: [...totals.values()], breakdown: [...breakdown.values()], trend: [...trend.values()],
    advances: [...advances.values()], missing: [...missing].sort() }
}
