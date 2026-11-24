"use client";

import { useActionState } from "react";
import { CURRENCIES } from "@/lib/money";
import { fetchRates, saveRate } from "./actions";

export function RateForms({ today }: { today: string }) {
  const [manualMessage, manualAction, saving] = useActionState(saveRate, "");
  const [syncMessage, syncAction, syncing] = useActionState(fetchRates, "");
  const currencies = CURRENCIES.map(c => <option key={c}>{c}</option>);
  return <>
    <section className="panel"><h2>手动录入</h2>
      <form action={manualAction} className="grid">
        <label>报价日期<input type="date" name="date" defaultValue={today} required /></label>
        <label>基准币种<select name="base" defaultValue="USD">{currencies}</select></label>
        <label>目标币种<select name="quote" defaultValue="CNY">{currencies}</select></label>
        <label>1 单位基准币兑换<input name="rate" inputMode="decimal" required /></label>
        <div className="actions"><button disabled={saving}>保存汇率</button></div>
      </form><p role="status">{manualMessage}</p>
    </section>
    <section className="panel"><h2>同步 Frankfurter 汇率</h2>
      <form action={syncAction} className="grid">
        <label>历史日期（留空获取最新报价）<input type="date" name="date" max={today} /></label>
        <div className="actions"><button className="secondary" disabled={syncing}>获取报价</button></div>
      </form><p role="status">{syncMessage}</p>
    </section>
  </>;
}
