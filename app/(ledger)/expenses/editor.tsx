"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CURRENCIES } from "@/lib/money";
import { type ExpenseDraft, type ExpenseOptions, type Option, ORDINARY_STATUSES, INVOICE_STATUSES } from "@/lib/expense-form";
import { saveExpense } from "./actions";

type EditorProps = {
  id: string | null; initial: ExpenseDraft; options: ExpenseOptions;
  generated: boolean; preserveCurrencies: boolean;
};

function hasFee(value: string) {
  return value.trim() !== "" && !/^0+(\.0*)?$/.test(value.trim());
}

export function ExpenseEditor({ id, initial, options, generated, preserveCurrencies }: EditorProps) {
  const [draft, setDraft] = useState(initial);
  const [fixedCurrencies, setFixedCurrencies] = useState({
    original: preserveCurrencies, booked: preserveCurrencies,
  });
  const [currencyNotice, setCurrencyNotice] = useState("");
  const [error, save, pending] = useActionState(saveExpense.bind(null, id), "");
  const set = (changes: Partial<ExpenseDraft>) => setDraft(current => ({ ...current, ...changes }));
  function setContext(changes: Partial<ExpenseDraft>) {
    setDraft(current => {
      const next = { ...current, ...changes };
      // A typed amount or rate already has units. Defaults only fill untouched sides.
      if (!fixedCurrencies.original && !next.originalAmount.trim() && !next.rateOverride.trim()) {
        next.originalCurrency = options.entities.find(e => e.id === next.ownerId)?.currency ?? "CNY";
      }
      if (!fixedCurrencies.booked && !next.bookedAmount.trim() && !hasFee(next.fee) && !next.rateOverride.trim()) {
        next.bookedCurrency = options.cards.find(c => c.id === next.cardId)?.currency
          ?? options.entities.find(e => e.id === next.payerId)?.currency ?? "CNY";
      }
      return next;
    });
  }

  function chooseOriginalCurrency(currency: string) {
    setFixedCurrencies(current => ({ ...current, original: true }));
    setCurrencyNotice(draft.originalAmount.trim() ? `原币金额现以 ${currency} 计价，请核对已填数字。` : "");
    set({ originalCurrency: currency, rateOverride: "" });
  }

  function chooseBookedCurrency(currency: string) {
    setFixedCurrencies(current => ({ ...current, booked: true }));
    setCurrencyNotice(draft.bookedAmount.trim() || hasFee(draft.fee)
      ? `入账金额和手续费现以 ${currency} 计价，请核对已填数字。` : "");
    set({ bookedCurrency: currency, rateOverride: "" });
  }

  function selectAccount(id: string) {
    const account = options.accounts.find(a => a.id === id);
    if (!account) return set({ accountId: "" });
    const card = options.cards.find(c => c.id === account.cardId);
    setContext({ accountId: id, websiteId: account.websiteId, ownerId: account.entityId, cardId: card?.id ?? "",
      payerId: card?.entityId ?? "", categoryId: account.lastCategoryId || "cat-other" });
  }
  function selectCard(id: string) {
    const card = options.cards.find(c => c.id === id);
    setContext({ cardId: id, payerId: card?.entityId ?? "" });
  }
  const items = (rows: Option[]) => rows.map(o => <option key={o.id} value={o.id}>{o.name}</option>);
  const currencies = CURRENCIES.map(c => <option key={c}>{c}</option>);
  return <form action={save}>
    <section className="panel"><h2>交易信息</h2>
      <div className="grid">
        <label>账号<select name="accountId" value={draft.accountId} onChange={e => selectAccount(e.target.value)}><option value="">无账号</option>{items(options.accounts)}</select></label>
        <label>交易日期<input type="date" name="date" required value={draft.date} onChange={e => set({ date: e.target.value })} /></label>
        <label>网站<select name="websiteId" required={!generated} value={draft.websiteId} onChange={e => set({ websiteId: e.target.value, accountId: "" })}><option value="">请选择</option>{items(options.websites)}</select></label>
        <label>支付工具<select name="cardId" required={!generated} value={draft.cardId} onChange={e => selectCard(e.target.value)}><option value="">请选择</option>{items(options.cards)}</select></label>
        <label>付款主体<select name="payerId" required value={draft.payerId} onChange={e => setContext({ payerId: e.target.value })}><option value="">请选择</option>{items(options.entities)}</select></label>
        <label>归属主体<select name="ownerId" required value={draft.ownerId} onChange={e => setContext({ ownerId: e.target.value })}><option value="">请选择</option>{items(options.entities)}</select></label>
      </div>
    </section>
    <section className="panel"><h2>金额与分类</h2><p className="muted">原币和入账币种可分别选择。填写实际入账金额后，按该金额记账。留空时按汇率折算。</p>
      {currencyNotice && <p role="status">{currencyNotice}</p>}<div className="grid">
      <label>原币金额（{draft.originalCurrency}）<input inputMode="decimal" name="originalAmount" required value={draft.originalAmount} onChange={e => set({ originalAmount: e.target.value })} /></label>
      <label>原币币种<select name="originalCurrency" value={draft.originalCurrency} onChange={e => chooseOriginalCurrency(e.target.value)}>{currencies}</select></label>
      <label>实际入账金额（{draft.bookedCurrency}，不含手续费）<input inputMode="decimal" name="bookedAmount" placeholder="留空按汇率折算" value={draft.bookedAmount} onChange={e => set({ bookedAmount: e.target.value })} /></label>
      <label>入账币种<select name="bookedCurrency" value={draft.bookedCurrency} onChange={e => chooseBookedCurrency(e.target.value)}>{currencies}</select></label>
      <label>外汇手续费（{draft.bookedCurrency}）<input inputMode="decimal" name="fee" value={draft.fee} onChange={e => set({ fee: e.target.value })} /></label>
      <label>覆盖汇率（{draft.originalCurrency} → {draft.bookedCurrency}）<input inputMode="decimal" name="rateOverride" placeholder="留空使用交易日汇率" value={draft.rateOverride} onChange={e => set({ rateOverride: e.target.value })} /></label>
      <label>分类<select name="categoryId" required value={draft.categoryId} onChange={e => set({ categoryId: e.target.value })}>{items(options.categories)}</select></label>
      <label>状态<select name="status" value={draft.status} onChange={e => set({ status: e.target.value })}>{ORDINARY_STATUSES.map(v => <option key={v}>{v}</option>)}</select></label>
    </div></section>
    <section className="panel"><h2>凭证与备注</h2><div className="grid">
      <label>交易流水号 / 订单号<input name="orderNumber" value={draft.orderNumber} onChange={e => set({ orderNumber: e.target.value })} /></label>
      <label>发票状态<select name="invoiceStatus" value={draft.invoiceStatus} onChange={e => set({ invoiceStatus: e.target.value })}>{INVOICE_STATUSES.map(v => <option key={v}>{v}</option>)}</select></label>
      <label>关联周期事项<select name="recurringId" value={draft.recurringId} onChange={e => set({ recurringId: e.target.value })}><option value="">无</option>{items(options.recurring)}</select></label>
      <label>垫付结清<input type="checkbox" name="settled" checked={draft.settled} onChange={e => set({ settled: e.target.checked })} /></label>
      <label>备注<textarea name="notes" value={draft.notes} onChange={e => set({ notes: e.target.value })} /></label>
    </div></section>
    {error && <p role="alert" className="notice">{error}</p>}
    <div className="actions"><button disabled={pending}>{pending ? "保存中…" : "保存支出"}</button><button className="secondary" name="afterSave" value="attach" disabled={pending}>保存并添加附件</button><Link className="secondary btn" href="/expenses">取消</Link></div>
  </form>;
}
