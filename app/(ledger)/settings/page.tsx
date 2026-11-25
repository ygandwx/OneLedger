import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { telegramConfigured } from "@/lib/reminders"
import { addDays } from "@/lib/calendar"
import { DataTable } from "@/components/data-table"
import { TotpField } from "@/components/totp-field"
import { readNotifications, testTelegram } from "./actions"
import { changePassword } from "./password-action"

const passwordMessages = new Map([
  ["changed", "密码已修改。其他设备的登录已退出。"],
  ["length", "新密码须为 12 至 200 个字符。"],
  ["mismatch", "两次输入的新密码不一致。"],
  ["invalid", "请核对当前密码和验证器中的六位动态验证码。"],
  ["used", "这组验证码已使用。请等验证器显示下一组数字。"],
  ["limit", "尝试过于频繁，请在 15 分钟后重试。"],
  ["stale", "登录状态或验证码已变化，请刷新页面并使用最新验证码重试。"],
])

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string; password?: string }> }) {
  await requireUser()
  const { notice, password } = await searchParams
  const passwordMessage = passwordMessages.get(password ?? "")
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
    <section className="panel" id="password"><h2>修改密码</h2>
      <form action={changePassword}>
        <div className="grid">
          <label>当前密码<input type="password" name="currentPassword" autoComplete="current-password" required maxLength={200}/></label>
          <label>新密码（12 至 200 个字符）<input type="password" name="newPassword" autoComplete="new-password" required minLength={12} maxLength={200}/></label>
          <label>确认新密码<input type="password" name="confirmPassword" autoComplete="new-password" required minLength={12} maxLength={200}/></label>
          <TotpField />
        </div>
        <p className="muted">请使用新一组验证码。保存后，其他设备需要用新密码重新登录。</p>
        {passwordMessage && <p role={password === "changed" ? "status" : "alert"}>{passwordMessage}</p>}
        <button>保存新密码</button>
      </form>
    </section>
    <section className="panel"><h2>提醒设置</h2><p>时区 {process.env.TZ || "Asia/Shanghai"} · 提醒计划 <code>{process.env.REMINDER_CRON || "0 9 * * *"}</code></p>
      <p>Telegram {telegramConfigured() ? "已配置" : "未配置"}{pending > 0 && ` · ${pending} 条汇总待发送`}</p>
      <form action={testTelegram}><button className="secondary">发送 Telegram 测试消息</button></form></section>
    <section className="panel"><h2>站内通知</h2><DataTable headers={["提醒日期", "到期事项", "状态"]} rows={[...days.entries()].sort((a,b) => b[0].localeCompare(a[0])).map(([day,list]) => [
      day, <ul key="events">{list.map(n => <li key={n.id}>{n.message}</li>)}</ul>,
      list.every(n => n.read) ? "已读" : <form key="read" action={readNotifications}>{list.filter(n => !n.read).map(n => <input key={n.id} type="hidden" name="id" value={n.id}/>)}<button className="secondary">标为已读</button></form>,
    ])}/></section>
  </>
}
