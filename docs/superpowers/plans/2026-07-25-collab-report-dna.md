# Implementation Plan: AI 콜라보 분석 리포트 + Brand DNA (Phase 1)
Date: 2026-07-25
Spec: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md

## Goal
소개서 페이지의 [콜라보 분석] 버튼 → Brand DNA(lazy·flash) + 카드형 리포트(6조각) 생성·캐싱·계측까지 Phase 1 전체를 배포한다.

## Architecture
```
[콜라보 분석] (MakerActionBar, 고스트 버튼)
  → ReportSheet (풀하이트 바텀시트: 로딩/리포트/샘플/thin/no-match/error)
  → POST /api/collab-report {fromSlug, toSlug}
      → 캐시 3조건 체크 → miss 시: DNA stale 병렬 갱신(flash) → 리포트 콜 → collab_reports insert
  → repo: getBrandDna/setBrandDna/getLatestCollabReport/insertCollabReport
  → 어휘 정본: src/lib/dna-pool.ts / 프롬프트: src/lib/collab-report-prompts.ts(대표 합동 리뷰 게이트)
```

## Tech Stack
Next.js 16(App Router) · TS · @google/genai(`GEMINI_API_KEY`, enrich와 동일) · Supabase(service_role, repo 경유) · GA4(gtag)

## Files
```
MODIFY supabase/schema.sql                       (brands.dna 주석 + collab_reports)
CREATE src/lib/dna-pool.ts                       (어휘 정본 + 상수 + 검증 헬퍼)
CREATE src/lib/collab-report-prompts.ts          (프롬프트 2종 — 대표 리뷰 게이트)
CREATE src/lib/collab-report.ts                  (DNA 생성·리포트 생성·채점 선발·mock)
CREATE src/lib/sample-report.json                (샘플 리포트 고정본)
CREATE src/lib/track.ts                          (GA4 이벤트 헬퍼)
CREATE src/app/api/collab-report/route.ts        (생성 API)
CREATE src/app/m/[slug]/ReportSheet.tsx          (리포트 시트)
CREATE scripts/generate-sample-report.ts         (샘플 1회 생성 스크립트)
MODIFY src/lib/types.ts                          (BrandDna·CollabReportData 타입)
MODIFY src/lib/repo.ts                           (4메서드 + 양 구현 + MakerRow.dna)
MODIFY src/app/m/[slug]/MakerActionBar.tsx       (바 개편·버튼·pendingReport·샘플 진입)
MODIFY src/app/m/[slug]/page.tsx                 (ReportSheet용 props)
```

공통 규칙: 커밋은 만진 파일만 `git add <경로>`. push 전 `npx tsc --noEmit` + `npm run build`. 각 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**⚠️브랜치 격리(레드팀 Gate3-C1)**: T2 시작 전 `git checkout -b feat/collab-report` — **전 태스크를 이 브랜치에서** 진행(main은 push=deploy 공유라 미푸시 커밋 장기 체류 금지 — 중간 핫픽스 시 반쪽 기능 유출·2팀 병합 리베이스 충돌 방지). T12에서 main 리베이스 병합 후 push. T1(schema.sql)만 main 직커밋 가능(즉시 push하는 문서 변경).

**게이트 대기 중 병행(레드팀 Gate3-N4)**: T4 대표 리뷰 대기 동안 프롬프트 비의존 태스크(T5 repo·T8 시트 골격·T10 계측) 선진행 가능 — T6·T7만 프롬프트 확정 후.

**대표 접점 3회로 압축**: ①T1 SQL ②T4 프롬프트 리뷰 ③T12 배포 QA(+샘플 품질 확인 — T11의 품질 확인을 여기로 흡수)·T13 A/B 판정.

---

## Task 1: DB — 대표 SQL 게이트 + schema.sql 갱신

**Goal:** 스키마가 코드보다 먼저 존재하게 한다(07-25 마이그레이션 철칙).

**Steps:**
1. 대표에게 아래 SQL 제시, **실행 완료 확인까지 대기** (⛔게이트):
```sql
alter table brands add column dna jsonb;

create table collab_reports (
  id            bigint generated always as identity primary key,
  from_brand_id bigint not null references brands(id) on delete cascade,
  to_brand_id   bigint not null references brands(id) on delete cascade,
  requested_by  bigint references users(user_id) on delete set null,
  report        jsonb not null,
  model         text not null,
  created_at    timestamptz not null default now()
);
create index idx_collab_reports_pair on collab_reports(from_brand_id, to_brand_id, created_at desc);
alter table collab_reports enable row level security;
```
2. `supabase/schema.sql`: brands 테이블 정의에 `dna jsonb,` 컬럼(주석: "Brand DNA — 파생 해석층, lazy 생성. 스펙 2026-07-25") 추가 + 파일 끝 collab_requests 블록 아래에 위 collab_reports 블록 추가.
3. Verify: 대표 "실행 완료" 회신 + `grep -c "collab_reports\|dna jsonb" supabase/schema.sql` ≥ 2.
   **✅프라이버시 집행 체크(레드팀 Gate3-C3)**: SQL에 `alter table collab_reports enable row level security;` 포함 확인(정책 0 = anon 전면 잠금 = 서버만 접근) + T7의 "from은 내 브랜드만" 검증이 앱 레이어 집행 — 이 두 줄이 비준된 "요청자 전용" 약속의 실제 집행 지점.
4. Commit: `docs(db): brands.dna + collab_reports — 콜라보 리포트 스키마 (대표 SQL 실행 완료)`

**Expected output:** prod에 두 스키마 존재, schema.sql 정본 일치.

## Task 2: 플로팅바 개편 — 하트 유틸 줄 이사 (⚠️독립 커밋)

**Goal:** 바 위 유틸 줄 `[🔗 링크 복사][♡]`, 바 안은 임시로 `[콜라보 시작하기]` 풀폭. (분석 버튼은 Task 9에서 — 이 커밋은 단독 리버트 가능해야 함)

**Steps:**
1. `MakerActionBar.tsx` 렌더부: 하트 `<button>`(현재 바 안 h-12 w-12)을 잘라내 링크복사 pill 옆으로 이동. pill 컨테이너를 `absolute -top-[52px] right-4 flex items-center gap-2` 래퍼로 바꾸고 안에 [링크복사 pill][하트 버튼(h-10 w-10 rounded-pill bg-surface border border-hairline shadow-e2, 하트 svg h-5 w-5, 채워짐=text-red-500)] 순서로 배치.
2. 바 안은 `[콜라보 시작하기]` 버튼만 남김(`flex-1` 그대로 → 자동 풀폭).
3. 하트의 onClick(toggleHeart)·aria·disabled 로직은 **문자 그대로 유지** — 위치만 이동.
4. Run: `npx tsc --noEmit && npm run build`
5. 로컬 프리뷰(모바일 뷰): 하트가 pill 줄에 렌더 + 비로그인 클릭 시 로그인 얼럿 동작 확인.
6. Commit: `polish(m): 하트를 바 위 유틸 줄로 이사 — [링크복사][♡] / 바=콜라보 액션 전용 (대표안, 단독 리버트 가능 커밋)`

**Expected output:** 스샷 상 유틸 줄 2요소 + 바 1버튼, 찜 동작 무변.

## Task 3: 타입 + DNA Pool 정본

**Goal:** 어휘·상수·검증 헬퍼 단일 정본.

**Steps:**
1. `src/lib/types.ts`에 추가:
```ts
export interface DnaItem { type: string; value: string; evidence: string; }
export interface BrandDna { summary: string; items: DnaItem[]; created_at: string; updated_at: string; }
export interface ReportMatchPoint { text: string; }           // ② 접점 (선발 통과분)
export interface ReportIdea { title: string; desc: string; method: string; } // ③ method=collabMethod 어휘
export interface CollabReportData {
  oneLiner: string;                 // ① 한 줄 결론
  matchPoints: ReportMatchPoint[];  // ② 2~4개
  ideas: ReportIdea[];              // ③ 1~3개
  steps: string[];                  // ④ 최대 4
  effects: string[];                // ⑤ 2~3개
}
```
2. `src/lib/dna-pool.ts` 신규 — 스펙 §2-3 표를 그대로 이식:
```ts
export const DNA_POOL: Record<string, readonly string[]> = {
  philosophy: ["지속가능성","자기표현","지역성","교육","사회적 가치","장인정신","취향 중심","경험 중심","사람 중심","커뮤니티"],
  mood: ["따뜻함","차분함","빈티지","미니멀","프리미엄","유쾌함","편안함","감성적","위트","자연 친화"],
  customer: ["20대","30대","40대","가족","직장인","창작자","관광객","지역 주민","취향 소비자","반려동물 보호자","운동인"],
  space: ["카페","공방","스튜디오","전시장","야외","팝업 가능","오프라인 매장","공유 공간"],
  content: ["사진","숏폼","릴스","브이로그","인터뷰","후기 콘텐츠","UGC","스토리텔링"],
  experience: ["체험","클래스","전시","공연","커뮤니티","정기 모임","시즌 이벤트","팝업"],
  operation: ["소규모","예약제","상시 운영","시즌 운영","정기 프로그램","1회성 이벤트","빠른 실행 가능"],
  collabMethod: ["입점 판매","프로젝트·프로그램 소속 팝업 참여","협동 워크숍","협동 프로그램 운영","제품 스팟 소개","링크 제휴 할인","할인 코드 교환","공동 상품","공동 브랜딩","콘텐츠 제작","SNS 이벤트","챌린지","굿즈","전시","지역 프로젝트","상호 고객 혜택 교환"],
  value: ["브랜드 인지도","신규 고객","팬덤 형성","지역 활성화","사회적 가치","경험 강화","재방문 유도"],
  locality: ["로컬 브랜드","지역 커뮤니티","관광지","지역 행사","골목 상권"],
  pricePosition: ["합리적","중간","프리미엄"],
  hours: ["아침","낮","저녁","심야","주말 중심"],
  salesChannel: ["오프라인 매장만","스마트스토어","자사몰","예약제 판매"],
  production: ["핸드메이드","소량 생산","주문 제작","친환경 소재","로컬 소싱"],
  audienceAsset: ["정기 모임 보유","단골 커뮤니티","뉴스레터","수강생 풀"],
  seasonality: ["사계절","특정 시즌 강세"],
};
// 가벼움→무거움 순 강도(작게 시작 추천 근거). 여기 없는 method는 중간 취급.
export const LIGHT_METHODS = ["할인 코드 교환","링크 제휴 할인","제품 스팟 소개","SNS 이벤트"];
export const HEAVY_METHODS = ["공동 상품","공동 브랜딩","입점 판매"];
export const THIN_MIN_TYPES = 4;      // 서로 다른 type 수 미달 = thin
export const MIN_MATCH_SCORE = 7;     // 접점 채점 통과 하한(10점 만점 합산 기준, A/B로 튜닝)
export const DNA_REFRESH_BEFORE = "2026-07-25T00:00:00Z"; // 이 날짜 이전 dna는 stale 취급
export function filterPoolValid(items: DnaItem[]): DnaItem[] {
  return items.filter((it) => (DNA_POOL[it.type] ?? []).includes(it.value) && it.evidence?.trim());
}
export function distinctTypeCount(items: DnaItem[]): number { return new Set(items.map((i) => i.type)).size; }
```
3. Run: `npx tsc --noEmit`
4. Commit: `feat(report): 타입 + DNA Pool 어휘 정본 (dna-pool.ts)`

**Expected output:** 컴파일 통과, Pool 16 type.

## Task 4: 프롬프트 2종 초안 → ⛔대표 합동 리뷰 게이트

**Goal:** DNA·리포트 프롬프트를 코드 배선 전에 대표와 확정(스펙 §7 게이트).

**Steps:**
1. `src/lib/collab-report-prompts.ts` 신규 — 초안 전문(아래 그대로 시작점):
```ts
export const DNA_SYSTEM = `당신은 브랜드 분석가다. 아래 브랜드 소개서를 읽고 Brand DNA를 추출한다.
규칙:
1. 반드시 제공된 Pool 어휘 목록에서만 value를 고른다. 목록에 없는 단어 창작 금지.
2. 모든 선택에는 evidence(소개서의 실제 문구 인용, 20자 내외)를 붙인다. 근거를 댈 수 없으면 선택하지 않는다.
   빈 DNA가 틀린 DNA보다 낫다.
3. customer의 연령·성별은 소개서에 명시적 근거(타깃 문구·후기 등)가 있을 때만. 추측 금지.
4. 같은 type에 여러 value를 골라도 된다. 뚜렷한 것만 — type당 최대 3개.
5. summary는 이 브랜드를 처음 보는 사람에게 한 문장으로.
6. 이 분석은 특정 비교 상대를 전제하지 않는다 — 브랜드 자체만 중립적으로 기술한다.
출력은 JSON: { summary, items: [{type, value, evidence}] }`;

export const REPORT_SYSTEM = `당신은 소상공인 콜라보를 오래 성사시켜온 기획자다. 두 브랜드의 소개서(사실)와
Brand DNA(성격)를 함께 읽고, A가 B에게 보내기 전에 읽을 "첫 협업 제안서"를 만든다.
이 문서의 목표는 분석이 아니라 행동이다 — 읽은 사람이 "이거 해볼까?"라고 생각하게 만든다.
규칙:
1. 접점 후보를 6~8개 넓게 찾은 뒤, 각 후보를 4기준으로 채점한다(각 0~10):
   - rarity(최고 가중): 이 문장을 아무 브랜드 쌍에 넣어도 말이 되면 0점. 이 둘에게만 성립할수록 높게.
   - specificity: 두 소개서의 실제 문구·사실에 근거할수록 높게.
   - actionability: 이 접점이 곧바로 콜라보 아이디어로 이어질수록 높게.
   - mutuality: 양쪽 모두에게 이득일수록 높게.
   후보 전체와 점수를 candidates 배열로 출력한다(선발은 시스템이 한다).
2. 아이디어는 1~3개. 억지 3개보다 진짜 1~2개. 당장 실행 가능한 수준으로, 각각 collabMethod 어휘
   하나를 method로 붙인다. 첫 아이디어는 가벼운 형태(강도 낮은 method) 우선.
3. 실행 플랜은 최대 4스텝: 인스타 DM → 30분 미팅 → 작은 실행 → 후기·콘텐츠.
4. 두 소개서에 없는 사실(행사·수치·시즌 이벤트·언론 보도)을 창작하지 않는다.
5. 같은 특징 나열("둘 다 ○○함")이 아니라 서로 보완하거나 새 경험을 만드는 지점을 중심으로.
6. 문체: 한국어 해요체, 따뜻하고 담백하게. 과장·영업 멘트 금지.
출력은 JSON: { oneLiner, candidates: [{text, rarity, specificity, actionability, mutuality}],
ideas: [{title, desc, method}], steps: [..], effects: [..] }`;
```
2. **⛔STOP — 대표 합동 리뷰**: 두 프롬프트 전문을 채팅에 그대로 제시 + "고칠 곳?" 질문. 대표 수정 반영 → 확정까지 다음 태스크 진행 금지.
3. Commit(확정 후): `feat(report): DNA·리포트 프롬프트 확정 (대표 합동 리뷰 반영)`

**Expected output:** 대표 승인된 프롬프트 2종.

## Task 5: repo 4메서드

**Goal:** 데이터 접근 계층.

**Steps:**
1. `repo.ts` `Repo` 인터페이스에 추가:
```ts
getBrandDna(brandId: number): Promise<BrandDna | null>;
setBrandDna(brandId: number, dna: BrandDna): Promise<void>;
getLatestCollabReport(fromBrandId: number, toBrandId: number): Promise<{ report: CollabReportData; model: string; createdAt: string } | null>;
insertCollabReport(r: { fromBrandId: number; toBrandId: number; requestedBy: number | null; report: CollabReportData; model: string }): Promise<void>;
```
2. `MakerRow`에 `dna: BrandDna | null;` 추가, `rowToMaker`에는 **싣지 않음**(도메인 객체 비노출 — API가 repo로 직접 읽음). SupabaseRepo:
```ts
async getBrandDna(brandId: number) {
  const { data } = await this.db.from("brands").select("dna").eq("id", brandId).maybeSingle();
  return (data?.dna as BrandDna) ?? null;
}
async setBrandDna(brandId: number, dna: BrandDna) {
  await this.db.from("brands").update({ dna }).eq("id", brandId);   // ⚠️ updated_at 트리거가 brands를 건드리므로
}                                                                    //    dna.updated_at ≥ brands.updated_at 순서 유지됨
async getLatestCollabReport(fromBrandId: number, toBrandId: number) {
  const { data } = await this.db.from("collab_reports").select("report, model, created_at")
    .eq("from_brand_id", fromBrandId).eq("to_brand_id", toBrandId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { report: data.report as CollabReportData, model: data.model, createdAt: data.created_at } : null;
}
async insertCollabReport(r) {
  await this.db.from("collab_reports").insert({ from_brand_id: r.fromBrandId, to_brand_id: r.toBrandId,
    requested_by: r.requestedBy, report: r.report, model: r.model });
}
```
   ⚠️ `setBrandDna`의 `update({dna})`는 brands의 updated_at 트리거를 발화시킴 → **dna.updated_at을 트리거 시각보다 뒤로 볼 수 없음** → stale 판정은 `brands.updated_at > dna.updated_at + 여유 5초` 허용 오차로 비교(코드 상수 `DNA_STALE_SLACK_MS = 5000`). InMemoryRepo는 Map 2개(`dnaByBrand`, `reportsByPair`)로 동일 시그니처 구현.
3. Run: `npx tsc --noEmit`
4. Commit: `feat(report): repo — dna·collab_reports 4메서드 (양 구현)`

**Expected output:** 인터페이스·구현 컴파일 통과.

## Task 6: lib/collab-report.ts — 생성 엔진

**Goal:** DNA 생성 + 리포트 생성 + 채점 선발 + mock.

**Steps:**
1. 신규 파일 골자:
```ts
import { GoogleGenAI, Type } from "@google/genai";
import { DNA_SYSTEM, REPORT_SYSTEM } from "./collab-report-prompts";
import { DNA_POOL, filterPoolValid, distinctTypeCount, THIN_MIN_TYPES, MIN_MATCH_SCORE } from "./dna-pool";

const MODEL = () => process.env.REPORT_MODEL || "gemini-2.5-flash";
const ai = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const hasKey = () => !!process.env.GEMINI_API_KEY;

function brandDigest(m: Maker): string { /* 소개서 전 필드를 사람이 읽는 텍스트 블록으로 직렬화
  (name·oneLiner·description·story·keywords·offers·seeks·offersDescription·seeksDescription·
   activities(title+desc)·collabHistory(partner+types+desc)·showcases 텍스트·region·trust 채널 유무) */ }

export async function generateDna(m: Maker): Promise<BrandDna> {
  if (!hasKey()) return MOCK_DNA(m);                     // 로컬 mock — UI 개발용
  const poolText = Object.entries(DNA_POOL).map(([t, vs]) => `${t}: ${vs.join(", ")}`).join("\n");
  const res = await ai().models.generateContent({
    model: "gemini-2.5-flash",                            // DNA는 flash 고정(스펙)
    contents: `[Pool]\n${poolText}\n\n[소개서]\n${brandDigest(m)}`,
    config: { systemInstruction: DNA_SYSTEM, responseMimeType: "application/json", responseSchema: DNA_SCHEMA, temperature: 0.2 },
  });
  const parsed = JSON.parse(res.text ?? "{}");
  const items = filterPoolValid(parsed.items ?? []);      // 화이트리스트 서버 검증(사실게이트 ②)
  const now = new Date().toISOString();
  return { summary: String(parsed.summary ?? "").slice(0, 80), items, created_at: now, updated_at: now };
}
export const isThin = (dna: BrandDna) => distinctTypeCount(dna.items) < THIN_MIN_TYPES;

export async function generateReport(a: Maker, aDna: BrandDna, b: Maker, bDna: BrandDna) {
  if (!hasKey()) return { report: MOCK_REPORT, candidates: [] };
  const res = await ai().models.generateContent({
    model: MODEL(),
    contents: `[브랜드 A(제안자)]\n${brandDigest(a)}\n[A DNA]\n${dnaText(aDna)}\n\n[브랜드 B(상대)]\n${brandDigest(b)}\n[B DNA]\n${dnaText(bDna)}`,
    config: { systemInstruction: REPORT_SYSTEM, responseMimeType: "application/json", responseSchema: REPORT_SCHEMA, temperature: 0.6 },
  });
  const p = JSON.parse(res.text ?? "{}");
  // 채점 선발(서버): rarity 2배 가중 합산 → MIN_MATCH_SCORE 미달 탈락 → (rarity,specificity,actionability) 사전순 동점 처리 → 상위 4
  const scored = (p.candidates ?? []).map((c) => ({ ...c, total: c.rarity * 2 + c.specificity + c.actionability + c.mutuality }))
    .filter((c) => c.total >= MIN_MATCH_SCORE)
    .sort((x, y) => y.rarity - x.rarity || y.specificity - x.specificity || y.actionability - x.actionability);
  const matchPoints = scored.slice(0, 4).map((c) => ({ text: c.text }));
  if (matchPoints.length < 2) return { report: null, candidates: p.candidates };  // no-match(스펙 선발 규칙)
  return { report: { oneLiner: p.oneLiner, matchPoints, ideas: (p.ideas ?? []).slice(0, 3), steps: (p.steps ?? []).slice(0, 4), effects: (p.effects ?? []).slice(0, 3) }, candidates: p.candidates };
}
```
2. `DNA_SCHEMA`·`REPORT_SCHEMA`는 `Type.OBJECT/ARRAY/STRING/NUMBER`로 위 JSON 형태 그대로 선언(enrich의 Gemini 스키마 선언 패턴 참조). MOCK 2종은 캔버스가든×호락 내용의 짧은 고정 객체.
3. Run: `npx tsc --noEmit`
4. Commit: `feat(report): 생성 엔진 — DNA·리포트·채점 선발·mock (collab-report.ts)`

**Expected output:** 키 없으면 mock, 있으면 실호출 가능한 순수 라이브러리.

## Task 7: /api/collab-report

**Goal:** 인증·캐시·오케스트레이션 API.

**Steps:**
1. `src/app/api/collab-report/route.ts`:
```ts
export const maxDuration = 60;
export async function POST(req: Request) {
  if (process.env.REPORT_DISABLED) return NextResponse.json({ error: "disabled" }, { status: 503 });
  const { fromSlug, toSlug } = await req.json();               // 클라 텍스트는 프롬프트에 안 들어감(주입 차단)
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "auth" }, { status: 401 });
  const [from, to] = await Promise.all([repo.getMakerBySlug(String(fromSlug)), repo.getMakerBySlug(String(toSlug))]);
  if (!from || !to) return NextResponse.json({ error: "notfound" }, { status: 404 });
  if (from.ownerUserId !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 }); // from은 내 브랜드만
  // 1) DNA 확보(양쪽 병렬, stale만 재생성 — DNA_STALE_SLACK_MS·DNA_REFRESH_BEFORE 반영)
  const [fromDna, toDna] = await Promise.all([ensureDna(from), ensureDna(to)]);
  // 2) thin 가드(양쪽) — from thin → {state:"thin", side:"from"} / to thin → side:"to"
  // 3) 캐시 3조건(스펙 §2-2): 최신 행 && 행.createdAt > 양쪽 dna.updated_at && 양쪽 non-stale → {state:"ok", report, cached:true}
  // 4) generateReport → null이면 {state:"no_match"} / 성공 시 insertCollabReport 후 {state:"ok", report, cached:false, model}
}
```
   `ensureDna(m)` = `repo.getBrandDna` → stale/없음이면 `generateDna` + `setBrandDna` 후 반환. 응답 형태는 `{state: "ok"|"thin"|"no_match", ...}` 로 통일.
2. Run: `npx tsc --noEmit && npm run build`
3. Commit: `feat(report): /api/collab-report — 캐시 3조건·병렬 DNA·thin/no-match (maxDuration 60)`

**Expected output:** mock 모드에서 200 + mock 리포트 JSON.

## Task 8: ReportSheet 컴포넌트

**Goal:** 6조각 렌더 + 전 상태.

**Steps:**
1. `src/app/m/[slug]/ReportSheet.tsx`(클라이언트) — 제안 시트와 같은 풀하이트 바텀시트 마크업(`fixed inset-0 … items-end`, `rounded-t-2xl`, X 버튼, ScrollLock, 바깥 클릭 닫힘). props: `{ open, onClose, fromBrands: {id,slug,name}[], toSlug, toName, sampleMode, onPropose }`.
2. 상태 머신: `idle → loading(3단 카피 순환: "두 소개서를 읽고 있어요…"→"접점을 찾는 중…"→"콜라보를 상상하는 중…", 4초 간격) → ok | thin | no_match | error(재시도 버튼)`. open 시 fetch(`/api/collab-report`), 생성 중 재클릭 방지(`pending` 가드 — 레이스 무해하지만 이중 지출 차단).
3. ok 렌더(6조각): ①`text-xl font-bold` oneLiner ②"이런 점이 잘 어울려요" ✔리스트 ③아이디어 카드(제목+설명+`method` 라운드 칩) ④번호 스텝 ⑤불릿 ⑥CTA `이 제안이 마음에 드셨나요? ✨ 이 내용으로 협업 제안 보내기` → `onPropose()`(리포트 닫고 제안 시트 오픈).
4. `sampleMode`: fetch 없이 `src/lib/sample-report.json` 렌더 + 상단 고정 배너 `예시 리포트예요` + 하단 안내 `소개서를 등록하면 ○○님과 나의 콜라보 분석을 받을 수 있어요` + `[내 소개서 만들기]` → `/register`.
5. 멀티 소개서: 시트 상단에 MakerActionBar의 brandPicker와 동일한 칩 UI(선택 slug 변경 시 재fetch — 캐시면 즉시).
6. thin: side별 문구(from → "내 소개서를 보강하면 분석이 더 정확해져요" + `[소개서 보강하기]`→`/register?edit=<fromSlug>` / to → "○○님의 소개서 정보가 아직 적어요"). no_match: "아직 뚜렷한 접점을 찾지 못했어요".
7. Run: `npx tsc --noEmit && npm run build`
8. Commit: `feat(report): ReportSheet — 6조각·상태 머신·샘플 모드`

**Expected output:** mock으로 전 상태 렌더 가능.

## Task 9: MakerActionBar 배선

**Goal:** [콜라보 분석] 버튼 + pendingReport + 진입 분기.

**Steps:**
1. 바에 고스트 버튼 추가(콜라보 시작하기 왼쪽): `flex h-12 flex-[0.8] items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink` 라벨 `콜라보 분석`.
2. `loginReason` 타입 `"save" | "propose" | "report"` 확장 + `PENDING_REPORT_KEY = "collab5:pendingReport"` + `markPending`이 report도 기록. 로그인 얼럿 카피: title `콜라보 분석을 보려면 로그인이 필요해요` / sub `로그인하면 두 브랜드의 콜라보 가능성을 AI가 분석해드려요.`
3. 복귀 effect(기존 propose effect와 동일 패턴): pendingReport==makerId → ReportSheet 오픈. **우선순위: report > propose**(둘 다 있으면 report만 오픈, propose 키는 소비만).
4. 클릭 분기: 비로그인→얼럿(reason report) / `viewerBrands.length===0`→ReportSheet `sampleMode` / 그 외→ReportSheet 정상 모드(fromBrands=viewerBrands, 기본 선택 [0]).
5. 제안 시트 안 보조 링크 한 줄(textarea 위): `제안 전에 콜라보 분석을 볼까요? →` 클릭=제안 시트 닫고 ReportSheet 오픈(논블로킹 — 링크일 뿐 흐름 차단 없음).
6. `onPropose` 콜백 = ReportSheet 닫고 `setProposeOpen(true)`.
7. Run: `npx tsc --noEmit && npm run build` + 로컬 프리뷰로 분기 4종(비로그인/무소개서/정상/보조링크) 확인 — 게이트 우회는 TEMP 주석 후 **반드시 원복**(`grep "TEMP" 0건` 확인).
8. Commit: `feat(m): [콜라보 분석] 진입 — 게이트·pendingReport·샘플 분기·보조 링크`

**Expected output:** 4분기 동작, 기존 하트·제안 무회귀.

## Task 10: GA4 계측

**Goal:** 스펙 §6 이벤트 6종.

**Steps:**
1. `src/lib/track.ts`:
```ts
export function track(event: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", event, params ?? {});
}
```
2. 배선: ReportSheet — 응답 수신 시 `report_view {cache_hit}` + 생성 완료 시 `report_generated {duration_ms, model, dna_calls}`(API 응답에 `durationMs`·`dnaCalls`·`model` 포함시켜 전달) / thin 수신 `report_thin_blocked {side, distinct_types}` / no_match `report_no_match` / CTA 클릭 `report_cta_propose` / sampleMode 오픈 `report_locked_view` + [내 소개서 만들기] 클릭 `wizard_start_from_report`.
3. Run: `npx tsc --noEmit && npm run build`
4. Commit: `feat(report): GA4 계측 6종 (track.ts)`

**Expected output:** prod에서 gtag 이벤트 발화(로컬은 GA 미로드로 no-op).

## Task 11: 샘플 리포트 생성 스크립트

**Goal:** 무소개서 티저용 고정본.

**Steps:**
1. **사전 검증(레드팀 Gate3-C2)**: 스크립트가 먼저 두 데모의 DNA를 생성해 thin 가드 통과 여부 출력 — `m-demo-none`(사진 없는 데모)이 thin이면 **폴백 쌍 = 캔버스가든(1호 테스트베드) × 호락호락 도서관**(둘 다 리치 실브랜드)으로 자동 전환.
2. `scripts/generate-sample-report.ts` — 선정 쌍을 A·B로 `generateDna`+`generateReport` 실행, 결과를 `src/lib/sample-report.json`에 `{ fromName, toName, report }`로 저장. 실행: `npx tsx scripts/generate-sample-report.ts`(env에 `GEMINI_API_KEY`·`SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY` 필요 — `.env.local`에 없으면 대표에게 실행 요청). **이 실행이 배포 전 유일한 실 Gemini 스모크 테스트**이므로 반드시 T12 이전에.
3. 생성물 품질 확인은 T12 대표 QA 세션에 흡수(별도 STOP 아님).
3. Commit: `feat(report): 샘플 리포트 고정본 (데모 쌍, 예시 라벨용)`

**Expected output:** sample-report.json 커밋됨, ReportSheet sampleMode가 이를 렌더.

## Task 12: 통합 검증 + 배포 게이트

**Goal:** 회귀 포함 전체 검증 후 배포.

**Steps:**
1. `npx tsc --noEmit && npm run build`.
2. 로컬(모의) QA: 정상 mock 리포트 6조각 / 샘플 모드 / thin·no_match·error 상태(모의 응답 강제) / 로딩 카피 순환.
3. **하트 회귀 체크리스트(스펙 C4 — 필수)**: ①찜/해제 토글 ②비로그인 하트→로그인 얼럿(문구 확인) ③(코드 리뷰로) pendingSave·pendingPropose·pendingReport 3키 공존 시 소비 순서 ④찜 계측 무변.
4. `git push` → Vercel 배포 → prod에서 대표와 실쌍 1개 생성 QA(캐시 히트 재열람 포함). 이상 시 `REPORT_DISABLED=1`.
5. Commit(수정분 있으면): `fix(report): QA 수정 — <내용>`

**Expected output:** prod 라이브, 회귀 0.

## Task 13: flash vs pro 블라인드 A/B (대표 판정)

**Goal:** 리포트 모델 확정.

**Steps:**
1. prod에서 실쌍 2~3개 선정(예: 캔버스가든×호락도서관, 로컬페이지×피망). 각 쌍을 `REPORT_MODEL=gemini-2.5-flash`와 `gemini-2.5-pro`로 1회씩 생성(모델명 라벨 가리고 A/B로 채팅 제시 — collab_reports.model로 추적).
2. 대표 블라인드 판정 → 승자를 코드 기본값으로 확정, `REPORT_MODEL` env는 스위치로 유지.
3. Commit: `feat(report): 리포트 모델 확정 — <승자> (블라인드 A/B, 대표 판정)`
4. 옵시디언 기록: [[의사결정-로그]]에 A/B 결과 + INDEX 갱신은 별도 세션 마무리 때.

**Expected output:** 모델 확정 + 근거 기록.
