# Implementation Plan: 소개서 블록 모듈화
Date: 2026-07-13
Spec: docs/superpowers/specs/2026-07-13-intro-blocks-design.md

## Goal
9섹션 코어를 유지한 채 선택 블록 6종(+PDF 첨부, +AI 추천)을 얹어 브랜드마다 다른 소개서가 나오게 한다.

## Architecture
- `Maker.blocks: Block[]`(jsonb) 단일 필드에 블록 배열 저장. 배열 순서 = 노출 순서.
- 폼: `/register` 코어 ⑦(콜라보 경험)과 ⑧(주요 고객) 사이에 `BlockEditor`(신규 클라 컴포넌트) 삽입.
- 소개서: `/m/[slug]` "함께한 콜라보" 섹션 뒤에 `BlockSections`(신규 서버 컴포넌트) 삽입.
- PDF: 기존 서명 URL 업로드 경로 재사용(`createUploadUrlAction`에 kind 파라미터).
- AI 추천: `enrichOptions` 판정에 `blockHints` 필드 추가(추가 API 호출 없음) → 폼 배너.

## Tech Stack
Next.js 16(App Router) · TS · Tailwind v4 · Supabase(makers.blocks jsonb) · 기존 enrich(Gemini) 파이프라인.

## Files
```
MODIFY src/lib/types.ts               (Block 유니온 + Maker.blocks/introFileUrl)
MODIFY src/lib/repo.ts                (시드·Row 매핑·create/update 배선)
MODIFY src/lib/actions.ts             (RegisterInput.blocks/introFileUrl + PDF 서명 URL)
MODIFY src/lib/upload.ts              (uploadPdf)
CREATE src/app/register/BlockEditor.tsx
MODIFY src/app/register/page.tsx      (상태·배치·제출·프리필·⑤subtitle·PDF UI·추천 배너)
CREATE src/app/m/[slug]/BlockSections.tsx
MODIFY src/app/m/[slug]/page.tsx      (블록 존 + 소개 자료 받기)
MODIFY src/lib/enrich.ts              (blockHints)
```
※ SQL 2줄과 Storage PDF mime 허용은 **대표가 Supabase 콘솔에서 직접 실행**(운영 규칙).

---

## Phase 1 — 블록 폼 + /m 렌더

### Task 1: DB 컬럼 추가 (대표 실행)

**Goal:** prod DB가 blocks를 받을 수 있게 한다. **코드 배포 전 필수.**

**Steps:**
1. 대표에게 아래 SQL 제시, Supabase SQL Editor에서 실행 요청:
```sql
alter table makers add column blocks jsonb not null default '[]';
alter table makers add column intro_file_url text;
```
2. Verify: `select blocks, intro_file_url from makers limit 1;` 이 에러 없이 반환.
3. Commit: 없음(코드 변경 아님).

**Expected output:** 기존 행 전부 `blocks=[]`, `intro_file_url=null`.

### Task 2: 타입 + repo 배선

**Goal:** `Block` 도메인 타입과 저장 경로를 한 번에 연결(컴파일 가능 상태 유지).

**Steps:**
1. `src/lib/types.ts` — `Activity` 인터페이스 아래에 추가:
```ts
/** 선택 블록 — 공통 photos(최대3)·links(최대3) + 타입별 고유 필드. 배열 순서 = 소개서 노출 순서 */
export interface BlockLink { label?: string; url: string }
interface BlockBase { photos: string[]; links: BlockLink[] }
export type Block = BlockBase & (
  | { type: "metrics"; items: { label: string; value: string }[] }
  | { type: "reviews"; items: { quote: string; source?: string }[] }
  | { type: "team"; intro: string }
  | { type: "press"; items: { title: string; year?: string }[] }
  | { type: "space"; desc: string; features: string[] }
  | { type: "custom"; title: string; body: string }
);
export type BlockType = Block["type"];
```
2. `Maker` 인터페이스 `photos: string[];` 다음 줄에:
```ts
  blocks: Block[]; // 선택 블록(순서 보존)
  introFileUrl?: string; // 소개자료 PDF(코어 위계)
```
3. `src/lib/repo.ts` — 시드 4개 각각에 `blocks: [],` 추가(`photos:` 줄 다음).
4. `MakerRow`에 `blocks: Maker["blocks"] | null; intro_file_url: string | null;` 추가.
5. `rowToMaker`에 `blocks: (r.blocks ?? []).map((b) => ({ ...b, photos: b.photos ?? [], links: b.links ?? [] })), introFileUrl: r.intro_file_url ?? undefined,` 추가.
6. `SupabaseRepo.createMaker`의 row에 `blocks: input.blocks, intro_file_url: input.introFileUrl ?? null,` / `updateMakerContent`의 patch에 `blocks: c.blocks, intro_file_url: c.introFileUrl ?? null,` 추가.
7. Run: `npx tsc --noEmit` → actions.ts에서 blocks 누락 에러가 나면 다음 태스크 전까지 `blocks: [],`를 createMakerAction/updateMakerAction의 repo 호출에 임시 삽입.
8. Commit: `git add src/lib/types.ts src/lib/repo.ts src/lib/actions.ts && git commit -m "feat(blocks): Block 타입·repo 배선"`

**Expected output:** tsc 통과. 기존 동작 무변화(blocks 항상 []).

### Task 3: actions.ts 제출 경로

**Goal:** 폼 → 서버액션으로 blocks·introFileUrl이 흐른다.

**Steps:**
1. `RegisterInput`에 추가(사진이 Storage URL이라 wire 래핑 불필요):
```ts
  blocks?: Block[]; // 선택 블록(사진=Storage URL이라 그대로 전송)
  introFileUrl?: string; // 소개자료 PDF URL
```
   import에 `Block` 추가.
2. `createMakerAction`·`updateMakerAction`의 repo 호출에 Task 2의 임시 `blocks: []` 를 다음으로 교체:
```ts
    blocks: sanitizeBlocks(input.blocks),
    introFileUrl: input.introFileUrl?.trim() || undefined,
```
3. 파일 하단(또는 unwrapPhotos 아래)에 빈 블록 제거 유틸:
```ts
/** 내용이 빈 블록은 저장 제외(⑦ 콜라보 빈 카드 제외 패턴) */
function sanitizeBlocks(blocks?: Block[]): Block[] {
  return (blocks ?? []).filter((b) => {
    if (b.type === "metrics" || b.type === "press")
      return b.items.some((i) => ("label" in i ? i.label : i.title).trim());
    if (b.type === "reviews") return b.items.some((i) => i.quote.trim());
    if (b.type === "team") return b.intro.trim() || b.photos.length > 0;
    if (b.type === "space") return b.desc.trim() || b.features.length > 0 || b.photos.length > 0;
    return b.title.trim() || b.body.trim() || b.photos.length > 0;
  }).map((b) => ({ ...b, links: b.links.filter((l) => l.url.trim()) }));
}
```
   ※ metrics/press 판별 유니온 좁히기: `b.items.some(...)` 부분은 타입별 분기로 각각 작성(metrics는 `i.label.trim() || i.value.trim()`, press는 `i.title.trim()`).
4. Run: `npx tsc --noEmit`
5. Commit: `git commit -m "feat(blocks): 제출 경로(RegisterInput.blocks·sanitize)"`

**Expected output:** tsc 통과. 서버가 blocks를 저장(아직 보낼 UI 없음).

### Task 4: BlockEditor — 골격 + 카탈로그 + custom 카드

**Goal:** 진입 한 줄 → 카탈로그 → 블록 추가/삭제/이동 컨테이너 완성. custom 블록으로 전체 흐름 증명.

**Steps:**
1. CREATE `src/app/register/BlockEditor.tsx`:
```tsx
"use client";
// 선택 블록 편집기 — 코어 ⑦과 ⑧ 사이. 카탈로그에서 골라 인라인 카드로 편집.
import { useState } from "react";
import type { Block, BlockType, BlockLink } from "@/lib/types";
import { uploadPhoto } from "@/lib/upload";

const CATALOG: { type: BlockType; label: string; hint: string }[] = [
  { type: "metrics", label: "우리를 보여주는 숫자", hint: "팔로워, 월 방문, 누적 판매 등의 지표도 콜라보에 도움을 줄 수 있어요." },
  { type: "reviews", label: "고객들의 이야기", hint: "고객의 반응을 공유해보세요." },
  { type: "team", label: "만드는 사람들", hint: "콜라버 정보를 등록하면 더 가깝게 느껴질 수 있어요." },
  { type: "press", label: "소개된 곳들", hint: "수상이나 언론, 방송에 나온 적이 있다면요." },
  { type: "space", label: "우리의 공간", hint: "공간이 있다면, 그 자체가 매력이 돼요." },
  { type: "custom", label: "직접 만들기", hint: "하고 싶은 이야기로 섹션을 직접 만들어보세요." },
];
const MAX_CUSTOM = 2;

export function emptyBlock(type: BlockType): Block {
  const base = { photos: [] as string[], links: [] as BlockLink[] };
  switch (type) {
    case "metrics": return { ...base, type, items: [{ label: "", value: "" }] };
    case "reviews": return { ...base, type, items: [{ quote: "", source: "" }] };
    case "team": return { ...base, type, intro: "" };
    case "press": return { ...base, type, items: [{ title: "", year: "" }] };
    case "space": return { ...base, type, desc: "", features: [] };
    case "custom": return { ...base, type, title: "", body: "" };
  }
}

export function BlockEditor({ blocks, onChange, onUploadingChange }: {
  blocks: Block[];
  onChange: (b: Block[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const canAdd = (t: BlockType) =>
    t === "custom" ? blocks.filter((b) => b.type === "custom").length < MAX_CUSTOM
                   : !blocks.some((b) => b.type === t);
  const add = (t: BlockType) => { onChange([...blocks, emptyBlock(t)]); setOpen(false); };
  const remove = (i: number) => onChange(blocks.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const patch = (i: number, p: Partial<Block>) =>
    onChange(blocks.map((b, k) => (k === i ? ({ ...b, ...p } as Block) : b)));
  const addPhotos = async (i: number, files: FileList | null) => {
    const room = 3 - blocks[i].photos.length;
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!list.length) return;
    setUploading((n) => { const v = n + 1; onUploadingChange?.(v > 0); return v; });
    try {
      const urls = await Promise.all(list.map((f) => uploadPhoto(f, 800)));
      onChange(blocks.map((b, k) => (k === i ? { ...b, photos: [...b.photos, ...urls] } : b)));
    } catch { alert("사진 업로드에 실패했어요. 다시 시도해주세요."); }
    finally { setUploading((n) => { const v = n - 1; onUploadingChange?.(v > 0); return v; }); }
  };
  // …blocks.map으로 카드 렌더 + 하단 진입 한 줄/카탈로그
}
```
2. 컴포넌트 JSX: 추가된 블록 카드 목록(각 카드 헤더 = 카탈로그 label + 우상단 ↑ ↓ 삭제 버튼, ⑦ 콜라보 카드의 버튼 스타일 재사용) → 그 아래 진입 줄:
```tsx
{!open ? (
  <button type="button" onClick={() => setOpen(true)}
    className="w-full rounded-md border border-dashed border-border-strong px-4 py-3 text-left text-[15px] font-medium text-body">
    + 브랜드의 이야기를 더 담아볼까요? <span className="text-faint">(선택)</span>
  </button>
) : (
  <div className="space-y-2 rounded-md border border-hairline p-3">
    {CATALOG.map((c) => (
      <button key={c.type} type="button" disabled={!canAdd(c.type)} onClick={() => add(c.type)}
        className="w-full rounded-md px-3 py-2.5 text-left disabled:opacity-40 hover:bg-surface-soft">
        <p className="text-[15px] font-semibold text-ink">{c.label}</p>
        <p className="mt-0.5 text-[13px] text-mute">{c.hint}</p>
      </button>
    ))}
    <button type="button" onClick={() => setOpen(false)} className="w-full py-1.5 text-center text-sm text-faint">접기</button>
  </div>
)}
```
3. custom 카드 편집 UI(제목 input + 본문 textarea rows=3, register 폼의 inputCls 스타일 복제) + 공통 첨부줄(사진 담기 label+file input, 링크 추가 → url·label input 행, 최대 3).
4. Run: `npx tsc --noEmit`
5. Commit: `git commit -m "feat(blocks): BlockEditor 골격+카탈로그+custom 카드"`

**Expected output:** 컴파일 통과(아직 미배선). custom 블록 추가·편집·이동·삭제·사진·링크 동작 코드 완성.

### Task 5: metrics·press·reviews 카드 (아이템 리스트형)

**Goal:** 반복 아이템형 블록 3종 편집 UI.

**Steps:**
1. `BlockEditor.tsx`에 아이템 배열 조작 헬퍼(각 카드 내 [+ 추가]/[삭제], 최대 metrics 4·reviews 3·press 5).
2. metrics 카드: 행마다 `label`("어떤 숫자인가요? 예: 인스타 팔로워")·`value`("예: 1.2만") input 2개.
3. press 카드: 행마다 `title`("예: 2025 서울디자인위크 참여")·`year`(4자리, ⑦ 연도 패턴) input.
4. reviews 카드: 행마다 `quote` textarea rows=2("예: 선물했더니 반응이 정말 좋았어요")·`source` input("어디서 들었나요? 예: 인스타 DM", 선택).
5. Run: `npx tsc --noEmit`
6. Commit: `git commit -m "feat(blocks): metrics·press·reviews 편집 카드"`

**Expected output:** 3종 카드 편집 가능(컴파일 통과).

### Task 6: team·space 카드

**Goal:** 나머지 2종.

**Steps:**
1. team 카드: `intro` textarea rows=3("만드는 사람들의 이야기를 편하게 들려주세요."). 사진은 공통 첨부(선택 — 필수 표시 없음).
2. space 카드: `desc` textarea rows=3 + `features` 칩 토글(기본 제안: 대관 가능·클래스 진행·촬영 친화·주차·팝업 경험·쇼룸 — 키워드칩(③) 토글 패턴 복제, 직접 추가 input 포함).
3. Run: `npx tsc --noEmit`
4. Commit: `git commit -m "feat(blocks): team·space 편집 카드"`

**Expected output:** 6종 전부 편집 가능.

### Task 7: register 페이지 배선

**Goal:** 폼에서 블록이 보이고, 저장되고, 수정 시 다시 로드된다.

**Steps:**
1. `src/app/register/page.tsx` — `RegisterForm`에 상태 추가:
```ts
const [blocks, setBlocks] = useState<Block[]>([]);
const [blocksUploading, setBlocksUploading] = useState(false);
```
2. ⑦(콜라보 경험) 섹션 JSX와 ⑧(주요 고객) 섹션 사이에(섹션 간격 space-y-12 유지):
```tsx
<BlockEditor blocks={blocks} onChange={setBlocks} onUploadingChange={setBlocksUploading} />
```
3. 제출 payload(등록·수정 양쪽)에 `blocks,` 추가. 제출 버튼 disabled 조건에 `|| blocksUploading` 추가(기존 사진 업로드 잠금과 동일 위치).
4. edit 모드 프리필(getEditDataAction 적용부)에 `setBlocks(m.blocks ?? []);` 추가.
5. `?demo=1` 프리필(DEMO_PREFILL 적용 effect)에 샘플 1개:
```ts
setBlocks([{ type: "metrics", photos: [], links: [], items: [{ label: "인스타 팔로워", value: "1.2만" }, { label: "누적 워크숍", value: "48회" }] }]);
```
6. ⑤ subtitle 교체: "제공할 수 있는 협업을 자유롭게 작성해주세요." → **"파트너가 우리와 함께하면 뭐가 좋을지, 편하게 들려주세요."**
7. Run: `npx tsc --noEmit && npm run build`
8. Verify: dev(3001)에서 `/register?demo=1` → 블록 존 보임·추가·저장 → `/m/<slug>`엔 아직 안 보임(정상, Task 8 전).
9. Commit: `git commit -m "feat(blocks): register 배선(상태·제출·프리필)+⑤ 카피"`

**Expected output:** 등록/수정 폼에서 블록 왕복 저장.

### Task 8: /m 블록 렌더

**Goal:** 소개서에 블록이 보인다.

**Steps:**
1. CREATE `src/app/m/[slug]/BlockSections.tsx` (서버 컴포넌트 — "use client" 없음):
```tsx
import type { Block } from "@/lib/types";
import { PhotoSlider } from "@/components/PhotoSlider";
import { normalizeUrl, prettyUrl } from "@/lib/links";

const TITLES: Record<Block["type"], string> = {
  metrics: "우리의 숫자 지표에요", reviews: "이런 이야기를 들었어요",
  team: "이런 사람들이 만들고 있어요", press: "이런 곳에 소개됐어요",
  space: "우리의 공간을 소개해요", custom: "",
};

export function BlockSections({ blocks, Section }: {
  blocks: Block[];
  Section: React.ComponentType<{ title: string; children: React.ReactNode }>;
}) {
  return (
    <>
      {blocks.map((b, i) => (
        <Section key={i} title={b.type === "custom" ? b.title : TITLES[b.type]}>
          <BlockBody b={b} />
          {b.photos.length > 0 && <div className="mt-3 max-w-[460px]"><PhotoSlider photos={b.photos} /></div>}
          {b.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {b.links.map((l, k) => (
                <a key={k} href={normalizeUrl(l.url)} target="_blank" rel="noopener noreferrer nofollow"
                  className="inline-flex h-9 items-center gap-1 rounded-sm bg-surface-soft px-3 text-[14px] font-medium text-body hover:bg-primary-pale hover:text-primary-on">
                  🔗 {l.label?.trim() || prettyUrl(l.url)}
                </a>
              ))}
            </div>
          )}
        </Section>
      ))}
    </>
  );
}
```
2. `BlockBody`(같은 파일): metrics = 2열 스탯 타일(`grid grid-cols-2 gap-3`, value `text-[26px] font-bold text-ink`, label `text-[14px] text-mute`) / reviews = 인용 카드(`rounded-md bg-surface-soft p-4`, quote `text-[16px] leading-relaxed text-body`, source `mt-1 text-[13px] text-faint`) / press = `space-y-1.5` 리스트(title font-medium + year text-mute) / team·custom = whitespace-pre-line 본문(기존 ① 문단 스타일) / space = 본문 + features TypeChip과 동일 칩.
3. `src/app/m/[slug]/page.tsx` — "함께한 콜라보" 섹션 블록 바로 뒤에:
```tsx
{maker.blocks.length > 0 && <BlockSections blocks={maker.blocks} Section={Section} />}
```
4. Run: `npx tsc --noEmit && npm run build`
5. Verify: demo 등록분의 `/m/<slug>`에서 "우리의 숫자 지표에요" 스탯 타일 확인.
6. Commit: `git commit -m "feat(blocks): /m 블록 섹션 렌더"`

**Expected output:** 소개서에 블록 노출(빈 블록은 sanitize로 이미 제거).

### Task 9: Phase 1 검증·배포 (QA 게이트)

**Steps:**
1. `npx tsc --noEmit && npm run build` → dev에서 등록→수정→/m 왕복 QA(6종 전부 1회).
2. 대표 QA(모바일 폭 확인 포함) → 통과 시 `git push` (Task 1 SQL 선행 확인 필수).
3. vault [[소개서-폼-구조]]에 §블록 추가, INDEX 상태 갱신.

---

## Phase 2 — 소개자료 PDF 첨부

### Task 10: 업로드 경로 (actions.ts + upload.ts)

**Steps:**
1. 대표가 Supabase 콘솔에서 `maker-photos` 버킷 allowed MIME에 `application/pdf` 추가(설정돼 있으면 스킵).
2. `createUploadUrlAction`에 파라미터: `(kind: "photo" | "pdf" = "photo")` → `const path = kind === "pdf" ? \`d/\${crypto.randomUUID()}.pdf\` : \`p/\${crypto.randomUUID()}.jpg\`;`
3. `src/lib/upload.ts`에:
```ts
/** 소개자료 PDF 업로드(리사이즈 없음, 10MB 제한). Storage 미설정이면 에러. */
export async function uploadPdf(file: File): Promise<string> {
  if (file.type !== "application/pdf") throw new Error("pdf-only");
  if (file.size > 10 * 1024 * 1024) throw new Error("too-large");
  const signed = await createUploadUrlAction("pdf");
  if ("error" in signed) throw new Error(signed.error);
  const supabase = createBrowserAuthClient();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: "application/pdf" });
  if (error) throw new Error("upload-failed");
  return signed.publicUrl;
}
```
4. Run: `npx tsc --noEmit` / Commit: `git commit -m "feat(intro-file): PDF 서명 업로드 경로"`

### Task 11: register ⑨ 첨부 UI

**Steps:**
1. 상태 `const [introFileUrl, setIntroFileUrl] = useState(""); const [pdfUploading, setPdfUploading] = useState(false);`
2. ⑨ 브랜드 정보 섹션 마지막 필드 뒤: 라벨 "(선택) 이미 만든 소개 자료가 있다면 함께 담아드릴게요." + [PDF 올리기] 파일버튼(가입 페이지 이미지 선택 label 패턴, `accept="application/pdf"`). 업로드됨 → 파일명 대신 "소개 자료 담김 · 지우기" 표시. 실패 alert: too-large → "10MB 이하 PDF만 담을 수 있어요.", 그 외 → "업로드에 실패했어요. 다시 시도해주세요."
3. 제출 payload에 `introFileUrl: introFileUrl || undefined,` / disabled에 `|| pdfUploading` / edit 프리필 `setIntroFileUrl(m.introFileUrl ?? "");`
4. Run+Verify: 등록→수정 왕복. Commit: `git commit -m "feat(intro-file): 폼 첨부 UI"`

### Task 12: /m [소개 자료 받기] + 배포

**Steps:**
1. `/m/[slug]/page.tsx` CopyLinkButton 아래:
```tsx
{maker.introFileUrl && (
  <a href={maker.introFileUrl} target="_blank" rel="noopener noreferrer"
    className="mt-3 flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink">
    소개 자료 받기
  </a>
)}
```
2. `npx tsc --noEmit && npm run build` → QA → push.
3. Commit: `git commit -m "feat(intro-file): /m 소개 자료 받기"`

---

## Phase 3 — AI 블록 추천 (blockHints)

### Task 13: enrich.ts 확장

**Steps:**
1. 타입(ActivityHint 근처):
```ts
export interface BlockHint {
  type: "metrics" | "press" | "space" | "reviews";
  reason: string; // 근거 한 줄 — "인스타그램에서 팔로워 1.2만을 봤어요"
  items?: { label: string; value?: string; year?: string }[]; // metrics·press 밑그림
}
```
   `EnrichOptions`에 `blockHints: BlockHint[];` 추가.
2. zod 스키마(collabHints 옆): `blockHints: z.array(z.object({ type: z.enum(["metrics","press","space","reviews"]), reason: z.string(), items: z.array(z.object({ label: z.string(), value: z.string().optional(), year: z.string().optional() })).optional() })).max(2).default([])`
3. Gemini 응답 스키마(collabHints 항목 옆)에 동일 구조 `Type.ARRAY` 추가.
4. `OPTIONS_SYSTEM` 프롬프트에 규칙 추가:
```
- blockHints: 조사에서 근거가 뚜렷할 때만 추천 블록 최대 2개.
  팔로워·리뷰수 등 공개 수치 발견 → metrics(items에 label·value 밑그림) /
  언론·수상·방송 → press(items에 label=제목, year) /
  공간 운영 흔적 → space(items 없음) / 고객 후기 풍부 → reviews(items 없음 — 인용문을 지어내지 않는다).
  reason은 반드시 "~에서 …을 봤어요" 형태의 근거 한 줄. 근거 없으면 빈 배열.
```
5. 모든 EnrichOptions 반환 지점(mock 포함)에 `blockHints: []` 기본값 배선.
6. Run: `npx tsc --noEmit` / Commit: `git commit -m "feat(block-hints): enrich 판정에 블록 추천 추가"`

### Task 14: 폼 추천 배너 + 배포

**Steps:**
1. `register/page.tsx` — `const [blockHints, setBlockHints] = useState<BlockHint[]>([]); const [usedBlockHints, setUsedBlockHints] = useState<Set<number>>(new Set());` + applyWizard에서 `setBlockHints(옵션결과.blockHints ?? [])`.
2. BlockEditor 위에 배너(④ actHints 접힌 배너 패턴 복제): 헤더 "웹에서 보니, 이런 이야기도 담으면 좋겠어요" → 항목마다 카탈로그 label + reason + [이 내용으로 시작하기].
3. 적용 핸들러: `emptyBlock(h.type)`에 items 밑그림 주입(metrics: label/value, press: title=label/year) 후 `setBlocks([...blocks, block])`, used 처리. 이미 있는 타입이면 항목 숨김.
4. `npx tsc --noEmit && npm run build` → 위저드 경유 등록 QA(캔버스가든) → push.
5. Commit: `git commit -m "feat(block-hints): 폼 추천 배너"`

---

## Quality Checklist
- [x] 스펙 전 요구사항 태스크 매핑(블록6종=T4-6·공통첨부=T4·순서이동=T4·⑤카피=T7·PDF=T10-12·추천=T13-14·빈블록제외=T3·수정폴백=T2)
- [x] 이름 일관성: `Block`·`BlockType`·`BlockLink`·`BlockHint`·`blocks`·`introFileUrl`·`intro_file_url`
- [x] DB(Task 1)가 코드 배포(Task 9) 전 선행
- [x] placeholder 없음 / 각 태스크 커밋 종결
