import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FILE_CATEGORIES } from "@/lib/files";
import { DataTable } from "@/components/data-table";
import { archiveFile, updateMetadata } from "./actions";
type Query = { entityId?:string; expenseId?:string; recurringId?:string; edit?:string; archived?:string; notice?:string; error?:string };
export default async function Files({searchParams}:{searchParams:Promise<Query>}) {
  await requireUser();
  const q = await searchParams;
  const [files, entities, expenses, items, edit] = await Promise.all([
    db.storedFile.findMany({where:{ archived:q.archived === "1",entityId:q.entityId || undefined, expenseId:q.expenseId || undefined, recurringId:q.recurringId || undefined },include:{entity:true,expense:true,recurring:true},orderBy:{uploadedAt:"desc"}}),
    db.entity.findMany({orderBy:{name:"asc"}}),
    db.expense.findMany({where:{deleted:false},select:{id:true,date:true,ownerId:true,orderNumber:true,website:{select:{name:true}}},orderBy:[{date:"desc"},{createdAt:"desc"}]}),
    db.recurringItem.findMany({orderBy:{title:"asc"}}),
    q.edit ? db.storedFile.findUnique({where:{id:q.edit}}) : null,
  ]);
  const chosenEntity = edit?.entityId || q.entityId || expenses.find(e=>e.id===q.expenseId)?.ownerId || items.find(e=>e.id===q.recurringId)?.entityId;
  const hidden = q.archived === "1";
  const filters = new URLSearchParams();
  for (const key of ["entityId","expenseId","recurringId"] as const) if(q[key]) filters.set(key,q[key]);
  if (!hidden) filters.set("archived","1");
  const fields = <div className="grid">
    <label>标题<input name="title" maxLength={200} defaultValue={edit?.title} required/></label>
    <label>所属主体<select name="entityId" defaultValue={chosenEntity || ""} required><option value="">请选择</option>{entities.filter(e=>!e.archived || e.id===chosenEntity).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <label>分类<select name="category" defaultValue={edit?.category || (q.expenseId ? "发票收据" : "其他")}>{FILE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>到期日<input type="date" name="expiresOn" defaultValue={edit?.expiresOn || ""}/></label>
    <label>关联支出<select name="expenseId" defaultValue={edit?.expenseId || q.expenseId || ""}><option value="">无</option>{expenses.map(e=><option value={e.id} key={e.id}>{e.date} · {e.website?.name || "线下"} · {e.orderNumber || e.id.slice(-6)}</option>)}</select></label>
    <label>关联周期事项<select name="recurringId" defaultValue={edit?.recurringId || q.recurringId || ""}><option value="">无</option>{items.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
  </div>;
  return <><h1>文件管理</h1>{q.notice && <p role="status">{q.notice}</p>}{q.error && <p role="alert">{q.error}</p>}
    <section className="panel"><h2>{edit ? "编辑文件信息" : "上传文件"}</h2>
    {edit ? <form action={updateMetadata}><input type="hidden" name="id" value={edit.id}/>{fields}<div className="actions"><button>保存</button><Link href="/files">取消</Link></div></form> :
      <form action="/api/files" method="post" encType="multipart/form-data">{fields}<div className="actions"><label>选择文件（最多 25 MB）<input type="file" name="file" required/></label><button>上传</button></div></form>}
    </section><section className="panel"><h2>{hidden ? "已归档文件" : "文件列表"}</h2>
    <div className="actions"><Link href={"/files?"+filters}>{hidden ? "查看使用中的文件" : "查看归档"}</Link>{(q.entityId||q.expenseId||q.recurringId) && <Link href="/files">显示全部文件</Link>}</div>
    <DataTable headers={["标题 / 原文件名","所属主体","分类","到期日","关联记录","大小","操作"]} rows={files.map(f=>[
      <span key="title">{f.title}<br/><small>{f.originalName}</small></span>, f.entity.name, f.category, f.expiresOn || "—",
      f.expenseId ? <Link key="expense" href={"/expenses/"+f.expenseId}>支出 · {f.expense?.date}</Link> : f.recurring?.title || "—",
      f.size < 1024*1024 ? Math.ceil(f.size/1024)+" KB" : (f.size/1024/1024).toFixed(1)+" MB",
      <div key="actions" className="actions">{(f.mimeType==="application/pdf"||f.mimeType.startsWith("image/"))&&<a target="_blank" rel="noreferrer" href={"/api/files/"+f.id+"?preview=1"}>预览</a>}<a href={"/api/files/"+f.id}>下载</a><Link href={"/files?edit="+f.id}>编辑</Link>
      <form action={archiveFile}><input type="hidden" name="id" value={f.id}/><input type="hidden" name="archive" value={hidden?"0":"1"}/><button className="secondary">{hidden?"恢复":"归档"}</button></form></div>
    ])}/></section></>;
}
