"use client";

import Link from "next/link";
import { refundExpense, removeExpense } from "./actions";

export function ExpenseActions({ id, editable, refundable }: { id: string; editable: boolean; refundable: boolean }) {
  return <div className="actions">
    {editable && <Link href={`/expenses/${id}`}>编辑</Link>}
    {refundable && <form action={refundExpense.bind(null, id)} onSubmit={e => {
      if (!window.confirm("全额退款将按今天生成独立的负数记录，同时冲减手续费。确认生成？")) e.preventDefault();
    }}><button className="secondary">全额退款</button></form>}
    <form action={removeExpense.bind(null, id)} onSubmit={e => {
      if (!window.confirm("从支出列表和报表移除这笔记录？")) e.preventDefault();
    }}><button className="secondary">移除</button></form>
  </div>;
}
