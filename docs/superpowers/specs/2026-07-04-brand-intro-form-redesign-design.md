# 브랜드 소개서 폼 전면 개편 — 설계

- 날짜: 2026-07-04
- 출처 기획: Notion "브랜드 소개서 아이데이션" (id 393a36ae2623803786d7cb4a7dc9e3ec)
- 상태: 승인됨 (2026-07-04 브레인스토밍)

## 목표

소개서는 회사 설명서가 아니라, **읽는 사람이 "이 브랜드와 한번 이야기해보고 싶다"** 라는 생각이 들게 하는 **인터뷰형 문서**다. `/register` 폼을 노션 기획 기준 8섹션으로 재구성한다.

이번 범위 = **수기 입력 폼 + 데이터 저장 + 카드(/c)·프로필(/m) 노출**.
AI 크롤링(위저드·초안받기)은 기존 동작 유지, 새 필드 자동채움은 **다음 스텝**.

## 폼 구조 (8섹션)

| # | 타이틀 | subtitle | 입력 |
|---|---|---|---|
| 1 | 브랜드를 소개해주세요. | (없음) | 상호(input) · 한 줄 소개(input) · **자세히 소개(textarea)** · **브랜드 사진 최대 10장** |
| 2 | 왜 이 브랜드를 시작하셨나요? | 시작하게 된 계기를 편하게 적어주세요. | `story` textarea (신규) |
| 3 | 우리 브랜드를 표현하는 키워드를 골라주세요. | (없음) | 기존 뱃지(4카테고리·최대 10) |
| 4 | 주로 어떤 활동을 하나요? | 대표 활동을 최대 3가지 소개해주세요. 사진도 담을 수 있어요. | `activities` 최대 3개 × {제목 · 한 줄 설명 · 사진 최대 3장} (신규) |
| 5 | 어떤 협업을 할 수 있나요? | 제공할 수 있는 협업을 자유롭게 작성해주세요. | `offersNote` textarea(신규) + 유형 칩(offers) |
| 6 | 이런 파트너를 찾고 있어요. | 파트너와 꿈꾸는 협업 유형을 알려주세요. | `seeksNote` textarea(신규) + 유형 칩(seeks) |
| (6.5) | 함께한 콜라보 | 지난 콜라보를 더하면 "검증된 파트너"라는 신호가 돼요. | 기존 유지 + **콜라보 1건당 사진 최대 3장**(신규) |
| 7 | 저희는 주로 이런 고객과 함께하고 있어요. | (없음) | 기존 targetAudience |
| 8 | 브랜드 정보를 입력해주세요. | (없음) | 기존 주소 · 인스타그램 · 홈페이지 |

- 섹션 순서·번호는 노션 기준. "함께한 콜라보"는 노션엔 없지만 신뢰 시그널로 유지(6과 7 사이).
- 자세히 소개(1번 textarea) = 기존 `description`(→ `trust.description`) 그대로 사용. "초안 받기" AI 버튼도 유지.

## 데이터 모델 (Maker 확장)

신규/변경 필드:

```ts
interface Maker {
  // ... 기존 유지 (name, oneLiner, offers, seeks, targetAudience, soul.values, trust, photos ...)
  story: string;                 // 신규 — 왜 시작했나
  activities: Activity[];        // 신규 — 대표 활동 최대 3
  offersNote: string;            // 신규 — 협업 직접 설명
  seeksNote: string;             // 신규 — 파트너 직접 설명
  collabHistory: CollabHistory[];// 유지 + 항목에 photos 추가
  photos: string[];              // 기존, 최대 4 → 10
}

interface Activity { title: string; desc: string; photos: string[]; } // photos 최대 3
interface CollabHistory { partner: string; types: string[]; year?: string; photos: string[]; } // photos 최대 3 추가
```

- `trust.description` = 1번 "자세히 소개" (기존 매핑 유지).
- 사진은 전부 클라 리사이즈 후 data URL(base64) 저장(기존 MVP 방식 계승).

## CollabType enum 병합 (7개)

노션 라벨 + 공간대여:

```
제품콜라보 · 팝업 · 워크숍 · 공동굿즈 · 공동콘텐츠 · 행사참여 · 공간대여
```

- 기존 enum(`공간대여/제품컬래버/워크숍/팝업/굿즈/콘텐츠/행사참여`) → 위 7개로 교체.
- 영향처 함께 갱신: `types.ts` CollabType, register 칩, 카드(/c)·프로필(/m) 칩, 검색, 시드 데이터, collabHistory 유형 칩.
- 시드 makers의 기존 라벨을 새 라벨로 정정.

## 저장 / 스키마 (Supabase)

`makers` 테이블 신규 컬럼(대표가 SQL 실행):

```sql
ALTER TABLE makers ADD COLUMN IF NOT EXISTS story       TEXT  NOT NULL DEFAULT '';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS activities  JSONB NOT NULL DEFAULT '[]';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS offers_note TEXT  NOT NULL DEFAULT '';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS seeks_note  TEXT  NOT NULL DEFAULT '';
-- collab_history(JSONB)·photos(JSONB)는 이미 존재. photos는 최대 10으로 UI만 변경.
```

- repo(MakerRow·rowToMaker·createMaker), actions(RegisterInput·createMakerAction) 배선.
- InMemory는 `{...input}` 자동 반영, 시드에 기본값 채움.

## 카드(/c)·프로필(/m) 노출

- **story**: "소개"와 별개로 "브랜드가 시작된 이야기" 블록.
- **activities**: 활동별 제목·설명 + 사진 슬라이드(PhotoSlider 재사용).
- **offersNote/seeksNote**: 협업/파트너 칩 위에 직접 작성 문구 노출.
- **collabHistory 사진**: 이력 항목에 사진 슬라이드(작게).
- 컴팩트 유지 원칙 안에서 배치. 폰트는 최근 확대 스케일 유지.

## 사진 처리 / 한도

- 사진 총량 증가(브랜드10 + 활동 3×3 + 콜라보 3×3 = 최대 28장).
- 완화: **브랜드 사진 1000px, 활동·콜라보 사진 800px**로 리사이즈(더 작게), JPEG q0.75.
- `next.config` serverActions `bodySizeLimit` 6mb → **12mb**로 상향.
- 사진량이 더 커지면 Supabase Storage 이전이 정석(향후 과제).

## 범위 밖(다음 스텝)

- AI 크롤링(위저드 불러오기·초안받기)이 story·activities·offersNote·seeksNote를 자동 채우는 것.
- 이번엔 이 필드들은 **수기 입력만**. 위저드는 기존 채우던 필드(name·oneLiner·description·values·주소·인스타·홈피)만 계속 담당.

## 리스크 / 결정 로그

- base64 다중 사진 → 행 크기·서버 한도 압박. 리사이즈 강화 + 한도 상향으로 MVP 대응, Storage는 향후.
- CollabType 라벨 교체 → 기존 prod maker의 옛 라벨 데이터는 그대로 남음(초기 테스트라 허용). 시드만 정정.
- 함께한 콜라보 유지 = 노션 플랜 외 결정(2026-07-04, 신뢰 시그널 가치).
