import { test } from "node:test"
import assert from "node:assert/strict"
import { calculateReport } from "../lib/report-totals"

test("入账及退款按入账金额加手续费计入，排除待确认、未扣款、软删除；垫付按双方统计", async () => {
  const row = { status: "已入账", bookedAmount: 1000n, fee: 35n, deleted: false, settled: false, date: "2026-04-10",
    group: { id: "s", label: "服务" }, bookedCurrency: "USD", payer: { id: "a", label: "个人" }, owner: { id: "b", label: "公司" } }
  const rows = [row, { ...row, status: "已退款", bookedAmount: -200n, fee: -5n }, { ...row, status: "待确认" },
    { ...row, status: "未扣款" }, { ...row, deleted: true }, { ...row, settled: true, fee: 0n }]
  const calc = await calculateReport(rows, "owner", true, null, async () => null)
  assert.equal(calc.totals[0].id, "b")
  assert.equal(calc.totals[0].amount, 1830n)
  assert.equal(calc.advances[0].amount, 830n)
  assert.equal(calc.trend[0].amount, 1830n)
  assert.equal(calc.breakdown[0].amount, 1830n)
  const converted = await calculateReport(rows, "payer", true, "CNY", async (net) => net * 7n)
  assert.equal(converted.totals[0].id, "a")
  assert.equal(converted.totals[0].amount, 12810n)
  const missing = await calculateReport(rows, "payer", false, "CNY", async () => null)
  assert.equal(missing.missing.length, 1)
})

test("折回原币时按单条覆盖汇率倒数折算净额，其他目标币仍使用历史报价", async () => {
  const row = { status: "已入账", bookedAmount: 1500n, fee: 20n, deleted:false, settled:true, date:"2026-04-10",
    group: { id:"s", label:"服务" }, bookedCurrency:"CNY", originalCurrency:"USD", rateOverride:"7.6",
    owner:{id:"b",label:"公司"}, payer:{id:"b",label:"公司"} }
  const usd = await calculateReport([row], "owner", false, "USD", async () => null)
  assert.equal(usd.totals[0].amount, 200n)
  const jpy = await calculateReport([row], "owner", false, "JPY", async () => 320n)
  assert.equal(jpy.totals[0].amount, 320n)
})
