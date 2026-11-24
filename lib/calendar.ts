export { ledgerToday as todayLocal, isLedgerDate as validDate } from "./expense-date"

export function addDays(date: string, days: number) {
  const value = new Date(date + "T00:00:00Z")
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function dateInMonth(year: number, month: number, day: number) {
  const end = new Date(Date.UTC(year, month, 0))
  end.setUTCDate(Math.min(day, end.getUTCDate()))
  return end.toISOString().slice(0, 10)
}
