"use client"
import { useState } from "react"
import { CURRENCIES } from "@/lib/money"

type Subject = { id: string; name: string; currency: string }

export function CurrencyFields({ subjects, initialSubject, initialCurrency, initialAmount }: {
  subjects: Subject[]; initialSubject: string; initialCurrency: string; initialAmount: string
}) {
  const [subjectId, setSubjectId] = useState(initialSubject)
  const [currency, setCurrency] = useState(initialCurrency)
  const [amount, setAmount] = useState(initialAmount)
  const subject = subjects.find(s => s.id === subjectId)
  const unit = currency || subject?.currency
  function chooseSubject(id: string) {
    if (!currency && subject && amount.trim()) setCurrency(subject.currency)
    setSubjectId(id)
  }
  return <>
    <label>所属主体<select name="entityId" required value={subjectId} onChange={e => chooseSubject(e.target.value)}>
      <option value="">请选择</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    <label>预计币种<select name="currency" value={currency} onChange={e => setCurrency(e.target.value)}>
      <option value="">{subject ? `使用主体默认币种（${subject.currency}）` : "使用主体默认币种"}</option>
      {CURRENCIES.map(c => <option key={c}>{c}</option>)}
    </select></label>
    <input type="hidden" name="displayedDefault" value={subject?.currency ?? ""}/>
    <label>预计金额{unit && `（${unit}）`}<input name="amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}/></label>
  </>
}
