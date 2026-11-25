import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { todayLocal } from "@/lib/calendar"
import { convertMinor } from "@/lib/money"
import { lookupRate } from "@/lib/rates"
import { dueEvents, type DueEvent } from "@/lib/due-items"
import { followingDue } from "@/lib/recurrence-dates"

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export async function sendTelegram(text: string) {
  if (!telegramConfigured()) throw Error("请先配置 Telegram 机器人令牌和会话 ID")
  // Never include the URL in logs: Telegram authenticates via the request path.
  let response: Response
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }), signal: AbortSignal.timeout(12000),
    })
  } catch { throw Error("无法确认 Telegram 是否收到请求，请检查网络及机器人会话") }
  if (!response.ok || !(await response.json()).ok) throw Error("Telegram 拒绝发送，请检查令牌、会话 ID 和机器人权限")
}

function describe(event: DueEvent) {
  const when = event.daysBefore ? `还有 ${event.daysBefore} 天` : "今天到期"
  return `${event.date}（${when}）${event.entity} · ${event.title}`
}

async function saveReminders(tx: Prisma.TransactionClient, today: string, events: DueEvent[]) {
  if (!events.length) return
  const now = new Date()
  const notices = events.map(event => {
    const key = { itemType: event.kind, itemId: event.id, dueDate: event.date, daysBefore: event.daysBefore, channel: "站内" }
    return tx.notification.upsert({ where: { itemType_itemId_dueDate_daysBefore_channel: key },
      create: { ...key, message: describe(event), sentAt: now }, update: {} })
  })
  if (telegramConfigured()) {
    const heading = `OneLedger · ${today}\n共 ${events.length} 项提醒\n`
    let message = heading
    for (const e of events) {
      const line = describe(e) + "\n"
      if (message.length + line.length > 4000) {
        message += "完整列表请查看站内通知。"
        break
      }
      message += line
    }
    const key = { itemType: "每日汇总", itemId: today, dueDate: today, daysBefore: 0, channel: "Telegram" }
    notices.push(tx.notification.upsert({ where: { itemType_itemId_dueDate_daysBefore_channel: key },
      create: { ...key, message, sentAt: null }, update: {} }))
  }
  await Promise.all(notices)
}

async function deliverBatches() {
  if (!telegramConfigured()) return
  const batches = await db.notification.findMany({ where: { channel: "Telegram", sentAt: null }, orderBy: { dueDate: "asc" } })
  for (const batch of batches) {
    await sendTelegram(batch.message)
    await db.notification.update({ where: { id: batch.id }, data: { sentAt: new Date() } })
  }
}

async function generateDue(today: string) {
  const items = await db.recurringItem.findMany({ where: { autoGenerate: true, status: "有效", nextDue: { lte: today } },
    include: { entity: true, card: true, account: true } })
  for (const item of items) {
    let due: string | null = item.nextDue
    while (due && due <= today) {
      const current: string = due
      const next: string | null = followingDue(current, item.frequency, item.intervalMonths, item.anchorDay)
      const currency = item.currency || item.entity.currency
      const booked = item.card?.currency || item.entity.currency
      const amount = item.amount ?? 0n
      const rate = booked === currency ? "1" : await lookupRate(current, currency, booked)
      const updated = await db.$transaction(async tx => {
        const moved = await tx.recurringItem.updateMany({ where: { id: item.id, nextDue: current, autoGenerate: true, status: "有效" },
          data: next ? { nextDue: next } : { status: "暂停" } })
        if (!moved.count) return false
        await tx.expense.upsert({ where: { recurringId_occurrenceDate: { recurringId: item.id, occurrenceDate: current } },
          create: { date: current, recurringId: item.id, occurrenceDate: current, ownerId: item.entityId,
            payerId: item.card?.entityId || item.entityId, cardId: item.cardId, websiteId: item.websiteId || item.account?.websiteId,
            accountId: item.accountId, categoryId: item.type === "订阅" ? "cat-software" : "cat-compliance",
            originalAmount: amount, originalCurrency: currency, bookedAmount: rate ? convertMinor(amount, currency, booked, rate) : 0n,
            bookedCurrency: booked, status: "待确认", notes: rate ? item.title : item.title + " · 缺少汇率，请核对实际入账金额" }, update: {} })
        return true
      })
      if (!updated) break
      due = next
    }
  }
}

async function processDaily(today: string) {
  // Read and persist events together so deleting a tool cannot orphan its first reminder.
  await db.$transaction(async tx => {
    const events = await dueEvents(today, 365, true, tx)
    await saveReminders(tx, today, events)
  }, { timeout: 30000 })
  await generateDue(today)
  await deliverBatches()
}

// The supported deployment has a single app process; concurrent scheduler calls share a run.
let running: Promise<void> | undefined
export function runDaily(today = todayLocal()) {
  if (!running) running = processDaily(today).finally(() => { running = undefined })
  return running
}
