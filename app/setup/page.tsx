import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { enrollmentSecret } from "@/lib/enrollment";
import { TotpField } from "@/components/totp-field";
import { authorizeSetup, setup } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function Setup({ searchParams }: { searchParams: Promise<{ error?: string; step?: string }> }) {
  if (await db.user.count()) redirect("/login");
  const secret = await enrollmentSecret();
  const { error, step } = await searchParams;
  return <main className="auth"><div className="brand"><b>壹</b> OneLedger</div><section className="panel">
    <h1>创建账本账号</h1>
    {secret ? <form action={setup}>
      <label>用户名<input name="username" maxLength={80} autoComplete="username" required /></label>
      <label>密码（至少 12 位）<input name="password" type="password" minLength={12} maxLength={200} autoComplete="new-password" required /></label>
      <p>在验证器中手动添加 OneLedger，选择基于时间、SHA-1、6 位数字、30 秒更新。妥善保存密钥。</p>
      <code className="secret">{secret}</code>
      <TotpField />
      {error === "code" && <p role="alert">验证码无效。当前密钥仍有效，请核对验证器条目，开启手机自动设置时间，再输入新一轮验证码。</p>}
      {error === "input" && <p role="alert">请填写用户名和 12 至 200 位的密码。</p>}
      <button>创建并进入账本</button>
    </form> : <form action={authorizeSetup}>
      <label>初始化口令<input name="setupToken" type="password" required /><small>使用部署时配置的 SETUP_TOKEN。</small></label>
      {error === "token" && <p role="alert">初始化口令无效，请重新输入。</p>}
      {error === "expired" && <p role="alert">绑定会话已失效。请重新输入初始化口令，并用新显示的密钥更新验证器条目。</p>}
      {step === "bind" && <p role="alert">绑定会话已过期或未保存在浏览器中。请重新输入初始化口令。如果反复返回此页，请允许 Cookie 并使用部署的 HTTPS 地址。</p>}
      <button>继续设置验证器</button>
    </form>}
  </section></main>;
}
