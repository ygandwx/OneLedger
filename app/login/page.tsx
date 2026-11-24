import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { login } from "../auth-actions";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: {searchParams: Promise<{error?: string}>}) {
  if (!await db.user.count()) redirect("/setup");
  if (await getUser()) redirect("/");
  const {error} = await searchParams;
  return <main className="auth"><div className="brand"><b>壹</b> OneLedger</div><section className="panel"><h1>登录账本</h1>
    <form action={login}><label>用户名<input name="username" autoComplete="username" required autoFocus /></label>
    <label>密码<input type="password" name="password" autoComplete="current-password" required maxLength={200}/></label>
    <label>动态验证码<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required /></label>
    {error && <p role="alert">{error === "limit" ? "尝试过于频繁，请在 15 分钟后重试。" : "登录信息无效，请检查账号、密码和最新验证码。"}</p>}<button>登录</button></form>
  </section></main>;
}
