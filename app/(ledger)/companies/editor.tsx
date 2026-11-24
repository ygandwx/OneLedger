"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CompanyProfile } from "@prisma/client";
import { profileFields } from "./fields";
import { saveProfile } from "./actions";

export function ProfileEditor({entityId,name,profile}:{entityId:string; name:string; profile:CompanyProfile | null}) {
  const [error, action, pending] = useActionState(saveProfile,"");
  return <form action={action} className="panel">
    <h2>{profile ? "编辑档案" : "建立档案"}</h2>
    <input type="hidden" name="entityId" value={entityId}/>
    <div className="grid">{profileFields.map(({key,label,multiline}) => {
      const value = profile?.[key] ?? (key === "fullName" ? name : "");
      return <label key={key}>{label}
        {multiline ? <textarea name={key} defaultValue={value}/> :
          <input name={key} required={key === "fullName"} defaultValue={value}
            type={key === "incorporationDate" ? "date" : "text"}
            placeholder={key === "fiscalYearEnd" ? "12-31" : undefined}/>}
      </label>;
    })}</div>
    {error && <p role="alert">{error}</p>}
    <div className="actions"><button disabled={pending}>{pending ? "保存中…" : "保存档案"}</button>
      <Link href={"/companies?"+new URLSearchParams({entityId})}>取消</Link>
    </div>
  </form>;
}
