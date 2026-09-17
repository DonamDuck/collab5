import "server-only"; // 🔒클라이언트 컴포넌트가 import하면 빌드가 멈춘다. 서비스 롤 키로 DB를 읽는 파일이다(09-18 밤 QA SEC-09).
// 하루 가게 — 사업자등록증 비공개 저장소 `host-docs` (2026-09-18) · 서버 전용
//
// 🔒사진(`maker-photos`, 공개 버킷)과 «다른 버킷»이다. 공개 URL을 만들지 않는다.
//   · 올리기 = 서버가 이 사람 폴더(`{user_id}/{uuid}.{ext}`)에 서명 업로드 URL을 발급 → 브라우저가 그 URL로 직접 올린다(사진과 같은 방식)
//   · 보기   = 관리자 확인 뒤 서버가 60초짜리 서명 다운로드 URL을 발급(`/rent/review/cert/[slug]`)
//   버킷엔 정책이 없다(SQL 머리말). service role 키를 든 이 파일만 닿는다.
// 🧪목 모드에선 저장소를 안 부른다. 호출부가 막고, 여기서 한 번 더 막는다.
import { createClient } from "@supabase/supabase-js";
import { rentMockOn } from "./rent-mock";
import { BIZ_CERT_TYPES } from "./bizcheck";

export const HOST_DOCS_BUCKET = "host-docs";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** 등록증 올릴 자리. 형식은 파일의 MIME으로 정한다(확장자는 사람이 바꿀 수 있어 안 믿는다). */
export async function signCertUpload(
  userId: number,
  mime: string,
): Promise<{ path: string; token: string } | { error: string }> {
  if (await rentMockOn()) return { error: "mock" };
  const ext = BIZ_CERT_TYPES[mime];
  if (!ext) return { error: "type" };
  const c = admin();
  if (!c) return { error: "storage-disabled" };
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await c.storage.from(HOST_DOCS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error(`[host-docs] sign upload failed: ${error?.message ?? "no data"}`);
    return { error: "sign-failed" };
  }
  return { path, token: data.token };
}

/** 등록증 보기 — 60초짜리 서명 URL. ⚠️권한(관리자)은 호출부가 먼저 확인한다. */
export async function signCertDownload(path: string): Promise<string | null> {
  if (await rentMockOn()) return null;
  const c = admin();
  if (!c || !path) return null;
  const { data, error } = await c.storage.from(HOST_DOCS_BUCKET).createSignedUrl(path, 60);
  if (error || !data) {
    console.error(`[host-docs] sign download failed: ${error?.message ?? "no data"}`);
    return null;
  }
  return data.signedUrl;
}
