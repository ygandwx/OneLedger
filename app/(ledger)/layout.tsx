import Link from "next/link";
import { LedgerNav } from "@/components/ledger-nav";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/auth-actions";
export const dynamic = "force-dynamic";
export default async function LedgerLayout({children}: {children: React.ReactNode}) {
  await requireUser();
  return <div className="shell"><aside><Link className="brand" href="/"><b>壹</b> OneLedger</Link><LedgerNav/><form action={logout}><button className="signout">退出登录</button></form></aside><main className="workspace">{children}</main></div>;
}
