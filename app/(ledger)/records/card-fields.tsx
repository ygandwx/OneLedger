"use client";

import { useState } from "react";
import { cardTypes, currencies } from "@/lib/records";

type Props = {
  entities: {id:string; name:string; currency:string}[];
  initialEntityId: string | null;
  initialType: string;
  initialCurrency: string;
  fixedTermsCurrency: string | null;
  historicalTerms: boolean;
  creditLimit: string;
  annualFee: string;
  statementDay: number | null;
  paymentDay: number | null;
  annualFeeDate: string | null;
};

export function CardFields(props: Props) {
  const [type, setType] = useState(props.initialType);
  const [currency, setCurrency] = useState(props.initialCurrency);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [creditLimit, setCreditLimit] = useState(props.creditLimit);
  const [annualFee, setAnnualFee] = useState(props.annualFee);
  const unit = props.fixedTermsCurrency || currency;
  function selectEntity(id: string) {
    if (props.initialEntityId || currencyTouched || creditLimit.trim() || annualFee.trim()) return;
    const entity = props.entities.find(entity => entity.id === id);
    if (entity) setCurrency(entity.currency);
  }
  return <>
    <label>所属主体<select name="entityId" defaultValue={props.initialEntityId || ""} onChange={event => selectEntity(event.target.value)} required>
      <option value="" disabled>请选择</option>
      {props.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
    </select></label>
    <label>类型<select name="type" value={type} onChange={event => setType(event.target.value)}>
      {cardTypes.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <label>默认支付币种<select name="currency" value={currency} onChange={event => { setCurrency(event.target.value); setCurrencyTouched(true); }}>
      {currencies.map(value => <option key={value}>{value}</option>)}
    </select></label>
    {type === "信用卡" && <>
      <input type="hidden" name="termsUnit" value={unit}/>
      <label>信用额度（{unit}）<input name="creditLimit" inputMode="decimal" value={creditLimit} onChange={event => setCreditLimit(event.target.value)}/></label>
      <label>账单日（每月）<input type="number" name="statementDay" min={1} max={31} defaultValue={props.statementDay ?? ""}/></label>
      <label>还款日（每月）<input type="number" name="paymentDay" min={1} max={31} defaultValue={props.paymentDay ?? ""}/></label>
      <label>年费（{unit}）<input name="annualFee" inputMode="decimal" value={annualFee} onChange={event => setAnnualFee(event.target.value)}/></label>
      <label>年费首个日期<input name="annualFeeDate" type="date" defaultValue={props.annualFeeDate ?? ""}/></label>
      {props.initialType !== "信用卡" && props.historicalTerms && <label>
        <input type="checkbox" name="reviewTerms" required/>已核对保留的信用卡条款和提醒日期
      </label>}
    </>}
  </>;
}
