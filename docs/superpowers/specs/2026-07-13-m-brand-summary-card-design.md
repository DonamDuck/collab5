# /m 브랜드 소개 페이지 상단 요약 카드 (BrandSummaryCard)

- 날짜: 2026-07-13
- 팀: 기획개발 2팀
- 대상 파일: `src/app/m/[slug]/page.tsx` (상단 `<header>` 교체) + 신규 `src/app/m/[slug]/BrandSummaryCard.tsx`
- 상태: 설계 승인됨 (대표, 2026-07-13)

## 배경 / 왜
현재 `/m/[slug]` 상단은 브랜드명 + 한 줄 소개 + 신뢰칩(인스타·홈피·주소)이 "둥" 떠 있는 느낌이라, 요약된 섹션처럼 정리돼 보이면 좋겠다는 피드백. 콜라보 제안 도구라는 성격상 상단이 **"이 브랜드 믿을 만하다(신뢰·정체성) + 한눈에 요약된다"**를 3초 안에 전달해야 함.

## 방향 (확정)
- 3초 각인 1순위 = **A(신뢰·정체성) + D(한눈 요약 카드)**.
- 레이아웃 = **C안: 통합 카드 + 신뢰 박스 분리** (상단 정체성 존 + 하단 신뢰정보 별도 박스).
- 비주얼 앵커 = **브랜드 로고(계정 프로필 이미지)**. 이미지 없으면 이미지 섹션 자체를 빼고 **텍스트 타이틀**(현재와 유사)로.
- 신뢰정보 = **라벨+값 리스트**, 이모지 아이콘 없이 깔끔하게.

## 컴포넌트 구조
신규 `BrandSummaryCard` 컴포넌트로 분리(현재 인라인 `<header>` 대체). 카드 아래 사진 슬라이더·본문 8섹션·링크복사는 전부 그대로.

```
BrandSummaryCard (server component)
├─ 카드 컨테이너: bg-surface · border border-hairline · rounded-md(16) · shadow-e1 · p-[18px]
├─ 정체성 존 (상단)
│  ├─ [로고] Avatar shape="square" size 56 — logoUrl 있을 때만 렌더 (이니셜 폴백 안 씀)
│  ├─ 우측 텍스트:
│  │  ├─ h1 이름 (24px/bold, text-ink) + 콜라보 뱃지(collabOpen시, bg-primary-pale·text-primary-on·rounded-sm)
│  │  ├─ oneLiner (15px, text-body)  ※있을 때만
│  │  └─ region (13px, text-faint)   ※있을 때만
│  └─ 우상단: EditButton (isOwner일 때만, 기존 컴포넌트 재사용)
└─ 신뢰 존 (하단, 값이 1개 이상일 때만)
   └─ 신뢰 박스: bg-surface-soft · rounded-sm(10) · p-[14px]
      └─ grid (라벨 70px + 값 1fr, row-gap 11)
         ├─ 인스타그램  →  @handle       (링크, 새 탭)
         ├─ 홈페이지    →  도메인         (링크, 새 탭)
         └─ 주소        →  주소 텍스트     (비링크)
```

### 이미지 없는 경우 (폴백)
- 로고 Avatar 렌더 안 함 (이니셜 동그라미도 안 씀).
- 정체성 존이 텍스트만 남음: 이름(타이틀) + 뱃지 + 소개 + 지역. 현재 헤더와 유사한 텍스트 타이틀 느낌.
- 신뢰 박스는 동일하게 유지.

## 데이터 소싱
- 로고 URL = 소유 계정의 `profileImage`. `/m`는 지금 `maker`만 조회하므로 `getProfile(maker.ownerUserId)`를 **추가 조회**. `maker.ownerUserId`(= owner_uuid)가 있을 때만(미클레임 카드는 owner 없음 → 폴백).
- 기존 `getSessionUser()`와 **`Promise.all`로 병렬 조회**하여 왕복을 늘리지 않음.
- `profileImage` 빈 문자열/owner 없음 → `logoUrl` = undefined → 폴백 경로.

## 신뢰 박스 동작
- 인스타그램/홈페이지 = 값 자체가 링크. 기존 `TrustLink`의 `href` 생성(`instagramUrl`/`normalizeUrl`)·표시(`instagramHandle`/`prettyUrl`)·`target="_blank" rel="noopener noreferrer nofollow"` 로직 재사용.
  - 아이콘(이모지) 제거. 클릭 가능 신호는 **호버 시 밑줄 + text-ink→hover:text-primary-on**로만.
- 주소 = 텍스트(비링크).
- 세 값 모두 없으면 신뢰 박스 통째로 렌더 안 함.

## 디자인 토큰 (design.md / globals.css 기준)
- 색: `surface`(#fff) · `surface-soft`(#f4f2ec) · `hairline`(#e7e4da) · `ink`(#222) · `body`(#4a4a45) · `mute`(#6b6a63) · `faint`(#9b9a91) · `primary-pale`(#ecffe0) · `primary-on`(#1f5c00).
- radius: 카드 `rounded-md`(16), 신뢰박스 `rounded-sm`(10), 뱃지 `rounded-sm`.
- shadow: `shadow-e1`.
- Avatar: `shape="square"`(브랜드 로고는 원형 크롭 안 함 — design.md §Avatar), size 56(표준 스텝).
- 폰트 웨이트: 이름 bold, 값 medium, 라벨 regular.

## 반응형
- 컨테이너 `max-w-[640px]` 모바일 우선. 카드 내부 세로 스택 구조라 모바일 안전. 긴 주소/핸들은 wrap.

## 범위 밖 (안 건드림)
- 사진 슬라이더(`PhotoSlider`), 본문 8개 섹션, 링크복사(`CopyLinkButton`).
- 인증/미들웨어 흐름.

## 검증
- `npx tsc --noEmit` + `npm run build` 통과.
- 로컬은 Supabase env 미설정(mock)이라 실데이터 렌더는 prod 확인. 목업(위젯) 기준 시각 확정.
- prod 확인: 로고 있는 카드(예: canvasgarden) + 로고 없는 카드(폴백) 둘 다 점검.

## 병렬작업 주의
1팀도 `/m/[slug]`를 만짐(과거 loading.tsx·MakerRow 충돌 이력). 착수·병합 전 `git fetch` + vault 확인.
