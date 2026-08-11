"use client";
// 사진 1장을 리사이즈해 Storage에 직접 업로드하고 public URL을 돌려준다.
// Storage env 미설정(로컬 mock)이면 base64 data URL로 폴백.
import { createBrowserAuthClient, authEnvReady } from "@/lib/supabase/client";
import { fileToResizedBlob, fileToResizedDataUrl } from "@/lib/image";
import { createUploadUrlAction } from "@/lib/actions";

const PHOTO_BUCKET = "maker-photos";

/** 단계별 타임아웃 — **무한 스피너의 유일한 탈출구**(2026-07-29, 대표가 실제로 갇힘).
 *
 * 왜 필요한가: 아래 3단계는 전부 "성공 아니면 실패"만 있고 **멈춤에 대한 대비가 없었다.**
 * 한 곳이라도 응답이 안 오면 promise가 영영 안 끝나 `.catch`도 안 타고, 호출부는
 * `uploading:true`인 사진을 영원히 들고 있게 된다 → 제출 버튼이 잠긴 채 빠져나갈 길이 없다.
 * 타임아웃이 있으면 reject → 호출부의 catch가 사진을 지우고 알려준다.
 *
 * ⚠️ 타임아웃 뒤에 원래 요청이 늦게 성공하면 Storage에 고아 파일이 남는다.
 *    고아 사진은 이미 방치 정책이라(소개서를 지워도 사진은 남는다) 여기서는 감수한다 —
 *    "파일 몇 개 남는 것"보다 "사용자가 폼에 갇히는 것"이 훨씬 나쁘다.
 */
function withTimeout<T>(p: Promise<T>, ms: number, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout:${step}`)), ms);
    }),
  ]);
}

export async function uploadPhoto(
  file: File,
  maxDim: number,
  /** 🆕저장 경로 접두사(2026-08-10) — 매거진은 `"magazine"`. 안 주면 기존 위치 그대로. */
  prefix?: string
): Promise<string> {
  if (!authEnvReady) return fileToResizedDataUrl(file, maxDim);
  // ① 서명 URL 발급(서버 액션) — 서버가 조용히 안 돌아오는 경우가 여기다
  const signed = await withTimeout(createUploadUrlAction("photo", prefix), 15_000, "sign");
  if ("error" in signed) {
    if (signed.error === "storage-disabled") return fileToResizedDataUrl(file, maxDim);
    throw new Error(signed.error);
  }
  // ② 브라우저 리사이즈 — `new Image()` 디코드가 load도 error도 안 뱉으면 여기서 멈춘다
  const blob = await withTimeout(fileToResizedBlob(file, maxDim), 15_000, "resize");
  const supabase = createBrowserAuthClient();
  // ③ Storage 업로드 — 모바일·불안정 회선을 감안해 가장 넉넉히
  const { error } = await withTimeout(
    supabase.storage
      .from(PHOTO_BUCKET)
      .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: "image/jpeg" }),
    45_000,
    "upload"
  );
  if (error) throw new Error("upload-failed");
  return signed.publicUrl;
}

/** 소개자료 PDF 업로드(리사이즈 없음, 10MB 제한). Storage 미설정이면 에러. */
export async function uploadPdf(file: File): Promise<string> {
  if (file.type !== "application/pdf") throw new Error("pdf-only");
  if (file.size > 10 * 1024 * 1024) throw new Error("too-large");
  if (!authEnvReady) throw new Error("storage-required");
  const signed = await createUploadUrlAction("pdf");
  if ("error" in signed) throw new Error(signed.error);
  const supabase = createBrowserAuthClient();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: "application/pdf" });
  if (error) throw new Error("upload-failed");
  return signed.publicUrl;
}
