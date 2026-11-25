import type { Binding, Prisma } from "@prisma/client";
import type { RecordType } from "./records";

type Counts = Record<string, number>;
type BindingPeriod = Pick<Binding, "accountId" | "cardId" | "startDate" | "endDate">;

// Expenses have a calendar date, so those on a handover day could precede the change.
export function bindingHistory(period: BindingPeriod): Prisma.ExpenseWhereInput {
  return { accountId:period.accountId, cardId:period.cardId,
    date:{gte:period.startDate, ...(period.endDate ? {lte:period.endDate} : {})} };
}

export async function wouldLoseBindingHistory(db: Prisma.TransactionClient, current: BindingPeriod, next: BindingPeriod) {
  if (current.accountId === next.accountId && current.cardId === next.cardId &&
      current.startDate === next.startDate && current.endDate === next.endDate) return false;
  const lost = await db.expense.findFirst({
    where: { AND: [bindingHistory(current), { NOT: bindingHistory(next) }] }, select: { id:true },
  });
  return Boolean(lost);
}

// Historical links (including archived records and removed expenses) are retained.
export async function recordReferences(db: Prisma.TransactionClient, tab: RecordType, id: string): Promise<Counts> {
  const where = { id };
  switch (tab) {
    case "entities": {
      const { profile, _count } = await db.entity.findUniqueOrThrow({
        where, select: { profile: { select: { entityId: true } }, _count: true },
      });
      return { 公司档案: Number(Boolean(profile)), 支付工具: _count.cards, 账号: _count.accounts,
        付款支出: _count.paidExpenses, 归属支出: _count.ownedExpenses, 周期事项: _count.recurringItems, 文件: _count.files };
    }
    case "websites": {
      const { _count } = await db.website.findUniqueOrThrow({ where, select: { _count: true } });
      return { 账号: _count.accounts, 支出: _count.expenses, 周期事项: _count.recurringItems };
    }
    case "accounts": {
      const { _count } = await db.account.findUniqueOrThrow({ where, select: { _count: true } });
      return { 绑卡记录: _count.bindings, 支出: _count.expenses, 周期事项: _count.recurringItems };
    }
    case "cards": {
      const { _count, replacementId } = await db.card.findUniqueOrThrow({ where, select: { _count: true, replacementId: true } });
      const notices = await db.notification.count({
        where: { itemId: id, itemType: { in: ["信用卡还款","年费","卡片到期"] } },
      });
      return { 绑卡记录: _count.bindings, 支出: _count.expenses, 周期事项: _count.recurringItems,
        状态记录: _count.logs, 替换关系: _count.replacedCards + Number(Boolean(replacementId)), 提醒: notices };
    }
    case "bindings": {
      const binding = await db.binding.findUniqueOrThrow({ where });
      const count = await db.expense.count({ where: bindingHistory(binding) });
      return { 绑定期间的支出: count };
    }
  }
}

export function describeReferences(counts: Counts) {
  return Object.entries(counts).filter(([,value]) => value > 0)
    .map(([label, value]) => label + " " + value + " 条").join("、");
}
