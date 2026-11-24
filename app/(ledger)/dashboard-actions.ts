"use server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { toMinor } from "@/lib/money"

export async function reviewCharge(form: FormData) {
  await requireUser()
  const id = String(form.get("id") || ""), op = form.get("result")
  const expense = await db.expense.findFirst({ where: { id, deleted: false, status: "待确认" } })
  if (!expense || (op !== "confirm" && op !== "skip")) redirect("/")
  let bookedAmount = expense.bookedAmount
  let originalAmount = expense.originalAmount
  if (op === "confirm") {
    try { bookedAmount = toMinor(String(form.get("amount") || ""), expense.bookedCurrency) }
    catch { redirect("/?notice=" + encodeURIComponent("请输入有效的实际入账金额")) }
    if (bookedAmount < 0n || bookedAmount + expense.fee <= 0n) redirect("/?notice=" + encodeURIComponent("确认扣款总额须大于零"))
    if (expense.bookedCurrency === expense.originalCurrency && expense.originalAmount === expense.bookedAmount) originalAmount = bookedAmount
  }
  await db.expense.updateMany({ where: { id, deleted: false, status: "待确认" }, data: { bookedAmount, originalAmount, status: op === "confirm" ? "已入账" : "未扣款" } })
  revalidatePath("/expenses")
  revalidatePath("/reports")
  redirect("/")
}
