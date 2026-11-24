import { open } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadDirectory } from "@/lib/files";

export const runtime = "nodejs";
export async function GET(request: Request, {params}: {params:Promise<{id:string}>}) {
  await requireUser();
  const file = await db.storedFile.findUnique({where:{id:(await params).id}});
  if (!file || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(file.path)) return new Response("找不到文件", {status:404});
  const handle = await open(join(uploadDirectory(),file.path), "r").catch((e:NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (!handle) return new Response("找不到存储文件", {status:404});
  const inline = new URL(request.url).searchParams.has("preview") && (file.mimeType.startsWith("image/") || file.mimeType === "application/pdf");
  const encoded = encodeURIComponent(file.originalName).replace(/['()*]/g, c=>"%"+c.charCodeAt(0).toString(16));
  return new Response(Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>, {headers:{
    "Content-Type":file.mimeType, "Content-Length":String(file.size),
    "Content-Disposition": (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encoded,
    "X-Content-Type-Options":"nosniff", "Content-Security-Policy":file.mimeType === "application/pdf"
      ? "frame-ancestors 'self'; base-uri 'none'" : "sandbox; default-src 'none'; style-src 'unsafe-inline'", "Cache-Control":"private, no-store",
  }});
}
