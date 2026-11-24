"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "首页"], ["/expenses", "支出明细"], ["/reports", "支出报表"],
  ["/records", "基础资料"], ["/recurring", "周期事项"], ["/companies", "公司档案"], ["/files", "文件管理"], ["/rates", "汇率"], ["/settings", "设置与通知"],
];
export function LedgerNav() {
  const pathname = usePathname();
  return <nav aria-label="账本导航">{links.map(([url, label]) => {
    const active = pathname === url || pathname.startsWith(url + "/");
    return <Link href={url} key={url} aria-current={active ? "page" : undefined}>{label}</Link>;
  })}</nav>;
}
