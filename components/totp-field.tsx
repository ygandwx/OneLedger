export function TotpField() {
  return <label>动态验证码
    <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
      pattern={"\\s*(?:[0-9０-９]\\s*){6}"} title="请输入六位数字" maxLength={32} required />
  </label>;
}
