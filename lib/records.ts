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
