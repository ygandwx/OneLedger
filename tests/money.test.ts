import test from "node:test";
import assert from "node:assert/strict";
import { convertMinor, fromMinor, toMinor } from "../lib/money";

test("金额以最小单位精确存取，日元无小数", () => {
  assert.equal(toMinor("123.45", "USD"), 12345n);
  assert.equal(fromMinor(-15n, "CNY"), "-0.15");
  assert.equal(toMinor("998", "JPY"), 998n);
  assert.equal(fromMinor(998n, "JPY"), "998");
  assert.throws(() => toMinor("0.01", "JPY"));
  assert.throws(() => toMinor("1.234", "GBP"));
  assert.throws(() => toMinor("9223372036854775808", "JPY"));
  assert.equal(toMinor("9007199254740993", "JPY"), 9007199254740993n);
});

test("折算按目标币最小单位四舍五入", () => {
  assert.equal(convertMinor(101n, "USD", "JPY", "150.00"), 152n);
  assert.equal(convertMinor(-101n, "USD", "JPY", "150.00"), -152n);
  assert.equal(convertMinor(1n, "JPY", "CNY", "0.05"), 5n);
});
