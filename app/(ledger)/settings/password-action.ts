"use server";

import { verify } from "@node-rs/argon2";
import { redirect } from "next/navigation";
import { currentSessionId, hashPassword, requireUser, reserveAttempt, verifyStep } from "@/lib/auth";
import { db } from "@/lib/db";

function finish(result: string): never {
  redirect("/settings?password=" + result + "#password");
}

export async function changePassword(form: FormData) {
  const userId = await requireUser();
  const sessionId = await currentSessionId();
  if (!sessionId) redirect("/login");

  const current = String(form.get("currentPassword") ?? "");
  const next = String(form.get("newPassword") ?? "");
  const confirm = String(form.get("confirmPassword") ?? "");
  if (next.length < 12 || next.length > 200) finish("length");
  if (next !== confirm) finish("mismatch");
  if (!await reserveAttempt()) finish("limit");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !current || current.length > 200 || !await verify(user.passwordHash, current)) finish("invalid");
  const step = verifyStep(user.totpSecret, String(form.get("code") ?? ""));
  if (step === null) finish("invalid");
  if (step <= user.lastTotpStep) finish("used");

  const passwordHash = await hashPassword(next);
  const updated = await db.$transaction(async tx => {
    const changed = await tx.user.updateMany({
      where: {
        id: user.id, passwordHash: user.passwordHash, lastTotpStep: { lt: step },
        sessions: { some: { id: sessionId, expiresAt: { gt: new Date() } } },
      },
      data: { passwordHash, lastTotpStep: step },
    });
    if (!changed.count) return false;
    await tx.session.deleteMany({ where: { userId, id: { not: sessionId } } });
    await tx.loginLimit.deleteMany({ where: { id: "login" } });
    return true;
  });
  finish(updated ? "changed" : "stale");
}
