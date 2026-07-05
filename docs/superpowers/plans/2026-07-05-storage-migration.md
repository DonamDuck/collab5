# Implementation Plan: Storage 이전 (사진 base64 → Supabase Storage URL)
Date: 2026-07-05
Spec: docs/superpowers/specs/2026-07-05-storage-migration-design.md

## Goal
사진을 선택 즉시 서명 URL로 Storage에 직접 업로드하고 DB엔 public URL만 저장해, 수정 진입·저장·렌더 속도를 근본 개선한다.

## Architecture
- 서버액션 `createUploadUrlAction`이 service_role로 `maker-photos` 버킷의 서명 업로드 URL(`createSignedUploadUrl`) + public URL 발급.
- 클라 `uploadPhoto(file, maxDim)`: 리사이즈 Blob → `uploadToSignedUrl`로 Storage 직접 업로드 → public URL 반환. **Storage env 미설정(로컬 mock) 시 base64 data URL 폴백.**
- `PhotoGrid`가 업로드중 스피너 표시. `register/page.tsx` submit은 URL만 전송(리사이즈 로직 제거).
- **`{u}` PhotoWire 래핑은 유지** — 로컬 base64 폴백 경로가 Flight 배열 한도에 다시 걸리지 않도록. URL엔 무해. (spec의 "래핑 제거" 항목은 본 플랜에서 취소, spec에 반영)

## Tech Stack
Next.js 16 서버액션, @supabase/supabase-js v2 Storage(`createSignedUploadUrl`/`uploadToSignedUrl`/`getPublicUrl`), 기존 canvas 리사이즈.

## Files
MODIFY docs/superpowers/specs/2026-07-05-storage-migration-design.md (래핑 유지로 정정)
MODIFY src/lib/image.ts               (fileToResizedBlob 추가)
MODIFY src/lib/actions.ts             (createUploadUrlAction 추가)
CREATE src/lib/upload.ts              (uploadPhoto — 업로드 오케스트레이션)
MODIFY src/app/register/PhotoGrid.tsx (uploading 스피너)
MODIFY src/app/register/page.tsx      (사진 상태 {url,uploading}, 즉시 업로드, submit 단순화)
MODIFY src/app/signup/page.tsx        (프로필 이미지 Storage 업로드)

## Task 1: fileToResizedBlob + spec 정정

**Goal:** 리사이즈 결과를 Blob으로 받는 함수 추가.

**Steps:**
1. `src/lib/image.ts` 끝에 추가:
```ts
// 리사이즈·압축 결과를 Blob으로 (Storage 업로드용)
export async function fileToResizedBlob(
  file: File,
  maxDim = 1000,
  quality = 0.78
): Promise<Blob> {
  const dataUrl = await fileToResizedDataUrl(file, maxDim, quality);
  const res = await fetch(dataUrl);
  return res.blob();
}
```
2. spec의 "actions.ts 배선" 절에서 `{u}` 래핑 제거 문장을 "래핑 유지(로컬 base64 폴백 보호, URL엔 무해)"로 수정.
3. Run: `npx tsc --noEmit`
4. Commit: `git add -A && git commit -m "feat(storage): fileToResizedBlob 추가 + spec 정정"`

**Expected output:** tsc 통과.

## Task 2: createUploadUrlAction (서버)

**Goal:** 서명 업로드 URL + public URL 발급 서버액션.

**Steps:**
1. `src/lib/actions.ts`에 추가 (파일 상단 import에 `createClient` from `@supabase/supabase-js` 추가):
```ts
const PHOTO_BUCKET = "maker-photos";

/** Storage 서명 업로드 URL 발급. env 미설정 시 error(클라는 base64 폴백). */
export async function createUploadUrlAction(): Promise<
  { path: string; token: string; publicUrl: string } | { error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "storage-disabled" };
  const admin = createClient(url, key);
  const path = `p/${crypto.randomUUID()}.jpg`;
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "sign-failed" };
  const { data: pub } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, token: data.token, publicUrl: pub.publicUrl };
}
```
2. Run: `npx tsc --noEmit`
3. Commit: `git commit -am "feat(storage): 서명 업로드 URL 발급 서버액션"`

**Expected output:** tsc 통과.

## Task 3: uploadPhoto 클라 유틸

**Goal:** 리사이즈→서명URL→직접 업로드→public URL 반환(+로컬 폴백).

**Steps:**
1. CREATE `src/lib/upload.ts`:
```ts
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
```
2. Run: `npx tsc --noEmit`
3. Commit: `git add -A && git commit -m "feat(storage): uploadPhoto 클라 업로드 유틸"`

**Expected output:** tsc 통과.

## Task 4: PhotoGrid 업로드중 스피너

**Goal:** 항목별 `uploading` 상태를 받아 스피너 오버레이 표시.

**Steps:**
1. `src/app/register/PhotoGrid.tsx` props 변경: `urls: string[]` → `items: { url: string; uploading?: boolean }[]`. 내부 `urls.map((u, i)` → `items.map((it, i)`, `<img src={u}>` → `<img src={it.url}>`.
2. 업로드중 오버레이(img 아래에 추가):
```tsx
{it.uploading && (
  <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
  </span>
)}
```
3. 업로드중 항목은 삭제 버튼 숨김(`{!it.uploading && <button …삭제…>}`), draggable도 `draggable={!it.uploading}`.
4. `urls.length` 참조 2곳 → `items.length`.
5. Run: `npx tsc --noEmit` (register/page.tsx 호출부 에러는 Task 5에서 해소 — 이 시점 에러는 호출부 3곳의 prop명만이어야 함)
6. Commit: `git commit -am "feat(storage): PhotoGrid 업로드중 스피너"`

**Expected output:** PhotoGrid 자체 타입 OK. page.tsx 호출부 3곳 prop 에러만 잔존(다음 태스크에서 해소).

## Task 5: register 페이지 — 즉시 업로드 배선

**Goal:** 사진 선택 즉시 업로드, submit은 URL만 전송.

**Steps:**
1. `src/app/register/page.tsx` 사진 상태 3종을 `{ url: string; uploading?: boolean }`로 통일:
   - 131행 `photos`: `useState<{ url: string; uploading?: boolean }[]>([])` (name·file 필드 제거)
   - activities/collabHistory의 `photos: { url: string; file?: File }[]` → `{ url: string; uploading?: boolean }[]`
2. 공통 헬퍼 추가(컴포넌트 안):
```ts
// 선택 즉시 업로드: objectURL 프리뷰+스피너 → 완료 시 publicUrl로 교체, 실패 시 제거
const uploadInto = (
  files: FileList | null, max: number, maxDim: number,
  get: () => { url: string; uploading?: boolean }[],
  set: (f: (p: { url: string; uploading?: boolean }[]) => { url: string; uploading?: boolean }[]) => void,
) => {
  const list = Array.from(files ?? []).slice(0, Math.max(0, max - get().length));
  list.forEach((f) => {
    const preview = URL.createObjectURL(f);
    set((p) => [...p, { url: preview, uploading: true }]);
    uploadPhoto(f, maxDim)
      .then((url) => set((p) => p.map((x) => (x.url === preview ? { url } : x))))
      .catch(() => {
        set((p) => p.filter((x) => x.url !== preview));
        alert("사진 업로드에 실패했어요. 다시 시도해주세요.");
      });
  });
};
```
3. `onPhotos`/`addActPhotos`/`addHistPhotos`를 `uploadInto` 호출로 교체(브랜드 max 10·1000px, 활동/콜라보 max 3·800px). PhotoGrid 3곳 `urls=` → `items=` (활동/콜라보는 `items={a.photos}` 그대로).
4. edit 프리필(510행 등): `{ name:"", url:u, file:… }` → `{ url: u }`.
5. **submit 단순화**: `fileToResizedDataUrl` 호출·try/catch 리사이즈 블록 제거 → `photoUrls = photos.filter(p=>!p.uploading).map(p=>p.url)` 식으로 URL만 수집(activities/history 동일). `wrap()`·payload는 유지.
6. 업로드중 제출 방지: submit 버튼 `disabled`에 `|| [photos, ...activities.flatMap(a=>a.photos), ...collabHistory.flatMap(h=>h.photos)].some(p=>p.uploading)` 추가.
7. `fileToResizedDataUrl` import 제거, `uploadPhoto` import 추가.
8. Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`
9. Verify: 로컬 dev에서 사진 추가 → base64 폴백 프리뷰 정상, 제출 정상.
10. Commit: `git commit -am "feat(storage): register 사진 선택 즉시 업로드 전환"`

**Expected output:** tsc·build 통과. 로컬 등록 플로우 정상.

## Task 6: signup 프로필 이미지 Storage 업로드

**Goal:** 회원가입 프로필 이미지도 같은 파이프.

**Steps:**
1. `src/app/signup/page.tsx`: `fileToResizedDataUrl` import → `uploadPhoto`로 교체. 27행 `setImage(await fileToResizedDataUrl(f, 400))` → 업로드중 상태 추가:
```ts
setImgUploading(true);
try { setImage(await uploadPhoto(f, 400)); }
catch { alert("이미지 업로드에 실패했어요. 다시 시도해주세요."); }
finally { setImgUploading(false); }
```
   (`const [imgUploading, setImgUploading] = useState(false)` 추가, 가입 버튼 `disabled`에 `|| imgUploading` 추가)
2. Run: `npx tsc --noEmit`
3. Commit: `git commit -am "feat(storage): 프로필 이미지 Storage 업로드"`

**Expected output:** tsc 통과.

## Task 7: 빌드 검증 + 배포 + prod 확인

**Goal:** 전체 검증 후 배포.

**Steps:**
1. Run: `npm run build`
2. Push: `git push` (Vercel 자동배포)
3. prod 검증(대표와 함께): 신규 소개서 등록 — 사진 추가 시 스피너→썸네일, 제출 즉시 완료, `/m` 렌더 빠름. Supabase Table Editor에서 photos 컬럼이 `https://…/maker-photos/p/….jpg` URL인지(base64 아님) 확인.
4. 캔가(m-6tjod7) 수정화면에서 사진 재업로드 → Storage 이전 완료.
5. Commit: 없음(검증만).

**Expected output:** prod에서 업로드·저장·렌더 모두 체감 개선.
