import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { db } from "@/lib/db";
import { isLedgerDate } from "@/lib/expense-date";

export const FILE_CATEGORIES = ["营业执照", "章程", "年报", "合同", "发票收据", "其他"];
export const MAX_FILE = 25 * 1024 * 1024;
const root = () => resolve(process.env.DATA_DIR || "/data");
export const uploadDirectory = () => join(root(), "uploads");

export class FileInputError extends Error {}
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export async function fileMetadata(form: FormData, currentEntityId?: string) {
  const entityId = field(form, "entityId"), category = field(form, "category"), title = field(form, "title");
  const expenseId = field(form, "expenseId") || null, recurringId = field(form, "recurringId") || null;
  const expiresOn = field(form, "expiresOn") || null;
  if (!title || title.length > 200 || !FILE_CATEGORIES.includes(category)) throw new FileInputError("请填写标题并选择有效的分类。");
  if (expiresOn && !isLedgerDate(expiresOn)) throw new FileInputError("文件到期日无效。");
  if (expenseId && recurringId) throw new FileInputError("一份文件可关联一笔支出或一个周期事项。");
  const entity = await db.entity.findUnique({ where: {id: entityId} });
  if (!entity || (entity.archived && entityId !== currentEntityId)) throw new FileInputError("请选择有效的所属主体。");
  if (expenseId) {
    const expense = await db.expense.findFirst({ where: {id: expenseId, deleted: false, OR: [{ownerId:entityId},{payerId:entityId}]} });
    if (!expense) throw new FileInputError("文件主体须为关联支出的付款或归属主体。");
  }
  if (recurringId && !await db.recurringItem.count({ where: {id:recurringId, entityId} })) throw new FileInputError("周期事项与文件所属主体不匹配。");
  return {entityId, category, title, expiresOn, expenseId, recurringId};
}
function detectType(b: Buffer) {
  if (b.subarray(0,5).toString("ascii") === "%PDF-") return "application/pdf";
  if (b.subarray(0,8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (b.subarray(0,3).toString("hex") === "ffd8ff") return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(b.subarray(0,6).toString("ascii"))) return "image/gif";
  if (b.subarray(0,4).toString("ascii") === "RIFF" && b.subarray(8,12).toString("ascii") === "WEBP") return "image/webp";
  if (b.subarray(4,8).toString("ascii") === "ftyp" && ["avif","avis"].includes(b.subarray(8,12).toString("ascii"))) return "image/avif";
  if (b.subarray(0,2).toString("ascii") === "BM") return "image/bmp";
  const prefix = b.subarray(0, 4096).toString("utf8").trimStart();
  if (/^(?:<\?xml[^>]*\?>\s*)?<svg(?:\s|>)/i.test(prefix)) return "image/svg+xml";
  return "application/octet-stream";
}
export async function storeUpload(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.name || file.size < 1 || file.size > MAX_FILE) throw new FileInputError("请选择 1 字节至 25 MB 的文件。");
  const metadata = await fileMetadata(form);
  const filename = randomUUID();
  await mkdir(uploadDirectory(), { recursive: true, mode: 0o700 });
  const temp = join(root(), ".upload-" + filename);
  const destination = join(uploadDirectory(), filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
    await rename(temp, destination);
    return await db.storedFile.create({data: { ...metadata, path: filename, originalName: basename(file.name.replaceAll("\\","/")).replace(/[\u0000-\u001f\u007f]/g,"").slice(0,255) || "附件", size: file.size, mimeType: detectType(bytes) }});
  } catch (error) {
    await Promise.all([rm(temp,{force:true}), rm(destination,{force:true})]);
    throw error;
  }
}
