"use server";
import { verify } from "@node-rs/argon2";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { beginEnrollment, clearEnrollment, enrollmentSecret } from "@/lib/enrollment";
import { createSession, endSession, hashPassword, matches, reserveAttempt, setSessionCookie, verifyStep } from "@/lib/auth";

const field = (f: FormData, name: string) => String(f.get(name) ?? "");
export async function authorizeSetup(f: FormData) {
  if (await db.user.count()) redirect("/login");
  const key = process.env.SETUP_TOKEN;
  if (!key || !matches(field(f, "setupToken"), key)) redirect("/setup?error=token");
  if (!await enrollmentSecret()) await beginEnrollment(key);
  redirect("/setup?step=bind");
}

export async function setup(f: FormData) {
  if (await db.user.count()) redirect("/login");
  const secret = await enrollmentSecret();
  if (!secret) redirect("/setup?error=expired");
  const username = field(f, "username").trim(), password = field(f, "password");
  if (!username || username.length > 80 || password.length < 12 || password.length > 200) redirect("/setup?error=input");
  const step = verifyStep(secret, field(f, "code"));
  if (step === null) redirect("/setup?error=code");
  const passwordHash = await hashPassword(password);
  let session;
  try {
    session = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { id: 1, username, passwordHash, totpSecret: secret, lastTotpStep: step } });
      return createSession(tx, user.id);
    });
  } catch (error) {
    if (await db.user.count()) redirect("/login");
    throw error;
  }
  await setSessionCookie(session);
  await clearEnrollment();
  redirect("/");
}
export async function login(f: FormData) {
  if (!await reserveAttempt()) redirect("/login?error=limit");
  const user = await db.user.findUnique({ where: { id: 1 } });
  const password = field(f, "password");
  if (!user || password.length > 200 || !await verify(user.passwordHash, password) || !matches(field(f, "username").trim(), user.username)) redirect("/login?error=invalid");
  const step = verifyStep(user.totpSecret, field(f, "code"));
  if (step === null) redirect("/login?error=invalid");
  const result = await db.$transaction(async tx => {
    // Use the credential that was verified to claim the code and create its
    // session atomically, so a concurrent password change revokes older logins.
    const claimed = await tx.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash, lastTotpStep: { lt: step } },
      data: { lastTotpStep: step },
    });
    if (!claimed.count) {
      const current = await tx.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
      return { error: current?.passwordHash === user.passwordHash ? "used" : "invalid" } as const;
    }
    await tx.loginLimit.deleteMany({ where: { id: "login" } });
    return { session: await createSession(tx, user.id) } as const;
  });
  if (result.error) redirect("/login?error=" + result.error);
  await setSessionCookie(result.session);
  redirect("/");
}
export async function logout() {
  await endSession();
  redirect("/login");
}
