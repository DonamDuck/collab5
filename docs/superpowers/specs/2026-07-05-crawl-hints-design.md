# 설계: 크롤 기반 활동·콜라보 참고 힌트

Date: 2026-07-05
Topic: AI 크롤이 발견한 활동·콜라보 흔적을 폼(④ 활동 / 함께한 콜라보) 수기작성 시 참고카드로 제공

## 목표

한 문장: AI가 활동·콜라보를 "써주는" 것이 아니라, **웹 조사(네이버+제미나이)에서 발견된 흔적을 출처 유형과 함께 정리**해 접힌 배너로 보여주고, 원하면 '이 내용으로 시작하기' 한 번으로 카드 밑그림을 깔아준다.

**원칙:** 사실 서술 항목(story·activities)의 AI 창작 금지 결정과 충돌하지 않는다 — 이 기능은 창작이 아니라 **발견한 사실의 정리**다. 조사 메모에 실제 등장한 것만, 없으면 빈 배열.

## 결정 사항 (브레인스토밍 확정)

1. **세기:** 읽기전용 참고카드 + 힌트별 '이 내용으로 시작하기' 넣기 버튼(밑그림 채움, 수정 전제).
2. **노출:** ④ 활동·함께한 콜라보 섹션 타이틀 아래 **접힌 배너 → 탭하면 펼침**. 힌트 0건이면 배너 자체 숨김.
3. **근거:** 출처 유형 라벨만(예: 네이버 블로그 후기 · 카페글 · 웹 검색 · 인스타그램). URL 배관 없음.
4. **고지 문구:** `웹에서 찾은 내용이에요.` (딱 이 문구 — "흔적/사실확인" 표현 쓰지 않음)
5. **경로:** 위저드(불러오기) 크롤에서만 생성. '초안 받기'(mode:draft) 경로는 무변경.
6. 사진 연계는 범위 밖.

## 데이터 모델

```ts
// lib/enrich.ts
export interface ActivityHint {
  title: string;  // 짧은 활동명 (예: "가방 만들기 워크숍")
  desc: string;   // 한두 문장 요약 (해요체)
  source: string; // 출처 유형 라벨 (예: "네이버 블로그 후기")
}
export interface CollabHint {
  partner: string; // 파트너/함께한 곳 이름
  desc: string;    // 한두 문장 요약 (해요체)
  source: string;  // 출처 유형 라벨
}
// EnrichOptions에 추가:
//   activityHints: ActivityHint[]; // 0~3건
//   collabHints: CollabHint[];     // 0~3건
```

## 백엔드 (`lib/enrich.ts`) — 추가 API 호출 0

`mode:options` 구조화 스키마 확장(같은 1회 호출에 얹음):

- `OptionsResultSchema`(zod, Haiku 폴백용)와 `GEMINI_OPTIONS_SCHEMA`(Gemini용) 양쪽에 `activityHints`/`collabHints` 추가.
- `OPTIONS_SYSTEM` 프롬프트에 규칙 추가: "activityHints/collabHints는 조사 메모에 실제로 언급된 활동(워크숍·클래스·팝업·제품라인 등)·콜라보(파트너명이 드러난 협업 소식)만 각각 0~3건. source는 메모에 드러난 출처 유형(네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나). **메모에 없으면 만들지 말고 빈 배열.**"
- `normalizeOptions()`에서 `(o.activityHints ?? []).slice(0,3)` / `(o.collabHints ?? []).slice(0,3)` + 빈 title/partner 필터.
- `MockProvider.options()`에 샘플 힌트 각 2건(로컬 테스트).

## 전달 (위저드 → 폼)

- `WizardFill`에 `activityHints?: ActivityHint[]`, `collabHints?: CollabHint[]` 추가.
- `EnrichWizard.apply()`가 `options`에서 실어 보냄(있을 때만).
- `register/page.tsx` `applyWizard()`가 새 상태 `hints: { activities: ActivityHint[]; collabs: CollabHint[] }`로 보관(세션 한정, 저장 안 함).

## UI (`register/page.tsx`)

새 컴포넌트 `HintBanner`(파일 내 함수 컴포넌트):

```
[접힘]  ✨ 웹에서 참고할 만한 정보를 찾았어요 (2건)                ∨
[펼침]  각 힌트: [출처칩] 제목/파트너(볼드) + 요약 + [이 내용으로 시작하기]
        하단 고지: ⓘ 웹에서 찾은 내용이에요.
```

- 위치: ④ GroupHeader 아래(활동 힌트) / 함께한 콜라보 라벨·설명 아래(콜라보 힌트). 해당 종류 힌트 0건이면 미렌더.
- 스타일: `rounded-md border border-hairline bg-primary-pale/soft` 계열, 접기/펼치기는 로컬 useState.

**'이 내용으로 시작하기' 규칙:**
- 활동 힌트 → 첫 **빈** 활동 카드(제목·설명·사진 모두 빈 것)에 `{title, desc}` 채움. 빈 카드 없고 3개 미만이면 새 카드 추가. 3개 꽉 차고 빈 카드 없으면 버튼 disabled(툴팁성 문구 불필요).
- 콜라보 힌트 → 같은 규칙으로 `{partner, desc}` 채움. types·year·photos는 비움(고객 몫).
- 같은 힌트 중복 넣기 방지: 넣은 힌트는 버튼을 `✓ 넣었어요`(disabled)로 전환(인덱스 Set).

## 엣지/에러

- 크롤 실패·힌트 없음 → 배너 미렌더(기존 흐름 무영향).
- 위저드 '적용' 없이 닫으면 힌트 없음(적용 시에만 전달).
- 힌트는 저장·전송되지 않음 — 카드에 넣은 결과만 기존 제출 경로로 저장.

## 영향 파일

- `src/lib/enrich.ts` — 타입·스키마·프롬프트·normalize·mock
- `src/app/register/EnrichWizard.tsx` — WizardFill 확장 + apply 전달
- `src/app/register/page.tsx` — hints 상태 + HintBanner + 넣기 핸들러

## 테스트/검증

- `npx tsc --noEmit` + eslint 클린.
- 로컬(mock): 위저드 적용 → ④·콜라보 아래 배너 노출 → 펼침 → '시작하기'로 카드 채움 → '✓ 넣었어요' 전환 → 3개 초과 disabled.
- 실크롤(prod/캔버스가든): 워크숍 후기가 활동 힌트로, 콜라보 소식이 콜라보 힌트로 잡히는지·없는 브랜드는 빈 배열인지.
