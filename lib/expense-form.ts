export const ORDINARY_STATUSES = ["待确认", "已入账", "未扣款"] as const;
export const INVOICE_STATUSES = ["未取得", "已取得", "无需发票"] as const;

export type ExpenseDraft = {
  date: string; websiteId: string; accountId: string; cardId: string; payerId: string; ownerId: string;
  originalAmount: string; originalCurrency: string; bookedAmount: string; bookedCurrency: string; fee: string;
  orderNumber: string; categoryId: string; status: string; recurringId: string; invoiceStatus: string;
  settled: boolean; rateOverride: string; notes: string;
};

export type Option = { id: string; name: string };
export type ExpenseOptions = {
  websites: Option[]; entities: Option[]; categories: Option[]; recurring: Option[];
  cards: (Option & { entityId: string; currency: string })[];
  accounts: (Option & { websiteId: string; entityId: string; cardId: string; lastCategoryId: string })[];
};
