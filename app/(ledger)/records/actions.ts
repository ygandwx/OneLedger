"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cardStatuses, cardTypes, accountStatuses, currencies, recordType, type RecordType } from "@/lib/records";
import { toMinor } from "@/lib/money";

type Tx = Prisma.TransactionClient;
class InvalidRecord extends Error {}

function field(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}
function required(value: string, label: string) {
  if (!value) throw new InvalidRecord("请填写" + label);
  return value;
}
function choice(value: string, options: readonly string[]) {
  if (!options.includes(value)) throw new InvalidRecord("请选择有效的选项");
  return value;
}
function date(value: string) {
  if (!value) return null;
  const parsed = new Date(value + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(+parsed) || parsed.toISOString().slice(0,10) !== value) {
    throw new InvalidRecord("请输入有效日期");
  }
  return value;
}
function day(value: string) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new InvalidRecord("账单日和还款日须为 1 至 31");
  return n;
}
function amount(value: string, currency: string) {
  if (!value) return null;
  try {
    const n = toMinor(value, currency);
    if (n >= 0n) return n;
  } catch {}
  throw new InvalidRecord("额度和年费须为本币精度内的非负金额");
}

async function save(tx: Tx, tab: RecordType, id: string, data: FormData) {
  const val = (k: string) => field(data, k);
  const name = val("name"), notes = val("notes");
  if (tab === "entities") {
    const type = choice(val("type"), ["个人", "公司"]);
    if (id && type === "个人" && await tx.companyProfile.count({where:{entityId:id}})) throw new InvalidRecord("已有公司档案，请保留公司类型");
    const row = { name: required(name, "主体名称"), type, currency: choice(val("currency"), currencies), notes };
    return id ? tx.entity.update({where:{id},data:row}) : tx.entity.create({data:row});
  }
  if (tab === "websites") {
    const url = val("url");
    if (url) {
      try {
        if (!["http:","https:"].includes(new URL(url).protocol)) throw new Error();
      } catch { throw new InvalidRecord("网址须为完整的 HTTP 或 HTTPS 地址"); }
    }
    const row = {name:required(name, "网站名称"), url, notes};
    return id ? tx.website.update({where:{id},data:row}) : tx.website.create({data:row});
  }
  if (tab === "accounts") {
    const entityId = val("entityId"), websiteId = val("websiteId");
    const old = id ? await tx.account.findUniqueOrThrow({where:{id}}) : null;
    if (old?.entityId !== entityId) await tx.entity.findFirstOrThrow({where:{id:entityId,archived:false}});
    if (old?.websiteId !== websiteId) {
      await tx.website.findFirstOrThrow({where:{id:websiteId,archived:false}});
      if (old && (await tx.expense.count({where:{accountId:id}}) || await tx.recurringItem.count({where:{accountId:id}}))) {
        throw new InvalidRecord("该账号已有支出或周期事项。请在新网站下另建账号，以保留原网站记录");
      }
    }
    const row = {identifier:required(val("identifier"),"账号标识"),entityId,websiteId,status:choice(val("status"), accountStatuses),notes};
    return id ? tx.account.update({where:{id},data:row}) : tx.account.create({data:row});
  }
  if (tab === "cards") {
    const old = id ? await tx.card.findUniqueOrThrow({where:{id}}) : null;
    const currency = choice(val("currency"), currencies), last4 = val("last4") || null;
    if (last4 && !/^\d{4}$/.test(last4)) throw new InvalidRecord("卡号后四位须为四位数字");
    const entityId = val("entityId");
    if (old?.entityId !== entityId) await tx.entity.findFirstOrThrow({where:{id:entityId,archived:false}});
    const row = {
      name:required(name, "支付工具昵称"), type:choice(val("type"), cardTypes), entityId, issuer:val("issuer"),
      currency, last4, expiresOn:date(val("expiresOn")), status:choice(val("status"), cardStatuses),
      statementDay:day(val("statementDay")), paymentDay:day(val("paymentDay")), annualFeeDate:date(val("annualFeeDate")),
      annualFee:amount(val("annualFee"),currency), creditLimit:amount(val("creditLimit"),currency), notes,
    };
    if (old && old.status !== row.status) await tx.cardStatusLog.create({data:{cardId:id,oldStatus:old.status,newStatus:row.status,reason:val("reason")}});
    return id ? tx.card.update({where:{id},data:row}) : tx.card.create({data:row});
  }
  const accountId = val("accountId"), cardId = val("cardId");
  const startDate = required(date(val("startDate")) ?? "", "开始日期");
  const endDate = date(val("endDate"));
  if (endDate && endDate < startDate) throw new InvalidRecord("结束日期不能早于开始日期");
  if (!endDate && startDate > today()) throw new InvalidRecord("当前绑卡记录的开始日期不能晚于今天");
  if (endDate && endDate > today()) throw new InvalidRecord("结束日期不能晚于今天");
  const old = id ? await tx.binding.findUniqueOrThrow({where:{id}}) : null;
  if (old?.accountId !== accountId || (old?.endDate && !endDate)) await tx.account.findFirstOrThrow({where:{id:accountId,archived:false}});
  if (old?.cardId !== cardId || (old?.endDate && !endDate)) {
    await tx.card.findFirstOrThrow({where:{id:cardId,...(!endDate ? {status:"正常",archived:false} : {})}});
  }
  // Half-open intervals allow a replacement on the day the old binding ends.
  if (startDate !== endDate && await tx.binding.count({where:{accountId,id:{not:id}, ...(endDate ? {startDate:{lt:endDate}} : {}),
    OR:[{endDate:null},{endDate:{gt:startDate},NOT:{endDate:{equals:tx.binding.fields.startDate}}}]}})) {
    throw new InvalidRecord("此账号在该期间已有绑卡记录。请先结束旧绑定或调整日期");
  }
  const row = {accountId,cardId,startDate,endDate};
  return id ? tx.binding.update({where:{id},data:row}) : tx.binding.create({data:row});
}

function today() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:process.env.TZ || "Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

async function replace(tx: Tx, id: string, newId: string) {
  const old = await tx.card.findUniqueOrThrow({where:{id}});
  if (id === newId || (old.status === "正常" && !old.archived)) throw new InvalidRecord("请选择需要替换的停用支付工具");
  await tx.card.findFirstOrThrow({where:{id:newId,status:"正常",archived:false}});
  const effective = today();
  const bindings = await tx.binding.findMany({where:{cardId:id,endDate:null}});
  for (const binding of bindings) {
    await tx.binding.update({where:{id:binding.id},data:{endDate:effective}});
    await tx.binding.create({data:{cardId:newId,accountId:binding.accountId,startDate:effective}});
  }
  await tx.recurringItem.updateMany({where:{cardId:id,type:"订阅",status:"有效"},data:{cardId:newId}});
  await tx.card.update({where:{id},data:{replacementId:newId}});
}

async function archive(tx: Tx, tab: RecordType, id: string, archived: boolean) {
  const args = {where:{id},data:{archived}};
  switch (tab) {
    case "entities": return tx.entity.update(args);
    case "websites": return tx.website.update(args);
    case "accounts": return tx.account.update(args);
    case "cards": return tx.card.update(args);
    case "bindings": throw new InvalidRecord("请填写结束日期以结束绑定");
  }
}

async function remove(tx: Tx, tab: RecordType, id: string) {
  const where = { id };
  switch (tab) {
    case "entities": return tx.entity.delete({ where });
    case "websites": return tx.website.delete({ where });
    case "accounts": return tx.account.delete({ where });
    case "bindings": return tx.binding.delete({ where });
    case "cards":
      if (await tx.notification.count({where:{itemId:id}})) throw new InvalidRecord("该支付工具已有提醒记录，请使用归档");
      return tx.card.delete({ where });
  }
}

export async function editRecord(data: FormData) {
  await requireUser();
  const tab = recordType(field(data,"tab")), id = field(data,"id"), op = field(data,"op");
  let edit = id, message = "已保存", error = false;
  try {
    await db.$transaction(async tx => {
      if (op === "replace" && tab === "cards") {
        await replace(tx,id,required(field(data,"newId"),"新支付工具")); message = "已完成换绑";
      } else if (op === "archive" || op === "restore") {
        await archive(tx,tab,id,op === "archive"); message = op === "archive" ? "已归档" : "已恢复"; edit = tab === "cards" ? id : "";
      } else if (op === "end" && tab === "bindings") {
        await tx.binding.update({where:{id,endDate:null},data:{endDate:today()}}); message = "已结束绑定"; edit = "";
      } else if (op === "delete") {
        if (field(data,"confirm") !== "on") throw new InvalidRecord("请勾选确认删除");
        await remove(tx,tab,id); message = "已删除"; edit = "";
      } else if (op === "save") {
        const changed = await save(tx,tab,id,data); edit = tab === "cards" ? changed.id : "";
      } else throw new InvalidRecord("无效操作");
    });
  } catch (e) {
    error = true;
    message = e instanceof InvalidRecord ? e.message : e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
      ? "该记录已存在，请核对账号标识或当前绑定" : e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003" ? "该记录仍有关联资料，请使用归档" : "保存失败，请核对记录、金额及关联资料是否可用";
  }
  revalidatePath("/", "layout");
  const params = new URLSearchParams({tab,[error ? "error" : "notice"]:message});
  if (edit || error) params.set("edit", edit || "new");
  redirect("/records?" + params);
}
