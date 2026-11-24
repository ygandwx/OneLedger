"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileMetadata, FileInputError } from "@/lib/files";

export async function updateMetadata(form: FormData) {
  await requireUser();
  const id = String(form.get("id") || "");
  const saved = await db.storedFile.findUnique({where:{id}});
  if (!saved) redirect("/files?error=" + encodeURIComponent("找不到文件"));
  try {
    const metadata = await fileMetadata(form, saved.entityId);
    await db.storedFile.update({where:{id},data:metadata});
  } catch (error) {
    if (error instanceof FileInputError) redirect("/files?" + new URLSearchParams({edit:id,error:error.message}));
    throw error;
  }
  revalidatePath("/files");
  redirect("/files?notice=" + encodeURIComponent("文件信息已更新"));
}
export async function archiveFile(form: FormData) {
  await requireUser();
  const id = String(form.get("id") || "");
  const archived = form.get("archive") === "1";
  await db.storedFile.update({where:{id}, data:{archived}});
  revalidatePath("/files");
  redirect("/files?notice=" + encodeURIComponent(archived ? "文件已归档" : "文件已恢复"));
}
