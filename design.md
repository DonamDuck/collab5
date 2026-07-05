---
version: v1.0
name: collab5-design-system
description: >
  결 있는 로컬·인디 메이커들이 서로를 알아보고 콜라보하게 잇는 "콜라보 프로토콜". 멘탈모델은 모바일 청첩장 + 명함앱.
  단단하지만 다정한(warm-premium) 캔버스 위에, 단 하나의 비비드 형광 Kiwi(#98FF5C)를 "스파크"로 아껴 쓴다 —
  Airbnb Rausch·Wise green처럼 단일 브랜드 컬러를 희소하게. Pretendard를 한글 우선 본문으로, 형태는 살짝 둥글게.
  핵심 원칙은 "무대지 주인공이 아니다(stage, not spotlight)": collab5 비주얼은 절제하고 주인공 자리는 메이커 콘텐츠에 내준다.

# ─────────────────────────────────────────────
# TOKENS (machine-readable contract)
# components는 아래 토큰을 {colors.x}/{typography.x}/{rounded.x}/{spacing.x} 로 참조한다.
# 코드 정본 = src/app/globals.css (CSS 변수 + Tailwind v4 @theme 매핑)
# ─────────────────────────────────────────────

colors:
  # Brand
  primary: "#98ff5c"            # Kiwi — 단일 시그니처(맑은 새싹 라임). CTA·활성·하이라이트에만, 희소하게.
  primary-strong: "#7ce63f"     # hover/press
  primary-on: "#1f5c00"         # Kiwi 위 텍스트(어두운 초록) — 흰색 금지
  primary-tint: "#d6ffc0"       # 선택 칩 등 옅은 면
  primary-pale: "#ecffe0"       # 가장 옅은 키위 면
  # Pop accents (비비드 — 포인트, 다색 패밀리)
  lemon: "#f2d81e"
  lemon-pale: "#fbf3b8"
  lemon-on: "#5c4a00"
  cornflower: "#6e86d6"         # 코드 변수명 = --corn
  cornflower-pale: "#dce3f7"
  cornflower-on: "#1b2a5c"
  mint: "#b8e9c8"               # 보조 그린 파스텔(면적용)
  mint-pale: "#e3f6ea"
  mint-on: "#27500a"
  # Ink / Text
  ink: "#222222"                # Night — 텍스트 primary & 다크 서피스
  body: "#4a4a45"               # 본문 보조
  mute: "#6b6a63"               # 캡션·메타
  faint: "#9b9a91"              # placeholder·disabled 텍스트
  on-dark: "#fbfaf6"            # 다크 위 텍스트
  # Surface
  canvas: "#fbfaf6"             # 라이트 기본 배경 (웜 오프화이트)
  surface: "#ffffff"            # 카드·패널
  surface-soft: "#f4f2ec"       # 옅은 채움(인풋 disabled·검색바·hover)
  surface-dark: "#2c2c2a"       # 다크 카드 표면
  # Hairline / Border
  hairline: "#e7e4da"           # 기본 0.5px 보더
  border-strong: "#d8d5cb"      # 강조·hover 보더
  # Semantic (브랜드색과 분리 — Kiwi를 성공색으로 재사용 금지)
  success: "#3b6d11"
  success-pale: "#eaf3de"
  warning: "#ba7517"
  warning-pale: "#faeeda"
  danger: "#e24b4a"
  danger-pale: "#fcebeb"
  info: "#378add"
  info-pale: "#e6f1fb"
  # Focus / Scrim
  focus: "#6e86d6"              # 포커스 링(키위는 대비 부족 → cornflower)
  scrim: "#222222"              # 오버레이 백드롭(40~45% opacity로 렌더)

typography:
  # 서체: Pretendard(한글 우선). 웨이트 3개만(400/500/700). 문장형.
  # ⚠️ 루트 font-size = 17px (html{font-size:17px}) — rem 계산 기준. 가독성 확대(2026-07 확정).
  rootFontSize: 17px
  display:       { fontFamily: "Pretendard", fontSize: 32px, fontWeight: 700, lineHeight: 1.2,  letterSpacing: -0.02em }  # 카드 히어로·랜딩·/m 페이지 h1
  h1:            { fontFamily: "Pretendard", fontSize: 24px, fontWeight: 700, lineHeight: 1.3,  letterSpacing: -0.02em }
  h2:            { fontFamily: "Pretendard", fontSize: 20px, fontWeight: 700, lineHeight: 1.35, letterSpacing: -0.01em }
  h3:            { fontFamily: "Pretendard", fontSize: 17px, fontWeight: 500, lineHeight: 1.4,  letterSpacing: -0.01em }  # 카드 제목
  body:          { fontFamily: "Pretendard", fontSize: 16px, fontWeight: 400, lineHeight: 1.6 }
  body-strong:   { fontFamily: "Pretendard", fontSize: 16px, fontWeight: 500, lineHeight: 1.6 }
  body-sm:       { fontFamily: "Pretendard", fontSize: 14px, fontWeight: 400, lineHeight: 1.5 }
  caption:       { fontFamily: "Pretendard", fontSize: 12px, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0.01em }
  button-md:     { fontFamily: "Pretendard", fontSize: 16px, fontWeight: 500, lineHeight: 1.25 }
  button-sm:     { fontFamily: "Pretendard", fontSize: 14px, fontWeight: 500, lineHeight: 1.29 }

rounded:   # 강도 B(더 후하게) 확정 — 친근·귀여움
  sm: 10px      # 칩(사각)·태그·인풋
  md: 16px      # 버튼·작은 카드
  lg: 22px      # 카드·패널·바텀시트
  xl: 28px      # 청첩장 카드 등 히어로
  pill: 9999px  # 토글·필터칩·아바타·검색바(풀필)

spacing:
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 24px
  "6": 32px
  "7": 48px
  "8": 64px

elevation:
  e0: "none"                                   # 기본(면+보더로 구분)
  e1: "0 1px 2px rgba(34,34,34,.06)"           # 살짝 뜬 카드
  e2: "0 4px 16px rgba(34,34,34,.10)"          # 바텀시트·드롭다운
  e3: "0 8px 32px rgba(34,34,34,.14)"          # 모달·공유 카드

motion:
  dur-fast: 120ms
  dur-base: 200ms
  dur-slow: 320ms
  ease: "cubic-bezier(.2,.8,.2,1)"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-on}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: 48px            # 실구현 h-12 (모바일 풀폭 CTA 기준). 최소 터치 44 유지.
    note: "화면당 1개 원칙. Kiwi는 여기서만 면으로 쓴다. 로딩 시 spinner+라벨 병기."
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border-strong}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    height: 48px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    height: 48px
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: 48px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    placeholderColor: "{colors.faint}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: 44px            # 실구현 h-11. textarea는 py-2.5 + rows.
    focus: "border {colors.focus} (focus:border-focus)"
  chip-choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.mute}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    height: 32px            # 필터칩 h-8. 카드 내 표시칩은 h-7(28).
    padding: "0 12px"
    selected: "bg {colors.primary-tint} · border {colors.primary} · text {colors.primary-on}"
  switch:
    trackOff: "{colors.border-strong}"
    trackOn: "{colors.primary}"
    knob: "#ffffff"
    size: "44x26, knob 22"
    note: "즉시 적용. '콜라보 열림/닫힘' 토글의 기본형. (스펙 확정 · UI 구현 대기)"
  tag-trust:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.mute}"
    checkColor: "{colors.success}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 32px            # /m 헤더 신뢰뱃지 실구현 h-8~9(클릭형은 h-9)
    note: "검증 가능한 신뢰 시그널(인증·홈피·인스타·주소). 링크형은 hover bg-primary-pale."
  tag-tone:
    backgroundColor: "{colors.mint-pale}"   # 또는 lemon-pale / cornflower-pale 로테이션
    textColor: "{colors.mint-on}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    note: "AI distill 결(結) 칩 = 보조층. 신뢰 시그널보다 연하게 — '검증된 것'처럼 보이면 안 됨. /m 키워드칩은 h-9 확대형."
  badge-status:
    backgroundColor: "{colors.primary-pale}"  # 상태 긍정. semantic은 success-pale/warning-pale/danger-pale/info-pale
    textColor: "{colors.primary-on}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    note: "'콜라보 받는 중' 등. 실구현 h-6."
  avatar:
    rounded: "{rounded.pill}"   # shape=square(브랜드 로고 맥락)는 {rounded.md}
    sizes: "24 / 32 / 40 / 48 / 56 / 64"
    fallback: "4색 로테이션(kiwi/mint/lemon/corn pale + 각 -on, 이름 해시 결정론) + 이니셜 1자"
    note: "메이커 로고 우선(우리 색 입히지 않음). 폴백은 Kiwi 틴트 '고정' 금지 → 4색 로테이션으로 Kiwi는 ≈25%만 등장(브랜드색 살리되 그리드 도배 회피, 2026-07-05 확정). 컴포넌트 = src/components/Avatar.tsx"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.4}"
    elevation: "{elevation.e0}"   # interactive 시 hover bg-surface-soft (또는 e1 + border-strong)
  card-dark:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    accentColor: "{colors.primary}"   # Night × Kiwi — 형광이 가장 빛나는 곳
    rounded: "{rounded.xl}"
    padding: "{spacing.4}"
  list-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    hover: "{colors.surface-soft}"
    note: "썸네일=메이커 이미지(무대) + 상호 + 결 한줄 + '콜라보 열림' 뱃지."
  search-bar:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    iconColor: "{colors.faint}"
    rounded: "{rounded.pill}"
    height: 44px
  top-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.h3}"
    height: 56px
    note: "스크롤 시 하단 {colors.hairline} 노출. sticky. 구현 = src/components/SiteHeader.tsx(모바일 리디자인·세션 Avatar)."
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"  # 상단만
    elevation: "{elevation.e2}"
    grabHandle: "36x4 {colors.border-strong}"
    scrim: "{colors.scrim} @45%"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    elevation: "{elevation.e3}"
    maxWidth: 340px           # 완료 얼럿 실구현 max-w-sm. 모바일은 items-end(하단 시트형) sm:items-center.
  toast:
    backgroundColor: "{colors.surface}"   # 다크는 {colors.ink} 반전
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    elevation: "{elevation.e2}"
  segmented:
    track: "{colors.surface-soft}"
    selected: "{colors.surface}"
    rounded: "{rounded.pill}"
    selectedElevation: "{elevation.e1}"
  tabs:
    activeIndicator: "{colors.primary}"   # 2px 하단 인디케이터
    activeText: "{colors.ink}"
    inactiveText: "{colors.mute}"
  photo-grid:
    tile: "80x80 (h-20 w-20), rounded-md, border-hairline"
    addTile: "+ 점선 border, bg-surface"
    removeBtn: "우상단 20px pill bg-ink/60 text-white"
    drag: "드래그 순서변경, 드래그 중 opacity-40, 타깃 border-primary"
    note: "사진 업로드 그리드. max 3~10(맥락별). 구현 = src/app/register/PhotoGrid.tsx"
  photo-slider:
    rounded: "{rounded.lg}"
    behavior: "snap-x mandatory 스와이프 · 인디케이터 점 · 데스크탑 화살표 · 자동재생 없음"
    note: "공개 페이지 사진 노출. 구현 = src/components/PhotoSlider.tsx"
  # ── Signature composite ──
  invitation-card:
    description: "★ 청첩장형 콜라보 카드 — 히어로 아티팩트. 무계정 열람. North Star = 카드 view."
    container: "{components.card-dark} 또는 {components.card}"
    rounded: "{rounded.xl}"
    elevation: "{elevation.e3}"
    maxWidth: 420px
    anatomy:
      - "상단 리본: '콜라보 제안' 캡션 + {colors.primary} 점 (collab5 존재감은 여기까지)"
      - "히어로(무대): 메이커 커버 이미지 + 로고 + 상호 + 결 한 줄 — 화면의 주인공"
      - "신뢰 시그널: {components.tag-trust} 행 (검증 정보만)"
      - "제안 본문 + 하드축 {components.chip-choice}"
      - "RSVP: [관심 있어요]={components.button-primary} · [다음에요]={components.button-ghost}"
      - "푸터: 'collab5로 만든 카드' 초소형 {colors.faint}"
---

# collab5 — 디자인 시스템 (`design.md`)

> **정본(Source of Truth).** 디자인·개발·Claude의 UI 생성 모두 이 파일을 기준으로 한다.
> 위 frontmatter = 기계가 읽는 토큰/컴포넌트 계약. 아래 산문 = 사람이 읽는 의도·규칙.
> 문서 구조는 **토스 TDS Mobile 문서 체계를 차용**(소개→시작하기→Foundation→Components→Patterns, 태스크형 소제목, "이해하기" 관문, 접근성 2단, 인터페이스 최후미). 값(색·폰트·라운드)은 전부 우리 것.
> 변경은 디자인팀↔대표 합의 후 반영하고, 옵시디언 [[디자인-시스템]]에 한 줄 남긴다.

- 버전: **v1.0** (TDS 구조 재정리 + 실구현 실측 반영)
- 최종 수정: 2026-07-05
- 멘탈모델: **모바일 청첩장 + 명함앱**
- 브랜드 소명: "소소하고 소중한 아기자기한 곳들이 자기 이야기를 세상에 더 펼쳐나가는 교두보."

---

## 소개

collab5 디자인 시스템은 **결 있는 로컬·인디 메이커**가 서로를 알아보고 콜라보하도록 잇는 제품의 시각 언어다. 지향은 3가지:

1. **최소 품질 보장** — 어떤 화면을 누가 만들어도 warm-premium 무드가 유지된다.
2. **생산성** — 토큰·컴포넌트 재사용으로 새 화면을 빠르게 조립한다.
3. **무대 원칙** — 사용자 콘텐츠(이미지·브랜드색·목소리)가 주인공. collab5 비주얼은 절제한다. *"stage, not spotlight."*

기본 무드는 **"단단하지만 다정한(warm-premium)"** — 깔끔하고 절제된 프레임에 따뜻함·발랄함·약간의 귀여움을 얹는다(Airbnb의 따뜻한 마켓플레이스 감성 참고). 화면 대부분은 웜 오프화이트 `{colors.canvas}` 또는 Night `{colors.ink}` 위에 잉크 텍스트로 차분하게 깔리고, **단 하나의 비비드 형광 Kiwi `{colors.primary}`** 가 "스파크"로 아주 아껴서 등장한다.

> **단일 브랜드 컬러 철학** — Airbnb(Rausch #ff385c)도 Wise(green #9fe870)도 *브랜드 색 하나를 희소하게* 써서 강력한 인지를 만든다. collab5의 Kiwi도 같다: 대부분 뉴트럴 + 한두 곳의 Kiwi 순간.

**Key Characteristics:**
- **단일 시그니처 Kiwi #98FF5C** — 비비드(맑은 새싹 라임), 포인트 전용(CTA·활성·하이라이트). 면적 크게 깔지 않는다.
- **팝 액센트 패밀리** — Lemon·Cornflower(비비드, 보조 포인트) + 파스텔 틴트(Mint 등, 면적용). "메인은 비비드, 파스텔은 면적."
- **Night × Kiwi 다크 변형** — 잉크 배경 + 키위 글자/CTA. 형광이 가장 빛나는 곳(공유 썸네일·강조).
- **Pretendard, 웨이트 3개(400/500/700), 문장형.** 한글 우선.
- **살짝 둥근 형태(라운드 강도 B)** — 친근하되 절제. 보더 0.5px.

### 타깃 페르소나 (톤의 기준)
- **자기 개성에 확신이 있는** 메이커(솔리드한 자기 무대 위 개성 표현).
- **결이 맞는 다른 메이커와의 콜라보를 기대**하는 사람 → "끼리끼리 알아보는" 큐레이션된 신뢰감.
- 함의: 제너릭·코퍼릿 금지. 표현적·크래프트한 손맛 OK(무대 원칙 내 절제).

---

## 시작하기

딱 3단계다. (TDS의 설치→Provider→첫 사용에 대응)

1. **토큰 확인** — 코드 정본은 `src/app/globals.css`(CSS 변수 + Tailwind v4 `@theme` 매핑). 이 문서 frontmatter와 동일 계약. 색·간격·라운드·그림자는 **반드시 토큰 유틸**(`bg-primary`, `text-ink`, `rounded-md`, `shadow-e2`…)을 쓴다. 임의 hex·px 금지.
2. **컴포넌트 조립** — 만들려는 UI가 [Components](#components)에 있으면 그 클래스 시그니처를 그대로 쓴다. 새로 만들지 않는다.
3. **확장 규칙** — 새 원시값이 필요하면 먼저 frontmatter+`globals.css`에 토큰으로 등록한 뒤 참조한다. 새 컴포넌트는 이 문서에 항목을 추가한다.

> 우선순위(충돌 시 상위가 이김): **토큰 > 컴포넌트 > 패턴**.

```css
/* globals.css 발췌 — 전체는 코드 참조 */
:root{
  --primary:#98ff5c; --primary-strong:#7ce63f; --primary-on:#1f5c00;
  --primary-tint:#d6ffc0; --primary-pale:#ecffe0;
  --lemon:#f2d81e; --lemon-pale:#fbf3b8; --lemon-on:#5c4a00;
  --corn:#6e86d6; --corn-pale:#dce3f7; --corn-on:#1b2a5c;
  --mint:#b8e9c8; --mint-pale:#e3f6ea; --mint-on:#27500a;
  --ink:#222222; --body:#4a4a45; --mute:#6b6a63; --faint:#9b9a91; --on-dark:#fbfaf6;
  --canvas:#fbfaf6; --surface:#ffffff; --surface-soft:#f4f2ec; --surface-dark:#2c2c2a;
  --hairline:#e7e4da; --border-strong:#d8d5cb;
  --success:#3b6d11; --warning:#ba7517; --danger:#e24b4a; --info:#378add;
  --focus:#6e86d6; --scrim:#222222;
  --r-sm:10px; --r-md:16px; --r-lg:22px; --r-xl:28px; --r-pill:9999px;
  --e1:0 1px 2px rgba(34,34,34,.06); --e2:0 4px 16px rgba(34,34,34,.10); --e3:0 8px 32px rgba(34,34,34,.14);
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms; --ease:cubic-bezier(.2,.8,.2,1);
  --font-sans:"Pretendard Variable","Pretendard",-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo",sans-serif;
}
html{font-size:17px} /* 루트 17px — rem 기준. 가독성 확대 확정 */
[data-theme="dark"]{
  --canvas:#222222; --surface:#2c2c2a; --surface-soft:#33332f;
  --ink:#fbfaf6; --body:#b4b2a9; --mute:#888780; --faint:#6b6a63;
  --hairline:#3a3a36; --border-strong:#4a4a45; --primary-on:#222222; --focus:#9db3f0;
}
```

---

## Foundation

> TDS는 Foundation을 Colors·Typography 2개로 두고 간격·아이콘을 컴포넌트에 흡수한다. 우리는 웹앱 특성상 Layout·Elevation·Shape·Motion도 Foundation으로 유지한다.

### Colors

개발자와 디자이너가 통일된 색상 이름을 쓰기 위한 2층 구조: **원시 팔레트**(브랜드·팝·잉크·서피스) + **시맨틱 토큰**(semantic·focus·scrim).

**Brand & Accent**
- **Kiwi** `primary` #98FF5C — 단일 시그니처. primary CTA·활성·선택·하이라이트. **희소하게.** ⚠️ 라이트 배경에 **텍스트로 쓰지 않는다**(대비 부족) → 텍스트는 `primary-on` #1F5C00.
- **Lemon / Cornflower** — 비비드 보조 포인트(팝 패밀리). 카테고리 구분·세컨더리 강조. (코드 변수명: `--lemon`/`--corn`)
- **Mint + `*-pale` 틴트** — 파스텔, **면적용**(넓은 배경·태그). 비비드와 같은 자리에 겹치지 않는다.

**Surface**
- `canvas`(웜 오프화이트) = 라이트 기본 배경. `surface` = 카드 흰색. `surface-soft` = 옅은 채움(검색바·hover·disabled).
- **Night** `ink` #222 = 다크 기본/잉크. 다크는 collab5의 시그니처 무드(Kiwi 극대화).

**Text** — `ink`(primary) → `body`(보조) → `mute`(캡션·메타) → `faint`(placeholder·disabled). 순서대로 옅어진다.

**Semantic** — `success`/`warning`/`danger`/`info` + 각 `-pale`. ⚠️ **성공색에 Kiwi 금지** — Kiwi는 브랜드 스파크 전용(의미 혼선 방지).

**다크모드** — `[data-theme="dark"]`에서 canvas/surface/텍스트/보더가 자동 반전(위 시작하기 블록). `primary-on`은 다크에서 #222(키위 위 잉크).

### Typography

- **Pretendard** 한 패밀리로 한글·숫자·영문 모두. 웨이트 3개만 **400/500/700**. 문장형(sentence case).
- **루트 font-size 17px** — 모든 rem의 기준. 하드코딩 px 대신 토큰·유틸을 쓴다.
- **타입은 절제, 콘텐츠가 무게를 짊어진다.** 단, 시그니처 큰 타입 = **메이커명/카드 제목**을 크게(주인공은 메이커).

토큰 표 (Token | size | LH | 용도):

| Token | Size | LH | 용도 |
|---|---|---|---|
| `display` | 32px·700 | 1.2 | 페이지 히어로 제목. `/m` 브랜드명(text-[32px]) |
| `h1` | 24px·700 | 1.3 | 화면 제목 (text-2xl) |
| `h2` | 20px·700 | 1.35 | 섹션 제목. `/m` 섹션(21px 변형 허용) |
| `h3` | 17px·500 | 1.4 | 카드 제목·리스트 강조 |
| `body` | 16px·400 | 1.6 | 기본 본문 (text-base) |
| `body-strong` | 16px·500 | 1.6 | 본문 강조·버튼 |
| `body-sm` | 14px·400 | 1.5 | 보조 설명 (text-sm) |
| `caption` | 12px·500 | 1.4 | 라벨·메타·뱃지 (text-[12px]) |
| `button-md` | 16px·500 | 1.25 | 기본 버튼 |
| `button-sm` | 14px·500 | 1.29 | 작은 버튼 |

실사용 보조 스케일(코드 관찰): 23px(청첩장 상호명) · 18px(활동 타이틀) · 15px(oneLiner·상세) · 13px(태그) · 11px(초소형 뱃지). 이 범위 밖 크기는 새로 만들지 말 것.

### Layout & Spacing

- **모바일 우선.** 본문 max-width 640px, **카드 공유뷰 420px**, 인증·폼 화면 400px.
- 페이지 좌우 패딩: 모바일 16px(px-4), ≥768 24px(sm:px-6).
- 베이스 4px(`spacing.*`). 컴포넌트 내부 8·12·16, 섹션 리듬 24·32·48.
- **폼 하드-룰**: 섹션 타이틀 → 첫 input = 23px(GroupHeader `mb-[23px]`) · 섹션 간격 `space-y-12`(51px). ⚠️ Tailwind v4 `space-y`는 margin-bottom 기반 — 음수 mb로 덮지 말고 양수 mb로 개별 덮어쓰기.
- **여백 넉넉히** = warm-premium의 핵심. (단 검색·디렉토리는 카드 밀도 ↑ — "열린 히어로 + 조밀한 마켓".)

### Elevation

`e0`(기본, 면+보더) → `e1`(살짝 뜬 카드) → `e2`(시트/드롭다운) → `e3`(모달/공유 카드). **남발 금지.**
다크는 그림자 약함 → **면 대비(canvas vs surface)** 로 깊이 표현.

### Shape

`rounded.*` 5단(10/16/22/28/pill) — 강도 B. 살짝 둥근 절제. 단일 보더 변(`border-left` 등)에는 라운드 주지 않는다.

### Motion

`dur-fast` 120ms(마이크로) · `dur-base` 200ms(기본 전환) · `dur-slow` 320ms(시트·오버레이) · ease `cubic-bezier(.2,.8,.2,1)`. 회전·맥동 애니메이션은 브랜드 정체성·접근성상 지양(→ Loader).

---

## Components

> **문서 규칙(TDS식)**: 각 컴포넌트는 ① 도입문("~할 때 사용해요") ② 사용하기(태스크형 소제목) ③ 상태 ④ **인터페이스(클래스 시그니처, 항상 마지막)** 순. 변형이 2개 이상인 패밀리는 **"이해하기"**로 시작해 A vs B 선택 기준부터 제시한다.
> 우리는 컴포넌트 라이브러리가 아니라 Tailwind 클래스 조합이므로, "인터페이스" = 클래스 시그니처 + 코드 위치다.

### Avatar

프로필·브랜드 로고를 보여줄 때 사용해요. 이미지가 있으면 이미지, 없으면 이니셜. (2026-07-05 디자인 확정)

- **모양 고르기** — `circle`(기본): 계정·프로필(헤더·/my·가입 미리보기) / `square`(rounded-md): **브랜드 로고 맥락**(찾기 카드 등) — 로고는 원형으로 크롭하지 않는다.
- **이니셜 폴백 쓰기** — 이미지 없으면 **4색 로테이션**(kiwi/mint/lemon/corn pale + 각 `-on` 글자색, **이름 해시 결정론** — 같은 브랜드는 항상 같은 색) + 이니셜 1자. ⚠️ Kiwi 틴트 **고정** 금지 → 4색 중 하나로만(≈25%) 등장해 브랜드색은 살리되 그리드 도배는 피한다.
- **크기 정하기** — 표준 스텝 24(리스트) / 32(헤더) / 40 / 48(가입 미리보기) / 56(/my) / 64(프로필).
- 이미지형은 `border-hairline`으로 배경과 분리.

접근성 — 기본: 폴백 `aria-label={name}`, 이미지 `alt={name}` 내장.

인터페이스: `src/components/Avatar.tsx` — props `image?, name, size?(기본 32), shape?("circle"|"square", 기본 circle)`.

### Badge

콘텐츠의 상태를 짧게 표시할 때 사용해요. ('콜라보 받는 중' 등)

인터페이스: `inline-flex h-6 items-center rounded-sm bg-primary-pale px-2 text-xs font-medium text-primary-on`. semantic 상태는 `success-pale`/`warning-pale`/`danger-pale`+각 진한 글자색.

### Button

사용자의 행동을 유도할 때 사용해요. 화면당 primary 1개 원칙.

- **스타일 고르기** — 4종:
  - `primary`(Kiwi) = 화면의 주요 행동. Kiwi를 면으로 쓰는 유일한 곳.
  - `secondary`(보더) = 보조 행동. `border-border-strong bg-surface text-ink`.
  - `ghost`(투명) = 소극 행동("다음에요"). `text-mute`.
  - `danger` = 파괴적 행동.
- **로딩 표시하기** — `pending` 시 spinner(회전 border) + 라벨 변경("가입 중…"). `disabled={pending}`.
- **비활성보다 안내 우선하기** — 입력 미완이어도 버튼은 활성으로 두고, 누르면 안내 메시지(2026-07-05 로그인 폴리시). `disabled`는 pending(중복 방지)에만.

상태: enabled → hover(`primary-strong`) → pressed → loading → disabled(opacity-40~50).

접근성 — 기본: `<button type="button">` 시맨틱. 추가로 지원하기: 아이콘만 있는 버튼엔 `aria-label` 필수.

인터페이스: `h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50` (CTA 기준. 인라인은 w-auto px-6). 코드 전역 사용.

### Card 이해하기

콘텐츠 묶음을 담는 표면이에요. 2가지 중 선택:

| 타입 | 언제 | 스펙 |
|---|---|---|
| **Card** (라이트) | 기본. 목록·패널·정보 | `rounded-lg border border-hairline bg-surface` (+interactive 시 `hover:bg-surface-soft`) |
| **Card-dark** (Night×Kiwi) | 임팩트: 공유 썸네일·히어로 | `bg-ink text-on-dark` + Kiwi 액센트, `rounded-[24px]~xl` |

- **청첩장 카드 만들기** — `rounded-[24px] bg-surface p-5 shadow-e3` (히어로 전용, → Patterns §청첩장 카드).
- **리스트 카드 만들기** — `block rounded-lg border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-surface-soft`.

### Chip 이해하기

여러 항목 중 선택하거나 걸러낼 때 사용해요. 3가지 중 선택:

| 타입 | 언제 | 시그니처 |
|---|---|---|
| **선택 칩**(폼) | 등록 폼 유형·키워드 다중 선택 | 기본 `border-hairline bg-surface text-mute` / 선택 `border-primary bg-primary-tint text-primary-on` |
| **필터 칩**(토글) | 검색 필터 | `inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors` + 활성 동일 키위틴트 |
| **표시 칩**(읽기전용) | 카드·소개서에 값 노출 | `inline-flex h-7 items-center rounded-pill bg-primary-tint px-2.5 text-[12px] font-medium text-primary-on` (하드축) / `bg-mint-pale text-mint-on`(결·보조) |

- **한글 입력으로 직접 추가하기** — 칩 직접입력 Enter 핸들러엔 `!e.nativeEvent.isComposing` 체크 필수(조합 중 Enter 중복입력 버그 방지 — 2026-07-01 확정 규칙).
- ❌ 다수 칩 전부 비비드 금지 — 선택된 것만 키위틴트.

### Dialog 이해하기

흐름을 멈추고 확인/선택을 받아야 할 때 사용해요. 2가지 중 선택:

| 타입 | 언제 | 예 |
|---|---|---|
| **완료 얼럿** | 작업 완료 통지 + 단일 행동 | 가입 완료("🎉 가입이 완료됐어요"), 등록 완료("소개서 확인하기") |
| **선택 모달** | 후보 중 고르기 | 초안 5지선다, 위저드 항목 확인 |

- **모바일 하단 시트형으로 띄우기** — `fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center` (모바일=하단, 데스크탑=중앙).
- **닫기 버튼 배치하기** — `absolute right-3 top-3 h-8 w-8 rounded-pill text-mute hover:bg-surface-soft`.

인터페이스: 컨테이너 `w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2(~e3)`. scrim `bg-ink/40`.

### EmptyState

보여줄 것이 없는 화면을 채울 때 사용해요. 빈 화면도 브랜드 결 유지 — **아톰 마크 흐리게 + 격려 톤.** 절대 차갑게 두지 않는다.

- **구성하기** — 아톰 아이콘(44px, 흐림) → 제목(15~17px/700) → 보조설명(12~13px mute) → primary CTA(+선택 ghost). 가운데 정렬, `px-4 py-10`.
- **아이콘 상태로 의미 표현하기** — 무결과=아웃라인(opacity .4) / 콜드스타트=키위 핵 살아있음(희망) / 404·만료=점선(`stroke-dasharray:3 3`, opacity .3).
- **3종 카피(확정)**:
  - 검색 무결과: "결이 맞는 곳을 아직 못 찾았어요" / CTA `메이커 등록하기` + ghost `필터 초기화`
  - 콜드스타트: "이곳의 첫 메이커가 되어보세요" / CTA `30초 만에 등록하기`
  - 404·만료: "사라졌거나 없는 카드예요" / CTA `collab5 둘러보기`(secondary)

인터페이스: `rounded-lg border border-hairline bg-surface px-4 py-10 text-center`. 아이콘 = `logo-mark-mono.svg`(currentColor).

### Field & GroupHeader (폼 구조)

등록·가입 폼의 골격이에요. 라벨/섹션 구조를 통일할 때 사용해요.

- **Field** — 라벨 위·입력 아래·선택 표기: `label mb-1.5 text-[15px] font-medium text-body` + `· 선택`(optional, `text-faint`).
- **GroupHeader** — 폼 섹션 헤더(번호+타이틀+sub). 타이틀→첫 input 23px(`mb-[23px]`) 하드-룰.
- **섹션 리듬** — 섹션 간 `space-y-12`. 카드 내 세트 간 `space-y-5`.

인터페이스: `src/app/register/page.tsx` 내 `Field`/`GroupHeader` 함수, `src/app/signup/page.tsx` `Field`.

### ListRow

목록의 한 행을 표시할 때 사용해요. (검색 결과 등)

인터페이스: `block rounded-lg border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-surface-soft`. 구성 = 썸네일(메이커 이미지) + 상호 + 결 한줄 + '콜라보 열림' Badge. 그리드 배치 `grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3`.

### Loader (로딩 오버레이)

수 초~분 걸리는 비동기 작업(enrich 등)의 진행을 알릴 때 사용해요. 버튼 비활성만으론 부족할 때.

- **구성하기** — 딤(`bg-ink/40`) + 중앙 카드(surface, rounded-lg, e3, max-w 280): ① **고정 아톰 마크**(~44px, **회전·맥동 X** — 정적) ② 제목("○○의 결을 찾고 있어요") ③ **순환 상태 메시지**(2.4s 간격, 파이프라인 단계 반영) ④ 소요 안내("1~2분 걸릴 수 있어요").
- **움직임 규칙** — 움직임은 **텍스트 순환만**. 스피너/로고 회전 금지(브랜드 정체성·접근성).
- 인라인 소형 로딩(버튼 안)은 예외적으로 spinner 허용: `h-4 w-4 animate-spin rounded-full border-2 border-primary-on border-t-transparent`.

접근성 — 기본: `role="status" aria-live="polite"`.

인터페이스: EnrichWizard LoadingView(`src/app/register/EnrichWizard.tsx`)가 §9.8 스펙 구현체.

### PhotoGrid

사진을 여러 장 올리고 관리할 때 사용해요. (등록 폼 브랜드/활동/콜라보 사진)

- **추가하기** — `+` 점선 타일. 클라이언트 리사이즈 후 data URL(브랜드 1000px / 활동·콜라보 800px).
- **삭제하기** — 타일 우상단 `h-5 w-5 rounded-pill bg-ink/60 text-white` 버튼.
- **순서 바꾸기** — 드래그&드롭. 드래그 중 `opacity-40`, 드롭 타깃 `border-primary`. 하단 힌트 "끌어서 순서를 바꿀 수 있어요."(`text-faint`).
- **최대 장수 지키기** — 맥락별 max(브랜드 10 / 활동·콜라보 3).

인터페이스: `src/app/register/PhotoGrid.tsx` — props `urls[], max, onAdd, onRemove, onReorder`. 타일 `h-20 w-20 rounded-md border border-hairline`.

### PhotoSlider

공개 페이지에서 사진 여러 장을 스와이프로 보여줄 때 사용해요.

- 스냅 스크롤(`snap-x snap-mandatory`) · 인디케이터 점 · 데스크탑 화살표 · **자동재생 없음**.
- 비율 `aspect-[4/3]`, `rounded-lg overflow-hidden`, 빈 배경 `bg-surface-soft`.

인터페이스: `src/components/PhotoSlider.tsx` — props `photos[], rounded?`.

### SearchField

목록에서 원하는 것을 찾을 때 사용해요.

인터페이스: `flex h-11 max-w-xl items-center gap-2 rounded-pill bg-surface-soft px-4` + 아이콘 `text-faint`. 아래 필터 Chip 행과 세트.

### Segmented Control

같은 층위의 뷰를 전환할 때 사용해요. track `surface-soft` / 선택 `surface`+e1, `rounded-pill`.

### Switch

설정을 즉시 켜고 끌 때 사용해요. ('콜라보 열림/닫힘')

- 44×26, knob 22. track off `border-strong` / on `primary`. **즉시 적용**(저장 버튼 없음). 상태 문구 동반("콜라보 받는 중").
- ⚠️ 스펙 확정 · 전용 UI 컴포넌트는 구현 대기(현재 폼 내 다른 방식).

### Tab

콘텐츠 영역을 나눌 때 사용해요. 활성 = `ink` 텍스트 + 하단 2px `primary` 인디케이터 / 비활성 = `mute`.

### Tag 이해하기

메이커에 대한 부가 정보를 표시할 때 사용해요. **신뢰층 vs 보조층을 시각적으로 반드시 구분**한다:

| 타입 | 층 | 시그니처 |
|---|---|---|
| **tag-trust** | 검증 가능(인스타·홈피·주소·인증) | `inline-flex h-8~9 items-center gap-1 rounded-sm bg-surface-soft px-2.5 text-[13px] font-medium text-body` — 링크형은 `hover:bg-primary-pale hover:text-primary-on`, 인증 ✓=`success` |
| **tag-tone** | AI distill 결(보조) | `bg-mint-pale text-mint-on`(또는 lemon/corn pale 로테이션) `rounded-sm` — 신뢰보다 연하게 |

- ❌ 보조(tone)를 검증(trust)처럼 강조 금지 · 미검증 정보에 ✓ 금지 (legitimacy 원칙).
- `/m` 헤더 신뢰뱃지 = tag-trust h-9 클릭형(📷 인스타 / 🔗 홈피 / 📍 주소).

### TextField 이해하기

텍스트를 입력받을 때 사용해요. 2가지 중 선택:

| 타입 | 언제 |
|---|---|
| **TextField**(한 줄) | 상호·이메일·제목·짧은 값 |
| **TextArea**(여러 줄) | 소개·story·활동 설명·협업 서술 — **문장 2개 이상 기대되면 무조건 TextArea** |

- **기본형 만들기** — TextField: `h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus`.
- **여러 줄 받기** — TextArea: 같은 시그니처 + `py-2.5 leading-relaxed rows={3}` (h 고정 제거).
- **라벨·헬퍼 배치하기** — 라벨 위(Field), 헬퍼/에러 아래. 에러는 색+문구(색만 금지), `text-red-600 → {colors.danger}` 계열.
- **한글 Enter 처리하기** — Enter 제출 핸들러엔 `!e.nativeEvent.isComposing` 필수.
- **숫자 포맷 입력받기** — 휴대폰 등은 `inputMode="numeric"` + 자동 포맷(`formatPhone`: 숫자만, 하이픈 자동) + `maxLength`.

상태: enabled → focus(`border-focus`) → disabled(`bg-surface-soft`) → error(`border-danger`+문구).

### Toast

가벼운 완료/안내를 흐름 방해 없이 알릴 때 사용해요. `bg-surface rounded-md shadow-e2`(다크는 ink 반전). 예: 링크 복사 피드백("복사했어요"). 접근성: 중요도에 따라 `aria-live` polite(안내)/assertive(에러).

### TopBar (SiteHeader)

전역 내비게이션이에요. `bg-canvas h-56px sticky`, 스크롤 시 하단 hairline. 세션 상태에 따라 로그인 버튼 ↔ Avatar. 모바일 리디자인(2026-07-05) 반영.

인터페이스: `src/components/SiteHeader.tsx`.

---

## Patterns

> 컴포넌트를 조합한 collab5 고유의 화면 단위. (TDS엔 없는 층위 — 우리 제품 자산)

### P1. ★ 청첩장 콜라보 카드 (히어로) — v1 확정

**무대 원칙 최우선** — 받는 사람에게 보이는 건 *그 메이커*. 라이트=따뜻·접근 / 다크(Night×Kiwi)=임팩트(공유 썸네일 추천). 카드는 **시안이 아니라 템플릿(시스템)** — 슬롯에 메이커 데이터가 바인딩된다.

**구조(세로, 모바일 max 420, radius 24, padding 20, e3):**
1. 상단 라벨 — `● 콜라보 제안`(키위 점 + caption 11px). collab5 존재감은 여기까지만. *(상태배지 없음)*
2. 커버(무대) — 메이커 이미지(radius 16). **없으면** 브랜드 틴트 + 이니셜 아바타 폴백.
3. 상호명(23px/700, -0.03em) + 결 한줄(13~15px body) — **같은 그룹(간격 4px)**.
4. 신뢰 시그널 행 — tag-trust(검증만). 0개면 행 숨김.
5. 구분선(0.5px hairline).
6. 제안 — 라벨(11px) + 본문(14~15px/lh1.6, 키워드 1개만 키위 하이라이트) + 하드축 표시칩 / 결 tag-tone.
7. RSVP — `[관심 있어요]`(primary) + `[다음에요]`(ghost).
8. 푸터 — 아톰 마크 16px + "collab5로 만든 카드"(11px faint).

**행간 리듬(2단 proximity):** 그룹 내부 4~8px / **섹션↔섹션 18~22px** / 구분선 위아래 22 / RSVP 앞 24.

**슬롯 맵:**

| 슬롯 | 변하는 것 | 규칙/폴백 |
|---|---|---|
| 커버 | 메이커 사진 | 없으면 브랜드틴트+이니셜 |
| 상호명 | 텍스트 | 2줄까지, 초과 말줄임 |
| 결 한줄 | 소개 | 1~2줄 말줄임 |
| 신뢰 시그널 | 0~N | **검증된 것만**, 0개면 숨김 |
| 제안 본문 | 콜라보 내용 | 키워드 1개만 키위 하이라이트 |
| 하드축 칩 | 1~N | 키위틴트, 넘치면 줄바꿈 |
| 결 칩 | 0~N | 파스텔(보조층), 신뢰와 시각 구분 |
| RSVP | 고정 | 관심(키위)/다음에요(ghost) |

- ✅ 메이커 이미지·브랜드색 최대 노출 · 콘텐츠 길이/유무에 레이아웃 안 깨짐(스트레스 테스트 통과).
- ❌ Kiwi로 카드 전체 칠하기 · AI 결 칩을 검증처럼 · 상태배지 추가.

### P2. 등록 폼 (9섹션 소개서 폼)

인터뷰형 9섹션(①브랜드 소개→⑨브랜드 정보). 상세 스펙 정본 = 옵시디언 [[소개서-폼-구조]].
- 디자인 골격: GroupHeader(23px 룰) + Field + TextField/TextArea + 선택 Chip + PhotoGrid + 인라인 편집 카드(활동·콜라보, "+ 추가" 링크드인 패턴).
- 하드축(검증·필터)과 결층(AI 보조)의 시각·문구 분리 유지.
- 완료 팝업 = Dialog 완료 얼럿("소개서 확인하기" 단일 버튼). 편집 모드 하단 안내문구 없음(2026-07-05).

### P3. 딸깍 위저드 (EnrichWizard)

AI 자동완성 인테이크. **인터뷰 4스텝**(①브랜드 한 문장 ②지역 ③강조 키워드 ④담고 싶은 이야기) → LoadingView(§Loader 스펙) → 항목 확인(인라인 수정+칩 토글) → 한줄/소개 5지선다(+직접 입력하기).
- 다음 버튼 항상 활성 + '건너뛰기' + n/4 카운터.
- 크롤 힌트: 조사에서 발견된 활동·콜라보만 접힌 배너("웹에서 찾은 내용이에요.") → '이 내용으로 시작하기'.
- 인터페이스: `src/app/register/EnrichWizard.tsx`.

### P4. 무계정 열람 + RSVP + 공유

로그인 없이 카드 열람 → 신뢰 체크 → `[관심 있어요]`/`[다음에요]`(RsvpBar). "관심"=보조 지표, view=North Star(ViewTracker가 1회 기록).
- **공유 = 링크 중심**: 소개서 최하단 `[🔗 링크 복사]`(CopyLinkButton, 클립보드+"복사했어요" 피드백) + 카드 생성 직후 ShareBar. PNG/PDF 다운로드는 제거됨(2026-07-04).
- 마이크로카피는 가볍게("부담 없이", "링크를 복사해 협업하고 싶은 곳에 보내보세요.").

### P5. 검색 + 결과

SearchField + 필터 Chip → ListRow 그리드. 개별 상세는 공개, '전체 둘러보기' 벽은 밀도 쌓일 때까지 절제(cold-start 안전). 무결과 = EmptyState.

### P6. 온보딩 "이렇게 써요" (3스텝)

각 스텝: 아톰 라인 일러스트 → `STEP n`(11px/700 primary-on) → 제목(15px/700) → 보조(12px mute).
- STEP 1 **결을 등록해요** / STEP 2 **콜라보 카드를 만들어요** / STEP 3 **보내고, 관심을 받아요**.

### P7. 일러스트레이션 (아톰 라인 패밀리)

- **모티프 재활용**: 로고 아톰 파생 — 노드·궤도·연결선·새싹. 별도 캐릭터 X.
- **선**: stroke 1.6~2px, 라운드 캡/조인. 잉크 선 + **키위 포인트 1점**.
- **면 채움 최소**: 틴트/파스텔만, 비비드 면 금지.
- **용도**: 온보딩·Empty·빈 자리. **사용자 콘텐츠 영역엔 쓰지 않음**(무대 원칙).
- 모티프 3종: `연결`(두 노드+점선) · `새싹`(스템+잎) · `아톰 코어`(궤도+키위 핵).

### P8. 소개서 페이지 (/m — 편집물형)

"AI 페이지" 탈피: 큰 볼드 타이틀(display 32px) + 섹션 상단 구분선(`border-t border-hairline pt-8`) + 편집물형 섹션 타이틀("우리는 이런 브랜드에요" 등 — 맵은 [[소개서-폼-구조]]).
- 헤더 = 브랜드명 + 한 줄 + tag-trust 뱃지 행(인스타·홈피·주소).
- 값 없으면 섹션 숨김. 장문은 `whitespace-pre-line`.

---

## Responsive

| 이름 | 폭 | 주요 변화 |
|---|---|---|
| Mobile | < 768px | 1-up 스택. 카드 공유뷰 풀폭. 모달=하단 시트형(items-end). 하단 고정 CTA. |
| Tablet | 768–1023px | 그리드 2-up. 검색바 확장. 모달 중앙(sm:items-center). |
| Desktop | ≥ 1024px | 그리드 3–4up. 본문 640 / 디렉토리 그리드 확장. |

- 터치 타깃 ≥ 44×44. 그리드는 행 리플로우 대신 **열 수만** 줄인다.

## Accessibility

> 컴포넌트별 "기본 지원 / 추가로 지원해야 하는 것"은 각 컴포넌트 절에. 아래는 전역 원칙.

- 대비 ≥ 4.5:1(큰 텍스트 3:1). **Kiwi 위 텍스트=`primary-on`**(흰색 금지).
- 모든 인터랙티브 키보드 접근 + 보이는 focus(`focus` cornflower — 키위는 대비 부족).
- 색만으로 의미 전달 금지(아이콘/문구 동반) — 에러·상태·신뢰 시그널.
- 움직임 절제: 로고 회전·맥동 금지, `prefers-reduced-motion`·`prefers-color-scheme` 존중.
- 긴 비동기 = `role="status" aria-live="polite"`(Loader), 에러 토스트 = assertive.

## 로고 (Brand Mark)

- **마크 = "아톰(Atom)".** Kiwi 핵(=공유 기반=collab5) + 교차 궤도 2개 + 전자 3개(홀수). 의미 = *서로 다른 메이커(전자)가 하나의 중심을 공유하며 함께 돈다* = 콜라보.
- **잉크 = 딥블랙 `#111111`** (로고 전용 — UI 본문 잉크는 Night `#222` 유지). 핵 = Kiwi.
- **워드마크 = Pretendard 700, letter-spacing -0.03em, 소문자 `collab5`**, 딥블랙.
- **에셋** (`assets/` · `public/`): `logo-mark.svg`(라이트) · `logo-mark-dark.svg`(다크) · `logo-mark-mono.svg`(currentColor) · `logo-lockup.svg` · `favicon.svg`
- **배경별**: 라이트=딥블랙 선+키위 핵 / 다크=캔버스 선+키위 핵 / 키위 배경=딥블랙(모노).
- **여백**: 마크 높이 ≥25% 사방. **최소 크기**: 16px.
- ✅ 핵은 항상 Kiwi. ❌ 궤도·전자를 키위로 · 비례/각도 변경 · 그림자·그라데이션 · 워드마크 폰트 교체.
- ⚠️ SiteHeader 임시 인라인 SVG 아이콘 → 아톰 패밀리로 교체 예정(디자인팀 백로그).

## Do & Don't 총칙

**Do** — Kiwi는 primary 행동에만 희소하게 · 뉴트럴 위에 색을 얹기 · 다크는 면 대비로 깊이 · 메이커 콘텐츠를 주인공으로 · 문장 2개 이상 기대되는 입력은 TextArea.
**Don't** — 두 번째 브랜드 색 도입 · Kiwi를 성공색/배경 대면적/글자색으로 · 한 화면 primary 여러 개 · AI 결 칩을 검증처럼 강조 · 임의 hex/px 하드코딩.

## Known Gaps / TODO

- Switch 전용 UI 구현(스펙만 확정).
- SiteHeader 아이콘 아톰 패밀리 교체 · 인증화면 4종 다듬기 · `/m` 편집물형 최종 감수 (07-05 기획팀 멘션).
- PortfolioCard 인라인 스타일 → 토큰 클래스 리팩토링(캡처 이슈 해결과 함께).
- semantic `-pale` 계열 globals.css 미등록(frontmatter에만 존재) — 사용 시 등록.
- 풀 일러스트 아트 가이드 · 데스크탑 디테일 · 아이콘 세트 픽스.

## Changelog

- v0.1~v0.2 (06-21): Foundation 잠금 · 토큰 계약·컴포넌트 16종·패턴 4종.
- v0.3 (06-21): frontmatter 토큰/컴포넌트 계약 도입(Airbnb·Wise 분석) · warm-premium 보정.
- v0.4 (06-21): Foundation 완전 잠금 — Kiwi #98FF5C · 라운드 B · 큰 타입 · Pretendard 단독.
- v0.5 (06-21): 로고 확정 = 아톰 마크. SVG 5종.
- v0.6 (06-21): 청첩장 카드 v1 확정(슬롯 맵·행간 리듬). 상태배지 삭제.
- v0.7 (06-21): Empty States 확정 + 구현 QA.
- v0.8 (06-21): 온보딩 3스텝·일러스트 스타일 확정 + 카드 스트레스 테스트 통과.
- v0.9 (06-24): 로딩 오버레이 확정·구현(고정 아톰+순환 메시지, 회전 X) + 등록 QA.
- **v1.0 (07-05): TDS 구조 재정리** — 토스 TDS Mobile 문서 체계 차용(소개→시작하기→Foundation→Components 알파벳순+"이해하기" 관문→Patterns, 태스크형 소제목, 인터페이스 최후미). 실구현 실측 반영(버튼 h-12/48px, 루트 17px, 칩 3형, tag-trust h-8~9). 미문서 컴포넌트 7종 신규 문서화(PhotoGrid·PhotoSlider·EnrichWizard·Field&GroupHeader·CopyLink/ShareBar·SiteHeader·완료얼럿/선택모달 구분). 값·철학 변경 없음(정리+업데이트).
