"use client";
// 사진 1장을 리사이즈해 Storage에 직접 업로드하고 public URL을 돌려준다.
// Storage env 미설정(로컬 mock)이면 base64 data URL로 폴백.
import { createBrowserAuthClient, authEnvReady } from "@/lib/supabase/client";
import { fileToResizedBlob, fileToResizedDataUrl } from "@/lib/image";
import { createUploadUrlAction } from "@/lib/actions";

const PHOTO_BUCKET = "maker-photos";

export async function uploadPhoto(file: File, maxDim: number): Promise<string> {
  if (!authEnvReady) return fileToResizedDataUrl(file, maxDim);
  const signed = await createUploadUrlAction();
  if ("error" in signed) {
    if (signed.error === "storage-disabled") return fileToResizedDataUrl(file, maxDim);
    throw new Error(signed.error);
  }
  const blob = await fileToResizedBlob(file, maxDim);
  const supabase = createBrowserAuthClient();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("upload-failed");
  return signed.publicUrl;
}
