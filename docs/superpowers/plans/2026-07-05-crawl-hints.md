# Implementation Plan: 크롤 기반 활동·콜라보 참고 힌트

Date: 2026-07-05
Spec: [docs/superpowers/specs/2026-07-05-crawl-hints-design.md](../specs/2026-07-05-crawl-hints-design.md)

## Goal
AI 크롤(mode:options)이 조사 메모에서 발견한 활동·콜라보 흔적을 힌트로 뽑아, 폼의 ④ 활동·함께한 콜라보 섹션 아래 접힌 배너로 보여주고 '이 내용으로 시작하기'로 카드 밑그림을 채운다.

## Architecture
- 백엔드: `mode:options` 1회 호출의 스키마에 `activityHints`/`collabHints` 확장(추가 API 호출 0). 프롬프트에 "메모에 실제 등장한 것만, 없으면 빈 배열" 규칙.
- 전달: `EnrichOptions` → `WizardFill` → `applyWizard` → `hints` 상태(세션 한정).
- UI: `HintBanner`(접힘/펼침) + 넣기 핸들러(빈 카드 우선 채움, 넣은 힌트 `✓ 넣었어요` disabled).
- ⚠️ Tailwind v4 `space-y`는 margin-bottom 기반 — ④ 아래 배너는 자체 `mb-6`로 간격 덮어씀(기존 하드-원 규칙).

## Tech Stack
Next.js 16 · React 19 · TypeScript · Tailwind v4 · zod(Haiku 폴백 스키마) · @google/genai(Type 스키마).

## Files
MODIFY src/lib/enrich.ts
MODIFY src/app/register/EnrichWizard.tsx
MODIFY src/app/register/page.tsx

---

## Task 1: enrich.ts — 힌트 타입·스키마·프롬프트·normalize·mock

**Goal:** options 파이프라인이 activityHints/collabHints를 뽑아 반환하게 한다.

**Steps:**

1. **타입 추가** — `src/lib/enrich.ts`에서 `/** 5지선다 결과 — ... */` 주석 위(`export interface EnrichOptions {` 바로 위)에 추가:
   ```ts
   /** 크롤이 발견한 활동 흔적 — 창작 아님, 조사 메모에 실제 등장한 것만 */
   export interface ActivityHint {
     title: string; // 짧은 활동명 (예: "가방 만들기 워크숍")
     desc: string; // 한두 문장 요약 (해요체)
     source: string; // 출처 유형 라벨 (예: "네이버 블로그 후기")
   }
   /** 크롤이 발견한 콜라보 흔적 */
   export interface CollabHint {
     partner: string; // 파트너/함께한 곳
     desc: string; // 한두 문장 요약 (해요체)
     source: string; // 출처 유형 라벨
   }
   ```

2. **EnrichOptions 확장** — `EnrichOptions` 인터페이스의 `values: string[];` 아래에 추가:
   ```ts
     activityHints: ActivityHint[]; // 발견된 활동 흔적 0~3건 (참고용)
     collabHints: CollabHint[]; // 발견된 콜라보 흔적 0~3건 (참고용)
   ```

3. **MockProvider.options() 확장** — mock 반환 객체의 `values: input.focusKeywords?.slice(0, 4) ?? ["정성", "손맛", "로컬"],` 아래에 추가:
   ```ts
       activityHints: [
         { title: "가방 만들기 워크숍", desc: "5주 과정 워크숍 후기가 여러 건 보여요.", source: "네이버 블로그 후기" },
         { title: "온라인 스토어 운영", desc: "자체 제작 소품을 판매하는 스토어가 언급돼요.", source: "웹 검색" },
       ],
       collabHints: [
         { partner: "오월의숲", desc: "함께 팝업을 열었다는 후기가 보여요.", source: "카페글" },
       ],
   ```

4. **zod 스키마 확장(Haiku 폴백)** — `OptionsResultSchema`의 `values: z.array(z.string()).describe("브랜드 결 단어 2~4개"),` 아래에 추가:
   ```ts
     activityHints: z
       .array(
         z.object({
           title: z.string().describe("짧은 활동명"),
           desc: z.string().describe("한두 문장 요약, 해요체"),
           source: z.string().describe("출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나"),
         })
       )
       .describe("조사 메모에 실제 언급된 활동 흔적 0~3건. 없으면 빈 배열"),
     collabHints: z
       .array(
         z.object({
           partner: z.string().describe("파트너/함께한 곳 이름"),
           desc: z.string().describe("한두 문장 요약, 해요체"),
           source: z.string().describe("출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나"),
         })
       )
       .describe("조사 메모에 실제 언급된 콜라보 흔적 0~3건. 없으면 빈 배열"),
   ```

5. **Gemini 스키마 확장** — `GEMINI_OPTIONS_SCHEMA`의 `values: { type: Type.ARRAY, ... },` 아래에 추가하고, `required` 배열을 `["identity", "instagramCandidates", "oneLiners", "descriptions", "values", "activityHints", "collabHints"]`로 교체:
   ```ts
       activityHints: {
         type: Type.ARRAY,
         items: {
           type: Type.OBJECT,
           properties: {
             title: { type: Type.STRING, description: "짧은 활동명" },
             desc: { type: Type.STRING, description: "한두 문장 요약, 해요체" },
             source: { type: Type.STRING, description: "출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나" },
           },
           required: ["title", "desc", "source"],
         },
         description: "조사 메모에 실제 언급된 활동(워크숍·클래스·팝업·제품라인 등) 흔적 0~3건. 메모에 없으면 빈 배열 — 창작 금지",
       },
       collabHints: {
         type: Type.ARRAY,
         items: {
           type: Type.OBJECT,
           properties: {
             partner: { type: Type.STRING, description: "파트너/함께한 곳 이름" },
             desc: { type: Type.STRING, description: "한두 문장 요약, 해요체" },
             source: { type: Type.STRING, description: "출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나" },
           },
           required: ["partner", "desc", "source"],
         },
         description: "조사 메모에 파트너명이 드러난 협업 소식 0~3건. 메모에 없으면 빈 배열 — 창작 금지",
       },
   ```

6. **OPTIONS_SYSTEM 규칙 추가** — `OPTIONS_SYSTEM` 템플릿 문자열 마지막(인스타 규칙 줄 뒤)에 추가:
   ```
   - activityHints: 조사 메모에 실제로 언급된 이 브랜드의 활동(워크숍·클래스·팝업·제품라인 등)만 0~3건. collabHints: 메모에 파트너명이 드러난 협업 소식만 0~3건. 각 항목의 source는 그 정보가 나온 출처 유형(네이버 블로그 후기/카페글/웹 검색/인스타그램)으로. ⚠️메모에 없으면 절대 만들지 말고 빈 배열로 둬라(참고용 힌트라 사실만).
   ```

7. **options() 프롬프트 한 줄 추가** — `NaverGeminiProvider.options()`의 prompt 마지막 줄 `나머지는 사실만 쓰고, 확인 안 된 필드는 빈 문자열. 모든 문장은 '해요체'로 끝내('~합니다/~습니다' 금지).` 를 다음으로 교체(약한 모델은 user 프롬프트 끝 지시가 강함):
   ```
   나머지는 사실만 쓰고, 확인 안 된 필드는 빈 문자열. 모든 문장은 '해요체'로 끝내('~합니다/~습니다' 금지).
   ⭐activityHints·collabHints는 조사 자료에 실제로 언급된 활동·협업만 0~3건씩(source=출처 유형). 자료에 없으면 빈 배열 — 지어내기 금지.
   ```

8. **normalizeOptions 확장** — `normalizeOptions`의 반환 객체에서 `values: (o.values ?? []).filter(Boolean).slice(0, 4),` 아래에 추가:
   ```ts
       activityHints: (o.activityHints ?? [])
         .filter((h) => h && h.title?.trim() && h.desc?.trim())
         .slice(0, 3),
       collabHints: (o.collabHints ?? [])
         .filter((h) => h && h.partner?.trim() && h.desc?.trim())
         .slice(0, 3),
   ```

9. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/lib/enrich.ts`
10. Verify: 에러 0. (MockProvider·zod·Gemini 스키마·normalize 4곳 모두 새 필드 존재 — `grep -c "activityHints" src/lib/enrich.ts` ≥ 6)
11. Commit: `git commit -am "feat(enrich): options 스키마에 활동·콜라보 힌트 추출 추가"`

**Expected output:** `mode:options` 응답에 `activityHints`/`collabHints`(각 0~3건)가 포함되고, mock은 샘플 힌트 반환. 타입·린트 클린.

---

## Task 2: EnrichWizard — WizardFill 확장 + apply 전달

**Goal:** 위저드 '적용' 시 힌트가 폼으로 전달된다.

**Steps:**

1. **import 확장** — `src/app/register/EnrichWizard.tsx`의 `import type { EnrichField, EnrichOptions } from "@/lib/enrich";` 형태의 import에 `ActivityHint, CollabHint`를 추가 (실제 import 라인을 확인 후 타입 추가):
   ```ts
   import type { ActivityHint, CollabHint, EnrichField, EnrichOptions } from "@/lib/enrich";
   ```
   (기존 import에 EnrichField가 없다면 있는 것 그대로 두고 ActivityHint·CollabHint만 추가.)

2. **WizardFill 확장** — `export type WizardFill = { ... }`의 `description?: string;` 아래에 추가:
   ```ts
     activityHints?: ActivityHint[]; // 크롤이 발견한 활동 흔적(참고용)
     collabHints?: CollabHint[]; // 크롤이 발견한 콜라보 흔적(참고용)
   ```

3. **apply() 전달** — `const apply = () => { onApply({ ... }) }`의 `values: options?.values.length ? options.values : undefined,` 아래에 추가:
   ```ts
       activityHints: options?.activityHints?.length ? options.activityHints : undefined,
       collabHints: options?.collabHints?.length ? options.collabHints : undefined,
   ```

4. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/register/EnrichWizard.tsx`
5. Verify: 에러 0.
6. Commit: `git commit -am "feat(enrich): 위저드 적용 시 활동·콜라보 힌트 전달"`

**Expected output:** applyWizard의 `fill`에 힌트 배열이 실려 옴(있을 때만).

---

## Task 3: register 폼 — hints 상태 + HintBanner + 넣기 핸들러

**Goal:** ④ 활동·함께한 콜라보 아래 접힌 배너로 힌트를 보여주고, '이 내용으로 시작하기'로 카드를 채운다.

**Steps:**

1. **import** — `src/app/register/page.tsx`의 `import type { EnrichField } from "@/lib/enrich";`를 다음으로 교체:
   ```ts
   import type { ActivityHint, CollabHint, EnrichField } from "@/lib/enrich";
   ```

2. **상태 추가** — `const [reviewMode, setReviewMode] = useState(false);` 아래에 추가:
   ```ts
     // 크롤이 발견한 활동·콜라보 힌트(참고용, 세션 한정 — 저장 안 함)
     const [actHints, setActHints] = useState<ActivityHint[]>([]);
     const [collabHints, setCollabHints] = useState<CollabHint[]>([]);
     const [usedActHints, setUsedActHints] = useState<Set<number>>(new Set());
     const [usedCollabHints, setUsedCollabHints] = useState<Set<number>>(new Set());
   ```

3. **applyWizard에서 수신** — `applyWizard` 내 `setAiFilled(filled);` 바로 위에 추가:
   ```ts
       if (fill.activityHints?.length) {
         setActHints(fill.activityHints);
         setUsedActHints(new Set());
       }
       if (fill.collabHints?.length) {
         setCollabHints(fill.collabHints);
         setUsedCollabHints(new Set());
       }
   ```

4. **넣기 핸들러 추가** — `applyWizard` 함수 정의가 끝나는 `};` 아래에 추가:
   ```ts
     // 힌트 '이 내용으로 시작하기' — 빈 카드 우선 채움, 없으면 새 카드(최대 3), 꽉 차면 불가
     const applyActHint = (i: number) => {
       const h = actHints[i];
       if (!h) return;
       setActivities((p) => {
         const empty = p.findIndex((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length);
         if (empty >= 0)
           return p.map((a, j) => (j === empty ? { ...a, title: h.title, desc: h.desc } : a));
         if (p.length < 3) return [...p, { title: h.title, desc: h.desc, photos: [] }];
         return p;
       });
       setUsedActHints((s) => new Set(s).add(i));
     };
     const canApplyActHint =
       activities.some((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length) ||
       activities.length < 3;
     const applyCollabHint = (i: number) => {
       const h = collabHints[i];
       if (!h) return;
       setCollabHistory((p) => {
         const empty = p.findIndex(
           (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
         );
         if (empty >= 0)
           return p.map((c, j) => (j === empty ? { ...c, partner: h.partner, desc: h.desc } : c));
         if (p.length < 3) return [...p, { ...emptyHist(), partner: h.partner, desc: h.desc }];
         return p;
       });
       setUsedCollabHints((s) => new Set(s).add(i));
     };
     const canApplyCollabHint =
       collabHistory.some(
         (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
       ) || collabHistory.length < 3;
   ```

5. **HintBanner 컴포넌트 추가** — 파일 하단 `function GroupHeader(` 정의 바로 위에 추가:
   ```tsx
   // 크롤이 발견한 참고 힌트 — 접힌 배너 → 펼침. 창작 아님(웹에서 찾은 내용만).
   function HintBanner({
     items,
     used,
     canApply,
     onApply,
   }: {
     items: { heading: string; desc: string; source: string }[];
     used: Set<number>;
     canApply: boolean;
     onApply: (i: number) => void;
   }) {
     const [open, setOpen] = useState(false);
     if (!items.length) return null;
     return (
       <div className="rounded-md border border-hairline bg-primary-pale/60">
         <button
           type="button"
           onClick={() => setOpen((v) => !v)}
           className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-primary-on"
         >
           <span>✨ 웹에서 참고할 만한 정보를 찾았어요 ({items.length}건)</span>
           <span className="text-mute">{open ? "∧" : "∨"}</span>
         </button>
         {open && (
           <div className="space-y-3 border-t border-hairline px-3 py-3">
             {items.map((it, i) => {
               const isUsed = used.has(i);
               return (
                 <div key={i}>
                   <span className="inline-flex h-6 items-center rounded-pill bg-surface px-2 text-[12px] text-mute">
                     {it.source}
                   </span>
                   <p className="mt-1 text-sm font-semibold text-ink">{it.heading}</p>
                   <p className="mt-0.5 text-sm leading-relaxed text-body">{it.desc}</p>
                   <button
                     type="button"
                     onClick={() => onApply(i)}
                     disabled={isUsed || !canApply}
                     className="mt-1.5 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                   >
                     {isUsed ? "✓ 넣었어요" : "이 내용으로 시작하기"}
                   </button>
                 </div>
               );
             })}
             <p className="text-[12px] text-faint">ⓘ 웹에서 찾은 내용이에요.</p>
           </div>
         )}
       </div>
     );
   }
   ```

6. **④ 활동 아래 배치** — `{/* ── ④ 주로 어떤 활동을 하나요 ── */}`의 `<GroupHeader n="④" ... />` 바로 다음, `<div className="space-y-4">` 앞에 추가 (space-y-12의 margin-bottom을 자체 `mb-6`으로 덮어씀 — Tailwind v4 하드-원):
   ```tsx
           {actHints.length > 0 && (
             <div className="-mt-3 mb-6">
               <HintBanner
                 items={actHints.map((h) => ({ heading: h.title, desc: h.desc, source: h.source }))}
                 used={usedActHints}
                 canApply={canApplyActHint}
                 onApply={applyActHint}
               />
             </div>
           )}
   ```

7. **함께한 콜라보 아래 배치** — `지난 콜라보를 더하면 "검증된 파트너"라는 신호가 돼요.` `</p>` 바로 다음(콜라보 카드 `<div className="space-y-4">` 앞)에 추가:
   ```tsx
             {collabHints.length > 0 && (
               <div className="mb-3">
                 <HintBanner
                   items={collabHints.map((h) => ({ heading: h.partner, desc: h.desc, source: h.source }))}
                   used={usedCollabHints}
                   canApply={canApplyCollabHint}
                   onApply={applyCollabHint}
                 />
               </div>
             )}
   ```

8. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/register/page.tsx`
9. Verify: 에러 0. `grep -c "HintBanner" src/app/register/page.tsx` = 3 (정의 1 + 사용 2).
10. Commit: `git commit -am "feat(register): 크롤 힌트 배너(활동·콜라보 참고정보 + 시작하기)"`

**Expected output:** 위저드 적용 후 ④·함께한 콜라보 아래 접힌 배너 노출 → 펼침 → '이 내용으로 시작하기'로 카드 밑그림 채움 → '✓ 넣었어요' 전환.

---

## 최종 검증 (전체)
- `npx tsc --noEmit` + 3파일 eslint 클린.
- 로컬(mock, 3001): `/register`에서 상호 입력 → 불러오기 → 인터뷰 4스텝 → 적용 → ④ 아래 배너(2건)·콜라보 아래 배너(1건) 확인 → 펼침 → 시작하기 → 활동/콜라보 카드에 제목·설명/파트너·내용 채워짐 → 버튼 `✓ 넣었어요` → 저장까지 기존 경로 정상.
- prod(실크롤): 캔버스가든으로 워크숍 후기→활동 힌트 검증, 힌트 없는 무명 브랜드→배너 미노출.
