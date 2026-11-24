import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { telegramConfigured } from "@/lib/reminders"
import { addDays } from "@/lib/calendar"
import { DataTable } from "@/components/data-table"
import { readNotifications, testTelegram } from "./actions"
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireUser()
  const { notice } = await searchParams
  const notices = await db.notification.findMany({ where: { channel: "站内" }, orderBy: [{ dueDate: "desc" }, { itemType: "asc" }] })
  const pending = await db.notification.count({ where: { channel: "Telegram", sentAt: null } })
  const days = new Map<string, typeof notices>()
  for (const n of notices) {
    const day = addDays(n.dueDate, -n.daysBefore)
    const group = days.get(day)
    if (group) group.push(n)
    else days.set(day, [n])
  }
  return <><h1>设置与通知</h1>{notice && <p className="panel" role="status">{notice}</p>}
    <section className="panel"><h2>提醒设置</h2><p>时区 {process.env.TZ || "Asia/Shanghai"} · 提醒计划 <code>{process.env.REMINDER_CRON || "0 9 * * *"}</code></p>
      <p>Telegram {telegramConfigured() ? "已配置" : "未配置"}{pending > 0 && ` · ${pending} 条汇总待发送`}</p>
      <form action={testTelegram}><button className="secondary">发送 Telegram 测试消息</button></form></section>
    <section className="panel"><h2>站内通知</h2><DataTable headers={["提醒日期", "到期事项", "状态"]} rows={[...days.entries()].sort((a,b) => b[0].localeCompare(a[0])).map(([day,list]) => [
      day, <ul key="events">{list.map(n => <li key={n.id}>{n.message}</li>)}</ul>,
      list.every(n => n.read) ? "已读" : <form key="read" action={readNotifications}>{list.filter(n => !n.read).map(n => <input key={n.id} type="hidden" name="id" value={n.id}/>)}<button className="secondary">标为已读</button></form>,
    ])}/></section>
  </>
}
