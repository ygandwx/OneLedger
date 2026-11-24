import { db } from "@/lib/db"
import { requireUser } from "@/lib/auth"
import { CURRENCIES, fromMinor } from "@/lib/money"
import { dateInMonth } from "@/lib/calendar"
import { DataTable } from "@/components/data-table"
import { GROUPS, getReport, paramsToSearch, pivotReport, reportOptions, type ReportParams } from "@/lib/reports"
import { Trend } from "./trend"

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportParams> }) {
  await requireUser()
  const params = await searchParams
  let options
  try { options = reportOptions(params) } catch (error) {
    return <section className="panel"><h1>支出报表</h1><p>{(error as Error).message}</p><a href="/reports">重选期间</a></section>
  }
  const opt = options
  const [entities, report] = await Promise.all([db.entity.findMany({ orderBy: { name: "asc" } }), getReport(opt)])
  const selected = opt.split ? entities.filter(e => opt.subjects.includes(e.id)).map(e => ({ id: e.id, label: e.name })) : []
  const pivot = pivotReport(report, selected)
  const currencies = [...new Set(report.trend.map(t => t.currency))]
  return <><header><h1>支出报表</h1><p>{opt.start} 至 {opt.end} · 按{opt.by === "owner" ? "归属" : "付款"}主体统计</p></header>
    <form className="panel" method="get"><div className="grid">
      <label>统计期间<select name="period" defaultValue={opt.period}>{["月","季","年","自定义"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>所在月、季或年的任一天<input type="date" name="anchor" defaultValue={opt.anchor} required /></label>
      <label>自定义开始<input type="date" name="start" defaultValue={opt.start} /></label>
      <label>自定义结束<input type="date" name="end" defaultValue={opt.end} /></label>
      <label>主体口径<select name="by" defaultValue={opt.by}><option value="owner">归属主体</option><option value="payer">付款主体</option></select></label>
      <label>展示方式<select name="split" defaultValue={opt.split ? "1" : "0"}><option value="0">合并汇总</option><option value="1">分主体并列</option></select></label>
      <label>分组<select name="group" defaultValue={opt.group}>{Object.entries(GROUPS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>显示币种<select name="currency" defaultValue={opt.target || ""}><option value="">按币种分别合计</option>{CURRENCIES.map(c => <option key={c} value={c}>折算为 {c}</option>)}</select></label>
    </div>{entities.length > 0 && <fieldset><legend>筛选主体（不选即全部）</legend><div className="actions">
      {entities.map(entity => <label key={entity.id}><input type="checkbox" name="subject" value={entity.id} defaultChecked={opt.subjects.includes(entity.id)} /> {entity.name}</label>)}</div></fieldset>}
      <div className="actions"><button>更新报表</button><a className="btn secondary" href={`/api/reports/csv?${paramsToSearch(params)}`}>导出当前报表 CSV</a></div>
    </form>
    {report.missing.length ? <section className="panel" role="alert"><h2>缺少折算汇率</h2><p>请在汇率页补录以下汇率，再查看完整合计。</p><ul>{report.missing.map(m => <li key={m}>{m}</li>)}</ul><a href="/rates">管理汇率</a></section> : <>
      <section className="panel"><h2>期间合计</h2><DataTable headers={["主体", "币种", "净支出"]} rows={report.totals.map(t => [t.label, t.currency, fromMinor(t.amount, t.currency)])}/></section>
      <section className="panel"><h2>按{GROUPS[opt.group]}汇总</h2><DataTable headers={[GROUPS[opt.group], "币种", ...pivot.subjects.map(s => s.label)]} rows={pivot.rows}/></section>
      {currencies.map(currency => {
        const values = report.trend.filter(t => t.currency === currency)
        const series = [...new Map(values.map(t => [t.subject.id, t.subject.label]))].map(([id, label], i) => ({ id, key: "s" + i, label }))
        const points = new Map<string, Record<string, number | string>>()
        const blank = (month: string): Record<string, number | string> => ({ month, ...Object.fromEntries(series.map(s => [s.key, 0])) })
        let month = opt.start.slice(0,7)
        const endMonth = opt.end.slice(0,7)
        const span = (Number(endMonth.slice(0,4)) - Number(month.slice(0,4))) * 12 + Number(endMonth.slice(5)) - Number(month.slice(5))
        if (span < 1200) while (month <= endMonth) {
          points.set(month, blank(month))
          if (month === endMonth) break
          month = dateInMonth(Number(month.slice(0,4)), Number(month.slice(5)) + 1, 1).slice(0,7)
        }
        for (const t of values) {
          const point = points.get(t.month) || blank(t.month)
          point[series.find(s => s.id === t.subject.id)!.key] = Number(fromMinor(t.amount, currency))
          points.set(t.month, point)
        }
        return <section key={currency} className="panel"><h2>月度趋势 · {currency}</h2>
          <Trend points={[...points.values()]} series={series} currency={currency}/></section>
      })}
      <section className="panel"><h2>期间垫付未结清</h2><DataTable headers={["付款主体 → 归属主体", "币种", "金额"]} rows={report.advances.map(a => [a.label, a.currency, fromMinor(a.amount, a.currency)])}/></section>
    </>}
  </>
}
