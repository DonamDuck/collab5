---
version: v0.3
name: collab5-design-system
description: >
  결 있는 로컬·인디 메이커들이 서로를 알아보고 콜라보하게 잇는 "콜라보 프로토콜". 멘탈모델은 모바일 청첩장 + 명함앱.
  단단하지만 다정한(warm-premium) 캔버스 위에, 단 하나의 비비드 형광 Kiwi(#98FF5C)를 "스파크"로 아껴 쓴다 —
  Airbnb Rausch·Wise green처럼 단일 브랜드 컬러를 희소하게. Pretendard를 한글 우선 본문으로, 형태는 살짝 둥글게.
  핵심 원칙은 "무대지 주인공이 아니다(stage, not spotlight)": collab5 비주얼은 절제하고 주인공 자리는 메이커 콘텐츠에 내준다.

# ─────────────────────────────────────────────
# TOKENS (machine-readable contract)
# components는 아래 토큰을 {colors.x}/{typography.x}/{rounded.x}/{spacing.x} 로 참조한다.
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
  cornflower: "#6e86d6"
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
  scrim: "#222222"              # 오버레이 백드롭(45% opacity로 렌더)

typography:
  # 서체: Pretendard(한글 우선). 웨이트 3개만(400/500/700). 문장형.
  display:       { fontFamily: "Pretendard", fontSize: 32px, fontWeight: 700, lineHeight: 1.2,  letterSpacing: -0.02em }  # 카드 히어로·랜딩
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
    height: 44px
    note: "화면당 1개 원칙. Kiwi는 여기서만 면으로 쓴다."
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border-strong}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    height: 44px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    height: 44px
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: 44px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    placeholderColor: "{colors.faint}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: 44px
    focus: "border {colors.focus} + 2px ring {colors.focus}"
  chip-choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.mute}"
    borderColor: "{colors.hairline}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    height: 32px
    padding: "0 12px"
    selected: "bg {colors.primary-pale} · border {colors.primary} · text {colors.primary-on}"
  switch:
    trackOff: "{colors.border-strong}"
    trackOn: "{colors.primary}"
    knob: "#ffffff"
    size: "44x26, knob 22"
    note: "즉시 적용. '콜라보 열림/닫힘' 토글의 기본형."
  tag-trust:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.mute}"
    checkColor: "{colors.success}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    note: "검증 가능한 신뢰 시그널(인증·홈피·인스타·주소)."
  tag-tone:
    backgroundColor: "{colors.mint-pale}"   # 또는 lemon-pale / cornflower-pale 로테이션
    textColor: "{colors.mint-on}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    height: 24px
    note: "AI distill 결(結) 칩 = 보조층. 신뢰 시그널보다 연하게 — '검증된 것'처럼 보이면 안 됨."
  badge-status:
    backgroundColor: "{colors.success-pale}"  # warning-pale/danger-pale/info-pale
    textColor: "{colors.success}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
  avatar:
    rounded: "{rounded.pill}"   # 브랜드 로고는 {rounded.md}
    sizes: "24 / 40 / 64"
    note: "메이커 로고 우선(우리 색 입히지 않음). 없으면 파스텔 틴트 이니셜."
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.4}"
    elevation: "{elevation.e0}"   # interactive 시 e1 + border-strong
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
    note: "스크롤 시 하단 {colors.hairline} 노출. sticky."
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
    maxWidth: 340px
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
> 변경은 디자인팀↔대표 합의 후 반영하고, 마스터브레인 로그에 한 줄 남긴다.

- 버전: **v0.9** (로딩 오버레이 §9.8 + enrich/등록 QA 반영)
- 최종 수정: 2026-06-21
- 멘탈모델: **모바일 청첩장 + 명함앱**
- 브랜드 소명: "소소하고 소중한 아기자기한 곳들이 자기 이야기를 세상에 더 펼쳐나가는 교두보."

---

## 0. 이 파일 쓰는 법 (for Claude & devs)

- **읽는 순서**: frontmatter 토큰 → 컴포넌트 정의 → 산문 규칙. 토큰 > 컴포넌트 > 패턴 (충돌 시 상위가 이김).
- **Claude/AI 빌드**: 색·간격·라운드·그림자는 반드시 토큰 변수를 쓴다(임의값 금지). 컴포넌트가 frontmatter에 있으면 그 스펙대로 쓰고 새로 만들지 않는다.
- **개발**: §2 CSS 변수 블록을 전역에 붙이거나 Tailwind preset 사용. 컴포넌트 = 토큰의 조합.
- **확장**: 새 원시값이 필요하면 먼저 frontmatter에 토큰으로 등록한 뒤 참조한다.

---

## 1. Overview

collab5는 **결 있는 로컬·인디 메이커**가 서로를 알아보고 콜라보하도록 잇는 제품이다. 기본 무드는 **"단단하지만 다정한(warm-premium)"** — 깔끔하고 절제된 프레임에 따뜻함·발랄함·약간의 귀여움을 얹는다(Airbnb의 따뜻한 마켓플레이스 감성 참고). 화면의 대부분은 웜 오프화이트 `{colors.canvas}` 또는 Night `{colors.ink}` 위에 잉크 텍스트로 차분하게 깔리고, **단 하나의 비비드 형광 Kiwi `{colors.primary}`** 가 "스파크"로 아주 아껴서 등장한다.

> **단일 브랜드 컬러 철학** — Airbnb(Rausch #ff385c)도 Wise(green #9fe870)도 *브랜드 색 하나를 희소하게* 써서 강력한 인지를 만든다. collab5의 Kiwi도 같다: 대부분 뉴트럴 + 한두 곳의 Kiwi 순간.

**Key Characteristics:**
- **단일 시그니처 Kiwi `{colors.primary}` (#98FF5C)** — 비비드(맑은 새싹 라임), 포인트 전용(CTA·활성·하이라이트). 면적 크게 깔지 않는다.
- **팝 액센트 패밀리** — Lemon·Cornflower(비비드, 보조 포인트) + 파스텔 틴트(Mint 등, 면적용). "메인은 비비드, 파스텔은 면적."
- **Night × Kiwi 다크 변형** — 잉크 배경 + 키위 글자/CTA. 형광이 가장 빛나는 곳(공유 썸네일·강조). (Wise `card-feature-dark` 패턴과 동형.)
- **Pretendard, 웨이트 3개(400/500/700), 문장형.** 한글 우선. 모던하고 누구에게나 쉽게.
- **살짝 둥근 형태** — 친근하되 절제. 보더 0.5px.
- **🎭 무대지 주인공이 아니다.** 사용자 콘텐츠(이미지·브랜드색·목소리)가 주인공. collab5 색은 그 위에서 절제.

### 타깃 페르소나 (톤의 기준)
- **자기 개성에 확신이 있는** 메이커(솔리드한 자기 무대 위 개성 표현 — 예: 보라 티셔츠 위 손그림 캐릭터).
- **결이 맞는 다른 메이커와의 콜라보를 기대**하는 사람 → "끼리끼리 알아보는" 큐레이션된 신뢰감.
- 함의: 제너릭·코퍼릿 금지. 표현적·크래프트한 손맛 OK(무대 원칙 내 절제).

---

## 2. Tokens — 복붙용 (CSS / Tailwind)

> frontmatter와 동일 값. 개발은 이 블록을 그대로 쓰면 된다.

```css
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
  --focus:#6e86d6;
  --r-sm:10px; --r-md:16px; --r-lg:22px; --r-xl:28px; --r-pill:9999px;
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --s-7:48px; --s-8:64px;
  --e1:0 1px 2px rgba(34,34,34,.06); --e2:0 4px 16px rgba(34,34,34,.10); --e3:0 8px 32px rgba(34,34,34,.14);
  --dur-fast:120ms; --dur-base:200ms; --dur-slow:320ms; --ease:cubic-bezier(.2,.8,.2,1);
  --font-sans:"Pretendard",-apple-system,BlinkMacSystemFont,system-ui,"Apple SD Gothic Neo",sans-serif;
}
[data-theme="dark"]{
  --canvas:#222222; --surface:#2c2c2a; --surface-soft:#33332f;
  --ink:#fbfaf6; --body:#b4b2a9; --mute:#888780; --faint:#6b6a63;
  --hairline:#3a3a36; --border-strong:#4a4a45; --primary-on:#222222; --focus:#9db3f0;
}
```

```js
// tailwind.config.js → theme.extend
colors:{ primary:{DEFAULT:'#98ff5c',strong:'#7ce63f',on:'#1f5c00',tint:'#d6ffc0',pale:'#ecffe0'},
  lemon:{DEFAULT:'#f2d81e',pale:'#fbf3b8'}, corn:{DEFAULT:'#6e86d6',pale:'#dce3f7'}, mint:{DEFAULT:'#b8e9c8'},
  canvas:'#fbfaf6', ink:{DEFAULT:'#222222',body:'#4a4a45',mute:'#6b6a63',faint:'#9b9a91'},
  line:{DEFAULT:'#e7e4da',strong:'#d8d5cb'} },
borderRadius:{sm:'10px',md:'16px',lg:'22px',xl:'28px',pill:'9999px'},
fontFamily:{sans:['Pretendard','-apple-system','system-ui','sans-serif']},
```

---

## 3. Colors (의도)

### Brand & Accent
- **Kiwi** `{colors.primary}` #98FF5C — 단일 시그니처(맑은 새싹 라임). primary CTA·활성·선택·하이라이트. **희소하게.** ⚠️ 라이트 배경에 **텍스트로 쓰지 않는다**(대비 부족) → 텍스트는 `{colors.primary-on}`.
- **Lemon / Cornflower** — 비비드 보조 포인트(팝 패밀리). 카테고리 구분·세컨더리 강조.
- **Mint + *-pale 틴트** — 파스텔, **면적용**(넓은 배경·태그). 비비드와 같은 자리에 겹치지 않는다.

### Surface
- **Canvas** `{colors.canvas}` (웜 오프화이트) = 라이트 기본. **Surface** = 카드 흰색. **Surface-soft** = 옅은 채움.
- **Night** `{colors.ink}` = 다크 기본/잉크. 다크는 collab5의 시그니처 무드(Kiwi 극대화).

### Text
- ink(primary) / body(보조) / mute(캡션) / faint(placeholder·disabled). 순서대로 옅어짐.

### Semantic (브랜드색과 분리)
- success/warning/danger/info + 각 -pale. ⚠️ **성공색에 Kiwi 금지** — Kiwi는 브랜드 스파크 전용(의미 혼선 방지). (Wise도 같은 규칙.)

---

## 4. Typography (의도)

- **Pretendard** 한 패밀리로 한글·숫자·영문 모두. fallback 시스템 스택.
- **웨이트 3개만** 400/500/700. **문장형(sentence case).**
- 스케일은 frontmatter `typography.*` 참조.
- **타입은 절제, 콘텐츠가 무게를 짊어진다** (Airbnb식). 단, 시그니처 큰 타입 = **카드의 메이커명/제목**을 `display`(32~40)로 크게 (확정). '주인공은 메이커' 원칙과 일치하는 시각적 무게중심.

### Note on Font
- **Pretendard 단독 확정** — 한글·라틴·숫자 모두 Pretendard(일관·심플). 별도 라틴 페어링 없음. 로고/워드마크만 개성 있는 서체 가능(로고 작업 시 결정).

---

## 5. Layout & Spacing
- **모바일 우선.** 본문 max-width 640px, **카드 공유뷰 420px**.
- 페이지 좌우 패딩: 모바일 16px, ≥768 24px. 그리드: `repeat(auto-fill,minmax(160px,1fr))` gap 12px.
- 베이스 4px(`spacing.*`). 컴포넌트 내부 8·12·16, 섹션 리듬 24·32·48.
- **여백 넉넉히** = warm-premium의 핵심. (단 검색·디렉토리는 카드 밀도 ↑ — Airbnb처럼 "열린 히어로 + 조밀한 마켓".)

## 6. Elevation
- `e0`(기본, 면+보더) → `e1`(살짝 뜬 카드) → `e2`(시트/드롭다운) → `e3`(모달/공유 카드). **남발 금지.**
- 다크는 그림자 약함 → **면 대비(canvas vs surface)** 로 깊이 표현(Wise식).

## 7. Shapes
- frontmatter `rounded.*`. 살짝 둥근 절제. 단일 보더 변(`border-left` 등)에는 라운드 주지 않는다.

---

## 8. Components

> 스펙은 frontmatter `components.*`. 아래는 핵심 의도/Do·Don't만.

- **Button** — primary(Kiwi, 화면당 1개)·secondary·ghost·danger. sizes sm44? (md 44 기본 / sm 36 / lg 52). ✅ 터치 ≥44. ❌ Kiwi primary 여러 개 나열, Kiwi 글자색.
- **Text Field / Textarea** — 라벨 위·헬퍼 아래. focus = `{colors.focus}` 링. 에러는 색+아이콘+문구(색만 금지).
- **Chip(choice/filter)** — 하드축 선택·검색 필터. 선택=`primary-pale` 면(파스텔 OK). ❌ 다수 칩 전부 비비드.
- **Switch** — 즉시 적용. '콜라보 받는 중' 등 상태 문구 동반.
- **Tag** — `tag-trust`(검증, 뉴트럴+체크) vs `tag-tone`(AI 결 칩, 파스텔). **둘을 시각적으로 구분**(보조를 검증처럼 강조 금지).
- **Card / Card-dark** — 기본 표면 / Night×Kiwi. interactive 시 hover 보더+e1.
- **List item · Search bar · Top bar · Bottom sheet · Dialog · Toast · Segmented · Tabs** — frontmatter 참조.
- **Avatar** — 메이커 로고 우선(우리 색 입히지 않음).

---

## 9. Patterns

### 9.1 ★ 청첩장 콜라보 카드 (히어로) — v1 확정 (2026-06-21)
**무대 원칙 최우선** — 받는 사람에게 보이는 건 *그 메이커*. 라이트=따뜻·접근 / 다크(Night×Kiwi)=임팩트(공유 썸네일 추천). 카드는 **시안이 아니라 템플릿(시스템)** — 아래 슬롯에 메이커 데이터가 바인딩됨.

**구조(세로, 모바일 max 420, 카드 radius 24, padding 20, e-3):**
1. 상단 라벨 — `● 콜라보 제안`(키위 점 + caption 11px). collab5 존재감은 여기까지만. *(상태배지 없음)*
2. 커버(무대) — 메이커 이미지(radius 16, height ~108). **없으면** 브랜드 틴트 + 이니셜 아바타 폴백.
3. 상호명(23px/700, -0.03em) + 결 한줄(13px text-2) — **같은 그룹(간격 4px)**.
4. 신뢰 시그널 행 — `tag`(검증된 것만, 뉴트럴, 인증=✓ success). 0개면 행 숨김.
5. 구분선(0.5px).
6. 제안 — 라벨(11px) + 본문(14px/lh1.6, 키워드 1개만 키위 하이라이트) + 하드축 `chip`(키위틴트) / 결 `tag-tone`(파스텔).
7. RSVP — `[관심 있어요]`(primary 키위, flex) + `[다음에요]`(ghost).
8. 푸터 — 아톰 마크 16px + "collab5로 만든 카드"(11px text-3, opacity).

**행간 리듬 (2단 — proximity):** 같은 그룹 내부 4~8px(예: 이름↔결 4) / **섹션↔섹션 18~22px** / 구분선 위아래 22 / RSVP 앞 24. line-height 본문 1.6. → "여백 넉넉히" 프리미엄.

**슬롯 맵 (변하는 콘텐츠 + 규칙):**
| 슬롯 | 변하는 것 | 규칙/폴백 |
|---|---|---|
| 커버 | 메이커 사진 | 없으면 브랜드틴트+이니셜 |
| 상호명 | 텍스트 | 2줄까지, 초과 말줄임 |
| 결 한줄 | 소개 | 1줄, 초과 말줄임 |
| 신뢰 시그널 | 인증·인스타·홈피·위치 (0~N) | **검증된 것만**, 0개면 숨김 |
| 제안 본문 | 콜라보 내용 | 키워드 1개만 키위 하이라이트 |
| 하드축 칩 | 유형/지역 (1~N) | 키위틴트, 넘치면 줄바꿈 |
| 결 칩 | AI distill (0~N) | 파스텔(보조층), 신뢰시그널과 시각 구분 |
| RSVP | 고정 | 관심(키위)/다음에요(ghost) |

- ✅ 메이커 이미지·브랜드색 최대 노출 · 신뢰 시그널은 검증된 것만 · 콘텐츠 길이/유무에 레이아웃 안 깨짐.
- ❌ collab5 Kiwi로 카드 전체 칠하기(주인공 침범) · AI 결 칩을 검증처럼 · 상태배지 추가.

### 9.2 업체 등록 폼
기본정보(상호·한줄·이미지) → 하드축 칩 → 결층(AI distill→`tag-tone` 교정) → description 폴리셔 → 콜라보 열림/닫힘 스위치. 하드축(검증·필터)과 결층(AI 보조) 시각·문구 분리.

### 9.3 무계정 열람 + RSVP(관심/패스)
로그인 없이 카드 열람 → 신뢰 체크 → `[관심 있어요]`/`[다음에요]`. "관심"=우리 도메인 측정(보조 지표). 가벼운 마이크로카피("부담 없이").

### 9.4 검색 + 결과 리스트
search-bar + 필터 chip → list-item / 카드 그리드. 개별 상세는 공개, '전체 둘러보기' 벽은 밀도 쌓일 때까지 절제(cold-start 안전).

### 9.5 Empty States (craft) — v1 확정 (2026-06-21)
빈 화면도 brand 결 유지. **아톰 마크를 흐리게(empty 아이콘)** + 격려 톤. 절대 차갑게 두지 않음.
- **Anatomy**: 아톰 아이콘(44px, 흐림) → 제목(15~17px/700, 1~2줄) → 보조설명(12~13px text-2, 1줄) → primary CTA(+선택 ghost). 가운데 정렬, 패딩 24.
- **아이콘 상태로 의미 표현**: 무결과=아톰 **아웃라인**(opacity .4) / 콜드스타트=**키위 핵 살아있음**(희망·새싹) / 404·만료=**점선 아톰**(opacity .3, 사라짐).
- **3종 카피(확정):**
  - 검색 무결과: "결이 맞는 곳을 아직 못 찾았어요" / "검색어·필터를 바꿔보거나 직접 등록해도 좋아요" / CTA `메이커 등록하기` + ghost `필터 초기화`
  - 콜드스타트(등록 0): "이곳의 첫 메이커가 되어보세요" / "결을 등록하면 콜라보 카드의 '집'이 생겨요" / CTA `30초 만에 등록하기`
  - 404·만료 카드: "사라졌거나 없는 카드예요" / "링크가 만료됐을 수 있어요" / CTA `collab5 둘러보기`(secondary)
- 구현: 아이콘은 `logo-mark-mono.svg`(currentColor) 재사용 → 색·다크 자동. 점선 변형은 `stroke-dasharray:3 3`.
- ✅ 격려·따뜻 / ❌ "데이터 없음" 식 무미건조 · 에러코드 노출 · collab5 비브랜드 일러스트.

### 9.6 온보딩 "이렇게 써요" (랜딩/첫 방문) — v1 확정 (2026-06-21)
3스텝 카드(랜딩 또는 첫 방문 시). 각: 아톰 라인 일러스트 → `STEP n`(11px/700 kiwi-on) → 제목(15px/700) → 보조(12px text-2, 1~2줄).
- STEP 1 **결을 등록해요** / "클릭 몇 번이면 끝. 공개 브랜드 페이지가 생겨요" (일러: 노드 형성)
- STEP 2 **콜라보 카드를 만들어요** / "제안할 상대·내용만 적으면 청첩장 같은 카드 완성" (일러: 카드+아톰)
- STEP 3 **보내고, 관심을 받아요** / "기존 채널로 링크 공유 → 상대가 무계정으로 열람·관심" (일러: 두 노드 점선 연결)

### 9.7 일러스트레이션 스타일 (아톰 라인 패밀리)
- **모티프 재활용**: 로고 아톰에서 파생 — 노드·궤도·연결선·새싹. 별도 캐릭터 X.
- **선**: stroke 1.6~2px, 라운드 캡/조인. 잉크(`--ink`) 선 + **키위 핵/포인트 1점**(과하면 분산).
- **면 채움 최소**: 틴트(`--primary-pale`/파스텔)만, 비비드 면 금지.
- **용도**: 온보딩·Empty·빈 일러스트 자리. **사용자 콘텐츠 영역엔 쓰지 않음**(무대 원칙).
- 모티프 3종 예: `연결`(두 노드+점선), `새싹·자람`(스템+잎), `아톰(코어)`(궤도+키위 핵).

### 9.8 로딩 오버레이 (긴 비동기 — enrich 등) — v1 확정 (2026-06-24)
enrich(AI 자동완성)처럼 **수 초~분** 걸리는 작업은 버튼 비활성만으론 부족 → **레이어 오버레이**로 진행을 알린다.
- **구성**: 딤 배경(`bg-ink/40`) + 중앙 카드(surface, radius-lg, e3, max-w 280) → ① **고정 아톰 마크**(작게 ~44px, **회전·맥동 X** — 어지럼 방지, 정적) ② 제목("○○의 결을 찾고 있어요") ③ **순환 상태 메시지**(2.4s 간격, 파이프라인 단계 반영: 웹 검색→정보 모음→결 읽기→카드로 담기) ④ 소요 안내("1~2분 걸릴 수 있어요").
- **원칙**: 움직임은 **텍스트 순환만**(로고는 정적). 스피너/회전 금지(브랜드 정체성·접근성). `role="status" aria-live="polite"`.
- ❌ 로고 회전·과한 모션 / "로딩…"만 표기 / 무한 대기 안내 없음.

---

## 10. Responsive

| 이름 | 폭 | 주요 변화 |
|---|---|---|
| Mobile | < 768px | 1-up 스택. 카드 공유뷰 풀폭. 바텀시트 기본. 하단 고정 CTA 바. |
| Tablet | 768–1023px | 그리드 2-up. 검색바 확장. |
| Desktop | ≥ 1024px | 그리드 3–4up. 본문 640 / 디렉토리 그리드 확장. 사이드 디테일. |

- 터치 타깃 ≥ 44×44. 그리드는 행 리플로우 대신 **열 수만** 줄인다.

## 11. Accessibility
- 대비 ≥ 4.5:1(큰 텍스트 3:1). **Kiwi 위 텍스트=`{colors.primary-on}`**.
- 모든 인터랙티브 키보드 접근 + 보이는 focus(`{colors.focus}` 2px).
- 색만으로 의미 전달 금지(아이콘/문구 동반) — 에러·상태·신뢰 시그널.
- `prefers-reduced-motion`·`prefers-color-scheme` 존중.

## 12. Do's & Don'ts (요약)
**Do** — Kiwi는 primary 행동에만 희소하게 · 뉴트럴 위에 색을 얹기 · 다크는 면 대비로 깊이 · 메이커 콘텐츠를 주인공으로.
**Don't** — 두 번째 브랜드 색 도입 금지 · Kiwi를 성공색/배경 대면적/글자색으로 · 한 화면 primary 여러 개 · AI 결 칩을 검증처럼 강조.

## 13. Known Gaps / TODO (v0.6)
- 풀 일러스트/온보딩 아트 가이드 · 카드 스트레스 테스트.
- ✅ 로고(§14) · ✅ 카드 v1(§9.1) · ✅ Empty States(§9.5) · ✅ 3+1화면 QA.
- 데스크탑 디테일·모션 디테일·아이콘 세트 픽스.
- ✅ Foundation 확정: 색(Kiwi #98FF5C)·라운드(B)·큰 타입(메이커명/카드제목)·캔버스(웜 오프화이트 중립)·글꼴(Pretendard 단독).

## 14. 로고 (Brand Mark)
- **마크 = "아톰(Atom)".** Kiwi 핵(=공유 기반=collab5) + 교차 궤도 2개 + 전자 3개(홀수). 의미 = *서로 다른 메이커(전자)가 하나의 중심을 공유하며 함께 돈다* = 콜라보.
- **잉크 = 딥블랙 `#111111`** (로고 전용 — UI 본문 잉크는 Night `#222` 유지). 핵 = Kiwi `#98FF5C`.
- **워드마크 = Pretendard 700, letter-spacing -0.03em, 소문자 `collab5`**, 딥블랙.
- **에셋** (`~/Desktop/collab5/assets/`):
  - `logo-mark.svg` (라이트) · `logo-mark-dark.svg` (다크 배경) · `logo-mark-mono.svg` (`currentColor` 1색) · `logo-lockup.svg` (마크+워드마크) · `favicon.svg`
- **배경별**: 라이트=딥블랙 선+키위 핵 / 다크(Night)=캔버스 선+키위 핵 / 키위 배경=딥블랙(모노).
- **여백(clear space)**: 마크 높이의 ≥25% 사방. **최소 크기**: 마크 16px(파비콘)까지.
- **Do/Don't**: ✅ 핵은 항상 Kiwi. ❌ 궤도·전자를 키위로(핵만 키위). ❌ 비례·각도 임의 변경·그림자·그라데이션·워드마크 폰트 교체.

## 15. Changelog
- v0.1 (06-21): Foundation 잠금.
- v0.2 (06-21): 토큰 계약(CSS/Tailwind)·컴포넌트 16종·패턴 4종(산문 표 형식).
- v0.3 (06-21): **frontmatter 토큰/컴포넌트 계약 도입**(Airbnb·Wise 분석 반영) · Overview/Key Characteristics/Responsive/Do·Don't/Known Gaps 재구성 · 톤 "warm-premium" 보정.
- v0.4 (06-21): **Foundation 완전 잠금** — 시그니처 색 #89E900→**#98FF5C**(맑은 새싹 라임) · 라운드 강도 **B**(sm10/md16/lg22/xl28/pill) · 큰 타입=메이커명·카드제목 · 캔버스 중립 · Pretendard 단독 확정.
- v0.5 (06-21): **로고 확정** = "아톰" 마크(키위 핵+교차 궤도 2+전자 3, 딥블랙 #111). SVG 에셋 5종 `assets/` 추가 · §14 로고 섹션 신설.
- v0.6 (06-21): **청첩장 카드 v1 확정** — §9.1에 구조·슬롯 맵·2단 행간 리듬(섹션 18~22px) 명시. 상태배지 삭제. 라이트/다크.
- v0.7 (06-21): **Empty States craft 확정**(§9.5, 아톰 모티프 3종) + 등록·공개상세·검색·카드 구현 QA(펀치리스트 → master-brain). 공통 P1=미검증 신뢰시그널 ✓ 표기.
- v0.8 (06-21): **온보딩 3스텝(§9.6)·일러스트 스타일(§9.7, 아톰 라인 패밀리)** 확정 + **카드 스트레스 테스트 통과**(이미지無·긴이름·신뢰0·칩多·미니멀 전부 레이아웃 유지).
- v0.9 (06-24): **로딩 오버레이 §9.8 확정·구현**(enrich 70~130s 대응 — 고정 아톰+순환 메시지, 회전 X) + 등록 QA 반영(미리보기 칩 pill). 디자인팀이 register/page.tsx·globals.css 직접 편집(대표 지시).
