import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fromMinor } from "@/lib/money";
import { type ExpenseDraft, type ExpenseOptions } from "@/lib/expense-form";
import { ledgerToday } from "@/lib/expense-date";
import { ExpenseEditor } from "./editor";

export async function ExpenseScreen({ id, copy }: { id?: string; copy?: boolean }) {
  await requireUser();
  const today = ledgerToday();
  const source = id ? await db.expense.findFirst({ where: { id, deleted: false }, include: { _count: { select: { refunds: { where: { deleted: false } } } } } })
    : copy ? await db.expense.findFirst({ where: { deleted: false, refundOfId: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { _count: { select: { refunds: { where: { deleted: false } } } } } }) : null;
  if (id && !source) notFound();
  if (id && source && (source.refundOfId || source._count.refunds)) return <section className="panel"><h1>关联退款</h1><p>请在支出列表移除退款后再编辑原支出。</p><Link href="/expenses">返回支出列表</Link></section>;
  const keep = (existingId?: string | null) => ({ OR: [{ archived: false }, ...(id && existingId ? [{ id: existingId }] : [])] });
  const [entities, websites, cards, accounts, categories, recurring, history] = await Promise.all([
    db.entity.findMany({ where: { OR: [{ archived: false }, { id: { in: id && source ? [source.ownerId, source.payerId] : [] } }] }, orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } }),
    db.website.findMany({ where: keep(source?.websiteId), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.card.findMany({ where: keep(source?.cardId), orderBy: { name: "asc" }, select: { id: true, name: true, entityId: true, currency: true, status: true, last4: true } }),
    db.account.findMany({ where: keep(source?.accountId), orderBy: { identifier: "asc" }, include: { website: true, entity: true,
      bindings: { where: { endDate: null, startDate: { lte: today }, card: { archived: false } }, orderBy: { startDate: "desc" }, take: 1 } } }),
    db.category.findMany({ orderBy: { name: "asc" } }), db.recurringItem.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.expense.findMany({ where: { deleted: false, accountId: { not: null }, refundOfId: null }, distinct: ["accountId"], orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { accountId: true, categoryId: true } }),
  ]);
  const lastCategories = new Map(history.map(h => [h.accountId, h.categoryId]));
  const options: ExpenseOptions = {
    entities, websites, categories, recurring: recurring.map(r => ({ id: r.id, name: r.title })),
    cards: cards.map(c => ({ ...c, name: [c.name, c.last4 && "尾号 " + c.last4, c.status !== "正常" && c.status].filter(Boolean).join(" · ") })),
    accounts: accounts.map(a => ({ id: a.id, name: [a.website.name, a.identifier, a.entity.name].join(" · "), entityId: a.entityId,
      websiteId: a.websiteId, cardId: a.bindings[0]?.cardId ?? "", lastCategoryId: lastCategories.get(a.id) ?? "" })),
  };
  const orig = source?.originalCurrency ?? "CNY";
  const booked = source?.bookedCurrency ?? "CNY";
  const available = (list: { id: string }[], value?: string | null) => list.find(o => o.id === value)?.id ?? "";
  const initial: ExpenseDraft = {
    date: id && source ? source.date : today, websiteId: available(websites, source?.websiteId),
    accountId: available(accounts, source?.accountId), cardId: available(cards, source?.cardId),
    payerId: available(entities, source?.payerId), ownerId: available(entities, source?.ownerId),
    originalAmount: source ? fromMinor(source.originalAmount, orig) : "", originalCurrency: orig,
    bookedAmount: source ? fromMinor(source.bookedAmount, booked) : "", bookedCurrency: booked,
    fee: source ? fromMinor(source.fee, booked) : "0", orderNumber: id ? source?.orderNumber ?? "" : "",
    categoryId: source?.categoryId ?? "cat-other", status: id ? source?.status ?? "已入账" : "已入账",
    recurringId: source?.recurringId ?? "", invoiceStatus: id ? source?.invoiceStatus ?? "未取得" : "未取得",
    settled: Boolean(id && source?.settled), rateOverride: source?.rateOverride ?? "", notes: source?.notes ?? "",
  };
  return <><div className="actions"><Link href="/expenses">返回支出记录</Link></div>
    <h1>{id ? "编辑支出" : copy ? "复制上一条支出" : "记一笔支出"}</h1>
    {(!entities.length || !cards.length || !websites.length) && <p className="notice">首次录入前，请先在<Link href="/records">基础资料</Link>中添加主体、网站和支付工具。</p>}
    <ExpenseEditor id={id ?? null} initial={initial} options={options} preserveCurrencies={Boolean(source)} generated={Boolean(id && source?.recurringId)} />
  </>;
}
