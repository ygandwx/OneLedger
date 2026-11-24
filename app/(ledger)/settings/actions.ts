"use server"
import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { sendTelegram } from "@/lib/reminders"

export async function testTelegram() {
  await requireUser()
  let notice = "测试消息已发送"
  try { await sendTelegram("OneLedger 提醒测试成功。") }
  catch (error) { notice = error instanceof Error ? error.message : "测试发送失败" }
  redirect("/settings?notice=" + encodeURIComponent(notice))
}
export async function readNotifications(form: FormData) {
  await requireUser()
  const ids = form.getAll("id").filter((v): v is string => typeof v === "string")
  if (ids.length) await db.notification.updateMany({ where: { id: { in: ids }, channel: "站内" }, data: { read: true } })
  redirect("/settings")
}
