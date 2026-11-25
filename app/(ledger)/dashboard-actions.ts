"use server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { toMinor } from "@/lib/money"

export async function reviewCharge(form: FormData) {
  await requireUser()
  const id = String(form.get("id") || ""), op = form.get("result")
  const pending = { id, deleted: false, status: "待确认" }
  if (op === "skip") {
    await db.expense.updateMany({ where: pending, data: { status: "未扣款" } })
  } else if (op === "confirm") {
    const expense = await db.expense.findFirst({ where: pending })
    if (!expense) redirect("/")
    if (form.get("bookedCurrency") !== expense.bookedCurrency) {
      redirect("/?notice=" + encodeURIComponent("这笔扣款的币种已更新，请核对后再确认"))
    }
    let bookedAmount: bigint
    try { bookedAmount = toMinor(String(form.get("amount") || ""), expense.bookedCurrency) }
    catch { redirect("/?notice=" + encodeURIComponent("请输入有效的实际入账金额")) }
    if (bookedAmount < 0n || bookedAmount + expense.fee <= 0n) redirect("/?notice=" + encodeURIComponent("确认扣款总额须大于零"))
    const unknownOriginal = Boolean(expense.occurrenceDate && expense.recurringId)
      && expense.originalCurrency === expense.bookedCurrency && expense.originalAmount === 0n && expense.bookedAmount === 0n
    const originalAmount = unknownOriginal ? bookedAmount : expense.originalAmount
    const updated = await db.expense.updateMany({
      where: { ...pending, bookedCurrency: expense.bookedCurrency, originalCurrency: expense.originalCurrency,
        fee: expense.fee, originalAmount: expense.originalAmount, bookedAmount: expense.bookedAmount },
      data: { bookedAmount, originalAmount, status: "已入账" },
    })
    if (!updated.count) redirect("/?notice=" + encodeURIComponent("这笔扣款已更新，请核对最新记录"))
  } else redirect("/")
  revalidatePath("/expenses")
  revalidatePath("/reports")
  redirect("/")
}
