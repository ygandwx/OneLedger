import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { newSecret } from "@/lib/auth";
import { setup } from "../auth-actions";
export const dynamic = "force-dynamic";
export default async function Setup({searchParams}: {searchParams: Promise<{error?:string}>}) {
  if (await db.user.count()) redirect("/login");
  const secret = newSecret();
  const {error} = await searchParams;
  return <main className="auth"><div className="brand"><b>壹</b> OneLedger</div><section className="panel"><h1>创建账本账号</h1>
    {error && <p role="alert">{error === "token" ? "初始化口令无效。" : error === "code" ? "验证码无效。" : "请检查用户名及密码长度。"} 请使用下方新密钥重新配置验证器。</p>}
    <form action={setup}><label>初始化口令<input name="setupToken" type="password" required/><small>使用部署时配置的 SETUP_TOKEN。</small></label>
    <label>用户名<input name="username" maxLength={80} autoComplete="username" required /></label>
    <label>密码（至少 12 位）<input name="password" type="password" minLength={12} maxLength={200} autoComplete="new-password" required /></label>
    <p>在验证器中手动添加 OneLedger，选择基于时间的六位验证码，妥善保存密钥。</p><code className="secret">{secret}</code>
    <input name="secret" value={secret} type="hidden"/><label>验证器中的动态验证码<input name="code" pattern="[0-9]{6}" maxLength={6} inputMode="numeric" required /></label>
    <button>创建并进入账本</button></form></section></main>;
}
