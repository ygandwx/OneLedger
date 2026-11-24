import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ProfileEditor } from "./editor";
import { profileFields } from "./fields";

type Query = {entityId?:string; edit?:string; archived?:string; saved?:string};
function companyUrl(entityId:string, edit=false) {
  return "/companies?" + new URLSearchParams(edit ? {entityId,edit:"1"} : {entityId});
}

export default async function Companies({searchParams}:{searchParams:Promise<Query>}) {
  await requireUser();
  const query = await searchParams;
  const archived = query.archived === "1";
  if (!query.entityId) {
    const entities = await db.entity.findMany({where:{type:"公司",archived},include:{profile:true},orderBy:{name:"asc"}});
    return <>
      <h1>公司档案</h1>
      <section className="panel"><div className="actions">
        <Link className="btn" href="/records?tab=entities&edit=new&type=company">新增公司主体</Link>
        <Link href={archived ? "/companies" : "/companies?archived=1"}>{archived ? "查看使用中" : "查看已归档"}</Link>
      </div>
      {!entities.length && <p>{archived ? "暂无已归档公司。" : "建立公司主体后，即可填写注册资料并关联文件。"}</p>}
      {entities.length > 0 && <DataTable headers={["主体名称","公司全称","注册地","财年结束日","操作"]} rows={entities.map(x=>[
        x.name, x.profile?.fullName || "尚未建档", x.profile?.jurisdiction || "—", x.profile?.fiscalYearEnd || "—",
        <Link key={x.id} href={companyUrl(x.id,!x.profile && !archived)}>{x.profile || archived ? "查看档案" : "建立档案"}</Link>
      ])}/>}</section>
    </>;
  }

  const entity = await db.entity.findFirst({where:{id:query.entityId,type:"公司"},include:{profile:true}});
  if (!entity) return <><h1>找不到公司主体</h1><Link href="/companies">返回公司列表</Link></>;
  const {profile} = entity;
  return <>
    <Link href={entity.archived ? "/companies?archived=1" : "/companies"}>返回公司列表</Link>
    <h1>{entity.name}</h1>
    {query.saved === "1" && <p role="status">档案已保存。</p>}
    <div className="actions">
      <Link href={"/files?"+new URLSearchParams({entityId:entity.id})}>公司文件</Link>
      <Link href={"/records?"+new URLSearchParams({tab:"entities",edit:entity.id})}>管理主体</Link>
    </div>
    {query.edit === "1" && !entity.archived ? <ProfileEditor entityId={entity.id} name={entity.name} profile={profile}/> :
      <section className="panel"><div className="actions"><h2>注册与治理资料</h2>
      {!entity.archived && <Link className="btn" href={companyUrl(entity.id,true)}>{profile ? "编辑档案" : "建立档案"}</Link>}
      {entity.archived && <span>已归档</span>}</div>
      {profile ? <dl className="grid">{profileFields.map(({key,label})=><div key={key}>
        <dt className="muted">{label}</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{profile[key] || "—"}</dd>
      </div>)}</dl> : <p>尚未填写公司档案。</p>}
    </section>}
  </>;
}
