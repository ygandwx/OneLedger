export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { db } = await import("./lib/db");
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  }
}
