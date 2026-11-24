import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth-actions";
export const dynamic = "force-dynamic";
const links = [["/","首页"],["/expenses","支出明细"],["/reports","支出报表"],["/records","基础资料"],["/rates","汇率"]];
export default async function LedgerLayout({children}: {children: React.ReactNode}) {
  await requireUser();
  return <div className="shell"><aside><Link className="brand" href="/"><b>壹</b> OneLedger</Link><nav>{links.map(([url,label])=><Link href={url} key={url}>{label}</Link>)}</nav><form action={logout}><button className="signout">退出登录</button></form></aside><main className="workspace">{children}</main></div>;
}
