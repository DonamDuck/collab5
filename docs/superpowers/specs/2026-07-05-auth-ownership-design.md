# 설계: 가입·로그인 + 소개서 소유권 (관리 키 클레임)

Date: 2026-07-05
Topic: Supabase Auth 기반 가입/로그인 + 익명 생성 소개서의 계정 귀속(관리 키) + 수정 권한 + 내 소개서

## 목표

한 문장: 이메일 가입/로그인을 열고, 익명으로 만든 소개서를 **관리 키(클레임 토큰)**로 안전하게 계정에 귀속시켜 — 소유자만 수정할 수 있게 한다.

**핵심 문제 (대표 정의):** 비회원이 소개서를 만들면 링크는 누구나 보는데 수정 권한을 줄 대상을 모른다. 링크 공유받은 타인이 가로채면 안 된다.
**해법:** 생성 시점에 만든 사람에게만 비밀 증표(관리 키)를 지급. 공유 링크에는 절대 포함하지 않음.

## 결정 사항 (브레인스토밍 확정)

1. **가입 방식:** 이메일+비밀번호 코어. **카카오 소셜 병행**(Supabase Auth 프로바이더) — 구현 지연 시 카카오만 백로그로 이동.
2. **소유권 증표 = A안 관리 키:** 생성 시 서버가 토큰 발급(해시 저장) → localStorage 자동 + 완료 팝업 "관리 링크". 수정 버튼에서 계정 연결 유도.
3. **가입 필드:** 이메일 · 비밀번호(+확인) · 휴대폰번호 · **브랜드명(필수)** · **로고/브랜드 사진(선택·1장)** · 개인정보 수집·이용 동의(필수 체크).
4. **내 소개서(/my) 미니멀 리스트 포함.**
5. **헤더 아바타:** 원형 — 프로필 사진 있으면 사진, 없으면 **브랜드명 첫 글자**(예: 송영덕→"송"). 추후 '찾기' 카드(브랜드명+사진 노출 예정)에서도 재사용할 공용 컴포넌트로.
6. 가입 완료 → 완료 얼럿 → /login 이동(자동 로그인 X). 로그인 성공 → 홈. 이메일 인증 단계 없음(콘솔에서 confirm off).
7. 수정 화면 = 기존 /register 폼 재사용(프리필 + update). 새 화면 안 만듦.

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

## 소유권 — 관리 키 메커니즘

### 발급 (createMakerAction)
- 로그인 세션 있으면: `owner_user_id = user.id`, 토큰 발급 안 함.
- 익명이면: `crypto.randomUUID()` 토큰 생성 → **SHA-256 해시만 DB 저장**(`claim_token_hash`) → 토큰 원문을 응답으로 1회 반환.
- 클라: `localStorage["collab5_claim_" + slug] = token` + 완료 팝업에 **[관리 링크 복사]**(`/m/{slug}?key={token}`) 버튼 + 경고 문구("이 링크가 있어야 나중에 수정할 수 있어요. 계정에 연결하면 링크 없이도 수정돼요.").
- **공유용 CopyLinkButton은 key를 절대 포함하지 않음**(현재 URL에서 `?key` 제거 후 복사).

### 소개서(/m/[slug]) 하단 [수정] 버튼 — 판정 매트릭스
| 상태 | 동작 |
|---|---|
| 로그인 && owner_user_id === user.id | 수정 진입 |
| 관리 키 보유(?key= 또는 localStorage) → 서버 액션으로 해시 대조 통과 | 수정 진입 + 상단 배너 "내 계정에 연결하면 어디서든 수정할 수 있어요 → [연결하기]" |
| 그 외 | 안내 모달: "관리 링크로 접속하거나, 소개서를 만든 계정으로 로그인해주세요." |

- **[연결하기]** = 비로그인 시 /login(returnTo 유지) → `claimMakerAction(slug, token)`: 해시 검증 → `owner_user_id = user.id`, `claim_token_hash = NULL`(토큰 무효화). 이미 owner 있으면 거부.
- 검증·클레임·수정은 전부 서버 액션(서비스롤) — 클라 우회 불가.

### 수정 흐름
- `/register?edit={slug}&key={token}`(키 방식) 또는 `/register?edit={slug}`(소유자): 서버에서 권한 재검증 → maker 데이터 프리필(사진은 기존 base64를 그대로 미리보기) → 제출 시 `updateMakerAction`(신규 생성 아님, slug 유지).
- 권한 없으면 /m/[slug]로 되돌림.

## /my — 내 소개서
- 로그인 필수(비로그인 → /login).
- 상단: 아바타 + 브랜드명. 목록: 내 소유 maker 카드(이름·한 줄·[보기]·[수정]). 0건이면 "아직 연결된 소개서가 없어요 → [소개서 만들기]".

## 엣지/에러
- **레거시 소개서**(토큰·주인 없음): 클레임 불가. 실데이터는 캔가 1건 → 대표가 SQL 수동 귀속:
  `UPDATE makers SET owner_user_id='(대표 user_id)' WHERE slug='m-6tjod7';`
- 관리 링크 분실+브라우저 변경 = 복구 불가(Phase 2 백로그 — 지금은 재작성 안내).
- 세션 만료 중 제출 → 익명 취급(토큰 발급). 로그인 유지되면 자동 귀속.
- 카카오 로그인 계정도 클레임·소유 동작 동일.

## 영향 파일 (신규/수정 개요)
- 신규: `lib/supabase/`(browser·server 클라이언트) · `app/login` · `app/signup` · `app/reset-password`(+`/update`) · `app/my` · `components/Avatar.tsx` · auth 서버 액션(`lib/auth-actions.ts`) · 미들웨어(세션 갱신)
- 수정: `lib/types.ts`·`repo.ts`(ownerUserId·claimTokenHash·profiles) · `lib/actions.ts`(create 토큰/귀속·claim·update) · `app/register/page.tsx`(edit 모드 프리필·완료팝업 관리링크) · `app/m/[slug]`(수정 버튼+판정) · nav 헤더 · `supabase/schema.sql`

## 구현 분할 (플랜 2개)
1. **플랜 A — 인증 기반:** Supabase Auth 셋업·미들웨어·/login·/signup(프로필 포함)·/reset-password·헤더(아바타)·/my 빈 껍데기.
2. **플랜 B — 소유권·수정:** DB 컬럼·토큰 발급/완료팝업·수정 버튼 판정·claim·edit 모드(update)·/my 목록·CopyLinkButton key 제거.

## 테스트/검증
- tsc·eslint 클린. 가입→완료얼럿→로그인→홈, 비번찾기 메일→재설정→로그인.
- 익명 생성→관리링크 복사→다른 브라우저에서 key로 수정 진입→가입→연결→토큰 무효 확인.
- 공유 링크에 key 미포함, key 없는 제3자 수정 불가, 이미 귀속된 소개서 재클레임 거부.
- 로그인 상태 생성→자동 귀속→/my에 노출→수정→반영.
