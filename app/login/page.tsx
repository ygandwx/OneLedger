import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { TotpField } from "@/components/totp-field";
import { login } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!await db.user.count()) redirect("/setup");
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return <main className="auth"><div className="brand"><b>壹</b> OneLedger</div><section className="panel"><h1>登录账本</h1>
    <form action={login}>
      <label>用户名<input name="username" autoComplete="username" required autoFocus /></label>
      <label>密码<input type="password" name="password" autoComplete="current-password" required maxLength={200} /></label>
      <TotpField />
      {error === "used" && <p role="alert">这组验证码已使用，或早于上次使用的验证码。请等验证器显示下一组数字后再登录。</p>}
      {error === "limit" && <p role="alert">尝试过于频繁，请在 15 分钟后重试。</p>}
      {error === "invalid" && <p role="alert">登录信息无效。请核对建账时的用户名、密码和 OneLedger 的当前验证码。若换码后仍失败，请确认手机与服务器均已自动校时。</p>}
      <button>登录</button>
    </form>
  </section></main>;
}
