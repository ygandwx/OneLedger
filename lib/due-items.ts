import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { addDays, dateInMonth } from "@/lib/calendar"
import { daysBetween, followingDue, repaymentDates } from "@/lib/recurrence-dates"

export type DueEvent = { kind: string; id: string; date: string; title: string; entity: string; daysBefore: number; href: string }
export async function dueEvents(today: string, horizon: number, forReminder = false, reader: Prisma.TransactionClient = db): Promise<DueEvent[]> {
  const end = addDays(today, horizon)
  const [items, cards, files] = await Promise.all([
    reader.recurringItem.findMany({ where: { status: "有效", nextDue: { lte: end } }, include: { entity: true } }),
    reader.card.findMany({ where: { archived: false, status: { notIn: ["已注销","停用"] } }, include: { entity: true } }),
    reader.storedFile.findMany({ where: { archived: false, expiresOn: { gte: today, lte: end } }, include: { entity: true } }),
  ])
  const result: DueEvent[] = []
  function push(kind: string, id: string, date: string, title: string, entity: string, href: string, leads = [7, 1]) {
    if (date < today || date > end) return
    const daysBefore = daysBetween(today, date)
    if (!forReminder || daysBefore === 0 || leads.includes(daysBefore)) result.push({ kind, id, date, title, entity, href, daysBefore })
  }
  for (const item of items) {
    const leads = item.reminderDays.split(",").map(Number)
    // Only the outstanding next occurrence is actionable until it has been processed.
    let date: string | null = item.nextDue
    if (date < today && !item.autoGenerate) continue
    // Catch-up for auto-generated items runs separately; project dates inside the displayed horizon.
    while (date && date <= end) {
      push("周期事项", item.id, date, item.title, item.entity.name, "/recurring?edit=" + item.id, leads)
      date = followingDue(date, item.frequency, item.intervalMonths, item.anchorDay)
    }
  }
  for (const card of cards) {
    if (card.type === "信用卡" && card.paymentDay) {
      for (const date of repaymentDates(today, end, card.statementDay, card.paymentDay)) {
        push("信用卡还款", card.id, date, card.name + " · 还款", card.entity.name, "/records?tab=cards&edit=" + card.id)
      }
    }
    if (card.type === "信用卡" && card.annualFeeDate) {
      const [firstYear, m, d] = card.annualFeeDate.split("-").map(Number)
      for (let y = Math.max(Number(today.slice(0,4)), firstYear); y <= Number(end.slice(0,4)); y++)
        push("年费", card.id, dateInMonth(y, m, d), card.name + " · 年费", card.entity.name, "/records?tab=cards&edit=" + card.id)
    }
    if (card.expiresOn) push("卡片到期", card.id, card.expiresOn, card.name + " · 到期", card.entity.name, "/records?tab=cards&edit=" + card.id)
  }
  for (const file of files) if (file.expiresOn)
    push("文件到期", file.id, file.expiresOn, file.title + " · 到期", file.entity.name, "/files?edit=" + file.id)
  return result.sort((a,b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "zh"))
}
