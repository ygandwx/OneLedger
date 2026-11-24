"use server";
import { hash, verify } from "@node-rs/argon2";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { endSession, matches, reserveAttempt, startSession, verifyStep } from "@/lib/auth";

const field = (f: FormData, name: string) => String(f.get(name) ?? "");
export async function setup(f: FormData) {
  if (await db.user.count()) redirect("/login");
  if (!matches(field(f, "setupToken"), process.env.SETUP_TOKEN ?? "")) return redirect("/setup?error=token");
  const username = field(f, "username").trim(), password = field(f, "password"), secret = field(f, "secret");
  if (!username || username.length > 80 || password.length < 12 || password.length > 200 || !/^[A-Z2-7]{32}$/.test(secret)) redirect("/setup?error=input");
  const step = verifyStep(secret, field(f, "code"));
  if (step === null) redirect("/setup?error=code");
  const passwordHash = await hash(password, { memoryCost: 65536, timeCost: 3, parallelism: 1 });
  try {
    await db.user.create({ data: { id: 1, username, passwordHash, totpSecret: secret, lastTotpStep: step } });
  } catch (error) {
    if (await db.user.count()) redirect("/login");
    throw error;
  }
  await startSession();
  redirect("/");
}
export async function login(f: FormData) {
  if (!await reserveAttempt()) redirect("/login?error=limit");
  const user = await db.user.findUnique({ where: { id: 1 } });
  const password = field(f, "password");
  if (!user || password.length > 200 || !await verify(user.passwordHash, password) || !matches(field(f, "username"), user.username)) redirect("/login?error=invalid");
  const step = verifyStep(user.totpSecret, field(f, "code"));
  if (step === null) redirect("/login?error=invalid");
  const claimed = await db.user.updateMany({ where: { id: 1, lastTotpStep: { lt: step } }, data: { lastTotpStep: step } });
  if (!claimed.count) redirect("/login?error=invalid");
  await db.loginLimit.deleteMany();
  await startSession();
  redirect("/");
}
export async function logout() {
  await endSession();
  redirect("/login");
}
