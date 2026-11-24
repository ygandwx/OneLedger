import { requireUser } from "@/lib/auth";
import { FileInputError, MAX_FILE, storeUpload } from "@/lib/files";

export const runtime = "nodejs";
function toLibrary(params: Record<string,string>) {
  return new Response(null, {status:303, headers:{Location: "/files?" + new URLSearchParams(params), "Cache-Control":"no-store"}});
}
export async function POST(request: Request) {
  await requireUser();
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) return new Response("请求来源无效", {status:403});
  // Allow multipart metadata in addition to the 25 MiB file. Count streamed bytes even without a Content-Length.
  const maxRequest = MAX_FILE + 256 * 1024;
  if (Number(request.headers.get("content-length")) > maxRequest) return toLibrary({error:"文件超过 25 MB。"});
  const reader = request.body?.getReader();
  if (!reader || !request.headers.get("content-type")?.startsWith("multipart/form-data;")) return new Response("请使用文件上传表单", {status:400});
  let total = 0;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxRequest) { await reader.cancel(); return toLibrary({error:"文件超过 25 MB。"}); }
    chunks.push(new Uint8Array(value));
  }
  let form: FormData;
  try {
    form = await new Response(new Blob(chunks), {headers:{"content-type":request.headers.get("content-type")!}}).formData();
  } catch { return new Response("上传格式无效", {status:400}); }
  try {
    const file = await storeUpload(form);
    return toLibrary({notice:"文件已上传", ...(file.expenseId ? {expenseId:file.expenseId} : {entityId:file.entityId})});
  } catch (error) {
    if (error instanceof FileInputError) return toLibrary({error:error.message});
    throw error;
  }
}
