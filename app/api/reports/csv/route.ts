import { requireUser } from "@/lib/auth"
import { getReport, GROUPS, reportOptions, type ReportParams } from "@/lib/reports"
import { fromMinor } from "@/lib/money"

function quoted(value: string, numeric = false) {
  const safe = !numeric && /^[\s]*[=+@-]|^[\t\r]/.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}
export async function GET(request: Request) {
  await requireUser()
  const query = new URL(request.url).searchParams
  const params: ReportParams = Object.fromEntries([...new Set(query.keys())].map(key => [key, query.getAll(key)]))
  let opt
  try { opt = reportOptions(params) } catch { return new Response("无效的报表期间", { status: 400 }) }
  const report = await getReport(opt)
  if (report.missing.length) return new Response("请先补录汇率：" + report.missing.join("，"), { status: 422 })
  const data = [
    ...report.totals.map(t => ["期间合计", t.label, "", t.currency, fromMinor(t.amount, t.currency)]),
    ...report.breakdown.map(t => ["按" + GROUPS[opt.group], t.subject.label, t.label, t.currency, fromMinor(t.amount, t.currency)]),
    ...report.trend.map(t => ["月度趋势", t.subject.label, t.month, t.currency, fromMinor(t.amount, t.currency)]),
    ...report.advances.map(t => ["未结清垫付", t.label, "", t.currency, fromMinor(t.amount, t.currency)]),
  ]
  const body = "\uFEFF" + ["报表,主体,分组,币种,金额", ...data.map(row => row.map((cell, i) => quoted(cell, i === 4)).join(","))].join("\r\n")
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="oneledger-${opt.start}-${opt.end}.csv"` } })
}
