import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readdir, rename, rm, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "./db";

const exec = promisify(execFile);
export async function backupDatabase() {
  const root = resolve(process.env.DATA_DIR || "/data");
  const backups = join(root, "backups");
  await mkdir(backups, { recursive: true, mode: 0o700 });
  await mkdir(join(root, "uploads"), { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(join(backups, ".building-"));
  const date = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `oneledger-${date}.tar.gz`;
  try {
    await db.$executeRaw`VACUUM INTO ${join(stage, "ledger.db")}`;
    // Uploads are immutable and published on disk before their metadata commits.
    await exec("tar", ["-czf", join(stage, "snapshot.tar.gz"), "-C", stage, "ledger.db", "-C", root, "uploads"]);
    await chmod(join(stage, "snapshot.tar.gz"), 0o600);
    await rename(join(stage, "snapshot.tar.gz"), join(backups, filename));
    const archives = (await readdir(backups)).filter(name => /^oneledger-\d{4}-\d{2}-\d{2}T[\d-]+Z\.tar\.gz$/.test(name)).sort().reverse();
    await Promise.all(archives.slice(30).map(name => rm(join(backups, name), {force:true})));
    return filename;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
