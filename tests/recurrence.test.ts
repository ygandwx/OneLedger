import { test } from "node:test"
import assert from "node:assert/strict"
import { followingDue, repaymentDates, repaymentForStatement } from "../lib/recurrence-dates"

test("月末截短后恢复锚点，闰日年度事项保留 29 日", () => {
  assert.equal(followingDue("2024-01-31", "每月", 1, 31), "2024-02-29")
  assert.equal(followingDue("2024-02-29", "每月", 1, 31), "2024-03-31")
  assert.equal(followingDue("2024-02-29", "每年", 12, 29), "2025-02-28")
  assert.equal(followingDue("2027-02-28", "每年", 12, 29), "2028-02-29")
  assert.equal(followingDue("2025-10-31", "每季", 3, 31), "2026-01-31")
  assert.equal(followingDue("2025-11-30", "每 N 月", 2, 30), "2026-01-30")
  assert.equal(followingDue("2025-11-30", "一次性", 1, 30), null)
})

test("还款日早于账单日则跨月，可跨年，小月取最后一天，并包含当天", () => {
  assert.equal(repaymentForStatement("2025-12-01", 25, 3), "2026-01-03")
  assert.equal(repaymentForStatement("2025-02-01", 8, 31), "2025-02-28")
  assert.equal(repaymentForStatement("2024-01-01", 31, 31), "2024-02-29")
  assert.deepEqual(repaymentDates("2026-01-03", "2026-02-10", 25, 3), ["2026-01-03", "2026-02-03"])
})
