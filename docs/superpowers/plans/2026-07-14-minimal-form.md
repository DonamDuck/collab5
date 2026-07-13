# Implementation Plan: 소개서 폼 필수 최소화 + AI 리빌
Date: 2026-07-14
Spec: docs/superpowers/specs/2026-07-14-minimal-form-redesign-design.md

## Goal
필수 3구역만 보이는 가벼운 폼 + 접힌 스텁 3종 + 시트 두 그룹 + AI 리빌로 소개서 작성 공포를 없앤다.

## Architecture
- **완성 기준**: `src/lib/completeness.ts`의 `isRichIntro()` 단일 함수 — 폼 안내(지금)·넛지(다음)·리빌 우선순위 공용.
- **스텁**: 신규 `StubSection` 래퍼가 ②④⑦(+시트 출신 4종)을 접힌 한 줄 ↔ 펼침으로 감쌈. 펼침 상태는 page.tsx의 `openSections: Set<SectionKey>`.
- **시트**: BlockEditor의 바텀시트에 `storyItems` prop 추가 → 그룹1 "브랜드 이야기"(seeks·keywords·customers·offersNote), 그룹2 "더 보여주기"(블록 6종).
- **리빌**: 신규 `RevealStep` 컴포넌트 — 위저드 onApply 후 폼 진입 전 카드 스택. 소스 = 기존 힌트 + enrich 신규 `blockHints`·`seeksHint`. 건너뛴 카드는 섹션 내부 힌트로 영속(기존 HintBanner 은퇴).
- DB 변경 0.

## Tech Stack
Next.js 16(App Router) · TS · Tailwind v4 · 기존 enrich(Gemini) 파이프라인.

## Files
```
CREATE src/lib/completeness.ts
CREATE src/app/register/StubSection.tsx
CREATE src/app/register/RevealStep.tsx        (Phase 2)
MODIFY src/app/register/page.tsx              (칩 이사·스텁 배선·시트 storyItems·완성도 안내·수정모드)
MODIFY src/app/register/BlockEditor.tsx       (시트 두 그룹 + storyItems)
MODIFY src/lib/enrich.ts                      (blockHints + seeksHint)      (Phase 2)
MODIFY src/app/register/EnrichWizard.tsx      (리빌 데이터 전달)             (Phase 2)
```

---

## Phase 1 — 폼 재구성

### Task 1: completeness.ts

**Goal:** 완성 기준 단일 함수.

**Steps:**
1. CREATE `src/lib/completeness.ts`:
```ts
// 소개서 완성 기준(스펙 2026-07-14) — 폼 안내·넛지·리빌 우선순위 공용.
// 어드바이저리 전용: 제출·공개를 막는 데 쓰지 않는다.
export interface IntroPresence {
  required: boolean; // 상호 + 협업칩(offers) ≥1
  story: boolean;
  activities: boolean;
  collabs: boolean;
  keywords: boolean;
  customers: boolean;
  offersNote: boolean;
  seeks: boolean; // seeks 칩 또는 seeksNote
  blocks: number; // 내용 있는 블록 수
}
export function narrativeCount(p: IntroPresence): number {
  return [p.story, p.activities, p.collabs].filter(Boolean).length;
}
export function sectionCount(p: IntroPresence): number {
  return (
    narrativeCount(p) +
    [p.keywords, p.customers, p.offersNote, p.seeks].filter(Boolean).length +
    p.blocks
  );
}
/** 충분한 소개서 = 필수 + 섹션 2개 이상 + 서사(시작·활동·콜라보 경험) 1개 이상 */
export function isRichIntro(p: IntroPresence): boolean {
  return p.required && sectionCount(p) >= 2 && narrativeCount(p) >= 1;
}
```
2. Run: `npx tsc --noEmit`
3. Commit: `git commit -m "feat(minimal-form): 완성 기준 isRichIntro"`

### Task 2: StubSection 컴포넌트

**Goal:** 접힌 한 줄 ↔ 펼침 래퍼 (키위 포인트 · 재접기 · scroll-mt).

**Steps:**
1. CREATE `src/app/register/StubSection.tsx`:
```tsx
"use client";
// 접힌 스텁 — 탭하면 그 자리에서 기존 편집 UI가 펼쳐진다(시트 이동 없음).
// 펼쳤지만 빈 채 = 추가 아님(제출 시 값 없으면 어차피 저장 안 됨 — 기존 sanitize/빈값 규칙 재사용).
export function StubSection({
  id, label, expanded, hasData, onExpand, onCollapse, children,
}: {
  id: string; // 완성도 칩 scroll+focus 타깃
  label: string; // 기존 질문 문장 그대로
  expanded: boolean;
  hasData: boolean; // 값 있으면 접기 버튼 숨김(실수 접힘 방지 아님 — 접어도 데이터 유지, 라벨만 "담김" 표시)
  onExpand: () => void;
  onCollapse: () => void;
  children: React.ReactNode;
}) {
  if (!expanded)
    return (
      <button
        type="button"
        id={id}
        onClick={onExpand}
        className="w-full rounded-md border border-dashed border-border-strong bg-surface px-4 py-3.5 text-left scroll-mt-4"
      >
        <span className="text-[15px] font-medium text-body">
          <span className="mr-1 font-semibold text-primary-on">+</span> {label}
        </span>
        {hasData && (
          <span className="ml-2 rounded-pill bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-on">담김</span>
        )}
      </button>
    );
  return (
    <div id={id} className="scroll-mt-4">
      <div className="mb-[23px] flex items-center justify-between border-b border-hairline pb-2">
        <span className="text-[17px] font-bold text-ink">{label}</span>
        <button type="button" onClick={onCollapse} className="text-sm text-faint hover:text-ink">접기</button>
      </div>
      {children}
    </div>
  );
}
```
2. Run: `npx tsc --noEmit` / Commit: `git commit -m "feat(minimal-form): StubSection 접힘 래퍼"`

### Task 3: page.tsx — 섹션 상태 모델

**Goal:** 어떤 섹션이 펼쳐져 있는지의 단일 상태 + 수정모드/제출 규칙.

**Steps:**
1. `page.tsx`에 타입·상태 추가(다른 useState 묶음 옆):
```ts
type SectionKey = "story" | "activities" | "collabs" | "keywords" | "customers" | "offersNote" | "seeks";
const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set());
const openSection = (k: SectionKey) =>
  setOpenSections((s) => new Set(s).add(k));
const closeSection = (k: SectionKey) =>
  setOpenSections((s) => { const n = new Set(s); n.delete(k); return n; });
```
2. 데이터 존재 판정 헬퍼(제출·완성도·hasData 공용, 컴포넌트 안):
```ts
const hasStory = !!story.trim();
const hasActivities = activities.some((a) => a.title.trim() || a.desc.trim() || a.photos.length > 0);
const hasCollabs = collabHistory.some((h) => h.partner.trim() || h.desc.trim() || h.photos.length > 0);
const hasKeywords = values.length > 0;
const hasCustomers = targetAudience.length > 0;
const hasOffersNote = !!offersNote.trim();
const hasSeeks = seeks.length > 0 || !!seeksNote.trim();
```
3. **수정모드 규칙**: edit 프리필 함수 끝에 데이터 있는 섹션 자동 펼침:
```ts
const open = new Set<SectionKey>();
if (m.story.trim()) open.add("story");
if (m.activities.length) open.add("activities");
if (m.collabHistory.length) open.add("collabs");
if (m.soul.values.length) open.add("keywords");
if (m.targetAudience.length) open.add("customers");
if (m.offersNote.trim()) open.add("offersNote");
if (m.seeks.length || m.seeksNote.trim()) open.add("seeks");
setOpenSections(open);
```
4. `?demo=1` 프리필도 동일하게 채운 섹션 펼침(`new Set(["story","activities","collabs"] as SectionKey[])` — 데모 데이터 기준).
5. Run: `npx tsc --noEmit` / Commit: `git commit -m "feat(minimal-form): 섹션 펼침 상태 모델·수정모드 규칙"`

### Task 4: ① 협업 칩 이사 + ⑤⑥ 섹션 해체

**Goal:** offers 칩이 ①의 필수 요소가 되고, ⑤⑥ GroupHeader 섹션이 사라진다.

**Steps:**
1. ①(브랜드를 소개해주세요) 섹션의 브랜드 사진 필드 뒤에 이동 삽입(기존 ⑤의 ChipRow 재사용):
```tsx
<Field label="어떤 협업을 할 수 있나요? *">
  <ChipRow options={COLLAB_TYPES} selected={offers} onToggle={(t) => toggle(offers, setOffers, t)} />
</Field>
```
2. 기존 ⑤ 섹션(GroupHeader+textarea+ChipRow)과 ⑥ 섹션 전체 JSX **삭제** — offersNote·seeks·seeksNote의 state·제출 payload는 그대로 유지(옵션 섹션으로 재배치는 Task 6).
3. 제출 검증에 offers 최소 1개 추가(기존 validate 위치): `if (!offers.length) return "제공할 수 있는 협업을 1개 이상 골라주세요.";`
4. Run: `npx tsc --noEmit` (offersNote 등 미사용 경고 나오면 Task 6까지 임시 — eslint-disable 말고 Task 6에서 소비되므로 빌드만 통과 확인)
5. Commit: `git commit -m "feat(minimal-form): 협업 칩 ① 이사·⑤⑥ 섹션 해체"`

### Task 5: ②④⑦을 StubSection으로 감싸기

**Goal:** 시작 이야기·활동·콜라보 경험이 접힌 한 줄이 된다.

**Steps:**
1. ②(왜 이 브랜드를…) 섹션: GroupHeader 제거하고 기존 textarea 블록을 감쌈:
```tsx
<StubSection id="stub-story" label="왜 이 브랜드를 시작하셨나요?"
  expanded={openSections.has("story")} hasData={hasStory}
  onExpand={() => openSection("story")} onCollapse={() => closeSection("story")}>
  {/* 기존 story textarea + 크롤힌트 그대로 */}
</StubSection>
```
2. ④(주로 어떤 활동…)·⑦(이런 콜라보 경험…)도 동일 패턴(`stub-activities`·`stub-collabs`, 기존 내부 JSX 통째 이동).
3. GroupHeader의 번호 뱃지: 남는 필수 섹션은 ①(소개)·②(브랜드 정보 — 구⑨)로 리넘버. 스텁·시트 섹션은 번호 없음(질문 문장이 헤더).
4. Run: `npx tsc --noEmit && npm run build`
5. Verify: dev에서 /register 열어 스텁 3종 접힘·펼침·재접기.
6. Commit: `git commit -m "feat(minimal-form): 스텁 3종(시작·활동·콜라보) 전환"`

### Task 6: 시트 두 그룹 + 시트 출신 4종 인라인 렌더

**Goal:** 바텀시트에 "브랜드 이야기" 그룹 추가, 선택 시 정본 위치에 펼쳐짐.

**Steps:**
1. `BlockEditor.tsx`에 prop 추가:
```ts
storyItems?: { key: string; label: string; hint: string; added: boolean; onAdd: () => void }[];
```
시트 렌더에서 CATALOG 위에 그룹 헤더 "브랜드 이야기"(text-primary-on 키위 포인트) + storyItems 버튼(카탈로그 카드와 동일 스타일, added면 disabled), 그 아래 그룹 헤더 "더 보여주기" + 기존 CATALOG.
2. `page.tsx`에서 BlockEditor 호출에 전달(스펙 순서 — seeks 맨 위):
```tsx
storyItems={[
  { key: "seeks", label: "이런 파트너를 찾고 있어요.", hint: "파트너와 꿈꾸는 협업 유형을 알려주세요.", added: openSections.has("seeks") || hasSeeks, onAdd: () => openSection("seeks") },
  { key: "keywords", label: "우리 브랜드를 표현하는 키워드를 골라주세요.", hint: "분위기를 칩으로 골라요.", added: openSections.has("keywords") || hasKeywords, onAdd: () => openSection("keywords") },
  { key: "customers", label: "저희는 주로 이런 고객과 함께하고 있어요.", hint: "주요 고객을 알려주세요.", added: openSections.has("customers") || hasCustomers, onAdd: () => openSection("customers") },
  { key: "offersNote", label: "어떤 협업을 할 수 있나요? — 자세히", hint: "제공할 수 있는 협업을 편하게 들려주세요.", added: openSections.has("offersNote") || hasOffersNote, onAdd: () => openSection("offersNote") },
]}
```
(onAdd 안에서 openSection 후 `setTimeout(() => document.getElementById("sec-"+key)?.scrollIntoView({behavior:"smooth",block:"center"}), 60)` — 블록 add 앵커 패턴 재사용.)
3. 시트 출신 4종을 정본 위치에 StubSection으로 렌더(접힌 스텁은 노출 안 함 — `expanded=false`면 null 반환하는 변형 필요 → StubSection에 `hiddenWhenCollapsed?: boolean` prop 추가, 시트 출신만 true):
   - keywords = 구③ 위치(① 다음) · offersNote·seeks = 구⑤⑥ 위치(활동 뒤) · customers = 구⑧ 위치. 내부 JSX는 기존 섹션 것 그대로 이동.
4. Run: `npx tsc --noEmit && npm run build` / Verify: 시트에서 "이런 파트너를…" 추가 → 정위치 펼침 확인.
5. Commit: `git commit -m "feat(minimal-form): 시트 두 그룹·시트 섹션 인라인 렌더"`

### Task 7: 완성도 안내 한 줄

**Goal:** 제출 버튼 위 다정한 안내 + 스텁 칩(scroll+focus).

**Steps:**
1. `page.tsx` 제출 버튼 위에:
```tsx
{(() => {
  const p = { required: !!name.trim() && offers.length > 0, story: hasStory, activities: hasActivities, collabs: hasCollabs, keywords: hasKeywords, customers: hasCustomers, offersNote: hasOffersNote, seeks: hasSeeks, blocks: blocks.length };
  if (isRichIntro(p))
    return <p className="mb-3 text-center text-sm text-primary-on">✓ 충분히 멋진 소개서예요. 언제든 더 담을 수 있어요.</p>;
  const closed = ([["story","시작 이야기"],["activities","주요 활동"],["collabs","콜라보 경험"]] as const)
    .filter(([k]) => !openSections.has(k) || !p[k]).slice(0, 2);
  return (
    <div className="mb-3 text-center">
      <p className="text-sm text-mute">이야기를 하나만 더 담으면, 소개서가 한층 단단해져요.</p>
      <div className="mt-2 flex justify-center gap-2">
        {closed.map(([k, label]) => (
          <button key={k} type="button" onClick={() => { openSection(k); setTimeout(() => document.getElementById("stub-" + (k === "collabs" ? "collabs" : k))?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }}
            className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on">
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
})()}
```
   import: `import { isRichIntro } from "@/lib/completeness";`
2. Run: `npx tsc --noEmit && npm run build`
3. Commit: `git commit -m "feat(minimal-form): 완성도 안내 한 줄"`

### Task 8: Phase 1 검증·배포 게이트

**Steps:**
1. `npx tsc --noEmit && npm run build` → dev에서: 신규 등록 최소 경로(①+칩+⑨만) 제출 → /m 확인 / 스텁 3종 펼침·접기 / 시트 4종 추가 / 수정모드 재진입 시 펼침 복귀 / `?demo=1`.
2. **대표 QA(실기기 모바일 우선)** → OK 시 push(prod).
3. vault [[소개서-폼-구조]] §신규 추가 + INDEX 갱신.

---

## Phase 2 — AI 리빌

### Task 9: enrich.ts — blockHints + seeksHint

**Goal:** 리빌 소스 확장 (기존 07-13 계획 Task 13 재사용 + seeks).

**Steps:**
1. 2026-07-13 계획 Task 13의 blockHints 구현 그대로(BlockHint 타입·zod·Gemini 스키마·OPTIONS_SYSTEM 규칙·기본값 배선).
2. 추가로 `seeksHint` 필드:
```ts
export interface SeeksHint { types: string[]; note: string; reason: string }
// EnrichOptions에: seeksHint: SeeksHint | null;
```
zod: `seeksHint: z.object({ types: z.array(z.string()).max(3), note: z.string(), reason: z.string() }).nullable().default(null)` + Gemini 스키마 동일 구조.
OPTIONS_SYSTEM 추가 규칙: "seeksHint: 조사에서 이 브랜드가 어떤 파트너·협업을 원하는지 근거가 보이면 제안(없으면 null). 지어내지 않는다. reason은 '~에서 봤어요' 근거 한 줄."
3. Run: `npx tsc --noEmit` / Commit: `git commit -m "feat(reveal): enrich blockHints·seeksHint"`

### Task 10: RevealStep 컴포넌트

**Goal:** "이런 이야기들을 찾았어요" 카드 스택.

**Steps:**
1. CREATE `src/app/register/RevealStep.tsx`:
```tsx
"use client";
// 크롤 결과 리빌 — 카드별 [이 내용으로 담기]/[건너뛰기]. 빈손이면 부모가 아예 렌더 안 함.
export interface RevealCard {
  key: string;            // "seeks" | "story" | "activity-0" | "collab-0" | "block-metrics" ...
  sectionLabel: string;   // 기존 질문 문장
  preview: string;        // 내용 프리뷰(최대 3줄 line-clamp)
  reason: string;         // "인스타그램에서 봤어요"
}
export function RevealStep({ cards, onAccept, onSkip, onDone }: {
  cards: RevealCard[];
  onAccept: (key: string) => void;
  onSkip: (key: string) => void;
  onDone: () => void;
}) { /* 카드 목록 + 하단 [소개서로 이동] 버튼. 카드 = border-2 border-primary rounded-md, 섹션 라벨 볼드 + preview(text-mute, line-clamp-3) + reason(text-faint text-[13px]) + [이 내용으로 담기](bg-primary)·[건너뛰기](text-faint) */ }
```
   전 카드 처리(담기/건너뛰기) 시 자동 onDone.
2. Run: `npx tsc --noEmit` / Commit: `git commit -m "feat(reveal): RevealStep 카드 스택"`

### Task 11: 위저드→리빌→폼 배선 + 배너 은퇴

**Goal:** applyWizard가 리빌을 거치고, 기존 HintBanner가 섹션 내부 힌트로 이사.

**Steps:**
1. `page.tsx`: `const [revealCards, setRevealCards] = useState<RevealCard[] | null>(null);` — applyWizard에서 즉시 반영하던 힌트들(actHints·collabHints)+신규(blockHints·seeksHint)+소개글 후보(descChoices 있으면 "자세히 소개" 카드 1장)를 RevealCard[]로 조립. **카드 순서 = seeks 최우선**(스펙 완화책). 0장이면 null(리빌 스킵).
2. onAccept(key): 해당 상태 채움 + `openSection(...)` + aiFilled 표시. **사용자가 이미 만진 필드는 덮지 않음** — 각 accept 핸들러에서 `if (!story.trim())` 식 가드. onSkip(key): 카드만 제거 — 힌트 원본(actHints 등) 상태는 유지.
3. 리빌 렌더: `revealCards && <RevealStep .../>`를 폼 위 오버레이(기존 위저드 모달 패턴)로. onDone → setRevealCards(null).
4. **HintBanner 은퇴**: ④⑦ 아래 `<HintBanner>` 2곳 제거. 대신 각 스텁 펼침 내부 상단에 미사용 힌트가 남아 있으면 소형 인라인 힌트(기존 applyActHint/applyCollabHint 재사용): "웹에서 찾은 내용이에요 — [이 내용으로 시작하기]". HintBanner 함수는 삭제(미사용).
5. Run: `npx tsc --noEmit && npm run build` / Verify: 위저드 경유 등록(캔버스가든) → 리빌 카드 → 담기 → 폼 프리필 확인.
6. Commit: `git commit -m "feat(reveal): 위저드→리빌→폼 배선·크롤힌트 배너 은퇴"`

### Task 12: Phase 2 검증·배포 게이트

**Steps:**
1. tsc+build → 위저드 경유/미경유/빈손 크롤 3경로 QA → 대표 실기기 QA → push.
2. vault 갱신([[소개서-폼-구조]]·[[인프라-운영]] enrich 절) + 2026-07-13 계획 Task 13~14를 "본 계획으로 대체" 표기.

## Quality Checklist
- [x] 스펙 전 요구사항 매핑: 칩 이사(T4)·스텁(T2,5)·시트 두 그룹(T6)·완성도(T1,7)·수정모드(T3)·리빌(T9~11)·배너 은퇴(T11)·seeks 완화(T6 순서·T9 seeksHint·T11 카드 순서)·카피 승계(각 태스크 문장 명기)
- [x] 넛지 = 스코프 아웃(정책은 스펙에)
- [x] DB 변경 0 확인 · placeholder 없음 · 태스크별 커밋
