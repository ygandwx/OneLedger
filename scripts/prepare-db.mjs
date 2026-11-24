import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) throw new Error("请将 DATABASE_URL 设置为 SQLite file: 路径");
const filename = resolve("prisma", decodeURIComponent(url.slice(5).split("?")[0]));
await mkdir(dirname(filename), { recursive: true });
await (await open(filename, "a", 0o600)).close();
