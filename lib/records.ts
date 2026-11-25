export const recordTypes = {
  entities: "主体",
  websites: "网站",
  accounts: "账号",
  cards: "支付工具",
  bindings: "绑卡记录",
} as const;

export type RecordType = keyof typeof recordTypes;
export { CURRENCIES as currencies } from "@/lib/money";
export const cardTypes = ["信用卡", "借记卡", "虚拟卡", "PayPal", "支付宝", "微信", "银行账户", "其他"];
export const cardStatuses = ["正常", "冻结", "挂失", "停用", "已注销", "已过期"];
export const accountStatuses = ["正常", "暂停", "停用"];

export function recordType(value: string): RecordType {
  return Object.hasOwn(recordTypes, value) ? value as RecordType : "entities";
}

export const creditFields = ["creditLimit", "statementDay", "paymentDay", "annualFee", "annualFeeDate"] as const;

type Terms = {
  creditLimit: bigint | null;
  statementDay: number | null;
  paymentDay: number | null;
  annualFee: bigint | null;
  annualFeeDate: string | null;
  termsCurrency: string | null;
  currency: string;
};

export function hasCreditTerms(card: Terms) {
  return creditFields.some(field => card[field] !== null);
}

// The old schema denominated both amounts in the payment tool's currency.
export function existingTermsCurrency(card: Terms) {
  if (card.creditLimit === null && card.annualFee === null) return null;
  return card.termsCurrency ?? card.currency;
}
