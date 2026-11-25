import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { fromMinor } from "@/lib/money"
import { todayLocal } from "@/lib/calendar"
import { dueEvents } from "@/lib/due-items"
import { DataTable } from "@/components/data-table"
import { reviewCharge } from "./dashboard-actions"

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireUser()
  const { notice } = await searchParams
  const today = todayLocal()
  const [expenses, due, charges, cards, unread] = await Promise.all([
    db.expense.findMany({ where: { deleted: false, status: { in: ["已入账","已退款"] }, date: { gte: today.slice(0,4)+"-01-01", lte: today } },
      select: { date: true, bookedCurrency: true, bookedAmount: true, fee: true } }),
    dueEvents(today, 30),
    db.expense.findMany({ where: { status: "待确认", deleted: false }, include: { owner: true, website: true, recurring: true }, orderBy: { date: "asc" } }),
    db.card.findMany({ where: { OR: [{ status: {not: "正常"} }, {archived:true}], AND: [{ OR: [
      {bindings: { some: { endDate: null } }}, {recurringItems: { some: { status: "有效", type:"订阅" } }}
    ] }] }, include: {entity:true, _count:{select:{bindings:{where:{endDate:null}}, recurringItems:{where:{status:"有效", type:"订阅"}}}}} }),
    db.notification.count({ where:{ channel:"站内", read:false } }),
  ])
  const months = new Map<string,bigint>(), years = new Map<string,bigint>()
  for (const e of expenses) {
    const total = e.bookedAmount + e.fee
    years.set(e.bookedCurrency, (years.get(e.bookedCurrency) ?? 0n) + total)
    if (e.date.slice(0,7) === today.slice(0,7)) months.set(e.bookedCurrency, (months.get(e.bookedCurrency) ?? 0n) + total)
  }
  return <><header className="actions"><h1>账本总览</h1><a className="btn" href="/expenses/new">记一笔支出</a></header>
    {notice && <p role="alert" className="panel">{notice}</p>}
    {unread > 0 && <p><a href="/settings">查看 {unread} 项未读提醒</a></p>}
    <div className="grid">{([["本月支出",months],["本年支出",years]] as const).map(([label, bucket]) => <article className="panel" key={label}>
      <h2>{label}</h2>{bucket.size ? [...bucket].map(([c, amount]) => <p key={c} style={{fontSize:"1.45rem",fontVariantNumeric:"tabular-nums"}}><small>{c}</small> {fromMinor(amount,c)}</p>) : <p>暂无入账支出</p>}
    </article>)}</div>
    <section className="panel"><h2>待确认扣款 · {charges.length}</h2>
      <DataTable headers={["交易日期","扣款项目","归属主体","实际入账金额与操作"]} rows={charges.map(e => [
        e.date, <a key="expense" href={"/expenses/"+e.id}>{e.recurring?.title || e.website?.name || e.notes || "支出明细"}</a>, e.owner.name,
        <form key="review" action={reviewCharge} className="actions"><input type="hidden" name="id" value={e.id}/>
          <input type="hidden" name="bookedCurrency" value={e.bookedCurrency}/>
          <label>入账金额（{e.bookedCurrency}）<input aria-label="实际入账金额" size={9} inputMode="decimal" name="amount" defaultValue={fromMinor(e.bookedAmount,e.bookedCurrency)}/></label>
          <button name="result" value="confirm">确认入账</button><button name="result" value="skip" className="secondary">未扣款</button><a href={"/expenses/"+e.id}>调整币种与手续费</a></form>,
      ])}/></section>
    <section className="panel"><h2>未来 30 天到期</h2><DataTable headers={["到期日","事项","所属主体","类型"]} rows={due.map(e => [e.date,
      <a key="open" href={e.href}>{e.title}</a>, e.entity, e.kind === "卡片到期" ? "支付工具到期" : e.kind])}/></section>
    <section className="panel"><h2>仍有绑定的异常支付工具</h2><DataTable headers={["支付工具","所属主体","状态","当前账号","有效订阅"]} rows={cards.map(c => [
      <a key="replace" href={"/records?tab=cards&edit="+c.id}>{c.name}</a>,c.entity.name,c.archived ? "已归档" : c.status,c._count.bindings,c._count.recurringItems])}/></section>
  </>
}
