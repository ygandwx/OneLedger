import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Secret } from "otpauth";
import { matches } from "./auth";

const name = "ledger_enrollment";
const lifetime = 30 * 60;
const options = () => ({
  path: "/setup", httpOnly: true, sameSite: "strict" as const,
  secure: process.env.COOKIE_SECURE !== "false",
});

function mac(key: string, purpose: "grant" | "totp", payload: string) {
  return createHmac("sha256", key).update(purpose + ":" + payload).digest("hex");
}

// Only a verified setup token can issue a grant. Refreshes and retries derive
// the same secret until expiry, including across application restarts.
export async function beginEnrollment(key: string) {
  const payload = Math.floor(Date.now() / 1000 + lifetime) + "." + randomBytes(24).toString("hex");
  (await cookies()).set(name, payload + "." + mac(key, "grant", payload), { ...options(), maxAge: lifetime });
}

export async function enrollmentSecret() {
  const key = process.env.SETUP_TOKEN;
  const value = (await cookies()).get(name)?.value ?? "";
  const parts = /^(\d{10})\.([a-f0-9]{48})\.([a-f0-9]{64})$/.exec(value);
  if (!key || !parts || Number(parts[1]) <= Math.floor(Date.now() / 1000)) return null;
  const payload = parts[1] + "." + parts[2];
  if (!matches(parts[3], mac(key, "grant", payload))) return null;
  return Secret.fromHex(mac(key, "totp", payload).slice(0, 40)).base32;
}

export async function clearEnrollment() {
  (await cookies()).set(name, "", { ...options(), maxAge: 0 });
}
