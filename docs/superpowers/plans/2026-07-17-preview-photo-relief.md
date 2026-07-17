# Implementation Plan: 소개서 미리보기 + 사진 UI 완화
Date: 2026-07-17
Spec: docs/superpowers/specs/2026-07-17-preview-photo-relief-design.md

## Goal
사진 없는 유저의 이탈을 막는다 — 결과물 미리보기("소개서 미리보기": 홈 버튼·홈 섹션·폼 바텀시트)와 사진 첨부 UI 완화(메인 유지·카드/블록 접기)를 배포한다.

## Architecture
- `/m/[slug]` 본문 렌더를 `MakerArticle`(서버 컴포넌트)로 추출 → `/m`과 신규 `/preview`가 공유. `/preview`는 탭(Link 기반, `?tab=`)으로 데모 소개서 2종 표시.
- 데모 데이터 = 프로덕션 원본 2종의 동결 복제(행 + Storage 사본). 스크립트는 대표가 키 넣어 1회 실행(로컬 .env.local엔 Supabase 키 없음 — 로컬은 InMemory).
- 폼 바텀시트 v1 = 정적 이미지(iframe 후속). 접기 UI는 순수 표시 계층.

## Tech Stack
Next.js 16 App Router · TS · Supabase(@supabase/supabase-js, service key는 대표 실행 시만) · Tailwind v4 토큰.

## Files
```
CREATE src/app/m/[slug]/MakerArticle.tsx      (T1: 본문 렌더 추출)
MODIFY src/app/m/[slug]/page.tsx              (T1: 추출분 사용)
CREATE src/lib/demo.ts                        (T3: 데모 slug 상수·판별)
CREATE src/app/preview/page.tsx               (T3: 탭 + MakerArticle + 폴백)
CREATE scripts/clone-demo-makers.ts           (T4: 동결 복제, 대표 실행)
MODIFY src/app/my/MakerRow.tsx                (T5: 🔒 고정본 배지)
CREATE public/preview/sample-photo.png        (T6: 정적 스크린샷)
CREATE public/preview/sample-none.png         (T6: 정적 스크린샷)
MODIFY src/app/page.tsx                       (T7: 버튼 rename/retarget + 섹션)
MODIFY src/app/register/page.tsx              (T8: A′링크+바텀시트 / T9: 접기)
MODIFY src/app/register/BlockEditor.tsx       (T9: 블록 첨부 접기)
```
⚠️ `page.tsx`(홈)·`register/page.tsx`·`BlockEditor.tsx`·`MakerRow.tsx` 전부 2팀 최근 배포 핫파일 — **각 태스크 착수 전 `git fetch` + fast-forward 확인.**

---

## Task 1: `/m` 본문 렌더 `MakerArticle` 추출 (CONFIRMED-1 선행)

**Goal:** `/m/[slug]/page.tsx`의 `<main>` 내부(BrandSummaryCard ~ 상세 주소)를 `MakerArticle.tsx` 서버 컴포넌트로 이동. CopyLink/소개자료 블록은 페이지 고유라 page에 남긴다.

**Steps:**
1. `src/app/m/[slug]/MakerArticle.tsx` 생성:
```tsx
import type { Maker } from "@/lib/types";
import { PhotoSlider } from "@/components/PhotoSlider";
import { BrandSummaryCard } from "./BrandSummaryCard";
import { BlockSections } from "./BlockSections";

// 소개서 본문 — /m 상세와 /preview 데모가 공유하는 단일 렌더.
export function MakerArticle({ maker, isOwner, logoUrl }: {
  maker: Maker; isOwner: boolean; logoUrl?: string;
}) {
  return (
    <>
      <BrandSummaryCard maker={maker} isOwner={isOwner} logoUrl={logoUrl} />
      {/* …page.tsx 34~175행(사진 슬라이더~상세 주소) 원문 그대로 이동… */}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { /* page.tsx 원문 이동 */ }
function TypeChip({ children }: { children: React.ReactNode }) { /* page.tsx 원문 이동 */ }
```
2. `page.tsx`는 데이터 조회 + `<main>` 래퍼 + `<MakerArticle …/>` + CopyLink 블록만 남김. Section/TypeChip 정의는 MakerArticle 쪽으로 이동(page에서 삭제).
3. Run: `npx tsc --noEmit && npm run build`
4. **Verify (픽셀 게이트)**: 로컬 dev에서 시드 소개서 `/m/<시드slug>` 스크린샷 → 추출 전 스크린샷과 비교, 차이 0. 배포 후 프로덕션 실소개서 1종도 대표 확인.
5. Commit: `git add src/app/m/[slug]/MakerArticle.tsx src/app/m/[slug]/page.tsx && git commit -m "refactor(m): 소개서 본문 MakerArticle 추출 (렌더 공유 준비, 픽셀 동일)"`

**Expected output:** /m 화면 변화 0, 본문 렌더가 재사용 가능한 단일 컴포넌트로.

## Task 2: 데모 상수 + `/preview` 라우트

**Goal:** 탭 2개로 데모 소개서를 보여주는 공개 페이지.

**Steps:**
1. `src/lib/demo.ts`:
```ts
export const DEMO_SLUG_PHOTO = "m-demo-photo";
export const DEMO_SLUG_NONE = "m-demo-none";
export const isDemoSlug = (slug: string) => slug.startsWith("m-demo-");
```
2. `src/app/preview/page.tsx` (서버 컴포넌트):
```tsx
import Link from "next/link";
import { repo } from "@/lib/repo";
import { getProfile } from "@/lib/profiles";
import { MakerArticle } from "../m/[slug]/MakerArticle";
import { DEMO_SLUG_PHOTO, DEMO_SLUG_NONE } from "@/lib/demo";

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "none" ? "none" : "photo";
  const maker = await repo.getMakerBySlug(active === "none" ? DEMO_SLUG_NONE : DEMO_SLUG_PHOTO);
  const logoUrl = maker?.ownerUserId ? (await getProfile(maker.ownerUserId))?.profileImage || undefined : undefined;
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">소개서 미리보기</h1>
      <p className="mt-2 text-base text-mute">사진이 있는 버전과 없는 버전, 둘 다 살펴보세요.</p>
      <div className="mt-5 flex gap-2">{/* 탭 = Link, active면 primary 톤 */}
        <Tab href="/preview?tab=photo" active={active === "photo"}>사진 있는 소개서</Tab>
        <Tab href="/preview?tab=none" active={active === "none"}>사진 없는 소개서</Tab>
      </div>
      <div className="mt-6">
        {maker
          ? <MakerArticle maker={maker} isOwner={false} logoUrl={logoUrl} />
          : <p className="rounded-md border border-hairline bg-surface-soft p-6 text-base text-mute">미리보기를 준비하고 있어요. 잠시 후 다시 봐주세요.</p>}
      </div>
      <div className="mt-12 text-center">
        <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-on">내 소개서 만들기</Link>
      </div>
    </main>
  );
}
function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`flex h-10 items-center rounded-pill border px-4 text-[15px] font-medium ${active ? "border-primary bg-primary-pale text-primary-on" : "border-hairline bg-surface text-body"}`}>{children}</Link>;
}
```
   (데모 행 없으면 안내 문구 폴백 — CONFIRMED-2b. embed 모드는 v1 미구현·후속.)
3. Run: `npx tsc --noEmit && npm run build` / Verify: 로컬 `/preview` 폴백 문구 확인(로컬엔 데모 행 없음), `?tab=` 전환 동작.
4. Commit: `feat(preview): 소개서 미리보기 라우트 (탭 2종 + 데모 폴백)`

**Expected output:** `/preview`가 탭·폴백 포함 동작 (데모 데이터는 T3 후 프로덕션에서 표시).

## Task 3: 동결 복제 스크립트 (대표 1회 실행)

**Goal:** 원본 2종(`m-ofjghi`·`m-ay6uve`) → `m-demo-photo`·`m-demo-none` 동결 복제. 멱등.

**Steps:**
1. `scripts/clone-demo-makers.ts`:
```ts
// 실행(대표): SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/clone-demo-makers.ts
import { createClient } from "@supabase/supabase-js";
const BUCKET = "maker-photos";
const PAIRS = [
  { from: "m-ofjghi", to: "m-demo-photo" },
  { from: "m-ay6uve", to: "m-demo-none" },
];
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function freezeUrl(url: string, demoSlug: string, i: number): Promise<string> {
  const res = await fetch(url);                       // 공개 URL에서 받아
  if (!res.ok) throw new Error(`fetch fail ${url}`);
  const path = `demo/${demoSlug}/${i}${url.match(/\.\w+(?=\?|$)/)?.[0] ?? ".jpg"}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, await res.arrayBuffer(), {
    upsert: true, contentType: res.headers.get("content-type") ?? "image/jpeg",
  });                                                 // upsert → 재실행 시 덮어쓰기(고아 없음)
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
// main: 원본 행 조회 → photos·activities[].photos·collab_history[].photos·blocks[].photos 전부 freezeUrl로 교체
// → search_visible=false, collab_open=false, intro_file_url=null, slug=to 로 upsert(onConflict: slug)
```
   (row 컬럼 구조는 `src/lib/repo.ts` `MakerRow` 그대로 select→변형→upsert. jsonb 안 사진 URL을 재귀 교체.)
2. Run(개발자): `npx tsc --noEmit` (스크립트 타입만 검증 — 실행은 대표).
3. **대표 실행 가이드** 출력·전달: 실행 후 `/preview` 프로덕션에서 두 탭 표시 + `/search`에 데모 미노출 확인.
4. Commit: `feat(scripts): 데모 소개서 동결 복제 스크립트 (storage 사본·멱등)`

**Expected output:** 대표 실행 후 프로덕션 `/preview` 완전 동작. 원본과 완전 분리.

## Task 4: /my 🔒 고정본 배지 (CONFIRMED-2a)

**Goal:** 대표 /my에서 클론 오인 방지.

**Steps:**
1. `git fetch` 후 `src/app/my/MakerRow.tsx`: 카드 타이틀 옆에
```tsx
import { isDemoSlug } from "@/lib/demo";
{isDemoSlug(maker.slug) && (
  <span className="inline-flex h-6 items-center rounded-pill bg-surface-soft px-2 text-[12px] font-medium text-mute">🔒 미리보기 고정본</span>
)}
```
   (공개 /m·/preview 렌더에는 무표시 — /my 전용.)
2. Run: `npx tsc --noEmit && npm run build` / Verify: 로컬 /my 렌더 무변화(데모 행 없음), 코드 리뷰로 조건 확인.
3. Commit: `feat(my): 데모 고정본 배지 (클론 오인 방지)`

## Task 5: 홈 스크린샷 자산 + 섹션 + 버튼 개편

**Goal:** 랜딩 순간 결과물 인지 (D6) + 버튼 rename/retarget.

**Steps:**
1. 프로덕션 `/m/m-ofjghi`·`/m/m-ay6uve`를 브라우저 모바일 뷰포트(375px)로 열어 상단~2섹션 스크린샷 → `public/preview/sample-photo.png`·`sample-none.png` 저장(폭 750px 리사이즈, 각 ≤150KB).
2. `git fetch` 후 `src/app/page.tsx`:
   - 버튼: `예시 소개서 보기` → `소개서 미리보기`, `href="/search"` → `href="/preview"`.
   - 히어로 섹션 바로 아래에:
```tsx
{/* 소개서 미리보기 — 실제 화면. 나노바나나 목업 나오면 파일만 교체(2팀) */}
<section className="mt-14">
  <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">이런 소개서가 만들어져요</h2>
  <p className="mt-2 text-center text-base text-mute">사진이 없어도 괜찮아요. 두 가지 모습을 미리 보세요.</p>
  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
    {[{ src: "/preview/sample-photo.png", label: "사진 있는 소개서" },
      { src: "/preview/sample-none.png", label: "사진 없는 소개서" }].map((s) => (
      <Link key={s.src} href="/preview" className="block overflow-hidden rounded-xl border border-hairline bg-surface">
        <Image src={s.src} alt={s.label} width={750} height={900} loading="lazy" className="w-full" />
        <p className="border-t border-hairline px-4 py-3 text-center text-[15px] font-medium text-body">{s.label}</p>
      </Link>
    ))}
  </div>
</section>
```
   (`next/image` lazy·non-priority — LCP 게이트. `import Image from "next/image"` 추가.)
3. Run: `npx tsc --noEmit && npm run build` / Verify: 로컬 홈 모바일·데스크탑 렌더, 버튼 목적지.
4. Commit: `feat(home): 소개서 미리보기 섹션 + 버튼 rename·/preview 연결`

## Task 6: 폼 A′ 링크 + 바텀시트 (정적 이미지 v1)

**Goal:** 사진 불안이 터지는 자리에서 즉시 안심 (D3·D4).

**Steps:**
1. `git fetch` 후 `src/app/register/page.tsx`:
   - state: `const [previewOpen, setPreviewOpen] = useState(false);`
   - `layerOpen` 유니언에 `previewOpen` 추가(플로팅 제출버튼 숨김 연동).
   - 메인 브랜드 사진 라벨 아래("최대 10장" 문구 다음):
```tsx
<button type="button" onClick={() => setPreviewOpen(true)}
  className="mb-2.5 text-[14px] text-primary-on underline underline-offset-2">
  사진 없이 소개서를 만들어보셔도 좋아요 → 소개서 미리보기
</button>
```
   - 바텀시트(기존 시트 패턴 + `<ScrollLock />`): 시트 내용 = 정적 이미지 2장 세로 스택(사진 **없는** 버전 먼저) + 닫기 버튼. 외부 이동 링크 없음(폼 이탈 방지).
2. Run: `npx tsc --noEmit && npm run build` / Verify: 링크→시트 열림, 닫으면 스크롤·입력값 그대로, 플로팅 버튼 숨김/복귀.
3. Commit: `feat(register): 사진 섹션 미리보기 링크 + 바텀시트 (초안 유실 0)`

## Task 7: 사진 첨부 접기 (활동·콜라보 카드 + 블록)

**Goal:** 메인은 유지, 나머지 사진 UI를 접힌 텍스트 버튼으로 (D5).

**Steps:**
1. `src/app/register/page.tsx`에 로컬 컴포넌트:
```tsx
// 접힌 사진 첨부 — 사진 있으면 펼침 시작(기존 데이터 은닉 금지), 없으면 텍스트 버튼만.
function CollapsedPhotos({ children, hasPhotos }: { children: React.ReactNode; hasPhotos: boolean }) {
  const [open, setOpen] = useState(hasPhotos);
  useEffect(() => { if (hasPhotos) setOpen(true); }, [hasPhotos]); // 위저드 주입·수정 로드 대응
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="text-[14px] text-mute underline underline-offset-2">
      + 사진 담기 (선택)
    </button>
  );
  return <>{children}</>;
}
```
2. 활동 카드(1297행대)·콜라보 카드(1490행대)의 `<PhotoGrid …/>`(+라벨)를 `<CollapsedPhotos hasPhotos={act.photos.length > 0}>…</CollapsedPhotos>`로 감싼다. ① 메인 브랜드 사진은 손대지 않음.
3. `src/app/register/BlockEditor.tsx` 공통 첨부(325행대)도 동일 패턴(파일 내 동일 로컬 컴포넌트 추가, `hasPhotos={b.photos.length > 0}`). 링크 첨부는 현행 유지.
4. Run: `npx tsc --noEmit && npm run build` / Verify: 새 카드=접힘, 사진 추가→저장→수정 재진입=펼침+사진 표시(빈 스텁 경로 0 — NIT-3), 위저드 사진 힌트 주입 시 펼침.
5. Commit: `feat(register): 카드·블록 사진 첨부 접기 (메인 유지)`

## Task 8: 통합 검증 + 배포 게이트

**Steps:**
1. `git fetch` → 리베이스 필요 시 수행 → `npx tsc --noEmit && npm run build`.
2. 로컬 QA 일괄: 홈(버튼·섹션) → `/preview`(탭·폴백) → register(A′ 시트·접기·초본얼럿 불변) → /my(무변화).
3. 대표 확인 후 `git push` (=prod 배포). 배포 후: 대표가 클론 스크립트 실행 → 프로덕션 `/preview` 탭 2종·검색 미노출·실기기 QA.
4. vault 갱신: [[홈-예시노출-사진완화]] 상태·스크린샷 재촬영 운영 규칙, INDEX.

**Expected output:** 스펙 QA 체크리스트 전 항목 통과.
