# Implementation Plan: AI 크롤링 인테이크 인터뷰 4스텝 + 5지선다 직접 입력

Date: 2026-07-05
Spec: [docs/superpowers/specs/2026-07-05-enrich-interview-intake-design.md](../specs/2026-07-05-enrich-interview-intake-design.md)

## Goal
EnrichWizard의 인테이크를 대화형 4스텝 인터뷰(소개·지역·키워드·꼭 담고 싶은 이야기)로 바꾸고, 결과 5지선다에 '+ 직접 입력하기' 탈출구를 추가한다.

## Architecture
- 단일 컴포넌트 `src/app/register/EnrichWizard.tsx`만 수정. 백엔드(`/api/enrich`, `enrich.ts`)·폼(`register/page.tsx`)·결과 데이터 흐름 무변경.
- 인테이크: 기존 `kind === "keywords"` 단일 화면을 `interviewStep`(0=소개,1=지역,2=키워드,3=이야기) 기반 4개 서브스텝으로 분할. 인터뷰 전용 `n/4` 헤더는 keywords 블록 내부에 둠(결과 단계 헤더와 분리).
- 새 입력 `storyNote`는 `intro`와 합쳐 기존 `ownerNote` 파라미터로 전송(API 무변경).
- 위저드는 `{wizardOpen && <EnrichWizard/>}`로 조건부 렌더 → 닫으면 언마운트, 재오픈 시 useState 기본값으로 자동 초기화(별도 리셋 코드 불필요).
- 결과 픽커: `OptionPicker`에 `onAddCustom` prop 추가 → 빈 항목 append + 선택 + 편집 오픈.

## Tech Stack
Next.js 16(App Router) · React 19 · TypeScript · Tailwind v4. 클라이언트 컴포넌트("use client").

## Files
MODIFY src/app/register/EnrichWizard.tsx

---

## Task 1: 인테이크를 인터뷰 4스텝으로 전환

**Goal:** intro·region·keywords가 한 화면에 몰린 인테이크를 4스텝 인터뷰로 나누고, storyNote를 추가해 ownerNote에 합쳐 전송.

**Steps:**

1. **상태 추가** — `src/app/register/EnrichWizard.tsx`에서 `const [errMsg, setErrMsg] = useState("");`(현재 54행) 바로 아래에 추가:
   ```tsx
   const [interviewStep, setInterviewStep] = useState(0); // 0=소개 1=지역 2=키워드 3=이야기
   const [storyNote, setStoryNote] = useState(""); // 꼭 담고 싶은 이야기(자유양식 장문)
   const nextInterview = () => setInterviewStep((s) => s + 1);
   const backInterview = () => setInterviewStep((s) => Math.max(0, s - 1));
   ```

2. **runOptions의 ownerNote 조합** — `runOptions` 안의 `body: JSON.stringify({ mode: "options", ... ownerNote: intro.trim() || undefined, })` 블록을 찾아, `fetch` 직전에 조합 변수를 만들고 body에서 참조하도록 교체. 현재:
   ```tsx
       const r = await fetch("/api/enrich", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           mode: "options",
           name: query,
           research,
           focusKeywords: keywords,
           ownerNote: intro.trim() || undefined,
         }),
       });
   ```
   를 다음으로 교체:
   ```tsx
       const noteParts = [
         intro.trim(),
         storyNote.trim() && `꼭 담고 싶은 이야기: ${storyNote.trim()}`,
       ].filter(Boolean);
       const ownerNote = noteParts.length ? noteParts.join("\n\n") : undefined;
       const r = await fetch("/api/enrich", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           mode: "options",
           name: query,
           research,
           focusKeywords: keywords,
           ownerNote,
         }),
       });
   ```

3. **keywords 블록 전체 교체** — `{kind === "keywords" && (` 부터 그 짝이 되는 `)}` 까지(단일 인테이크 화면 전체)를 아래로 교체:
   ```tsx
        {kind === "keywords" && (
          <div>
            {/* 인터뷰 진행 헤더 (n/4) — 결과 단계 헤더와 분리 */}
            <div className="mb-3 flex items-center gap-2 pr-8">
              {interviewStep > 0 && (
                <button
                  type="button"
                  onClick={backInterview}
                  className="-ml-1 inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink"
                >
                  ← 뒤로
                </button>
              )}
              <span className="ml-auto text-xs font-medium text-mute">
                {interviewStep + 1} / 4
              </span>
            </div>

            {/* 1/4 — 짧은 소개 */}
            {interviewStep === 0 && (
              <div>
                <p className="pr-8 text-lg font-bold text-ink">
                  먼저, 브랜드를 한 문장으로 알려주세요.
                </p>
                <textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  rows={3}
                  placeholder="예: 버려지는 천으로 가방을 만드는 업사이클링 브랜드예요. 직접 만드는 워크숍도 함께 운영하고 있어요."
                  className="mt-4 w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
                />
                <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                  한두 문장이면 충분해요. 적어주실수록 브랜드에 더 잘 맞는 소개를 만들어드릴 수 있어요.
                </p>
                <button
                  onClick={nextInterview}
                  className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
                >
                  다음 (1/4)
                </button>
                <SkipLink onClick={nextInterview} />
              </div>
            )}

            {/* 2/4 — 지역 */}
            {interviewStep === 1 && (
              <div>
                <p className="pr-8 text-lg font-bold text-ink">
                  좋아요. 어디에 있는 브랜드인가요?
                </p>
                <input
                  value={regionInput}
                  onChange={(e) => setRegionInput(e.target.value)}
                  placeholder="예: 서울 종로구"
                  className="mt-4 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                />
                <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                  대략만 알려주셔도 돼요. 같은 이름의 다른 곳과 헷갈리지 않게 더 정확히 찾아드려요.
                </p>
                <button
                  onClick={nextInterview}
                  className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
                >
                  다음 (2/4)
                </button>
                <SkipLink onClick={nextInterview} />
              </div>
            )}

            {/* 3/4 — 키워드 */}
            {interviewStep === 2 && (
              <div>
                <p className="pr-8 text-lg font-bold text-ink">
                  강조하고 싶은 키워드나 단어가 있나요?
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
                  최대 {MAX_KEYWORDS}개까지 고를 수 있어요.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTED_KEYWORDS.map((k) => {
                    const on = keywords.includes(k);
                    const full = !on && keywords.length >= MAX_KEYWORDS;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleKw(k)}
                        disabled={full}
                        className={`inline-flex h-9 items-center rounded-pill border px-3.5 text-sm transition-colors ${
                          on
                            ? "border-primary bg-primary-tint text-primary-on"
                            : "border-hairline bg-surface text-mute"
                        } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        {k}
                        {on ? " ✓" : ""}
                      </button>
                    );
                  })}
                  {keywords
                    .filter((k) => !SUGGESTED_KEYWORDS.includes(k))
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleKw(k)}
                        className="inline-flex h-9 items-center rounded-pill border border-primary bg-primary-tint px-3.5 text-sm text-primary-on"
                      >
                        {k} ✕
                      </button>
                    ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        addKw();
                      }
                    }}
                    placeholder="직접 더하기 (예: 반려동물)"
                    disabled={keywords.length >= MAX_KEYWORDS}
                    className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={addKw}
                    disabled={keywords.length >= MAX_KEYWORDS}
                    className="h-11 shrink-0 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
                  >
                    추가
                  </button>
                </div>
                <p className="mt-2 text-xs text-mute">
                  {keywords.length} / {MAX_KEYWORDS} · 그동안 {query}
                  {josa(query, "을", "를")} 미리 찾고 있어요
                </p>
                <button
                  onClick={nextInterview}
                  className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
                >
                  다음 (3/4)
                </button>
                <SkipLink onClick={nextInterview} />
              </div>
            )}

            {/* 4/4 — 꼭 담고 싶은 이야기 */}
            {interviewStep === 3 && (
              <div>
                <p className="pr-8 text-lg font-bold text-ink">
                  마지막으로, 소개에 꼭 담고 싶은 이야기가 있나요?
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
                  AI가 소개 초안을 만들 때 함께 참고할게요.
                </p>
                <textarea
                  value={storyNote}
                  onChange={(e) => setStoryNote(e.target.value)}
                  rows={5}
                  placeholder="예: 창업 계기, 꼭 알리고 싶은 특징, 강조하고 싶은 가치… 편하게 적어주세요."
                  className="mt-4 w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
                />
                <button
                  onClick={runOptions}
                  className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
                >
                  ✨ 초안 받기 (4/4)
                </button>
                <SkipLink onClick={runOptions} />
              </div>
            )}
          </div>
        )}
   ```

4. **SkipLink 컴포넌트 추가** — 파일 하단의 `function FieldEdit(` 정의 바로 위에 추가:
   ```tsx
   // 인터뷰 각 스텝 하단 '건너뛰기' — 값은 지우지 않고 다음 스텝으로 진행
   function SkipLink({ onClick }: { onClick: () => void }) {
     return (
       <button
         type="button"
         onClick={onClick}
         className="mt-2 block w-full text-center text-sm text-mute hover:text-ink"
       >
         건너뛰기
       </button>
     );
   }
   ```

5. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint "src/app/register/EnrichWizard.tsx"`
6. Verify: 타입·린트 에러 0. `backInterview`/`nextInterview`/`storyNote`/`interviewStep`/`SkipLink` 모두 사용됨(미사용 경고 없음).
7. Commit: `git commit -am "feat(enrich): 인테이크를 인터뷰 4스텝으로 전환(소개·지역·키워드·이야기)"`

**Expected output:**
위저드를 열면 '먼저, 브랜드를 한 문장으로…' 1/4 화면부터 시작, 다음/뒤로/건너뛰기로 4스텝 이동, 4/4에서 '✨ 초안 받기' → 기존 로딩·결과 단계로 진입. storyNote 입력 시 ownerNote에 합쳐 전송.

---

## Task 2: 결과 5지선다에 '+ 직접 입력하기' 추가

**Goal:** 한 줄 소개·브랜드 소개 픽커 하단에서 직접 입력할 수 있게 한다.

**Steps:**

1. **OptionPicker에 prop 추가** — `function OptionPicker({ list, sel, onSelect, onEdit, multiline, })` 시그니처와 타입에 `onAddCustom`을 추가:
   ```tsx
   function OptionPicker({
     list,
     sel,
     onSelect,
     onEdit,
     multiline,
     onAddCustom,
   }: {
     list: string[];
     sel: number;
     onSelect: (i: number) => void;
     onEdit: (i: number, v: string) => void;
     multiline?: boolean;
     onAddCustom?: () => void;
   }) {
   ```

2. **'직접 입력하기' 버튼 추가** — `OptionPicker`의 `return (<div className="space-y-2">{list.map(...)}` 에서 `list.map(...)`의 닫는 `})}` 바로 다음, 바깥 `</div>` 직전에 추가:
   ```tsx
         {onAddCustom && (
           <button
             type="button"
             onClick={() => {
               onAddCustom();
               setEditing(list.length);
             }}
             className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute transition-colors hover:border-primary hover:text-primary-on"
           >
             ＋ 직접 입력하기
           </button>
         )}
   ```
   (클릭 시점 `list.length` = append 후 새 항목의 인덱스이므로 새 빈 항목이 편집 모드로 열림.)

3. **한 줄 소개 픽커에 onAddCustom 연결** — `kind === "oneLiner"` 블록의 `<OptionPicker ... />`에 prop 추가:
   ```tsx
               <OptionPicker
                 list={oneLinerList}
                 sel={oneLinerSel}
                 onSelect={setOneLinerSel}
                 onEdit={(i, v) => setOneLinerList((p) => p.map((x, j) => (j === i ? v : x)))}
                 onAddCustom={() => {
                   setOneLinerList((p) => [...p, ""]);
                   setOneLinerSel(oneLinerList.length);
                 }}
               />
   ```

4. **브랜드 소개 픽커에 onAddCustom 연결** — `kind === "desc"` 블록의 `<OptionPicker ... multiline />`에 prop 추가:
   ```tsx
               <OptionPicker
                 list={descList}
                 sel={descSel}
                 onSelect={setDescSel}
                 onEdit={(i, v) => setDescList((p) => p.map((x, j) => (j === i ? v : x)))}
                 onAddCustom={() => {
                   setDescList((p) => [...p, ""]);
                   setDescSel(descList.length);
                 }}
                 multiline
               />
   ```

5. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint "src/app/register/EnrichWizard.tsx"`
6. Verify: 타입·린트 에러 0. 두 픽커 하단에 '＋ 직접 입력하기'가 보이고, 클릭 시 빈 항목이 선택+편집 상태로 열림.
7. Commit: `git commit -am "feat(enrich): 5지선다 하단 '직접 입력하기' 추가(한줄·소개)"`

**Expected output:**
oneLiner/desc 5지선다 맨 아래 '＋ 직접 입력하기' → 누르면 빈 항목이 선택되고 편집 textarea/input이 열려 직접 타이핑, CTA로 그 값이 폼에 반영.

---

## 최종 검증 (전체)
- `npx tsc --noEmit` + `npx eslint "src/app/register/EnrichWizard.tsx"` 클린.
- 수동(로컬 `?demo=` 무관, 상단 '불러오기'로 위저드 오픈): 4스텝 이동/뒤로/건너뛰기, 전부 건너뛰고 이름만 크롤, intro·storyNote만 채우고 크롤, region 채워 재크롤, 결과에서 '직접 입력하기'로 커스텀 한 줄/소개 작성 후 폼 반영, 한글 조합 중 Enter 중복 없음.
