import test from "node:test";
import assert from "node:assert/strict";
import { resolveRate, type RatePoint } from "../lib/rate-math";

const quotes: RatePoint[] = [
  { date: "2026-03-06", base: "EUR", quote: "USD", rate: "1.25", source: "自动" },
  { date: "2026-03-06", base: "EUR", quote: "CNY", rate: "8", source: "自动" },
  { date: "2026-03-09", base: "EUR", quote: "CNY", rate: "8.5", source: "自动" },
];

test("周末采用之前最近的完整报价，不用之后的数据", () => {
  assert.equal(resolveRate(quotes, "2026-03-08", "USD", "CNY"), "6.4");
  assert.equal(resolveRate(quotes, "2026-03-09", "USD", "CNY"), "6.4");
  assert.equal(resolveRate(quotes, "2026-03-05", "USD", "CNY"), null);
  assert.equal(resolveRate([], "2026-03-08", "USD", "USD"), "1");
});

test("同日手动直接或反向报价优先于自动报价和交叉汇率", () => {
  const rows = [...quotes, { date: "2026-03-06", base: "USD", quote: "EUR", rate: "0.5", source: "手动" }];
  assert.equal(resolveRate(rows, "2026-03-08", "EUR", "USD"), "2");
});
