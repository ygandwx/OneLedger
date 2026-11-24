import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ledgerToday } from "@/lib/expense-date";
import { RateForms } from "./forms";

export default async function Rates({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser();
  const query = await searchParams;
  const total = await db.exchangeRate.count();
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(query.page ?? "", 10) || 1));
  const rows = await db.exchangeRate.findMany({ orderBy: [{ date: "desc" }, { base: "asc" }, { quote: "asc" }], skip: (page - 1) * 20, take: 20 });
  return <><h1>汇率</h1><RateForms today={ledgerToday()} />
    <section className="panel"><h2>报价记录</h2>
      <DataTable headers={["报价日期", "基准币种", "目标币种", "汇率", "来源"]} rows={rows.map(r => [r.date, r.base, r.quote, r.rate, r.source])} />
      {pages > 1 && <div className="actions pager">{page > 1 && <Link href={`?page=${page - 1}`}>上一页</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={`?page=${page + 1}`}>下一页</Link>}</div>}
    </section></>;
}
