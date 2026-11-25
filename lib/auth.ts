import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hash } from "@node-rs/argon2";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TOTP } from "otpauth";
import { db } from "./db";

const cookieName = "ledger_session";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function matches(a: string, b: string) {
  return Boolean(a && b) && timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}
export async function currentSessionId() {
  const token = (await cookies()).get(cookieName)?.value;
  return token ? digest(token) : null;
}
export async function getUser() {
  const id = await currentSessionId();
  if (!id) return null;
  const session = await db.session.findUnique({ where: { id } });
  return session && session.expiresAt > new Date() ? session.userId : null;
}
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
export function hashPassword(password: string) {
  return hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 1 });
}
export async function createSession(tx: Prisma.TransactionClient, userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await tx.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  await tx.session.create({ data: { id: digest(token), userId, expiresAt } });
  return { token, expiresAt };
}
export async function setSessionCookie({ token, expiresAt }: { token: string; expiresAt: Date }) {
  (await cookies()).set(cookieName, token, { httpOnly: true, secure: process.env.COOKIE_SECURE !== "false", sameSite: "strict", path: "/", expires: expiresAt });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  jar.delete(cookieName);
}
export function verifyStep(secret: string, input: string) {
  const token = input.normalize("NFKC").replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return null;
  const now = Date.now();
  const delta = new TOTP({ secret, digits: 6, period: 30 }).validate({ token, timestamp: now, window: 1 });
  return delta === null ? null : Math.floor(now / 30000) + delta;
}
// Single-user service: persist one counter so changing IP or username cannot reset it.
export async function reserveAttempt() {
  const now = new Date();
  return db.$transaction(async tx => {
    const current = await tx.loginLimit.findUnique({ where: { id: "login" } });
    if (current && current.until > now && current.failures >= 8) return false;
    if (current && current.until > now) {
      await tx.loginLimit.update({ where: { id: "login" }, data: { failures: { increment: 1 } } });
    } else {
      const data = { failures: 1, until: new Date(now.getTime() + 15 * 60000) };
      await tx.loginLimit.upsert({ where: { id: "login" }, update: data, create: { id: "login", ...data } });
    }
    return true;
  });
}
