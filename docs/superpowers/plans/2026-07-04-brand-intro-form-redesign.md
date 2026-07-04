# Implementation Plan: 브랜드 소개서 폼 전면 개편
Date: 2026-07-04
Spec: docs/superpowers/specs/2026-07-04-brand-intro-form-redesign-design.md

## Goal
노션 기준 8섹션 인터뷰형 소개서 폼으로 `/register`를 재구성하고, 새 필드(story·activities·offersNote·seeksNote·콜라보사진)를 저장·카드/프로필에 노출한다.

## Architecture
`types.ts`(모델) → `schema.sql`(DB) → `repo.ts`/`actions.ts`(저장) → `register/page.tsx`(폼) → `c/[slug]`·`m/[slug]`(노출). 전역 타이포는 `globals.css` 루트 폰트 레버.

## Tech Stack
Next.js 16 · React 19 · Tailwind v4 · TypeScript · Supabase. 사진=클라 리사이즈 data URL(base64).

## Files
```
MODIFY src/lib/types.ts              (CollabType 병합, Activity, Maker 필드)
MODIFY supabase/schema.sql           (story/activities/offers_note/seeks_note 컬럼)
MODIFY src/lib/repo.ts               (row 매핑·createMaker·시드)
MODIFY src/lib/actions.ts            (RegisterInput·createMakerAction)
MODIFY next.config.ts                (bodySizeLimit 12mb)
MODIFY src/app/globals.css           (루트 폰트 +1px)
MODIFY src/app/register/page.tsx     (8섹션 폼)
MODIFY src/app/c/[slug]/page.tsx     (새 필드 노출)
MODIFY src/app/m/[slug]/page.tsx     (새 필드 노출)
```

## 병합 CollabType (7개, 고정)
`["제품콜라보","팝업","워크숍","공동굿즈","공동콘텐츠","행사참여","공간대여"]`
시드 리맵: 제품컬래버→제품콜라보 · 굿즈→공동굿즈 · 콘텐츠→공동콘텐츠 (워크숍·팝업·공간대여·행사참여 동일).

---

## Task 1: 데이터 모델 확장 (types.ts)

**Goal:** CollabType 병합 + Activity 타입 + Maker 신규 필드.

**Steps:**
1. `src/lib/types.ts` — CollabType 유니온을 7개 병합 라벨로 교체:
```ts
export type CollabType =
  | "제품콜라보" | "팝업" | "워크숍" | "공동굿즈" | "공동콘텐츠" | "행사참여" | "공간대여";
```
2. CollabHistory에 photos 추가:
```ts
export interface CollabHistory {
  partner: string;
  types: string[];
  year?: string;
  photos: string[]; // 콜라보 사진 최대 3
}
```
3. Activity 타입 추가(CollabHistory 근처):
```ts
/** 대표 활동 — 제목·설명·사진(최대 3) */
export interface Activity { title: string; desc: string; photos: string[]; }
```
4. Maker 인터페이스에 신규 필드 추가(collabHistory 아래):
```ts
  story: string;          // 왜 시작했나
  activities: Activity[];  // 대표 활동 최대 3
  offersNote: string;      // 협업 직접 설명
  seeksNote: string;       // 파트너 직접 설명
```
5. Verify: `npx tsc --noEmit` (여기선 다른 파일 에러 남 — 다음 태스크에서 해소)
6. Commit: `git commit -m "feat(types): 소개서 개편 - CollabType 병합 + Activity + Maker 신규 필드"`

---

## Task 2: DB 스키마 (schema.sql)

**Goal:** 신규 컬럼 ALTER 추가.

**Steps:**
1. `supabase/schema.sql` — makers CREATE TABLE 컬럼부에 추가:
```sql
  story        TEXT  NOT NULL DEFAULT '',
  activities   JSONB NOT NULL DEFAULT '[]',
  offers_note  TEXT  NOT NULL DEFAULT '',
  seeks_note   TEXT  NOT NULL DEFAULT '',
```
2. ALTER 블록에 추가:
```sql
ALTER TABLE makers ADD COLUMN IF NOT EXISTS story       TEXT  NOT NULL DEFAULT '';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS activities  JSONB NOT NULL DEFAULT '[]';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS offers_note TEXT  NOT NULL DEFAULT '';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS seeks_note  TEXT  NOT NULL DEFAULT '';
```
3. Commit: `git commit -m "feat(schema): story/activities/offers_note/seeks_note 컬럼"`
4. ⚠️ 대표가 Supabase SQL Editor에서 ALTER 실행 (핸드오프 노트).

---

## Task 3: repo.ts — row 매핑 + createMaker + 시드

**Goal:** 신규 필드 DB 배선 + 시드 라벨 리맵/기본값.

**Steps:**
1. `MakerRow` 인터페이스에 추가: `story: string; activities: Maker["activities"]; offers_note: string; seeks_note: string;` (collab_history 옆).
2. `rowToMaker`에 추가:
```ts
    story: r.story ?? "",
    activities: r.activities ?? [],
    offersNote: r.offers_note ?? "",
    seeksNote: r.seeks_note ?? "",
```
   그리고 collabHistory 매핑을 photos 포함으로: `collabHistory: (r.collab_history ?? []).map((h) => ({ ...h, photos: h.photos ?? [] }))`
3. SupabaseRepo `createMaker` insert row에 추가: `story: input.story, activities: input.activities, offers_note: input.offersNote, seeks_note: input.seeksNote,`
4. 시드 makers 4곳: 각 maker에 `story: ""`(또는 짧은 문장), `activities: []`, `offersNote: ""`, `seeksNote: ""` 추가. collabHistory 항목에 `photos: []` 추가.
5. 시드 offers/seeks/collabHistory.types의 옛 라벨 리맵: 제품컬래버→제품콜라보, 굿즈→공동굿즈, 콘텐츠→공동콘텐츠.
6. Verify: `npx tsc --noEmit` (repo·types 통과)
7. Commit: `git commit -m "feat(repo): 신규 필드 매핑 + 시드 라벨 리맵/기본값"`

---

## Task 4: actions.ts — RegisterInput + createMakerAction

**Goal:** 서버 액션에 신규 필드 수신·저장.

**Steps:**
1. `RegisterInput`에 추가: `story?: string; activities?: Activity[]; offersNote?: string; seeksNote?: string;` (Activity import).
2. `createMakerAction`의 repo.createMaker 인자에 추가:
```ts
    story: input.story?.trim() ?? "",
    activities: input.activities ?? [],
    offersNote: input.offersNote?.trim() ?? "",
    seeksNote: input.seeksNote?.trim() ?? "",
```
   (collabHistory는 이미 전달됨 — photos 포함되어 넘어옴)
3. Verify: `npx tsc --noEmit`
4. Commit: `git commit -m "feat(actions): 신규 소개서 필드 저장"`

---

## Task 5: next.config bodySizeLimit 12mb

**Steps:**
1. `next.config.ts` — `bodySizeLimit: "6mb"` → `"12mb"`.
2. Commit: `git commit -m "chore: serverActions bodySizeLimit 12mb (사진 다중)"`

---

## Task 6: 전역 타이포 +1px (globals.css)

**Goal:** 루트 폰트 레버로 전 페이지 소폭 확대.

**Steps:**
1. `src/app/globals.css` — `html { background: var(--canvas); }` 를 `html { background: var(--canvas); font-size: 17px; }` 로.
2. Verify(프리뷰): 홈·register·검색·카드·프로필 열어 레이아웃 깨짐 없나 확인. 깨지면 16.5px로 완화.
3. Commit: `git commit -m "style: 루트 폰트 16→17px 전역 소폭 확대"`

---

## Task 7: register — COLLAB_TYPES + 섹션1(자세히 소개·사진10)

**Goal:** 유형 상수 교체 + 1섹션 타이틀/사진 한도.

**Steps:**
1. `COLLAB_TYPES` 상수를 병합 7개로 교체(순서: 제품콜라보·팝업·워크숍·공동굿즈·공동콘텐츠·행사참여·공간대여).
2. 그룹 헤더 `GroupHeader n="①" title="브랜드 소개"` → `title="브랜드를 소개해주세요."`.
3. 사진 섹션: `photos.length < 4` → `< 10`, `.slice(0, 4)` → `.slice(0, 10)` (onPhotos). 라벨 "브랜드 사진 (선택)" 유지, sub "콜라보 카드에 담을 사진을 올려주세요." 유지 → "최대 10장" 문구 추가.
4. Verify: `npx tsc --noEmit`
5. Commit: `git commit -m "feat(register): 유형 7개 병합 + 섹션1 타이틀·사진 10장"`

---

## Task 8: register — 섹션2 '왜 시작' (story)

**Goal:** story textarea 신규 섹션.

**Steps:**
1. 상태 추가: `const [story, setStory] = useState("");`
2. 섹션1 블록 다음(브랜드 표현 키워드 앞 적절 위치)에 GroupHeader ②:
```tsx
<GroupHeader n="②" title="왜 이 브랜드를 시작하셨나요?" sub="시작하게 된 계기를 편하게 적어주세요." />
<textarea value={story} onChange={(e)=>setStory(e.target.value)} rows={4}
  placeholder="예: 좋은 소재가 버려지는 게 늘 아쉬웠어요. 이미 있는 것의 가치를 다시 발견하는 일이 더 의미 있다고 믿어요."
  className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus" />
```
3. GroupHeader sub는 `text-sm` → `text-[13px]`로 서브 표기(기존 GroupHeader sub 활용).
4. Commit: `git commit -m "feat(register): 섹션2 '왜 시작했나' story"`

---

## Task 9: register — 섹션 타이틀 정리(3·7·8) + subtitle

**Steps:**
1. 키워드 섹션 라벨 "우리 브랜드를 표현하는 말" → GroupHeader ③ `title="우리 브랜드를 표현하는 키워드를 골라주세요."` (기존 label 자리에 GroupHeader 도입 or label 텍스트 교체).
2. targetAudience 라벨 → GroupHeader ⑦ `title="저희는 주로 이런 고객과 함께하고 있어요."` (subtitle 없음).
3. 브랜드 정보 그룹 `GroupHeader n="③" title="브랜드 정보"` → `n="⑧" title="브랜드 정보를 입력해주세요."` (sub 없음).
4. 콜라보 유형 그룹(②→⑤/⑥로 분리는 Task 11)·번호 재정렬.
5. Commit: `git commit -m "feat(register): 섹션 타이틀 노션 기준 정리"`

---

## Task 10: register — 섹션4 활동(activities) + [+추가]

**Goal:** 활동 세트 1개 기본 + 최대 3.

**Steps:**
1. 상태: `const [activities, setActivities] = useState<{title:string;desc:string;photos:{url:string;file?:File}[]}[]>([{title:"",desc:"",photos:[]}]);`
2. 추가/삭제/사진 핸들러:
```ts
const addActivity = () => setActivities(p => p.length>=3 ? p : [...p,{title:"",desc:"",photos:[]}]);
const setAct = (i:number,patch:Partial<{title:string;desc:string}>) => setActivities(p=>p.map((a,j)=>j===i?{...a,...patch}:a));
const addActPhotos = (i:number, files:FileList|null) => { if(!files) return; const next=Array.from(files).filter(f=>f.type.startsWith("image/")).map(f=>({url:URL.createObjectURL(f),file:f})); setActivities(p=>p.map((a,j)=>j===i?{...a,photos:[...a.photos,...next].slice(0,3)}:a)); };
const removeActPhoto = (i:number,k:number) => setActivities(p=>p.map((a,j)=>j===i?{...a,photos:a.photos.filter((_,x)=>x!==k)}:a));
const removeActivity = (i:number) => setActivities(p=>p.filter((_,j)=>j!==i));
```
3. GroupHeader ④ + 활동 카드 렌더(제목 input, 한 줄 설명 input, 사진 업로더 20×20 썸네일 max3, 2번째부터 삭제버튼). 아래 `activities.length<3` 이면 `[+ 활동 추가]` 점선 버튼.
   - 제목 placeholder "예: Fabric Bag", 설명 placeholder "예: 업사이클링 원단을 활용한 가방 제작".
4. Verify: `npx tsc --noEmit`
5. Commit: `git commit -m "feat(register): 섹션4 활동 3세트(항목추가 UX)"`

---

## Task 11: register — 섹션5·6 offersNote/seeksNote + 유형칩

**Goal:** 협업/파트너에 직접입력 textarea 추가.

**Steps:**
1. 상태: `const [offersNote,setOffersNote]=useState(""); const [seeksNote,setSeeksNote]=useState("");`
2. 콜라보 그룹을 ⑤/⑥ 두 GroupHeader로 분리:
   - ⑤ `title="어떤 협업을 할 수 있나요?" sub="제공할 수 있는 협업을 자유롭게 작성해주세요."` → offersNote textarea + 기존 offers ChipRow.
   - ⑥ `title="이런 파트너를 찾고 있어요." sub="파트너와 꿈꾸는 협업 유형을 알려주세요."` → seeksNote textarea + 기존 seeks ChipRow.
   - textarea placeholder: 협업="예: 친환경 가방을 만들어요. 브랜드 제품 콜라보, 굿즈 제작을 기대하고 있어요." / 파트너="예: 지속가능성을 이야기하는 브랜드, 라이프스타일 브랜드, 카페와 함께하고 싶어요."
3. Commit: `git commit -m "feat(register): 섹션5·6 협업/파트너 직접입력"`

---

## Task 12: register — 함께한 콜라보 사진(최대 3)

**Goal:** collabHistory 각 항목에 사진 추가.

**Steps:**
1. histDraft 상태에 `photos:{url:string;file?:File}[]` 추가(초기 []). 편집 UI에 사진 업로더(20×20, max3) 추가.
2. addHistory에서 photos를 CollabHistory에 포함(제출 시 리사이즈).
3. collabHistory 표시 항목에 사진 썸네일 미리보기(작게).
4. Commit: `git commit -m "feat(register): 함께한 콜라보 사진(최대 3)"`

---

## Task 13: register — 제출 배선 + 사진 리사이즈

**Goal:** 신규 필드 전송 + 활동/콜라보 사진 리사이즈.

**Steps:**
1. `fileToResizedDataUrl` 재사용. 활동·콜라보 사진은 800px, 브랜드 사진 1000px.
2. submit에서:
```ts
const activityOut = await Promise.all(activities.filter(a=>a.title.trim()||a.desc.trim()||a.photos.length).map(async a=>({
  title:a.title.trim(), desc:a.desc.trim(),
  photos: await Promise.all(a.photos.map(p=> p.file? fileToResizedDataUrl(p.file,800):Promise.resolve(p.url))),
})));
const historyOut = await Promise.all(collabHistory.map(async h=>({...h, photos: await Promise.all((h.photos??[]).map((p:any)=> p.file? fileToResizedDataUrl(p.file,800):Promise.resolve(typeof p==='string'?p:p.url)))})));
```
   createMakerAction에 `story, activities: activityOut, offersNote, seeksNote, collabHistory: historyOut` 추가.
3. Verify: `npx tsc --noEmit` + 프리뷰로 등록 1건 생성 확인.
4. Commit: `git commit -m "feat(register): 제출 시 신규 필드+사진 리사이즈 저장"`

---

## Task 14: register — 섹션 간 여백 확대

**Goal:** 타이틀 간 간격 쾌적하게.

**Steps:**
1. 폼 컨테이너 `space-y-8` → `space-y-12`, 각 GroupHeader `mt` 확대(섹션 앞 여백). 그룹 내부 `space-y-7` → `space-y-8` 정도.
2. Verify(프리뷰): register 스크롤하며 간격 확인.
3. Commit: `git commit -m "style(register): 섹션 간 여백 확대"`

---

## Task 15: 카드/c — 새 필드 노출

**Goal:** story·activities·offersNote·seeksNote·콜라보사진 표시 + CollabType 안전.

**Steps:**
1. story: "소개" 블록 아래 "시작한 이야기" 블록(있을 때만).
2. activities: 활동별 제목·설명 + `PhotoSlider`(사진 있을 때). 라벨 "이런 활동을 해요".
3. offersNote/seeksNote: 각 칩 위에 문구(있을 때).
4. collabHistory 항목 사진: 작은 썸네일/미니 슬라이드.
5. 폰트는 전역 확대 반영(별도 px 조정 최소).
6. Verify(프리뷰): 시드/신규 카드 확인.
7. Commit: `git commit -m "feat(card): 소개서 새 필드 노출(story·활동·협업설명·콜라보사진)"`

---

## Task 16: 프로필/m — 새 필드 노출

**Steps:**
1. /c와 동일 필드(story·activities·notes)를 프로필 레이아웃에 맞춰 추가.
2. Verify(프리뷰) + Commit: `git commit -m "feat(profile): 소개서 새 필드 노출"`

---

## Task 17: 최종 검증 + push

**Steps:**
1. `npx tsc --noEmit` && `npx eslint <변경파일>` 클린.
2. 프리뷰: register 전체 흐름(활동추가·사진·제출) → 카드/프로필 노출 확인.
3. `git push`.
4. 핸드오프: 대표에게 Supabase ALTER 실행 안내(Task 2).

---

## Quality Checklist
- [x] 모든 스펙 요구(8섹션·신규필드·CollabType·사진·타이포·여백)에 태스크 존재
- [x] 플레이스홀더 없음(코드 예시 실제)
- [x] 타입/필드명 태스크 간 일관(story·activities·offersNote·seeksNote·Activity)
- [x] DB(Task2) → 코드(Task3+) 순서
- [x] 각 태스크 커밋으로 종료
