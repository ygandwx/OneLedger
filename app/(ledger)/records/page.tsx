import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { DataTable } from "@/components/data-table";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fromMinor } from "@/lib/money";
import { accountStatuses, cardStatuses, existingTermsCurrency, hasCreditTerms, currencies, recordType, recordTypes, type RecordType } from "@/lib/records";
import { editRecord } from "./actions";
import { CardFields } from "./card-fields";
import { describeReferences, recordReferences } from "@/lib/record-references";
import styles from "./records.module.css";

type Option = { id: string; label: string };
type Query = Record<string, string | string[] | undefined>;

function Input({label,...props}:InputHTMLAttributes<HTMLInputElement> & {label:string}) {
  return <label>{label}<input {...props}/></label>;
}

function Select({name,label,value,options}: {name:string;label:string;value?:string;options:readonly string[] | Option[]}) {
  return <label>{label}<select name={name} required defaultValue={value ?? ""}>
    <option disabled value="">请选择</option>
    {options.map(option => typeof option === "string" ? <option key={option}>{option}</option> : <option key={option.id} value={option.id}>{option.label}</option>)}
  </select></label>;
}

function ActionFields({tab,id,op}:{tab:RecordType;id?:string;op:string}) {
  return <><input type="hidden" name="tab" value={tab}/><input type="hidden" name="id" value={id || ""}/><input type="hidden" name="op" value={op}/></>;
}

function href(tab:RecordType,edit?:string,archived?:boolean) {
  const params = new URLSearchParams({tab});
  if (edit) params.set("edit",edit);
  if (archived) params.set("archived","1");
  return "/records?"+params;
}

export default async function Records({searchParams}:{searchParams:Promise<Query>}) {
  await requireUser();
  const query = await searchParams;
  const tab = recordType(String(query.tab || ""));
  const edit = typeof query.edit === "string" ? query.edit : "";
  const remove = typeof query.remove === "string" ? query.remove : "";
  const selected = remove || edit;
  const showArchived = query.archived === "1";
  const [entities, websites, accounts, cards, bindings] = await Promise.all([
    db.entity.findMany({orderBy:{name:"asc"}}),
    db.website.findMany({orderBy:{name:"asc"}}),
    db.account.findMany({include:{website:true,entity:true},orderBy:{identifier:"asc"}}),
    db.card.findMany({include:{entity:true,replacement:true},orderBy:{name:"asc"}}),
    db.binding.findMany({include:{account:{include:{website:true}},card:true},orderBy:[{startDate:"desc"},{id:"desc"}]}),
  ]);
  const entity = tab === "entities" ? entities.find(x=>x.id===selected) : undefined;
  const website = tab === "websites" ? websites.find(x=>x.id===selected) : undefined;
  const account = tab === "accounts" ? accounts.find(x=>x.id===selected) : undefined;
  const card = tab === "cards" ? cards.find(x=>x.id===selected) : undefined;
  const binding = tab === "bindings" ? bindings.find(x=>x.id===selected) : undefined;
  const record = entity || website || account || card || binding;
  const [subs,logs] = card && !remove ? await Promise.all([
    db.recurringItem.findMany({where:{cardId:card.id,type:"订阅",status:"有效"},orderBy:{title:"asc"}}),
    db.cardStatusLog.findMany({where:{cardId:card.id},orderBy:{changedAt:"desc"}}),
  ]) : [[],[]];
  const accountLabel = (a:typeof accounts[number] | typeof bindings[number]["account"]) => a.website.name + " · " + a.identifier;
  const cardLabel = (c:typeof cards[number] | typeof bindings[number]["card"]) => c.name + (c.last4 ? " · " + c.last4 : "");
  const entityOptions = entities.filter(x=>!x.archived || x.id === (card || account)?.entityId).map(x=>({id:x.id,label:x.name}));
  const websiteOptions = websites.filter(x=>!x.archived || x.id === account?.websiteId).map(x=>({id:x.id,label:x.name}));
  const cardOptions = cards.filter(x=>(!x.archived && x.status === "正常") || x.id === binding?.cardId).map(x=>({id:x.id,label:cardLabel(x)}));
  const accountOptions = accounts.filter(x=>!x.archived || x.id===binding?.accountId).map(x=>({id:x.id,label:accountLabel(x)}));
  const removeHref = (id:string) => "/records?" + new URLSearchParams({tab, remove:id, ...(showArchived && {archived:"1"})});
  const manage = (id:string) => <span key={id} className={styles.rowActions}>
    <Link href={href(tab,id,showArchived)}>管理</Link><Link className={styles.deleteLink} href={removeHref(id)}>删除</Link>
  </span>;
  const visible = (x:{archived:boolean}) => x.archived === showArchived;
  let headers: string[], rows: ReactNode[][];
  switch(tab) {
    case "entities":
      headers = ["操作","名称","类型","默认币种"];
      rows = entities.filter(visible).map(x=>[manage(x.id),x.name,x.type,x.currency]); break;
    case "websites":
      headers = ["操作","网站","网址"];
      rows = websites.filter(visible).map(x=>[manage(x.id),x.name,x.url || "—"]); break;
    case "accounts":
      headers = ["操作","账号标识","网站","所属主体","状态"];
      rows = accounts.filter(visible).map(x=>[manage(x.id),x.identifier,x.website.name,x.entity.name,x.status]); break;
    case "cards":
      headers = ["操作","支付工具","类型","所属主体","默认支付币种","状态"];
      rows = cards.filter(visible).map(x=>[manage(x.id),cardLabel(x),x.type,x.entity.name,x.currency,x.status]); break;
    case "bindings":
      headers = ["操作","账号","支付工具","开始日期","结束日期"];
      rows = bindings.map(x=>[manage(x.id),accountLabel(x.account),cardLabel(x.card),x.startDate,x.endDate || "当前绑定"]); break;
  }
  const currentBindings = card ? bindings.filter(x=>x.cardId===card.id && !x.endDate) : [];
  const canReplace = card && (card.status !== "正常" || card.archived);
  const cardUnit = card && existingTermsCurrency(card);
  const recordName = entity?.name || website?.name || (account && accountLabel(account)) || (card && cardLabel(card))
    || (binding && (accountLabel(binding.account) + " → " + cardLabel(binding.card) + "（" + binding.startDate + "）"));
  const references = remove && record ? describeReferences(await recordReferences(db,tab,record.id)) : "";
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:process.env.TZ || "Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

  return <>
    <header className="page-head"><h1>基础资料</h1></header>
    <nav aria-label="资料类型" className={styles.tabs}>{(Object.keys(recordTypes) as RecordType[]).map(key=><Link key={key} href={href(key)} aria-current={tab===key ? "page" : undefined}>{recordTypes[key]}</Link>)}</nav>
    {query.notice && <p className="notice" role="status">{String(query.notice)}</p>}
    {query.error && <p className="error" role="alert">{String(query.error)}</p>}
    {selected && selected !== "new" && !record && <p className="error" role="alert">找不到这条记录。</p>}
    {remove && record && <section className="panel" aria-labelledby="remove-title">
      <h2 id="remove-title">删除{recordTypes[tab]} · {recordName}</h2>
      {references ? <>
        <p>此记录关联{references}，需保留历史。</p>
        {binding?.endDate && <p>绑定已于 {binding.endDate} 结束。</p>}
        {"archived" in record && record.archived && <p>此记录已归档。</p>}
        {(("archived" in record && !record.archived) || (binding && !binding.endDate)) && <form action={editRecord} className="actions">
          <ActionFields tab={tab} id={record.id} op={binding ? "end" : "archive"}/>
          <button className="secondary">{binding ? "结束绑定" : "归档" + recordTypes[tab]}</button>
        </form>}
        <Link href={href(tab,undefined,showArchived)}>返回列表</Link>
      </> : <form action={editRecord}>
        <p>确认永久删除这条{recordTypes[tab]}记录？</p>
        <ActionFields tab={tab} id={record.id} op="delete"/>
        <input type="hidden" name="archived" value={showArchived ? "1" : "0"}/>
        <div className="actions"><button className={styles.deleteButton} name="confirm" value="delete">确认删除</button>
          <Link href={href(tab,undefined,showArchived)}>取消</Link></div>
      </form>}
    </section>}
    {!remove && (edit==="new" || record) && <section className="panel">
      <h2>{record ? "编辑" : "新增"}{recordTypes[tab]}</h2>
      <form action={editRecord}>
        <ActionFields tab={tab} id={record?.id} op="save"/>
        <div className="grid">
          {tab === "entities" && <>
            <Input label="名称" name="name" required defaultValue={entity?.name}/>
            <Select label="类型" name="type" options={["个人","公司"]} value={entity?.type || (query.type === "company" ? "公司" : "个人")}/>
            <Select label="默认币种" name="currency" options={currencies} value={entity?.currency || "CNY"}/>
          </>}
          {tab === "websites" && <>
            <Input label="名称" name="name" required defaultValue={website?.name}/>
            <Input label="网址" name="url" type="url" placeholder="https://" defaultValue={website?.url}/>
          </>}
          {tab === "accounts" && <>
            <Select label="所属网站" name="websiteId" options={websiteOptions} value={account?.websiteId}/>
            <Select label="所属主体" name="entityId" options={entityOptions} value={account?.entityId}/>
            <Input label="账号标识（邮箱、用户名或 ID）" name="identifier" required defaultValue={account?.identifier}/>
            <Select label="状态" name="status" options={accountStatuses} value={account?.status || "正常"}/>
          </>}
          {tab === "cards" && <>
            <Input label="昵称" name="name" required defaultValue={card?.name}/>
            <CardFields key={card?.id || "new"} initialEntityId={card?.entityId ?? null}
              entities={entities.filter(x=>!x.archived || x.id === card?.entityId).map(({id,name,currency})=>({id,name,currency}))} initialType={card?.type || "信用卡"} initialCurrency={card?.currency || "CNY"}
              fixedTermsCurrency={cardUnit ?? null} historicalTerms={card ? hasCreditTerms(card) : false}
              creditLimit={card && card.creditLimit !== null ? fromMinor(card.creditLimit,cardUnit || card.currency) : ""}
              annualFee={card && card.annualFee !== null ? fromMinor(card.annualFee,cardUnit || card.currency) : ""}
              statementDay={card?.statementDay ?? null} paymentDay={card?.paymentDay ?? null} annualFeeDate={card?.annualFeeDate ?? null}/>
            <Input label="发卡行或平台" name="issuer" defaultValue={card?.issuer}/>
            <Input label="卡号后四位" name="last4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={card?.last4 ?? ""}/>
            <Input label="有效期最后一天" name="expiresOn" type="date" defaultValue={card?.expiresOn ?? ""}/>
            <Select label="状态" name="status" options={cardStatuses} value={card?.status || "正常"}/>
            {card && <Input label="状态变更原因" name="reason"/>}

          </>}
          {tab === "bindings" && <>
            <Select label="账号" name="accountId" options={accountOptions} value={binding?.accountId}/>
            <Select label="支付工具" name="cardId" options={cardOptions} value={binding?.cardId}/>
            <Input label="开始日期" name="startDate" type="date" required defaultValue={binding?.startDate || today}/>
            <Input label="结束日期（留空表示当前）" name="endDate" type="date" defaultValue={binding?.endDate ?? ""}/>
          </>}
          {tab !== "bindings" && <label>备注<textarea name="notes" defaultValue={(entity || card || account || website)?.notes || ""}/></label>}
        </div>
        <div className="actions"><button type="submit">保存</button><Link className="secondary" href={href(tab,undefined,showArchived)}>返回列表</Link></div>
      </form>
    </section>}
    {!remove && canReplace && <section className="panel">
      <h2>换绑支付工具</h2>
      {card.replacement && <p>已替换为 {cardLabel(card.replacement)}</p>}
      <h3>当前绑定账号（{currentBindings.length}）</h3>
      {currentBindings.length > 0 && <ul>{currentBindings.map(x=><li key={x.id}>{accountLabel(x.account)}</li>)}</ul>}
      <h3>有效订阅（{subs.length}）</h3>
      {subs.length > 0 && <ul>{subs.map(x=><li key={x.id}>{x.title}</li>)}</ul>}
      <form action={editRecord}><ActionFields tab={tab} id={card.id} op="replace"/>
        <Select label="替换为" name="newId" options={cardOptions.filter(x=>x.id!==card.id)}/>
        <button type="submit">将全部账号和有效订阅换绑</button>
      </form>
    </section>}
    {card && logs.length > 0 && <section className="panel"><h2>状态变更记录</h2>
      <DataTable headers={["时间","原状态","新状态","原因"]} rows={logs.map(x=>[x.changedAt.toLocaleString("zh-CN",{timeZone:process.env.TZ || "Asia/Shanghai"}), x.oldStatus,x.newStatus,x.reason || "—"])}/>
    </section>}
    {!remove && record && <section className="panel"><h2>记录管理</h2>
      {("archived" in record || (binding && !binding.endDate)) && <form action={editRecord} className="actions">
        <ActionFields tab={tab} id={record.id} op={"archived" in record ? record.archived ? "restore" : "archive" : "end"}/>
        <button className="secondary">{"archived" in record ? record.archived ? "恢复使用" : "归档" : "结束绑定"}</button>
      </form>}
      <Link className={styles.deleteLink} href={removeHref(record.id)}>删除{recordTypes[tab]}</Link>
    </section>}
    <section className="panel"><header className="actions">
      <h2>{recordTypes[tab]}列表</h2><Link className="btn" href={href(tab,"new")}>新增{recordTypes[tab]}</Link>
      {tab !== "bindings" && <Link href={href(tab,undefined,!showArchived)}>{showArchived ? "查看使用中" : "查看已归档"}</Link>}
    </header><DataTable headers={headers} rows={rows}/></section>
  </>;
}
