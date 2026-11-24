import { addDays, dateInMonth } from "./calendar"

export const FREQUENCIES = ["一次性", "每月", "每季", "每年", "每 N 月"] as const
export const ITEM_TYPES = ["订阅", "年报", "年审", "税务申报", "地址续费", "秘书费", "其他"] as const
export function followingDue(date: string, frequency: string, intervalMonths: number, anchorDay: number) {
  if (frequency === "一次性") return null
  const monthly: Record<string, number> = { "每月": 1, "每季": 3, "每年": 12, "每 N 月": intervalMonths }
  const offset = monthly[frequency]
  if (!Number.isSafeInteger(offset) || offset < 1) throw Error("周期月数无效")
  const [year, month] = date.split("-").map(Number)
  return dateInMonth(year, month + offset, anchorDay)
}

/** The repayment belonging to a statement month; a day on/before the statement day is in the next month. */
export function repaymentForStatement(monthDate: string, statementDay: number, paymentDay: number) {
  const [year, month] = monthDate.split("-").map(Number)
  return dateInMonth(year, month + (paymentDay <= statementDay ? 1 : 0), paymentDay)
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000)
}

export function repaymentDates(start: string, end: string, statement: number | null, payment: number) {
  const [year, month] = start.split("-").map(Number)
  let cursor = dateInMonth(year, month - 1, 1)
  const dates = []
  while (cursor <= end) {
    const due = repaymentForStatement(cursor, statement ?? 0, payment)
    if (due >= start && due <= end) dates.push(due)
    const [y, m] = cursor.split("-").map(Number)
    cursor = addDays(dateInMonth(y, m, 31), 1)
  }
  return dates
}
