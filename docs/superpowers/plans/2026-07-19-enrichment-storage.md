# Implementation Plan: 크롤 신호 저장 (maker.enrichment)

Date: 2026-07-19
Spec: [docs/superpowers/specs/2026-07-19-enrichment-storage-design.md](../specs/2026-07-19-enrichment-storage-design.md)

## Goal
AI 크롤 위저드에서 고객이 **선택한 신호(picked-only)** 를 소개서 생성 시 `maker.enrichment` jsonb 컬럼에 스냅샷으로 저장한다(v1=저장만).

## Architecture
```
EnrichWizard(client) ──buildEnrichment()──► WizardFill.enrichment
   └ 생성 화면 전용, createdAt=크롤 시각
        │
   page.tsx applyWizard → enrichment state → payload.enrichment
        │
   createMakerAction → repo.createMaker → makers.enrichment (WRITE)
   updateMakerAction → (enrichment 미전달) → 컬럼 PRESERVE
```
- 순수 함수 `buildEnrichment`는 신규 `src/lib/enrichment.ts`에 격리(핫파일 `enrich.ts` 안 건드림).
- update 경로는 코드 변경 없음 — `updateMakerContent`의 patch/Object.assign이 enrichment 키를 포함하지 않아 자동 보존.
- 로컬(InMemory)은 컬럼 개념 없이 객체 필드로 동작. prod은 컬럼 SQL 선행 필요.

## Tech Stack
Next.js 16(App Router) · TypeScript · Supabase(jsonb) · 검증=tsc + `npm run build` + Browser 개발서버 DOM 주행(프로젝트 관례, 테스트 프레임워크 없음).

## Files
```
MODIFY src/lib/types.ts            # Enrichment/EnrichmentChip + Maker.enrichment
CREATE src/lib/enrichment.ts       # 순수 buildEnrichment
MODIFY src/app/register/EnrichWizard.tsx  # createdAt 캡처 + WizardFill.enrichment + apply 빌드
MODIFY src/app/register/page.tsx   # enrichment state + applyWizard 세팅 + payload
MODIFY src/lib/actions.ts          # RegisterInput.enrichment + createMakerAction write
MODIFY src/lib/repo.ts             # MakerRow/rowToMaker/SupabaseRepo.createMaker
DB     makers.enrichment jsonb     # 대표 SQL(수동), prod 배포 전 선행
```

---

## Task 0: 최신화 (핫파일 충돌 방지)

**Goal:** 1팀과 겹치는 핫파일 작업 전 main 동기화.

**Steps:**
1. Run: `git fetch origin main && git status --short`
2. Run: `git merge origin/main --ff-only` (또는 `--no-edit` 병합)
3. Verify: 워킹트리 clean, `npx tsc --noEmit` 통과
4. (커밋 없음 — 동기화만)

**Expected output:** team2가 origin/main 최신 반영, tsc green.

---

## Task 1: 타입 추가 (`types.ts`)

**Goal:** Enrichment 도메인 타입 + Maker 필드.

**Steps:**
1. `src/lib/types.ts`의 `Block`/`Maker` 사이(선택 블록 섹션 아래, `Maker` 인터페이스 위)에 추가:
```ts
/** 크롤 스냅샷 — 위저드에서 고객이 "선택한" 신호(picked-only). v1=저장만, 미래 검색·매칭 자산.
 *  jsonb 내부 키는 camelCase(관례: collab_cards.proposal.toName). 미저장: 조사메모·미선택·힌트·링크후보. */
export interface EnrichmentChip {
  text: string;       // 칩 제목
  section: string;    // 칩 섹션(키워드/정체/제품/…/직접)
  factual: boolean;   // 숫자·이력 등 사실성 칩
  starred: boolean;   // 고객 별표(우선순위)
  confirmed: boolean; // factual 칩 "맞아요" 확인
}
export interface Enrichment {
  createdAt: string;  // ISO — 스냅샷(크롤) 생성 시각
  tier: "rich" | "thin";
  seed: { region: string; businessType: string };
  chips: EnrichmentChip[]; // 선택 칩만
}
```
2. `Maker` 인터페이스에 필드 추가(예: `blocks: Block[];` 다음 줄):
```ts
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시 기록, 수정 시 보존). 없으면 undefined
```
3. Run: `npx tsc --noEmit`
4. Verify: 타입 에러 없음(Maker 사용처가 optional이라 무해)
5. Commit: `git commit -m "feat(types): Enrichment 타입 + Maker.enrichment 추가"`

**Expected output:** tsc green, 신규 export 2종 + Maker optional 필드.

---

## Task 2: 순수 빌더 (`lib/enrichment.ts` 신규)

**Goal:** 위저드 상태 → Enrichment 스냅샷(또는 null) 변환 로직 격리.

**Steps:**
1. CREATE `src/lib/enrichment.ts`:
```ts
import type { Enrichment, EnrichmentChip } from "./types";

// 반환 null = 저장 가치 0(업종 없음 + 선택 칩 0). 호출부는 null이면 enrichment를 세팅하지 않는다
// → not-null 빈 스냅샷을 만들지 않아 미래 "has enrichment?" 판정이 깨지지 않음.
export function buildEnrichment(params: {
  region: string;
  businessType: string;
  tier: "rich" | "thin";      // 크롤 응답 tier 그대로(여기서 재계산 안 함)
  createdAt: string;          // ISO
  selected: string[];         // 선택 칩 텍스트
  starred: string[];
  confirmed: Set<string>;     // factualOk
  sectionOf: (text: string) => string | undefined;
  factualOf: (text: string) => boolean;
}): Enrichment | null {
  const businessType = params.businessType.trim();
  const chips: EnrichmentChip[] = params.selected.map((text) => ({
    text,
    section: params.sectionOf(text) ?? "직접",
    factual: params.factualOf(text),
    starred: params.starred.includes(text),
    confirmed: params.confirmed.has(text),
  }));
  if (!businessType && chips.length === 0) return null;
  return {
    createdAt: params.createdAt,
    tier: params.tier,
    seed: { region: params.region.trim(), businessType },
    chips,
  };
}
```
2. Run: `npx tsc --noEmit`
3. Verify: 컴파일 통과, `enrich.ts`는 미변경(`git status`로 확인)
4. Commit: `git commit -m "feat(enrichment): picked-only 스냅샷 순수 빌더"`

**Expected output:** 신규 파일 1개, tsc green.

---

## Task 3: 위저드 캡처 (`EnrichWizard.tsx`)

**Goal:** 크롤 시각 저장 + apply 시 enrichment를 WizardFill에 실어 보냄(생성 화면 전용).

**Steps:**
1. 상단 import에 추가:
```ts
import { buildEnrichment } from "@/lib/enrichment";
import type { Enrichment } from "@/lib/types";
```
2. `WizardFill` 타입에 필드 추가(`selectedHints?...` 옆):
```ts
  enrichment?: Enrichment; // 크롤 스냅샷(picked-only). 생성 저장용
```
3. 크롤 시각 상태 추가(다른 크롤 결과 상태 근처, 예: `const [research, setResearch] = useState("");` 아래):
```ts
  const [createdAtIso, setCreatedAtIso] = useState("");
```
4. `runCrawl`의 성공 분기에서 `setKind("chips");` 직전에 시각 기록:
```ts
      setCreatedAtIso(new Date().toISOString());
```
   (catch 폴백 분기 `setKind("chips")` 직전에도 동일 1줄 추가 — 재크롤 실패해도 시각 존재)
5. `apply` 함수 안, `onApply({ ... })` 호출 직전에 스냅샷 생성:
```ts
    const enrichment = buildEnrichment({
      region: regionInput,
      businessType: btype,
      tier,
      createdAt: createdAtIso || new Date().toISOString(),
      selected,
      starred,
      confirmed: factualOk,
      sectionOf: (t) => chipOf(t)?.section,
      factualOf: (t) => isFactual(t),
    });
```
6. `onApply({ ... })` 객체에 필드 추가:
```ts
      enrichment: enrichment ?? undefined,
```
7. Run: `npx tsc --noEmit`
8. Verify: 타입 통과, `chipOf`/`isFactual`/`regionInput`/`btype`/`tier`/`selected`/`starred`/`factualOk`가 apply 스코프에서 접근 가능(이미 컴포넌트 상태)
9. Commit: `git commit -m "feat(wizard): 크롤 스냅샷 캡처(createdAt) + WizardFill.enrichment"`

**Expected output:** apply 시 picked-only enrichment 생성, tsc green.

---

## Task 4: 폼 전달 (`page.tsx`)

**Goal:** applyWizard가 enrichment를 상태에 담고, 저장 payload에 포함.

**Steps:**
1. 상단 타입 import 확장(기존 `import type { CollabType, Block, Maker } from "@/lib/types";`):
```ts
import type { CollabType, Block, Maker, Enrichment } from "@/lib/types";
```
2. 상태 추가(다른 폼 상태 근처, 예: `const [blocks, setBlocks] = useState<Block[]>([]);` 아래):
```ts
  const [enrichment, setEnrichment] = useState<Enrichment | undefined>(undefined);
```
3. `applyWizard`(= wizard onApply 핸들러) 함수 본문 초입에 추가:
```ts
    setEnrichment(fill.enrichment);
```
4. `payload` 객체(제출부)에 필드 추가(`searchVisible,` 근처):
```ts
        enrichment,
```
5. Run: `npx tsc --noEmit`
6. Verify: 생성 경로에서 payload.enrichment 전달. (수정 경로는 위저드 미실행 → enrichment=undefined)
7. Commit: `git commit -m "feat(register): applyWizard→enrichment 상태·payload 전달"`

**Expected output:** 생성 payload에 enrichment 포함, tsc green.

---

## Task 5: 서버 액션 (`actions.ts`) — create=기록 / update=보존

**Goal:** RegisterInput에 enrichment 추가 + createMakerAction만 저장.

**Steps:**
1. 상단 타입 import에 `Enrichment` 추가(기존 types import 줄에):
```ts
import type { CollabType, Block, Enrichment } from "@/lib/types";
```
   (현재 import 구성에 맞춰 `Enrichment`만 추가)
2. `RegisterInput` 인터페이스 끝(`editPassword?...` 위)에 추가:
```ts
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시만 기록)
```
3. `createMakerAction`의 `repo.createMaker({ ... })` 인자에 추가(`searchVisible: input.searchVisible,` 근처):
```ts
    enrichment: input.enrichment,
```
4. **`updateMakerAction`는 수정하지 않는다** — enrichment를 updateMakerContent에 전달하지 않음으로써 컬럼이 보존된다(설계 의도). 코드 변경 없음. **단, 보이지 않는 불변식을 명시하기 위해** `updateMakerAction`의 `repo.updateMakerContent({ ... })` 인자 블록 위(또는 마지막 필드 뒤)에 가드 주석 1줄 추가(Gate3 C2):
```ts
    // enrichment는 의도적으로 전달하지 않음 — 전달하면 일반 수정마다 저장된 크롤 스냅샷을 덮어씀(보존 불변식).
```
5. Run: `npx tsc --noEmit`
6. Verify: create만 enrichment write, update는 미전달(보존)
7. Commit: `git commit -m "feat(actions): createMakerAction enrichment 기록(update=보존)"`

**Expected output:** 생성 시 enrichment 저장, tsc green.

---

## Task 6: 저장소 배선 (`repo.ts`)

**Goal:** enrichment 컬럼 read/write. InMemory는 spread로 자동.

**Steps:**
1. `MakerRow` 인터페이스에 추가(`owner_uuid: string | null; claim_token_hash: string | null;` 근처):
```ts
  enrichment: Maker["enrichment"] | null;
```
2. `rowToMaker` 반환 객체에 추가(`editPasswordHash: r.claim_token_hash ?? undefined,` 근처):
```ts
    enrichment: r.enrichment ?? undefined,
```
3. `SupabaseRepo.createMaker`의 `row` 객체에 추가(`claim_token_hash: input.editPasswordHash ?? null,` 근처):
```ts
      enrichment: input.enrichment ?? null,
```
4. **InMemoryRepo.createMaker는 변경 없음** — `{ ...input, ... }` spread가 enrichment를 자동 포함. **updateMakerContent(양쪽)도 변경 없음** — Supabase patch/InMemory Object.assign이 enrichment 키를 안 담아 보존. (확인만)
5. Run: `npx tsc --noEmit`
6. Verify: 타입 통과, update 경로 미변경
7. Commit: `git commit -m "feat(repo): makers.enrichment read/write 배선"`

**Expected output:** Supabase create에 enrichment 컬럼 매핑, tsc green.

---

## Task 7: 로컬 검증 (tsc + build + 개발서버 DOM 주행)

**Goal:** 로컬(InMemory)에서 저장·보존·null 동작 확인. (프로젝트 관례 = dev-DOM 검증, 테스트 프레임워크 없음)

**Steps:**
1. Run: `rm -rf .next && npx tsc --noEmit && npm run build` — 통과 확인
2. **임시 검증 로그 삽입(Gate3 C1 — InMemory는 외부 조회 불가라 로그가 유일한 확실한 관문)**:
   - `actions.ts` `createMakerAction` 안, `repo.createMaker` 호출 **직전**:
     ```ts
     console.log("[xcheck-create] enrichment=", JSON.stringify(input.enrichment));
     ```
   - `repo.ts` `InMemoryRepo.getMakerBySlug` 반환 직전(읽기 확인용):
     ```ts
     const _m = this.makers.find((m) => m.slug === slug) ?? null;
     console.log("[xcheck-read]", slug, "enrichment=", JSON.stringify(_m?.enrichment));
     return _m;
     ```
3. 개발서버 기동(Browser 도구, `collab5-verify`, `ENRICH_FORCE_MOCK=1`이면 무료 크롤). 위저드로 소개서 생성:
   - 씨앗(지역·업종) → 칩 선택 2~3개(별표 1·factual 확인 1 포함) → 생성 → 저장(등록)
4. Verify(생성) — `preview_logs`에서 `[xcheck-create]` 확인:
   - `chips`에 **선택한 것만**(미선택 제외) / `starred`·`confirmed` 플래그 정확 / `seed.businessType` 존재 / `createdAt` ISO / `tier` 존재
   - 조사메모·링크후보·`version` 키 **부재**
5. Verify(보존) — 그 소개서를 **재크롤 없이** 수정·저장 → 저장 후 `/m/[slug]` 재진입 시 `[xcheck-read]`의 enrichment가 **생성 때와 동일**(불변)
6. Verify(null) — 위저드 없이 폼 직접 입력으로 생성 → `[xcheck-create] enrichment= undefined`
7. **임시 로그 2개 제거**(2번에서 넣은 것 원복) → `npx tsc --noEmit` 재확인
8. (커밋 없음 — 검증·로그 원복 단계. 문제 발견 시 해당 Task로 돌아가 수정·재커밋)

**Expected output:** 로그로 picked-only 저장·수정 보존·수동생성 undefined 3종 확인 후 로그 원복, 빌드 green.

---

## Task 8: DB 컬럼 추가 (대표 SQL) + prod 배포 순서

**Goal:** prod `makers`에 컬럼 선행 후 배포(컬럼 없으면 create insert 에러).

**Steps:**
1. **대표가 Supabase에서 실행**:
```sql
ALTER TABLE makers ADD COLUMN enrichment jsonb;
```
2. Verify(잊음 방지 관문, Gate3 N1): 컬럼 존재를 실제로 확인 — Supabase SQL editor에서
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'makers' AND column_name = 'enrichment';
```
   1행 반환돼야 T9 진행. (ALTER 잊으면 여기서 막힘 → prod insert 에러 예방)
3. **배포 순서 = SQL 먼저 → 앱 배포.** (읽기는 컬럼 없어도 안전하나 create write는 컬럼 필요)
4. (앱 코드 커밋은 Task 1~6에서 완료 — 이 태스크는 SQL·순서 관문)

**Expected output:** prod 컬럼 존재, 배포 준비 완료.

---

## Task 9: 배포 + 1팀 겹침핑

**Goal:** 셀프 PR 배포 + 핫파일 통지.

**Steps:**
1. Run: `git fetch origin main && git merge origin/main --no-edit && npx tsc --noEmit && npm run build`
2. Run: `git push origin team2`
3. Run: `gh pr create --base main --head team2 --title "feat: 크롤 신호 저장(enrichment)" --body "..."` (스펙·plan 링크 + 테스트플랜)
4. Verify: PR mergeable → `gh pr merge <#> --merge` → `git fetch origin main && git merge origin/main --ff-only && git push origin team2`
5. prod(`collab5.vercel.app`)에서 위저드 생성 1건 dev-QA 재현(무료 크롤 경로 또는 대표 확인) — enrichment 저장 확인
6. **1팀 겹침핑**: INDEX `📢 알림`에 `register/page.tsx·EnrichWizard·actions·repo·types` 변경 통지(`git fetch` 요청). vault 백로그 `🔨→✅` 갱신.

**Expected output:** main 배포·동기화, prod 저장 확인, 겹침핑 게시.

---

## Self-Review 체크
- [x] 스펙 요구사항 전부 태스크화(타입·빌더·캡처·전달·액션·저장·검증·SQL·배포)
- [x] 플레이스홀더 없음(모든 코드 실물)
- [x] 이름 일관(`Enrichment`/`buildEnrichment`/`enrichment`/`createdAt`)
- [x] 각 태스크 독립 실행·커밋
- [x] DB SQL은 prod 배포 전 관문(Task 8), 로컬은 InMemory라 무관
- [x] update 경로 무변경 = 보존(설계), 별도 코드 없음
- [x] 핫파일 `enrich.ts` 미변경
