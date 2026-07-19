---
title: 크롤 신호 저장 (enrichment) — picked-only 스냅샷
date: 2026-07-19
status: design — Gate2 레드팀 통과(C1·C2 반영), 대표 리뷰 대기
team: 기획개발 2팀
backlog: 크롤-키워드-재설계 §v2 "크롤 칩 DB 저장" (대표 지시 07-15)
---

# 크롤 신호 저장 (`maker.enrichment`)

## 1. 목표 (v1)

AI 크롤 위저드에서 **고객이 선택·확정한 신호**를 소개서(maker) 레코드에 스냅샷으로 저장한다.
지금은 **저장만** 하고 능동적으로 활용하지 않는다. 미래 활용 목적 = **고객 선호·추가정보 기반 콜라보 매칭(+검색)**.

핵심 부가가치(소개서 레코드에 없는 것):
1. `seed.businessType` = **업종/카테고리** — 현재 maker 레코드에 없는 새 검색·매칭 축.
2. 고객이 affirm한 **구조화 칩**(섹션·factual·별표·확정 태그) — 큐레이션된 산출물(one_liner·values 등)과 다른, 원신호에 가까운 층.
3. 크롤 **출처·시각**(provenance).

## 2. 비목표 (YAGNI / 명시적 제외)

- ❌ **검색·매칭 기능 자체** — v1은 저장만. 소비자(인덱스·매처)는 후속.
- ❌ **조사메모(자유 텍스트) 저장** — 저장하지 않는다. 이것이 제3자 정보(남의 상호·언론명 등, 고객이 직접 주지 않은 것)의 최대 오염원이며, 자유 텍스트에서 제3자만 안정적으로 걸러내는 건 비싸고 불완전하다. **메모를 통째로 안 담으면 제3자 자유텍스트 덩어리가 사라진다.** ⚠️ **단, 완전한 스트립은 아니다** — 고객이 **선택한 칩**에 제3자명이 남을 수 있다(예: "○○매거진 소개", "지니뮤직"). 이는 **허용**한다: 고객이 그 칩을 스스로 골라 자기 브랜드 신호로 affirm했기 때문이며, 이미 `collab_history`·`blocks`가 파트너·언론명을 저장하는 것과 **동일한 기준**이다. (별도 필터 없음.)
- ❌ **미선택(unpicked) 칩·힌트 저장** — unpicked는 {거절 / 이번에 놓침 / 지금은 아니지만 미래엔 맞음}이 섞인 **모호 신호**다. 부정 신호 자산으로 쓰면 고객이 놓쳤거나 미래에 하려는 정보로 그 브랜드를 오노출·오라벨링할 위험이 있어 저장하지 않는다. **→ 미래 매처는 "부정 신호 풀"이 실수로 누락된 게 아니라 의도적으로 수집되지 않았음을 알아야 한다.**
- ❌ **step-4 생성 힌트(activity/collab/block Hints) 별도 저장** — 고객이 **선택한** 힌트는 이미 `maker.activities` / `maker.collab_history` / `maker.blocks`에 저장된다(중복). 미선택 힌트는 위 원칙상 제외. 따라서 enrichment에 힌트 섹션은 두지 않는다.
- ❌ **링크 후보 저장** — 고른 링크는 이미 `maker.trust.instagram/homepage`에 있고, 후보(추정 핸들 등)는 검색·매칭에 쓰이지 않는다.
- ❌ **재크롤-온-편집 시 enrichment 갱신** — v1은 **생성(create) 시점에만** enrichment를 기록한다. 편집(update)에서는 기존 값을 **보존만** 한다(덮어쓰지 않음). 편집 중 재크롤로 새 스냅샷을 반영하는 건 v1 범위 밖.

## 3. 데이터 모델

### 타입 (`src/lib/types.ts`)

```ts
export interface EnrichmentChip {
  text: string;       // 칩 제목
  section: string;    // KeywordChip.section (키워드/정체/제품/활동/콜라보/…/직접)
  factual: boolean;   // 숫자·이력 등 사실성 칩
  starred: boolean;   // 고객이 별표(우선순위)한 칩
  confirmed: boolean; // factual 칩을 고객이 "맞아요"로 확인
}

export interface Enrichment {
  version: 1;                 // 스키마 진화 대비(매처가 소비 시작하면 반드시 변경됨)
  crawledAt: string;          // ISO — 크롤 응답 시각
  tier: "rich" | "thin";      // 크롤 수집 밀도
  seed: { region: string; businessType: string }; // 고객이 씨앗에 입력
  chips: EnrichmentChip[];    // 고객이 "선택한" 칩만
}

// Maker에 추가 (optional)
export interface Maker {
  // …기존 필드…
  enrichment?: Enrichment;
}
```

### DB 컬럼 (`makers`)

```sql
ALTER TABLE makers ADD COLUMN enrichment jsonb;  -- nullable, default null
```

- **대표가 SQL 실행**(관례). additive·nullable이라 기존 행·읽기 무해.
- **삭제 동작(대표 요청 "CASCADE")**: enrichment는 별도 테이블/FK가 아니라 **makers의 한 컬럼**이다. 따라서 maker 행이 삭제되면 컬럼 값도 함께 사라진다 — CASCADE가 **구조적으로 자동 충족**된다(추가 FK·트리거 불필요).

## 4. 캡처 플로우

```
EnrichWizard(client state)
  → buildEnrichment(...)               // 순수 함수, 위저드 상태 → Enrichment
  → WizardFill.enrichment
  → page.tsx applyWizard: setEnrichment(fill.enrichment)
  → RegisterInput.enrichment
  → createMakerAction → repo.createMaker → makers.enrichment
```

### `buildEnrichment` (신규 `src/lib/enrichment.ts` — 순수·단위테스트 대상)

hot file인 `enrich.ts`를 건드리지 않도록 **새 파일**에 격리한다.

```ts
import type { Enrichment, EnrichmentChip } from "./types";

// 반환 null = 저장 가치 0(업종 없음 + 선택 칩 0). 호출부는 null이면 enrichment를 세팅하지 않는다.
// → not-null 빈 스냅샷을 만들지 않아 미래 "has enrichment?" 판정이 깨지지 않는다. (Gate2 C2)
export function buildEnrichment(params: {
  region: string;
  businessType: string;
  tier: "rich" | "thin";                    // 크롤 응답의 tier(서버 판정) 그대로 — 여기서 재계산하지 않음
  crawledAt: string;
  selected: string[];                       // 선택 칩 텍스트
  starred: string[];
  confirmed: Set<string>;                   // factualOk
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
  // 업종도 없고 선택 칩도 0이면 저장 가치가 없음 → null (수동 생성과 동일 취급).
  if (!businessType && chips.length === 0) return null;
  return {
    version: 1,
    crawledAt: params.crawledAt,
    tier: params.tier,
    seed: { region: params.region.trim(), businessType },
    chips,
  };
}
```

### 위저드 배선 (`EnrichWizard.tsx`)

- `runCrawl` 성공 시 `crawledAt = new Date().toISOString()`를 상태에 저장(크롤 시각). 재크롤하면 last-crawl-wins(유지한 칩에 대응하는 크롤 시각을 반영 — 올바른 provenance).
- `tier`는 **크롤 응답값(`d.tier`, 서버 판정)** 그대로 상태에 보관한 것을 넘긴다(앱에서 재계산 안 함).
- `apply()`에서 `buildEnrichment`로 스냅샷을 만든다. **null이면 `WizardFill.enrichment`를 생략(undefined)**; 아니면 실어 보낸다.
  입력: `regionInput`, `btype`, `tier`, `crawledAt`, `selected`, `starred`, `factualOk`, `chipOf(text)?.section`, `isFactual(text)`.
- **선택 칩이 0개여도** enrichment는 만들어진다 — 씨앗 업종(`businessType`)이 유효 신호이기 때문(seed·tier·시각 포함), `chips: []` 허용. 씨앗 스텝이 지역·업종을 **둘 다 필수**로 받으므로(`seedReady`) 정상 크롤 경로에선 `businessType`이 항상 존재 → `buildEnrichment`는 non-null. 업종도 없고 칩도 0인 경우에만 null(방어적 — 정상 경로 밖).

### 폼·저장 배선

- `WizardFill`에 `enrichment?: Enrichment` 추가. `page.tsx`가 applyWizard에서 `enrichment` 상태로 보관.
- `RegisterInput`에 `enrichment?: Enrichment` 추가.
- **create**: `createMakerAction`가 `input.enrichment`를 `repo.createMaker`로 전달. `SupabaseRepo.createMaker` row에 `enrichment: input.enrichment ?? null` 추가. `InMemoryRepo`도 동일 보관. `rowToMaker`에 `enrichment: r.enrichment ?? undefined`. `MakerRow`에 `enrichment: Maker["enrichment"] | null` 추가.
- **update (보존)**: `updateMakerAction`는 enrichment를 **전달하지 않는다**. `updateMakerContent`의 update row에 enrichment 키를 **넣지 않는다** → Supabase `.update()`는 제공한 키만 갱신하므로 컬럼이 보존된다. (InMemory도 기존 값 유지.) enrichment는 `Maker`에서 optional이라, update content 객체에서 생략해도 타입 에러 없음.

## 5. 프라이버시·동의 자세 (결정됨)

- **v1은 신규 동의 UI·처리방침 없이 진행.** 근거: 저장 대상은 고객 **본인 브랜드**에 관한 **본인 입력·확정** 데이터이며 본인 레코드에 묶인다. 제품은 이미 상호·인스타·주소·소개를 별도 동의 UI 없이 저장 중이라 **새 수집선을 긋지 않는다.** 제3자 오염원(조사메모)은 저장에서 제외한다.
- **트리거(별도 백로그)**: 콜라보 **매칭/검색(2차사용)을 실제 출시하기 전** 개인정보 처리방침·동의를 재검토한다 — "소개서 작성"과 다른 목적의 2차사용은 PIPA 목적제한 이슈이기 때문. 처리방침 작성·동의 기능은 [[크롤-키워드-재설계]] §v2 백로그에 등록됨.
- ⚠️ 본 판단은 법률 자문이 아니다. 매칭 출시 등 실제 적용 전 법률 확인 필요.

## 6. 컴포넌트·경계

| 단위 | 역할 | 의존 |
|---|---|---|
| `types.ts` `Enrichment`/`EnrichmentChip`/`Maker.enrichment` | 도메인 형태 | — |
| `lib/enrichment.ts` `buildEnrichment` | 위저드 상태 → 스냅샷 (순수) | types |
| `EnrichWizard.tsx` | crawledAt 캡처 + apply 시 buildEnrichment 호출 | enrichment, types |
| `WizardFill` / `page.tsx` | enrichment를 폼→저장으로 전달 | — |
| `RegisterInput` / `actions.ts` | create=기록 / update=보존 | repo |
| `repo.ts` (Supabase+InMemory) | 컬럼 read/write, update 시 보존 | — |

경계 확인: `buildEnrichment`는 내부를 몰라도 "선택 상태를 넣으면 스냅샷이 나온다"로 이해·독립 테스트 가능. 소비자(매처)는 v1에 없다.

## 7. DB 마이그레이션

1. 대표가 실행: `ALTER TABLE makers ADD COLUMN enrichment jsonb;`
2. 앱 배포는 컬럼 부재에도 안전해야 함(읽기 `r.enrichment ?? undefined`, 쓰기 시 컬럼 없으면 Supabase 에러) — **순서: 컬럼 추가 → 앱 배포.** 로컬(InMemory)은 컬럼 개념 없이 객체 필드로 동작하므로 무관.

## 8. 테스트

- **단위(`buildEnrichment`)**: 선택 칩만 포함 / starred·confirmed 플래그 정확 / 미선택 제외 / 씨앗 트림 / `businessType`만 있고 칩 0개 → non-null(`chips:[]`) / **업종·칩 둘 다 없음 → `null`** / section 폴백("직접").
- **통합(생성)**: 위저드 apply→create → `makers.enrichment`에 picked-only 스냅샷 저장(조사메모·미선택·링크후보 부재 확인).
- **통합(편집 보존)**: enrichment 있는 maker를 재크롤 없이 편집·저장 → enrichment **불변**.
- **통합(수동 생성)**: 위저드 없이 생성 → enrichment `null`/부재.
- **회귀**: 기존 maker(컬럼 null) 읽기·수정·렌더 정상.

## 9. v1 한계·리스크(문서화)

- 편집 중 재크롤로 새 스냅샷을 반영하지 않음(생성 시점 값 고정). 필요 시 v2에서 "enrichment dirty" 플래그로 조건부 갱신.
- 미래 매처가 소비를 시작하면 스키마가 바뀔 것이므로 `version` 필드로 마이그레이션한다.
- **네거티브 전용 계약 금지 사항**: enrichment는 "고객이 선택한 것"만 담는다. 미래 소비자는 이 데이터를 **긍정 신호**로만 취급한다(미선택을 부정 신호로 재구성하지 않는다 — 우리가 애초에 저장하지 않는다).
