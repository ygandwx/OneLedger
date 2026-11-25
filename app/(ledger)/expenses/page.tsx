import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isLedgerDate } from "@/lib/expense-date";
import { fromMinor } from "@/lib/money";
import { type Option, ORDINARY_STATUSES } from "@/lib/expense-form";
import { DataTable } from "@/components/data-table";
import { ExpenseActions } from "./row-actions";

type Query = Record<string, string | string[] | undefined>;
export default async function Expenses({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser();
  const query = await searchParams;
  const field = (key: string) => typeof query[key] === "string" ? query[key] : "";
  const start = field("start");
  const end = field("end");
  const entity = field("entity");
  const where: Prisma.ExpenseWhereInput = { deleted: false,
    date: { ...(isLedgerDate(start) && { gte: start }), ...(isLedgerDate(end) && { lte: end }) },
    ...(entity && { OR: [{ payerId: entity }, { ownerId: entity }] }), ...(field("website") && { websiteId: field("website") }),
    ...(field("account") && { accountId: field("account") }), ...(field("card") && { cardId: field("card") }),
    ...(field("category") && { categoryId: field("category") }), ...(field("status") && { status: field("status") }),
  };
  const [count, entities, websites, accounts, cards, categories] = await Promise.all([
    db.expense.count({ where }), db.entity.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.website.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.account.findMany({ orderBy: { identifier: "asc" }, select: { id: true, identifier: true, website: { select: { name: true } }, entity: { select: { name: true } } } }),
    db.card.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(count / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(field("page"), 10) || 1));
  const expenses = await db.expense.findMany({
    where, orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20,
    include: { website: true, account: true, card: true, payer: true, owner: true, category: true,
      _count: { select: { refunds: { where: { deleted: false } } } } },
  });
  const filter = (name: string, label: string, options: Option[]) => <label>{label}<select defaultValue={field(name)} name={name}>
    <option value="">全部</option>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
  const pageHref = (num: number) => {
    const p = new URLSearchParams();
    for (const key of ["start","end","entity","website","account","card","category","status"]) if (field(key)) p.set(key, field(key));
    p.set("page", String(num));
    return "/expenses?" + p.toString();
  };
  return <><h1>支出记录</h1>
    <div className="actions"><Link className="btn" href="/expenses/new">记一笔支出</Link><Link className="btn secondary" href="/expenses/new?copy=last">复制上一条</Link></div>
    {field("notice") && <p role="status">{field("notice")}</p>}
    <details className="panel" open={Boolean(start || end || entity || field("website") || field("account") || field("card") || field("category") || field("status"))}><summary>筛选支出</summary>
      <form><div className="grid">
        <label>起始日期<input type="date" name="start" defaultValue={start} /></label><label>截止日期<input type="date" name="end" defaultValue={end} /></label>
        {filter("entity", "主体（付款或归属）", entities)}{filter("website", "网站", websites)}
        {filter("account", "账号", accounts.map(a => ({ id: a.id, name: [a.website.name, a.identifier, a.entity.name].join(" · ") })))}
        {filter("card", "支付工具", cards)}{filter("category", "分类", categories)}
        {filter("status", "状态", [...ORDINARY_STATUSES, "已退款"].map(s => ({ id:s, name:s })))}
      </div><div className="actions"><button>应用筛选</button><Link href="/expenses">清空</Link></div></form>
    </details>
    <section className="panel"><h2>交易明细 <small>共 {count} 笔</small></h2>
      <DataTable headers={["交易日期", "网站 / 账号", "付款 / 归属", "支付工具", "分类", "入账合计", "状态", "操作"]} rows={expenses.map(e => [
        e.date, <span key="site">{e.website?.name ?? "—"}<br/><small>{e.account?.identifier}</small></span>,
        <span key="entity">{e.payer.name}<br/><small>{e.owner.name}</small></span>, e.card?.name ?? "—", e.category.name,
        <span key="amount">{e.bookedCurrency} {fromMinor(e.bookedAmount + e.fee, e.bookedCurrency)}
          {(e.originalCurrency !== e.bookedCurrency || e.originalAmount !== e.bookedAmount) &&
            <><br/><small>原币 {e.originalCurrency} {fromMinor(e.originalAmount, e.originalCurrency)}</small></>}
          {e.fee !== 0n && <><br/><small>含手续费 {fromMinor(e.fee, e.bookedCurrency)}</small></>}</span>,
        e.status, <ExpenseActions key={e.id} id={e.id} editable={!e.refundOfId && !e._count.refunds} refundable={e.status === "已入账" && !e.refundOfId && !e._count.refunds} />,
      ])} />
      {pages > 1 && <div className="actions pager">{page > 1 && <Link href={pageHref(page - 1)}>上一页</Link>}<span>{page} / {pages}</span>{page < pages && <Link href={pageHref(page + 1)}>下一页</Link>}</div>}
    </section></>;
}
