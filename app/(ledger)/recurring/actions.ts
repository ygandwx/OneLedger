"use server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { isCurrency, toMinor } from "@/lib/money"
import { validDate } from "@/lib/calendar"
import { FREQUENCIES, ITEM_TYPES, followingDue } from "@/lib/recurrence-dates"

const field = (form: FormData, name: string) => String(form.get(name) || "").trim()
function invalid(message: string, id: string): never {
  const query = new URLSearchParams({ error: message, ...(id ? { edit: id } : { new: "1" }) })
  redirect("/recurring?" + query)
}
export async function saveRecurring(form: FormData) {
  await requireUser()
  const id = field(form,"id")
  const old = id ? await db.recurringItem.findUnique({ where: { id } }) : null
  if (id && !old) invalid("找不到该事项", "")
  const title = field(form,"title"), type = field(form,"type"), frequency = field(form,"frequency"), status = field(form,"status")
  const nextDue = field(form,"nextDue"), days = field(form,"reminderDays").split(/[,，\s]+/).filter(Boolean)
  const intervalMonths = frequency === "每 N 月" ? Number(field(form,"intervalMonths")) : 1
  if (!title || !ITEM_TYPES.some(t => t === type) || !FREQUENCIES.some(f => f === frequency) ||
    !["有效","暂停","已取消"].includes(status) || !validDate(nextDue)) invalid("请检查标题、状态、周期和到期日期", id)
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 1200) invalid("每 N 月的间隔须在 1 至 1200 之间", id)
  if (!days.length || days.some(day => !/^\d{1,3}$/.test(day) || Number(day) > 365)) invalid("提醒天数须为 0 至 365 的整数，用逗号分隔", id)
  const entityId = field(form,"entityId"), accountId = field(form,"accountId") || null, cardId = field(form,"cardId") || null
  let websiteId = field(form,"websiteId") || null
  const [entity, account, card] = await Promise.all([db.entity.findUnique({ where: { id: entityId } }),
    accountId ? db.account.findUnique({ where: { id: accountId } }) : null, cardId ? db.card.findUnique({ where: { id: cardId } }) : null])
  if (!entity || (entity.archived && entityId !== old?.entityId)) invalid("请选择可用的所属主体", id)
  if (accountId && (!account || (account.archived && accountId !== old?.accountId))) invalid("请选择可用账号", id)
  if (cardId && (!card || (card.archived && cardId !== old?.cardId))) invalid("请选择可用支付工具", id)
  if (account && websiteId && websiteId !== account.websiteId) invalid("账号与网站不匹配", id)
  websiteId = websiteId || account?.websiteId || null
  if (websiteId) {
    const site = await db.website.findUnique({ where: { id: websiteId } })
    if (!site || (site.archived && old?.websiteId !== websiteId)) invalid("请选择可用网站", id)
  }
  const amountText = field(form,"amount")
  // Snapshot the monetary unit once an amount is stored. A reminder with no amount may follow the subject's current default.
  const currency = field(form,"currency") || (amountText ? field(form,"displayedDefault") || entity.currency : null)
  if (currency && !isCurrency(currency)) invalid("币种无效", id)
  let amount: bigint | null = null
  if (amountText) {
    if (!currency) invalid("填写预计金额时请选择币种", id)
    try { amount = toMinor(amountText, currency) } catch { invalid("预计金额无效，请检查小数位数及金额范围", id) }
    if (amount < 0n) invalid("预计支出金额不能小于零", id)
  }
  const data = { title, type, frequency, nextDue, intervalMonths, status, entityId, websiteId, accountId, cardId, amount, currency,
    anchorDay: nextDue === old?.nextDue ? old.anchorDay : Number(nextDue.slice(8)),
    reminderDays: [...new Set(days.map(Number))].sort((a,b) => b-a).join(","), autoGenerate: form.get("autoGenerate") === "on", notes: field(form,"notes") }
  if (old) {
    const edited = await db.recurringItem.updateMany({ where: { id, nextDue: field(form,"priorDue") }, data })
    if (!edited.count) invalid("到期日已更新，请刷新核对后再保存", id)
  } else await db.recurringItem.create({ data })
  revalidatePath("/")
  redirect("/recurring")
}
export async function finishOccurrence(form: FormData) {
  await requireUser()
  const id = field(form,"id"), item = await db.recurringItem.findUnique({ where: { id } })
  if (item?.status === "有效" && item.nextDue === field(form,"priorDue")) {
    const nextDue = followingDue(item.nextDue, item.frequency, item.intervalMonths, item.anchorDay)
    await db.recurringItem.updateMany({ where: { id, status: "有效", nextDue: item.nextDue },
      data: nextDue ? { nextDue } : { status: "暂停" } })
  }
  revalidatePath("/")
  redirect("/recurring")
}
