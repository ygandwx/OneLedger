import type { CompanyProfile } from "@prisma/client";

type ProfileField = { key: Exclude<keyof CompanyProfile,"entityId">; label:string; multiline?:boolean };
export const profileFields: ProfileField[] = [
  { key:"fullName", label:"公司全称" },
  { key:"jurisdiction", label:"注册地" },
  { key:"registrationNumber", label:"注册编号" },
  { key:"incorporationDate", label:"成立日期" },
  { key:"registeredAddress", label:"注册地址" },
  { key:"officeAddress", label:"办公地址" },
  { key:"fiscalYearEnd", label:"财年结束日（月-日）" },
  { key:"directors", label:"董事", multiline:true },
  { key:"shareholders", label:"股东", multiline:true },
  { key:"secretaryCompany", label:"秘书公司" },
  { key:"notes", label:"备注", multiline:true },
];
