# 설계: AI 크롤링 인테이크 — 인터뷰형 4스텝

Date: 2026-07-05
Topic: EnrichWizard 인테이크(소개 방향 정하기)를 대화형 4스텝 인터뷰로

## 목표

한 문장: 현재 한 화면에 몰려있는 크롤 인테이크(짧은 소개 + 지역 + 키워드)를 **질문 하나씩 대화로 넘기는 4스텝 인터뷰**(소개·지역·키워드·꼭 담고 싶은 이야기)로 바꿔, "여러 폼을 달랑 준" 느낌 대신 "함께 정해가는" 온보딩 경험을 준다.

**스코프에서 제외:** AI가 offersNote·seeksNote·targetAudience 등 새 소개서 항목을 초안하는 것(별도 요청으로 분리). 백엔드(enrich.ts / /api/enrich)·폼 반영 로직·결과 단계(필드확인·5지선다)는 **무변경**.

## 배경 (현재 구조)

- `src/app/register/EnrichWizard.tsx` 한 컴포넌트. 상단 "불러오기" 박스에서 **브랜드 이름(query)**을 받고 위저드가 열림.
- `type Kind = "keywords" | "loading" | "fields" | "oneLiner" | "desc" | "error"`.
- `kind === "keywords"`: 한 화면에 intro(textarea) + regionInput(input) + keywords(칩+직접추가) + 단일 CTA("이 방향으로 찾기" / "그냥 찾아주세요").
- `STEP_ORDER = ["fields","oneLiner","desc"]` — 결과 단계만 상단 "n/3" 카운터+뒤로가기 표시(`stepIdx = STEP_ORDER.indexOf(kind)`, keywords는 -1이라 헤더 미표시).
- CTA 클릭 → `runOptions()` → loading → research/options → fields → oneLiner → desc → 폼 반영.
- 열릴 때 `researchRef`로 이름 기준 백그라운드 research 프리페치. region 입력 시 `runOptions`에서 지역 포함 재크롤.

## 결정 사항 (브레인스토밍 확정)

1. **4스텝 순서:** 소개(intro) → 지역(region) → 키워드(keywords) → 꼭 담고 싶은 이야기(storyNote, 자유양식 장문).
2. **톤:** 대화체 헤드라인 + 앞 답변을 살짝 이어받는 리액션. **단, 앞 답변의 실제 내용은 참조하지 않음**(제네릭 "좋아요."류) → 건너뛰어도 어색하지 않고 조작 위험 0.
3. **스킵:** 네 스텝 모두 선택. '다음'은 빈칸이어도 항상 활성. **'건너뛰기'는 '다음' 버튼 하단**에 옅은 텍스트로 배치.
4. **진행 표시:** 인터뷰 전용 "n/4" 카운터(결과 단계의 n/3과 분리). 2·3·4스텝에 뒤로가기.
5. **꼭 담고 싶은 이야기(storyNote)의 백엔드 반영:** intro와 합쳐 기존 `ownerNote`에 실어 보냄 → **API·enrich.ts 무변경**. 조합 규칙은 아래 runOptions 절.
6. 폼 반영·결과 단계 무변경.

## 아키텍처

`EnrichWizard`의 `kind === "keywords"` 단계 하나를, 내부 `interviewStep` 상태로 3개 sub-step 렌더링.

- 새 상태: `const [interviewStep, setInterviewStep] = useState<0 | 1 | 2 | 3>(0)` (0=소개, 1=지역, 2=키워드, 3=이야기).
- 새 상태: `const [storyNote, setStoryNote] = useState("")` (꼭 담고 싶은 이야기, 자유양식 장문).
- `kind === "keywords"`일 때만 의미 있음. `runOptions()` 호출 시 `kind`가 loading으로 바뀌므로 이후 무관.
- 상태 intro/regionInput/keywords/kwInput 및 헬퍼(toggleKw/addKw)·research 프리페치·runOptions는 **그대로 재사용**. 화면만 스텝별로 나눔.

### 진행 헤더 (인터뷰 전용)

- 기존 결과-단계 헤더(`stepIdx >= 0` 블록)는 유지.
- `kind === "keywords"`일 때 별도 인터뷰 헤더 렌더:
  - `interviewStep > 0`이면 좌측 "← 뒤로"(→ `setInterviewStep(s => s-1)`).
  - 우측 "`{interviewStep + 1} / 4`".
  - 스타일은 기존 결과 헤더와 동일 클래스 재사용.

### 스텝별 화면

공통: 상단 대화체 헤드라인(`text-lg font-bold text-ink`) + (2·3·4스텝) 이어받기 톤. 입력 아래 도움말(기존 문구 재사용). 하단 CTA + 그 아래 '건너뛰기'.

**Step 0 — 소개 (intro)**
- 헤드라인: `먼저, 브랜드를 한 문장으로 알려주세요.`
- 입력: intro `<textarea rows={3}>` (기존 placeholder·클래스 유지).
- 도움말: `한두 문장이면 충분해요. 적어주실수록 브랜드에 더 잘 맞는 소개를 만들어드릴 수 있어요.`
- CTA: `다음 (1/4)` → `setInterviewStep(1)`.
- 건너뛰기: `건너뛰기` → `setInterviewStep(1)` (값 유지; intro는 비워도 됨).

**Step 1 — 지역 (region)**
- 헤드라인: `좋아요. 어디에 있는 브랜드인가요?`
- 입력: regionInput `<input>` (기존 placeholder "예: 서울 종로구"·클래스 유지).
- 도움말: `대략만 알려주셔도 돼요. 같은 이름의 다른 곳과 헷갈리지 않게 더 정확히 찾아드려요.`
- CTA: `다음 (2/4)` → `setInterviewStep(2)`.
- 건너뛰기: `건너뛰기` → `setInterviewStep(2)`.

**Step 2 — 키워드 (keywords)**
- 헤드라인: `강조하고 싶은 키워드나 단어가 있나요?`
- 입력: 기존 keyword 칩(SUGGESTED_KEYWORDS) + 커스텀 칩 + `직접 더하기` 인풋/추가 버튼 (전부 기존 유지, `MAX_KEYWORDS=4`).
- 도움말/카운터: 기존 `{keywords.length} / {MAX_KEYWORDS} · 그동안 {query}{josa(...)} 미리 찾고 있어요` 유지.
- CTA: `다음 (3/4)` → `setInterviewStep(3)`.
- 건너뛰기: `건너뛰기` → `setInterviewStep(3)`.

**Step 3 — 꼭 담고 싶은 이야기 (storyNote, 자유양식 장문)**
- 헤드라인: `마지막으로, 소개에 꼭 담고 싶은 이야기가 있나요?`
- 도움말(질문 하단): `AI가 소개 초안을 만들 때 함께 참고할게요.`
- 입력: storyNote `<textarea rows={5}>` (장문 허용). placeholder: `예: 창업 계기, 꼭 알리고 싶은 특징, 강조하고 싶은 가치… 편하게 적어주세요.`
- CTA: `✨ 초안 받기 (4/4)` → `runOptions()`.
- 건너뛰기: `건너뛰기` → `runOptions()` (이야기 없이 진행).

### runOptions — ownerNote 조합 (백엔드 무변경 유지)

- 현재 `runOptions`는 `ownerNote: intro.trim() || undefined`를 전송.
- 변경: intro와 storyNote를 하나의 ownerNote로 합쳐 전송.
  ```
  const parts = [intro.trim(), storyNote.trim() && `꼭 담고 싶은 이야기: ${storyNote.trim()}`]
    .filter(Boolean);
  const ownerNote = parts.length ? parts.join("\n\n") : undefined;
  ```
- 둘 다 비면 `undefined`(기존과 동일). API/enrich.ts는 `ownerNote` 문자열만 받으므로 무변경.

### 스킵/네비게이션 규칙

- '다음'/CTA 버튼은 항상 활성(빈칸 허용).
- '건너뛰기'는 다음 버튼 **하단**, 옅은 텍스트(`text-sm text-mute` 정도), 클릭 시 다음 스텝 진행(값은 지우지 않고 그대로 둠 — "비우고 넘어감"이 아니라 "지금 안 채우고 넘어감").
- 뒤로가기(인터뷰 헤더 좌측)로 이전 스텝 복귀, 입력값 유지.
- 4스텝 모두 건너뛰면 이름(query)만으로 크롤 = 기존 동작 보존.
- 결과 단계로 넘어간 뒤에는 인터뷰로 되돌아가지 않음(재크롤 필요하므로). 결과 헤더의 뒤로가기는 결과 단계 내에서만(기존 그대로).

## 추가: 결과 5지선다 '직접 입력하기'

결과 단계의 한 줄 소개(2/3)·브랜드 소개(3/3) 5지선다에서, 후보가 마음에 안 들면 직접 쓸 수 있는 탈출구.

- **위치:** `OptionPicker`의 보기 목록 **맨 아래**(CTA 버튼 바로 위)에 `+ 직접 입력하기` 버튼(옅은 점선/텍스트 스타일).
- **동작:** 클릭 시 목록에 **빈 문자열 항목을 추가**하고 그 항목을 **선택 + 편집 모드로 오픈** → 기존 per-item '수정' 편집 UI(textarea/input)를 그대로 재사용해 사용자가 타이핑.
- **구현:**
  - `OptionPicker`에 `onAddCustom: () => void` prop 추가.
  - 부모(위저드)의 핸들러가 해당 리스트에 `""`를 append하고 `sel`을 새 인덱스로 설정:
    - 한 줄: `setOneLinerList(p => [...p, ""]); setOneLinerSel(oneLinerList.length)`
    - 소개: `setDescList(p => [...p, ""]); setDescSel(descList.length)`
  - `OptionPicker` 내부 버튼 핸들러: `onAddCustom(); setEditing(list.length)` — 클릭 시점 `list.length`가 append 후 새 항목 인덱스와 일치하므로 새 빈 항목이 편집 모드로 열림.
- **엣지:** 커스텀 항목을 비운 채 그대로 두고 그게 선택되면 해당 필드는 빈 값으로 반영(사용자가 폼에서 채움) — 별도 차단 없음. 다른 보기를 고르면 빈 커스텀 항목은 무시됨.
- **범위:** 위저드의 두 픽커에만 적용. (register '초안 받기' 모달의 `DescPicker`는 이번 범위 밖 — 필요 시 후속.)

## 변경 없음 (재사용/보존)

- `runOptions`, research 프리페치, region 재크롤, `mode:"options"`, 5지선다(oneLiner/desc), instagram 후보, `onApply`/폼 반영.
- enrich.ts / `/api/enrich` / 폼(register/page.tsx) 무변경.
- 한글 IME: keyword 인풋 Enter 핸들러 `!e.nativeEvent.isComposing` 유지.

## 엣지/에러 처리

- research 429/실패 → 기존 네이버 단독 degrade + error 단계 그대로.
- 로딩(`kind==="loading"`) 중 인터뷰 헤더/뒤로가기 미표시(기존과 동일).
- 위저드 재오픈 시 `interviewStep` 0 · `storyNote` "" 로 초기화(다른 상태 초기화 위치와 함께).

## 영향 파일

- `src/app/register/EnrichWizard.tsx` — 인테이크 단계 3분할, `interviewStep` 상태, 인터뷰 헤더/카피/건너뛰기. **다른 파일 무변경.**

## 테스트/검증

- `npx tsc --noEmit` + `npx eslint` 클린.
- 수동: 4스텝 넘김/뒤로/건너뛰기, 전부 건너뛰고 이름만 크롤, intro만 채우고 크롤, storyNote만 채우고 크롤(ownerNote 반영 확인), region 채워 재크롤 정확도, 결과 5지선다까지 도달, 한글 조합 중 Enter 중복 없음.
- 결과 픽커 '+ 직접 입력하기': 한 줄·소개 각각에서 클릭 → 빈 항목이 선택+편집 상태로 열림 → 타이핑 → CTA로 폼에 그 값 반영.
