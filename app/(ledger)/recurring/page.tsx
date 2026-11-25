import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { fromMinor } from "@/lib/money"
import { todayLocal } from "@/lib/calendar"
import { FREQUENCIES, ITEM_TYPES } from "@/lib/recurrence-dates"
import { DataTable } from "@/components/data-table"
import { finishOccurrence, saveRecurring } from "./actions"
import { CurrencyFields } from "./currency-fields"
export default async function RecurringPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string; error?: string }> }) {
  await requireUser()
  const q = await searchParams
  const items = await db.recurringItem.findMany({ include: { entity: true, card: true }, orderBy: { nextDue: "asc" } })
  const edit = items.find(i => i.id === q.edit)
  const showForm = Boolean(q.new || edit)
  const options = showForm ? await Promise.all([
    db.entity.findMany({ where: { OR: [{archived:false}, {id: edit?.entityId ?? ""}] }, orderBy: {name:"asc"} }),
    db.website.findMany({ where: { OR: [{archived:false}, {id: edit?.websiteId ?? ""}] }, orderBy: {name:"asc"} }),
    db.account.findMany({ where: { OR: [{archived:false}, {id: edit?.accountId ?? ""}] }, include: { website:true }, orderBy: {identifier:"asc"} }),
    db.card.findMany({ where: { OR: [{archived:false}, {id: edit?.cardId ?? ""}] }, orderBy: {name:"asc"} }),
  ]) : null
  return <><header className="actions"><h1>周期事项</h1><a className="btn" href="/recurring?new=1">新增事项</a></header>
    {q.error && <p className="panel" role="alert">{q.error}</p>}
    {edit && <p><a href={"/files?recurringId="+edit.id}>事项文件</a></p>}
    {options && <form action={saveRecurring} className="panel">
      <h2>{edit ? "编辑事项" : "新增周期事项"}</h2>
      <input type="hidden" name="id" value={edit?.id ?? ""}/><input type="hidden" name="priorDue" value={edit?.nextDue ?? ""}/>
      <div className="grid">
        <label>事项标题<input name="title" required maxLength={200} defaultValue={edit?.title}/></label>
        <label>类型<select name="type" defaultValue={edit?.type}>{ITEM_TYPES.map(v => <option key={v}>{v}</option>)}</select></label>
        <CurrencyFields subjects={options[0].map(({ id, name, currency }) => ({ id, name, currency }))}
          initialSubject={edit?.entityId ?? ""} initialCurrency={edit?.currency ?? ""}
          initialAmount={edit?.amount != null && edit.currency ? fromMinor(edit.amount, edit.currency) : ""} />
        <label>网站<select name="websiteId" defaultValue={edit?.websiteId || ""}><option value="">未指定</option>{options[1].map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label>账号<select name="accountId" defaultValue={edit?.accountId || ""}><option value="">未指定</option>{options[2].map(e => <option key={e.id} value={e.id}>{e.website.name} · {e.identifier}</option>)}</select></label>
        <label>支付工具<select name="cardId" defaultValue={edit?.cardId || ""}><option value="">未指定</option>{options[3].map(e => <option key={e.id} value={e.id}>{e.name} · 默认 {e.currency}</option>)}</select></label>
        <label>周期<select name="frequency" defaultValue={edit?.frequency || "每月"}>{FREQUENCIES.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>每 N 月的间隔<input type="number" min="1" max="1200" name="intervalMonths" defaultValue={edit?.intervalMonths ?? 1}/></label>
        <label>下次到期日<input type="date" required name="nextDue" defaultValue={edit?.nextDue || todayLocal()}/></label>
        <label>提前提醒天数（逗号分隔）<input required name="reminderDays" defaultValue={edit?.reminderDays ?? "7,1"}/></label>
        <label>状态<select name="status" defaultValue={edit?.status}>{["有效","暂停","已取消"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label>备注<textarea name="notes" defaultValue={edit?.notes}/></label>
      </div><label><input type="checkbox" name="autoGenerate" defaultChecked={edit?.autoGenerate}/> 到期自动生成待确认支出</label>
      <div className="actions"><button>保存事项</button><a href="/recurring">返回列表</a></div>
    </form>}
    <section className="panel"><DataTable headers={["事项","所属主体","到期日","周期","预计金额","状态","操作"]} rows={items.map(i => [
      <a key="edit" href={"/recurring?edit="+i.id}>{i.title}</a>, i.entity.name, i.nextDue,
      i.frequency === "每 N 月" ? `每 ${i.intervalMonths} 月` : i.frequency,
      i.amount != null && i.currency ? fromMinor(i.amount,i.currency) + " " + i.currency : "—", i.status,
      i.status === "有效" && !i.autoGenerate ? <form key="finish" action={finishOccurrence}><input type="hidden" name="id" value={i.id}/><input type="hidden" name="priorDue" value={i.nextDue}/><button className="secondary">完成本期</button></form> : <a key="manage" href={"/recurring?edit="+i.id}>编辑</a>,
    ])}/></section>
  </>
}
