import Decimal from "decimal.js";

export const CURRENCIES = ["CNY", "USD", "GBP", "EUR", "HKD", "SGD", "JPY"] as const;
export type Currency = typeof CURRENCIES[number];

export function isCurrency(value: string): value is Currency {
  return CURRENCIES.some(currency => currency === value);
}

export const MoneyDecimal = Decimal.clone({ precision: 64, rounding: Decimal.ROUND_HALF_UP });

function digits(currency: string) {
  if (!isCurrency(currency)) throw new Error("不支持该币种");
  return currency === "JPY" ? 0 : 2;
}

function checkRange(amount: bigint) {
  // Leave room for reversing the sign on a full refund.
  if (amount > 9223372036854775807n || amount < -9223372036854775807n) throw new Error("金额超出范围");
  return amount;
}

export function toMinor(input: string, currency: string): bigint {
  const value = input.trim();
  const places = digits(currency);
  if (value.length > 32 || !/^-?\d+(\.\d+)?$/.test(value)) throw new Error("请输入有效金额");
  const amount = new MoneyDecimal(value);
  if (amount.decimalPlaces() > places) throw new Error(`${currency} 金额最多允许 ${places} 位小数`);
  return checkRange(BigInt(amount.mul(10 ** places).toFixed(0)));
}

export function fromMinor(input: bigint, currency: string): string {
  const places = digits(currency);
  return new MoneyDecimal(input.toString()).div(10 ** places).toFixed(places);
}

export function normalizeRate(input: string): string {
  if (!/^\d+(\.\d+)?$/.test(input) || input.length > 160) throw new Error("汇率格式无效");
  const value = new MoneyDecimal(input);
  if (!value.isPositive() || value.eq(0)) throw new Error("汇率必须大于零");
  return value.toFixed();
}

export function convertMinor(input: bigint, from: string, to: string, rate: string): bigint {
  const result = new MoneyDecimal(fromMinor(input, from)).mul(normalizeRate(rate)).mul(10 ** digits(to));
  return checkRange(BigInt(result.toFixed(0)));
}
