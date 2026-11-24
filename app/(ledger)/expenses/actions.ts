"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { convertMinor, isCurrency, normalizeRate, toMinor } from "@/lib/money";
import { isLedgerDate, ledgerToday } from "@/lib/expense-date";
import { INVOICE_STATUSES, ORDINARY_STATUSES } from "@/lib/expense-form";
import { lookupRate, syncRates } from "@/lib/rates";

function expenseChanged() {
  for (const path of ["/expenses", "/reports", "/"]) revalidatePath(path);
}

async function readExpense(form: FormData) {
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const date = field("date");
  const originalCurrency = field("originalCurrency");
  const bookedCurrency = field("bookedCurrency");
  const status = field("status");
  const invoiceStatus = field("invoiceStatus");
  if (!isLedgerDate(date) || !isCurrency(originalCurrency) || !isCurrency(bookedCurrency)) throw new Error("日期或币种无效");
  if (!ORDINARY_STATUSES.some(s => s === status) || !INVOICE_STATUSES.some(s => s === invoiceStatus)) throw new Error("状态无效");
  const originalAmount = toMinor(field("originalAmount"), originalCurrency);
  const fee = toMinor(field("fee") || "0", bookedCurrency);
  const rateOverride = field("rateOverride") ? normalizeRate(field("rateOverride")) : null;
  if (originalCurrency === bookedCurrency && rateOverride && rateOverride !== "1") throw new Error("同币种汇率只能为 1");
  let bookedAmount: bigint;
  if (field("bookedAmount")) {
    bookedAmount = toMinor(field("bookedAmount"), bookedCurrency);
  } else {
    let rate = rateOverride ?? await lookupRate(date, originalCurrency, bookedCurrency);
    if (!rate) {
      try { await syncRates(date); } catch { /* The manual paths remain available offline. */ }
      rate = await lookupRate(date, originalCurrency, bookedCurrency);
    }
    if (!rate) throw new Error("缺少交易日汇率，请填写实际入账金额、覆盖汇率或在汇率页补录报价");
    bookedAmount = convertMinor(originalAmount, originalCurrency, bookedCurrency, rate);
  }
  if (originalAmount < 0n || bookedAmount < 0n || fee < 0n) throw new Error("支出和手续费不能为负，退款请使用支出列表中的退款按钮");
  if (status === "已入账" && bookedAmount + fee === 0n) throw new Error("已入账支出的总额必须大于零");
  return {
    date, originalCurrency, bookedCurrency, originalAmount, bookedAmount, fee, rateOverride, status, invoiceStatus,
    accountId: field("accountId") || null, websiteId: field("websiteId") || null, cardId: field("cardId") || null,
    payerId: field("payerId"), ownerId: field("ownerId"), categoryId: field("categoryId"), recurringId: field("recurringId") || null,
    orderNumber: field("orderNumber"), notes: field("notes"), settled: form.get("settled") === "on",
  };
}

function friendlyError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) return "记录已变化或引用的数据无效，请刷新后重试";
  return error instanceof Error ? error.message : "保存失败，请重试";
}

export async function saveExpense(id: string | null, _: string, form: FormData) {
  await requireUser();
  try {
    const data = await readExpense(form);
    await db.$transaction(async tx => {
      const current = id ? await tx.expense.findFirst({ where: { id, deleted: false }, include: { refunds: { where: { deleted: false }, select: { id: true }, take: 1 } } }) : null;
      if (id && !current) throw new Error("这笔支出已删除");
      if (current?.refundOfId || current?.refunds.length) throw new Error("此记录已关联退款，请先撤销退款再编辑");
      const [account, card, website, payer, owner] = await Promise.all([
        data.accountId ? tx.account.findUnique({ where: { id: data.accountId } }) : null,
        data.cardId ? tx.card.findUnique({ where: { id: data.cardId } }) : null,
        data.websiteId ? tx.website.findUnique({ where: { id: data.websiteId } }) : null,
        tx.entity.findUnique({ where: { id: data.payerId } }),
        tx.entity.findUnique({ where: { id: data.ownerId } }),
      ]);
      if (!payer || !owner || (payer.archived && payer.id !== current?.payerId) || (owner.archived && owner.id !== current?.ownerId)) throw new Error("请选择有效的付款和归属主体");
      if (data.accountId && (!account || account.websiteId !== data.websiteId || (account.archived && account.id !== current?.accountId))) throw new Error("账号与网站不匹配或已归档");
      if (!website && (!current?.recurringId || data.websiteId)) throw new Error("请选择网站");
      if (!card && (!current?.recurringId || data.cardId)) throw new Error("请选择支付工具");
      if ((website?.archived && website.id !== current?.websiteId) || (card?.archived && card.id !== current?.cardId)) throw new Error("所选资料已归档");
      if (current?.occurrenceDate && data.recurringId !== current.recurringId) throw new Error("自动生成的支出必须保留其周期事项");
      if (id) await tx.expense.update({ where: { id }, data });
      else await tx.expense.create({ data });
    });
  } catch (error) { return friendlyError(error); }
  expenseChanged();
  redirect("/expenses");
}

export async function refundExpense(id: string) {
  await requireUser();
  let message = "已生成全额退款";
  try {
    await db.$transaction(async tx => {
      const source = await tx.expense.findFirst({ where: { id, deleted: false, status: "已入账", refundOfId: null }, include: { refunds: { where: { deleted: false }, take: 1 } } });
      if (!source || source.refunds.length) throw new Error("该支出已退款或尚未入账");
      await tx.expense.create({ data: {
        date: ledgerToday(), payerId: source.payerId, ownerId: source.ownerId, websiteId: source.websiteId,
        accountId: source.accountId, cardId: source.cardId, categoryId: source.categoryId, refundOfId: source.id,
        recurringId: source.recurringId, orderNumber: source.orderNumber, invoiceStatus: source.invoiceStatus,
        originalAmount: -source.originalAmount, originalCurrency: source.originalCurrency, bookedAmount: -source.bookedAmount,
        bookedCurrency: source.bookedCurrency, fee: -source.fee, status: "已退款", settled: source.settled,
        rateOverride: source.rateOverride, notes: `退回 ${source.date} 的支出`,
      } });
    });
  } catch (error) { message = friendlyError(error); }
  expenseChanged();
  redirect("/expenses?notice=" + encodeURIComponent(message));
}

export async function removeExpense(id: string) {
  await requireUser();
  const result = await db.expense.updateMany({
    where: { id, deleted: false, refunds: { none: { deleted: false } } }, data: { deleted: true },
  });
  expenseChanged();
  redirect("/expenses?notice=" + encodeURIComponent(result.count ? "已移除记录" : "请先移除关联的退款"));
}
