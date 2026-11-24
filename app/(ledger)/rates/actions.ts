"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLedgerDate } from "@/lib/expense-date";
import { isCurrency, normalizeRate } from "@/lib/money";
import { syncRates } from "@/lib/rates";

export async function saveRate(_: string, form: FormData) {
  await requireUser();
  const date = String(form.get("date") ?? "");
  const base = String(form.get("base") ?? "");
  const quote = String(form.get("quote") ?? "");
  if (!isLedgerDate(date) || !isCurrency(base) || !isCurrency(quote) || base === quote) return "请检查日期，选择两种不同的币种";
  let rate: string;
  try { rate = normalizeRate(String(form.get("rate") ?? "").trim()); }
  catch { return "请输入大于零的有效汇率"; }
  await db.exchangeRate.upsert({
    where: { date_base_quote: { date, base, quote } },
    create: { date, base, quote, rate, source: "手动" }, update: { rate, source: "手动" },
  });
  revalidatePath("/rates");
  revalidatePath("/reports");
  return "已保存手动汇率";
}

export async function fetchRates(_: string, form: FormData) {
  await requireUser();
  const date = String(form.get("date") ?? "");
  if (date && !isLedgerDate(date)) return "请检查报价日期";
  try {
    const count = await syncRates(date || undefined);
    revalidatePath("/rates");
    revalidatePath("/reports");
    return `已获取 ${count} 条报价，同日手动汇率优先。`;
  } catch { return "暂时无法获取该日期的汇率，请重试或手动录入。"; }
}
