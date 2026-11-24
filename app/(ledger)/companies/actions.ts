"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isLedgerDate } from "@/lib/expense-date";

export async function saveProfile(_error: string, form: FormData): Promise<string> {
  await requireUser();
  const field = (key: string) => String(form.get(key) ?? "").trim();
  const entityId = field("entityId");
  const fullName = field("fullName");
  const incorporationDate = field("incorporationDate") || null;
  const fiscalYearEnd = field("fiscalYearEnd") || null;
  if (!fullName) return "请填写公司全称";
  if (incorporationDate && !isLedgerDate(incorporationDate)) return "请输入有效的成立日期";
  if (fiscalYearEnd && !isLedgerDate("2000-" + fiscalYearEnd)) return "财年结束日请填写有效的月-日，例如 12-31";
  const data = {
    fullName, incorporationDate, fiscalYearEnd,
    jurisdiction: field("jurisdiction"),
    registrationNumber: field("registrationNumber"),
    registeredAddress: field("registeredAddress"),
    officeAddress: field("officeAddress"),
    directors: field("directors"),
    shareholders: field("shareholders"),
    secretaryCompany: field("secretaryCompany"),
    notes: field("notes"),
  };
  let saved: boolean;
  try {
    saved = await db.$transaction(async tx => {
      const company = await tx.entity.findFirst({where:{id:entityId,type:"公司",archived:false}});
      if (!company) return false;
      await tx.companyProfile.upsert({where:{entityId},create:{entityId,...data},update:data});
      return true;
    });
  } catch {
    return "档案保存失败，请重试";
  }
  if (!saved) return "该主体不是使用中的公司，请核对主体资料";
  revalidatePath("/companies");
  redirect("/companies?" + new URLSearchParams({entityId, saved:"1"}));
}
