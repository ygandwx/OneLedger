import { requireUser } from "@/lib/auth";
export default async function Home() {
  await requireUser();
  return <><h1>我的账本</h1><section className="panel"><h2>账本已就绪</h2><p>唯一账号与双重验证已启用。</p></section></>;
}
