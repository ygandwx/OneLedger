import { db } from "@/lib/db"
import { isCurrency, convertMinor, fromMinor } from "@/lib/money"
import { lookupRate } from "@/lib/rates"
import { dateInMonth, todayLocal, validDate } from "@/lib/calendar"
import { calculateReport, type Dimension } from "@/lib/report-totals"

export type ReportParams = Record<string, string | string[] | undefined>
const first = (params: ReportParams, key: string) => [params[key]].flat()[0] || ""
export const GROUPS = { category: "分类", website: "网站", account: "账号", card: "支付工具" } as const
export function reportOptions(params: ReportParams) {
  const today = todayLocal()
  const value = first(params, "period")
  const period = ["月", "季", "年", "自定义"].includes(value) ? value : "月"
  const anchor = first(params, "anchor") || today
  if (!validDate(anchor)) throw Error("期间参考日期无效")
  const [year, month] = anchor.split("-").map(Number)
  const firstMonth = period === "季" ? Math.floor((month - 1) / 3) * 3 + 1 : period === "年" ? 1 : month
  const lastMonth = firstMonth + (period === "季" ? 2 : period === "年" ? 11 : 0)
  const start = period === "自定义" ? first(params, "start") : dateInMonth(year, firstMonth, 1)
  const end = period === "自定义" ? first(params, "end") : dateInMonth(year, lastMonth, 31)
  if (!validDate(start) || !validDate(end) || start > end) throw Error("请选择有效的起止日期，结束日期须在开始日期之后或当天")
  const group = first(params, "group")
  const currency = first(params, "currency")
  return { period, anchor, start, end,
    subjects: ([params.subject].flat().filter(Boolean) as string[]),
    group: (Object.hasOwn(GROUPS, group) ? group : "category") as keyof typeof GROUPS,
    by: first(params, "by") === "payer" ? "payer" as const : "owner" as const,
    split: first(params, "split") === "1", target: isCurrency(currency) ? currency : null }
}

export async function getReport(opt: ReturnType<typeof reportOptions>) {
  const rows = await db.expense.findMany({ where: { date: { gte: opt.start, lte: opt.end },
    deleted: false, status: { in: ["已入账", "已退款"] },
    ...(opt.subjects.length ? { [opt.by === "payer" ? "payerId" : "ownerId"]: { in: opt.subjects } } : {}),
  }, include: { category: true, website: true, account: true, card: true, payer: true, owner: true }, orderBy: { date: "asc" } })
  const inputs = rows.map(row => {
    const groupRef = row[opt.group]
    const group = { id: groupRef?.id ?? "-", label: groupRef && "name" in groupRef ? groupRef.name :
      row.account && opt.group === "account" ? `${row.website?.name ?? ""} · ${row.account.identifier}` : "未指定" }
    return { ...row, group, owner: { id: row.ownerId, label: row.owner.name }, payer: { id: row.payerId, label: row.payer.name } }
  })
  const rates = new Map<string, string | null>()
  return calculateReport(inputs, opt.by, opt.split, opt.target, async (amount, date, from, to) => {
    const key = [date, from, to].join("/")
    if (!rates.has(key)) rates.set(key, await lookupRate(date, from, to))
    const rate = rates.get(key)
    return rate ? convertMinor(amount, from, to, rate) : null
  })
}

export type Report = Awaited<ReturnType<typeof getReport>>
export function pivotReport(report: Report, selected: Dimension[]) {
  const subjects = new Map(selected.map(subject => [subject.id, subject]))
  for (const cell of report.breakdown) subjects.set(cell.subject.id, cell.subject)
  const byRow = new Map<string, { label: string; currency: string; amounts: Map<string, bigint> }>()
  for (const cell of report.breakdown) {
    const key = JSON.stringify([cell.group.id, cell.currency])
    let row = byRow.get(key)
    if (!row) {
      row = { label: cell.label, currency: cell.currency, amounts: new Map() }
      byRow.set(key, row)
    }
    row.amounts.set(cell.subject.id, cell.amount)
  }
  const sorted = [...byRow.values()].sort((a, b) => a.currency.localeCompare(b.currency) || a.label.localeCompare(b.label, "zh"))
  return { subjects: [...subjects.values()], rows: sorted.map(row => [row.label, row.currency,
    ...[...subjects.keys()].map(id => fromMinor(row.amounts.get(id) ?? 0n, row.currency))]) }
}

export function paramsToSearch(params: ReportParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) for (const v of [value].flat()) if (v) query.append(key, v)
  return query
}
