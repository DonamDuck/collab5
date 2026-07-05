# 설계: 가입·로그인 + 소개서 소유권 (수정 비밀번호)

Date: 2026-07-05 (2026-07-05 갱신: 소유권 A관리키 → **B비밀번호**로 전환)
Topic: Supabase Auth 기반 가입/로그인 + 익명 생성 소개서의 수정 비밀번호/계정 귀속 + 수정 권한 + 내 소개서

## 목표

한 문장: 이메일 가입/로그인을 열고, 익명으로 만든 소개서를 **생성 시 설정한 수정 비밀번호**(또는 로그인 시 계정 자동 귀속)로 지켜 — 소유자만 수정할 수 있게 한다.

**핵심 문제 (대표 정의):** 비회원이 소개서를 만들면 링크는 누구나 보는데 수정 권한을 줄 대상을 모른다. 링크 공유받은 타인이 가로채면 안 된다.
**해법(B):** 생성 시점에 **수정 비밀번호**를 받아 해시로 저장. 수정 시 비번 일치해야 진입 → 기기·브라우저 무관·영구적. 관리 키(localStorage/링크)의 약점(기기 넘김·휘발성) 회피.

## 결정 사항 (브레인스토밍 확정)

1. **가입 방식:** 이메일+비밀번호 코어. **카카오 소셜 병행**(Supabase Auth 프로바이더) — 구현 지연 시 카카오만 백로그로 이동.
2. **소유권 = B안 수정 비밀번호:**
   - 비회원 생성 → 완료 얼럿에서 **수정 비밀번호 1회 입력(필수, 규칙 없음, 확인창 없음)** → 서버가 해시(`claim_token_hash` 재활용)로 저장. 분실 시 고객센터로만 복구(지금은 안내만).
   - 로그인 상태 생성 → 비번 불필요, **`owner_user_id`로 즉시 계정 귀속**.
3. **가입 필드:** 이메일 · 비밀번호(+확인) · 휴대폰번호 · **브랜드명(필수)** · **로고/브랜드 사진(선택·1장)** · 개인정보 수집·이용 동의(필수 체크).
4. **내 소개서(/my):** 미니멀 리스트 + **빈 상태에 [소개서 만들기]·[기존 소개서 연결하기]**(URL/슬러그+비번으로 귀속).
5. **헤더 아바타:** 원형 — 프로필 사진 있으면 사진, 없으면 **브랜드명 첫 글자**(예: 송영덕→"송"). 추후 '찾기' 카드에서도 재사용할 공용 컴포넌트.
6. 가입 완료 → 완료 얼럿 → /login 이동(자동 로그인 X). 로그인 성공 → 홈. 이메일 인증 단계 없음(콘솔에서 confirm off).
7. **수정 화면 = 기존 /register 폼 재사용**(프리필 + update). 새 화면 안 만듦.
8. **소개서 페이지 우상단 [수정] 버튼** + **모바일 [링크 복사] 플로팅 버튼**(스크롤 따라다님).

## 기술 토대

- **Supabase Auth** + `@supabase/ssr`(쿠키 세션). 브라우저/미들웨어는 anon 키 — **테이블 정책과 무관하므로 RLS 잠금 그대로 안전.**
- **데이터 접근은 기존대로 서버(service_role)만.** 소유권 검사 = 서버 액션에서 `세션 user.id === maker.owner_user_id`.
- 신규 env(Vercel + 로컬): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon 키는 공개 설계 — RLS 잠금이라 데이터 접근 불가, Auth만 가능).
- **대표 콘솔 작업:** ① Vercel env 2개 추가 ② Supabase Auth: Confirm email **off**, Site URL=`https://collab5.vercel.app`, Redirect URLs에 `/reset-password/update` 추가 ③ (카카오 시) 카카오 디벨로퍼스 앱 등록 → Supabase 프로바이더에 키 입력 ④ 아래 DB 마이그레이션 실행.
- 이메일(비번 재설정)은 Supabase 기본 발송 사용 — 별도 메일 서버 불필요. ⚠️ 무료 기본 SMTP는 시간당 발송 제한(소량) → 유저 늘면 커스텀 SMTP(백로그).

## DB 마이그레이션 (대표가 SQL Editor 실행)

```sql
ALTER TABLE makers ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE makers ADD COLUMN IF NOT EXISTS claim_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_makers_owner ON makers(owner_user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  profile_image TEXT NOT NULL DEFAULT '', -- 리사이즈 base64 data URL (Storage 이전 전 MVP)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; -- 정책 없음 = anon 잠금(서버 service_role만)
```

## 화면/플로우

### 헤더 (전 페이지 공용 nav)
- 비로그인: `[로그인]` 버튼.
- 로그인: **원형 아바타**(사진 or 브랜드명 첫 글자) + 드롭다운(또는 나란히): `내 소개서` · `로그아웃`.
- 공용 `<Avatar image?: string, name: string, size>` 컴포넌트 — 사진 없으면 `bg-primary-tint`류 원 + 첫 글자. '찾기' 카드에서 재사용 전제.

### /login
- 이메일 · 비밀번호 · [로그인] · (카카오로 시작하기) · 하단 링크: 회원가입 / 비밀번호 찾기.
- 성공 → `/`(홈). 실패 → 인라인 에러("이메일 또는 비밀번호를 확인해주세요.").

### /signup
- 필드: 이메일 / 비밀번호 / 비밀번호 확인 / 휴대폰번호 / 브랜드명(필수) / 로고 또는 브랜드 사진(선택 1장, 클라 리사이즈 400px→base64) / ✔ 개인정보 수집·이용 동의(필수).
- 제출: `auth.signUp` → `profiles` upsert(brand_name·phone·profile_image, 서버 액션/service_role) → **완료 얼럿**("가입이 완료됐어요! 로그인해주세요.") → /login.
- 유효성: 이메일 형식·비번 6자+·비번 확인 일치·동의 체크 필수. 한글 IME Enter 가드 준수.

### /reset-password
- 이메일 입력 → `resetPasswordForEmail(redirectTo=/reset-password/update)` → "재설정 링크를 보냈어요" 안내.
- `/reset-password/update`(링크 랜딩): 새 비밀번호 입력 → `updateUser` → /login.

## 소유권 — 수정 비밀번호 메커니즘 (B안)

### 저장 필드
- `makers.owner_user_id`(UUID, nullable) — 로그인 유저가 만들거나 연결하면 세팅.
- `makers.claim_token_hash`(TEXT, nullable) — **수정 비밀번호의 해시**로 재활용(SHA-256). 익명 생성 시 세팅, 계정 연결되면 유지(연결 후에도 비번은 남겨둠 — 소유자면 어차피 비번 불필요).

### 생성 (createMakerAction)
- **로그인 상태:** `owner_user_id = user.id`, 비밀번호 불필요. RegisterInput에 세션 여부는 서버가 판단.
- **비회원:** 완료 얼럿에서 받은 **수정 비밀번호(필수)**를 서버로 전송 → `claim_token_hash = sha256(pw)` 저장. 규칙 검증 없음(빈 값만 거부).
- 반환: `{ slug }`. (비번 원문은 저장/반환 안 함)

### 완료 얼럿 (2버전, 확정 카피)
- **비회원:** 타이틀 `✨ 브랜드 소개서가 완성됐어요!` / 안내 `이제 링크를 복사해 협업을 제안해 볼 수 있어요! 비회원 상태라 관리용 비밀번호를 입력해주세요.` / 입력 `소개서 관리 비밀번호 * (입력 규칙 없음)` 1회 / 도움말 `잊어버리면 고객센터를 통해서만 찾을 수 있으니 기억해주세요.` / 버튼 `소개서 확인하러 가기`(비번 있어야 활성) → 제출(비번 저장) 후 `/m/{slug}` 이동 / 버튼 하단 작게 `언제든 '내 소개서'에서 수정할 수 있어요.`
- **회원:** 타이틀 동일 / 안내 `브랜드 소개서 페이지에서 내용을 확인해보세요.` + `이제, 링크를 복사해 협업을 제안할 수 있어요.` / 입력 없음 / 버튼 `소개서 확인하러 가기` → `/m/{slug}` / 하단 작게 `언제든 '내 소개서'에서 수정할 수 있어요.`
- 회원/비회원 분기: register 페이지가 세션 유무를 prop(서버에서 주입)으로 받아 얼럿 버전 선택.

### 소개서(/m/[slug]) 우상단 [수정] 버튼 — 판정
| 상태 | 동작 |
|---|---|
| 로그인 && owner_user_id === user.id | 바로 수정 진입 |
| 그 외 (비번 필요) | **비밀번호 입력 모달** → `verifyMakerPasswordAction(slug, pw)` 해시 대조 → 통과 시 수정 진입(+ 로그인 상태면 상단 배너 "내 계정에 연결하면 다음부턴 비번 없이 수정돼요 → [연결하기]") |
| 비번 틀림 | 인라인 에러 "비밀번호가 일치하지 않아요." |

- **[연결하기]**(로그인 상태에서 비번으로 진입했을 때만): `claimMakerAction(slug, pw)` — 비번 재검증 → `owner_user_id = user.id`. 이미 다른 owner면 거부.
- 검증·연결·수정은 전부 서버 액션(service_role). 비번은 해시 대조만.

### 링크 복사 버튼 (모바일 플로팅)
- 소개서 페이지 하단 [🔗 링크 복사]는 유지. **모바일(≤sm)에서는 우하단 플로팅 버튼**으로도 노출(스크롤 따라다님, `fixed bottom-4 right-4`). 데스크탑은 기존 하단 버튼만.
- 공유 링크엔 어떤 비밀정보도 없음(그냥 `/m/{slug}`) — 비번 방식이라 URL 가로채기 무의미.

### 수정 흐름
- `/register?edit={slug}`: 서버(RSC)에서 권한 재검증 —
  - 로그인 소유자면 통과.
  - 아니면 **연결 토큰**(수정 버튼의 비번 검증 통과 시 서버가 발급한 1회성 세션 플래그/서명값)이 있어야 통과. 구현: 비번 검증 성공 시 서버가 짧은 수명 **HttpOnly 쿠키**(`edit_grant_{slug}`)를 심고, edit 페이지가 그 쿠키를 확인.
  - 권한 없으면 `/m/{slug}`로 되돌림.
- 폼 프리필(사진=기존 base64 미리보기) → 제출 시 `updateMakerAction(slug, input)`(신규 생성 아님, slug 유지).

## /my — 내 소개서
- 로그인 필수(비로그인 → /login).
- 상단: 아바타 + 브랜드명. 목록: 내 소유 maker 카드(이름·한 줄·[보기]·[수정]).
- **0건 빈 상태:** "아직 연결된 소개서가 없어요." + **[소개서 만들기]**(→/register) · **[기존 소개서 연결하기]**.
- **[기존 소개서 연결하기]:** 소개서 링크(전체 URL 또는 `m-xxxx` 슬러그) + 수정 비밀번호 입력 → `claimBySlugAction(slugOrUrl, pw)`(URL에서 슬러그 파싱) → 비번 검증 → `owner_user_id = user.id`. "링크를 모르겠어요" → 찾기(/search)로 안내(등록 브랜드는 검색에 노출되니 본인 것 찾아 링크 확보).

## 엣지/에러
- **레거시 소개서**(비번·주인 없음): 비번 없어 연결 불가. 실데이터는 캔가 1건(`m-6tjod7`) → 대표가 SQL 수동 귀속:
  `UPDATE makers SET owner_user_id='(대표 user_id)' WHERE slug='m-6tjod7';` (user_id는 가입 후 Supabase Auth Users에서 확인)
- 비번 분실 = 복구 불가(고객센터 안내만, Phase 2). 
- 세션 만료 중 제출 → 비회원 취급(비번 요구). 로그인 유지면 자동 귀속.
- 카카오 로그인 계정도 소유/연결 동작 동일.
- ⚠️ **로컬 mock(env 없음):** 소유권·비번·claim은 DB 필요 → 로컬에선 UI만 확인, 실검증은 prod.

## 영향 파일 (플랜 B)
- 수정: `lib/types.ts`·`repo.ts`(Maker에 ownerUserId·claimTokenHash + row 매핑, createMaker/updateMaker/verify/claim) · `lib/actions.ts`(create에 비번/세션 귀속, `verifyMakerPasswordAction`·`claimMakerAction`·`claimBySlugAction`·`updateMakerAction`) · `app/register/page.tsx`(완료얼럿 2버전+비번칸, edit 모드 프리필/update) · `app/register`용 세션 prop 주입 · `app/m/[slug]/page.tsx`(우상단 수정 버튼) + 비번 모달 클라 컴포넌트 · `CopyLinkButton`(모바일 플로팅) · `app/my/page.tsx`(목록+연결 UI) · `supabase/schema.sql`(플랜 A에서 이미 컬럼 추가됨).

## 구현 분할
- **플랜 A — 인증 기반: ✅ 완료·배포** (Supabase Auth·미들웨어·login·signup·reset·헤더·/my 껍데기).
- **플랜 B — 소유권·수정 (이번):** repo/types 소유권 + create 비번·귀속 + 완료얼럿 2버전 + 수정 버튼·비번모달·edit(update) + /my 목록·연결 + 모바일 플로팅 링크복사.

## ⚠️ 배포 후 UX 검증 게이트 (대표 확인 필수)
- 플랜 B 배포 후 **비밀번호 소유권 UX(비회원 생성→비번→나중에 수정/연결)를 대표가 직접 써보고 판정**한다. 여전히 어색하면 대안(가입 강제 등) 재논의.

## 테스트/검증
- tsc·eslint 클린. 가입→완료얼럿→로그인→홈, 비번찾기 메일→재설정→로그인.
- 익명 생성→관리링크 복사→다른 브라우저에서 key로 수정 진입→가입→연결→토큰 무효 확인.
- 공유 링크에 key 미포함, key 없는 제3자 수정 불가, 이미 귀속된 소개서 재클레임 거부.
- 로그인 상태 생성→자동 귀속→/my에 노출→수정→반영.
