# Implementation Plan: 인증 기반 (플랜 A)

Date: 2026-07-05
Spec: [docs/superpowers/specs/2026-07-05-auth-ownership-design.md](../specs/2026-07-05-auth-ownership-design.md)

## Goal
Supabase Auth로 가입(브랜드 프로필 포함)·로그인·로그아웃·비밀번호 재설정과 헤더 아바타·/my 골격을 만든다. (소유권·클레임·수정 = 플랜 B)

## Architecture
- 세션 = `@supabase/ssr` 쿠키 기반. 미들웨어가 세션 갱신. Auth는 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`(anon)로 — 테이블은 RLS 잠금이라 anon으로 데이터 접근 불가(안전).
- profiles 데이터 접근은 기존 패턴대로 **서버 + service_role**(`lib/profiles.ts`).
- **env 없으면 전부 우아하게 무력화**: 미들웨어 no-op, 헤더는 로그인 버튼만, auth 페이지는 안내 문구. (로컬 .env.local에 Supabase 키 없음 — 대표가 넣기 전까지 로컬은 UI만 확인)
- 카카오 버튼은 `NEXT_PUBLIC_KAKAO_ENABLED === "1"`일 때만 렌더(카카오 앱 등록 전 깨진 버튼 방지).

## Tech Stack
Next.js 16(App Router, 미들웨어) · React 19 · TS · Tailwind v4 · @supabase/ssr + @supabase/supabase-js.

## Files
CREATE src/lib/supabase/server.ts
CREATE src/lib/supabase/client.ts
CREATE src/middleware.ts
CREATE src/lib/profiles.ts
CREATE src/lib/auth-actions.ts
CREATE src/components/Avatar.tsx
CREATE src/components/SiteHeader.tsx
CREATE src/app/login/page.tsx
CREATE src/app/signup/page.tsx
CREATE src/app/reset-password/page.tsx
CREATE src/app/reset-password/update/page.tsx
CREATE src/app/my/page.tsx
MODIFY src/app/layout.tsx
MODIFY supabase/schema.sql

---

## Task 1: 의존성 + Supabase 클라이언트 헬퍼 + 미들웨어

**Goal:** ssr 세션 인프라. env 없으면 전부 no-op.

**Steps:**

1. Run: `cd ~/Desktop/collab5 && npm i @supabase/ssr`

2. CREATE `src/lib/supabase/server.ts`:
   ```ts
   // 서버(RSC·서버액션)용 Supabase Auth 클라이언트 — anon 키 + 쿠키 세션.
   // 데이터 접근은 여전히 repo(service_role)로만. 여긴 Auth 전용.
   import { createServerClient } from "@supabase/ssr";
   import { cookies } from "next/headers";
   import type { User } from "@supabase/supabase-js";

   export function authEnabled(): boolean {
     return !!(
       process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
     );
   }

   export async function createAuthClient() {
     const cookieStore = await cookies();
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll: () => cookieStore.getAll(),
           setAll: (cookiesToSet) => {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options)
               );
             } catch {
               // RSC 렌더 중 set 불가 — 미들웨어가 세션을 갱신하므로 무시 가능
             }
           },
         },
       }
     );
   }

   /** 현재 로그인 유저 (없거나 auth 미설정이면 null) */
   export async function getSessionUser(): Promise<User | null> {
     if (!authEnabled()) return null;
     try {
       const supabase = await createAuthClient();
       const { data } = await supabase.auth.getUser();
       return data.user ?? null;
     } catch {
       return null;
     }
   }
   ```

3. CREATE `src/lib/supabase/client.ts`:
   ```ts
   "use client";
   // 브라우저용 Auth 클라이언트 — 비번 재설정 링크(code 교환)·카카오 OAuth에 사용.
   import { createBrowserClient } from "@supabase/ssr";

   export function createBrowserAuthClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
     );
   }

   export const authEnvReady =
     !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   ```

4. CREATE `src/middleware.ts`:
   ```ts
   // Supabase 세션 갱신 미들웨어 — 만료 토큰을 재발급해 쿠키에 반영.
   // env 없으면(로컬 mock) 통과만.
   import { createServerClient } from "@supabase/ssr";
   import { NextResponse, type NextRequest } from "next/server";

   export async function middleware(request: NextRequest) {
     const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
     const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
     if (!url || !key) return NextResponse.next();

     let response = NextResponse.next({ request });
     const supabase = createServerClient(url, key, {
       cookies: {
         getAll: () => request.cookies.getAll(),
         setAll: (cookiesToSet) => {
           cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
           response = NextResponse.next({ request });
           cookiesToSet.forEach(({ name, value, options }) =>
             response.cookies.set(name, value, options)
           );
         },
       },
     });
     await supabase.auth.getUser(); // 세션 리프레시 트리거
     return response;
   }

   export const config = {
     matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
   };
   ```

5. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/lib/supabase/server.ts src/lib/supabase/client.ts src/middleware.ts`
6. Verify: 에러 0.
7. Commit: `git commit -am "feat(auth): supabase ssr 클라이언트 헬퍼 + 세션 미들웨어"`

**Expected output:** env 없이도 빌드·기존 페이지 무영향. env 있으면 요청마다 세션 갱신.

---

## Task 2: DB 마이그레이션 문서화 (schema.sql)

**Goal:** profiles 테이블 + (플랜 B 대비) makers 소유권 컬럼을 스키마 정본에 반영. 실행은 대표.

**Steps:**

1. MODIFY `supabase/schema.sql` — 파일 끝에 추가:
   ```sql
   -- ── 2026-07-05 인증·소유권 ──────────────────────────────
   -- 소개서 소유권(플랜 B에서 사용): 소유 계정 + 익명 생성 관리 키(해시)
   ALTER TABLE makers ADD COLUMN IF NOT EXISTS owner_user_id UUID;
   ALTER TABLE makers ADD COLUMN IF NOT EXISTS claim_token_hash TEXT;
   CREATE INDEX IF NOT EXISTS idx_makers_owner ON makers(owner_user_id);

   -- 계정 프로필 (가입 시 생성) — 브랜드명·휴대폰·로고(리사이즈 base64, Storage 이전 전 MVP)
   CREATE TABLE IF NOT EXISTS profiles (
     user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     brand_name    TEXT NOT NULL,
     phone         TEXT NOT NULL DEFAULT '',
     profile_image TEXT NOT NULL DEFAULT '',
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; -- 정책 없음 = anon 잠금(서버 service_role만)
   ```
2. Run: `cd ~/Desktop/collab5 && git diff --stat supabase/schema.sql`
3. Verify: 추가분만 diff에 나옴.
4. Commit: `git commit -am "feat(db): profiles 테이블 + makers 소유권 컬럼 스키마 추가"`

**Expected output:** 대표가 이 블록을 SQL Editor에서 1회 실행하면 DB 준비 끝.

---

## Task 3: profiles 서버 모듈 + auth 서버 액션

**Goal:** 가입·로그인·로그아웃·비번재설정 액션과 프로필 저장/조회.

**Steps:**

1. CREATE `src/lib/profiles.ts`:
   ```ts
   // 계정 프로필 — 서버 전용(service_role). RLS 잠금이라 anon으로 접근 불가.
   import { createClient, type SupabaseClient } from "@supabase/supabase-js";

   export interface Profile {
     userId: string;
     brandName: string;
     phone: string;
     profileImage: string; // 리사이즈 base64 data URL ('' = 없음)
   }

   function db(): SupabaseClient | null {
     const url = process.env.SUPABASE_URL;
     const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
     if (!url || !key) return null;
     return createClient(url, key);
   }

   export async function upsertProfile(p: Profile): Promise<void> {
     const client = db();
     if (!client) return; // 로컬 mock — DB 없음
     const { error } = await client.from("profiles").upsert({
       user_id: p.userId,
       brand_name: p.brandName,
       phone: p.phone,
       profile_image: p.profileImage,
     });
     if (error) throw new Error(error.message);
   }

   export async function getProfile(userId: string): Promise<Profile | null> {
     const client = db();
     if (!client) return null;
     const { data } = await client
       .from("profiles")
       .select("user_id, brand_name, phone, profile_image")
       .eq("user_id", userId)
       .maybeSingle();
     if (!data) return null;
     return {
       userId: data.user_id,
       brandName: data.brand_name,
       phone: data.phone ?? "",
       profileImage: data.profile_image ?? "",
     };
   }
   ```

2. CREATE `src/lib/auth-actions.ts`:
   ```ts
   "use server";

   import { redirect } from "next/navigation";
   import { authEnabled, createAuthClient } from "./supabase/server";
   import { upsertProfile } from "./profiles";

   const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://collab5.vercel.app";
   const NO_AUTH_MSG = "로그인 설정이 아직 준비되지 않았어요. (환경변수 미설정)";

   export interface SignUpInput {
     email: string;
     password: string;
     phone: string;
     brandName: string;
     profileImage: string; // base64 data URL 또는 ''
   }

   export async function signUpAction(input: SignUpInput): Promise<{ error?: string }> {
     if (!authEnabled()) return { error: NO_AUTH_MSG };
     const supabase = await createAuthClient();
     const { data, error } = await supabase.auth.signUp({
       email: input.email.trim(),
       password: input.password,
     });
     if (error || !data.user) return { error: friendly(error?.message) };
     try {
       await upsertProfile({
         userId: data.user.id,
         brandName: input.brandName.trim(),
         phone: input.phone.trim(),
         profileImage: input.profileImage,
       });
     } catch {
       return { error: "프로필 저장에 실패했어요. 로그인 후 다시 시도해주세요." };
     }
     // 스펙: 자동 로그인 X → 세션 정리 후 /login으로 보냄(클라에서 이동)
     await supabase.auth.signOut();
     return {};
   }

   export async function signInAction(
     email: string,
     password: string
   ): Promise<{ error?: string }> {
     if (!authEnabled()) return { error: NO_AUTH_MSG };
     const supabase = await createAuthClient();
     const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
     if (error) return { error: "이메일 또는 비밀번호를 확인해주세요." };
     return {};
   }

   export async function signOutAction(): Promise<void> {
     if (authEnabled()) {
       const supabase = await createAuthClient();
       await supabase.auth.signOut();
     }
     redirect("/");
   }

   export async function requestPasswordResetAction(email: string): Promise<{ error?: string }> {
     if (!authEnabled()) return { error: NO_AUTH_MSG };
     const supabase = await createAuthClient();
     const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
       redirectTo: `${SITE_URL}/reset-password/update`,
     });
     if (error) return { error: friendly(error.message) };
     return {};
   }

   function friendly(msg?: string): string {
     if (!msg) return "요청에 실패했어요. 잠시 후 다시 시도해주세요.";
     if (/already registered/i.test(msg)) return "이미 가입된 이메일이에요.";
     if (/at least 6/i.test(msg)) return "비밀번호는 6자 이상이어야 해요.";
     if (/rate limit/i.test(msg)) return "요청이 많아요. 잠시 후 다시 시도해주세요.";
     return "요청에 실패했어요. 잠시 후 다시 시도해주세요.";
   }
   ```

3. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/lib/profiles.ts src/lib/auth-actions.ts`
4. Verify: 에러 0.
5. Commit: `git commit -am "feat(auth): 가입·로그인·로그아웃·비번재설정 서버 액션 + profiles 모듈"`

**Expected output:** 서버 액션 4종 준비. env 없으면 친절한 에러 문자열 반환.

---

## Task 4: Avatar 컴포넌트

**Goal:** 원형 아바타 — 사진 있으면 사진, 없으면 브랜드명 첫 글자. '찾기' 카드 재사용 전제의 공용 컴포넌트.

**Steps:**

1. CREATE `src/components/Avatar.tsx`:
   ```tsx
   // 원형 아바타 — image 있으면 사진, 없으면 name 첫 글자(예: 송영덕 → 송).
   // 헤더·/my·(추후) 찾기 카드에서 공용.
   export function Avatar({
     image,
     name,
     size = 32,
   }: {
     image?: string;
     name: string;
     size?: number;
   }) {
     const initial = (name.trim()[0] ?? "?").toUpperCase();
     if (image) {
       return (
         // eslint-disable-next-line @next/next/no-img-element
         <img
           src={image}
           alt={name}
           width={size}
           height={size}
           style={{ width: size, height: size }}
           className="shrink-0 rounded-pill border border-hairline object-cover"
         />
       );
     }
     return (
       <span
         style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
         className="inline-flex shrink-0 items-center justify-center rounded-pill bg-primary-tint font-bold text-primary-on"
         aria-label={name}
       >
         {initial}
       </span>
     );
   }
   ```
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/components/Avatar.tsx`
3. Verify: 에러 0.
4. Commit: `git commit -am "feat(ui): 원형 Avatar 컴포넌트(사진 or 첫 글자)"`

**Expected output:** `<Avatar name="캔버스가든" image={...} size={32}/>` 재사용 가능.

---

## Task 5: /login 페이지

**Goal:** 로그인 + 회원가입/비번찾기 링크 + (플래그 시) 카카오.

**Steps:**

1. CREATE `src/app/login/page.tsx`:
   ```tsx
   "use client";

   import { useState, useTransition } from "react";
   import { useRouter } from "next/navigation";
   import { signInAction } from "@/lib/auth-actions";
   import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";

   const KAKAO_ON = process.env.NEXT_PUBLIC_KAKAO_ENABLED === "1";

   export default function LoginPage() {
     const router = useRouter();
     const [pending, start] = useTransition();
     const [email, setEmail] = useState("");
     const [password, setPassword] = useState("");
     const [err, setErr] = useState("");

     const submit = () =>
       start(async () => {
         setErr("");
         const r = await signInAction(email, password);
         if (r.error) {
           setErr(r.error);
           return;
         }
         router.push("/");
         router.refresh(); // 헤더 세션 반영
       });

     const kakao = async () => {
       const supabase = createBrowserAuthClient();
       await supabase.auth.signInWithOAuth({
         provider: "kakao",
         options: { redirectTo: window.location.origin },
       });
     };

     return (
       <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
         <h1 className="text-2xl font-bold tracking-tight text-ink">로그인</h1>
         <p className="mt-2 text-[15px] text-mute">콜라보 카드를 계정으로 관리해보세요.</p>
         {!authEnvReady && (
           <p className="mt-4 rounded-md bg-surface-soft px-3 py-2.5 text-sm text-mute">
             로그인 설정이 아직 준비되지 않았어요. (로컬 환경)
           </p>
         )}
         <div className="mt-6 space-y-3">
           <input
             type="email"
             value={email}
             onChange={(e) => setEmail(e.target.value)}
             placeholder="이메일"
             className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
           />
           <input
             type="password"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
             }}
             placeholder="비밀번호"
             className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
           />
         </div>
         {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
         <button
           type="button"
           onClick={submit}
           disabled={pending || !email.trim() || !password}
           className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
         >
           {pending ? "로그인 중…" : "로그인"}
         </button>
         {KAKAO_ON && (
           <button
             type="button"
             onClick={kakao}
             className="mt-2 h-12 w-full rounded-md bg-[#FEE500] text-base font-medium text-[#191919]"
           >
             카카오로 시작하기
           </button>
         )}
         <div className="mt-5 flex items-center justify-center gap-3 text-sm">
           <a href="/signup" className="font-medium text-primary-on underline-offset-2 hover:underline">
             회원가입
           </a>
           <span className="text-faint">·</span>
           <a href="/reset-password" className="text-mute underline-offset-2 hover:underline">
             비밀번호 찾기
           </a>
         </div>
       </main>
     );
   }
   ```
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/login/page.tsx`
3. Verify: 에러 0.
4. Commit: `git commit -am "feat(auth): 로그인 페이지"`

**Expected output:** /login 렌더. env 없으면 안내 문구 + 버튼 동작 시 에러 문자열.

---

## Task 6: /signup 페이지

**Goal:** 이메일·비번(+확인)·휴대폰·브랜드명·로고(선택)·동의 → 가입 → 완료 얼럿 → /login.

**Steps:**

1. CREATE `src/app/signup/page.tsx`:
   ```tsx
   "use client";

   import { useState, useTransition } from "react";
   import { useRouter } from "next/navigation";
   import { signUpAction } from "@/lib/auth-actions";
   import { fileToResizedDataUrl } from "@/lib/image";
   import { Avatar } from "@/components/Avatar";

   export default function SignupPage() {
     const router = useRouter();
     const [pending, start] = useTransition();
     const [email, setEmail] = useState("");
     const [password, setPassword] = useState("");
     const [password2, setPassword2] = useState("");
     const [phone, setPhone] = useState("");
     const [brandName, setBrandName] = useState("");
     const [image, setImage] = useState(""); // 리사이즈 base64
     const [agree, setAgree] = useState(false);
     const [err, setErr] = useState("");
     const [done, setDone] = useState(false);

     const onImage = async (files: FileList | null) => {
       const f = files?.[0];
       if (!f || !f.type.startsWith("image/")) return;
       try {
         setImage(await fileToResizedDataUrl(f, 400));
       } catch {
         setErr("이미지를 불러오지 못했어요. 다른 파일로 시도해주세요.");
       }
     };

     const validate = (): string => {
       if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "이메일 형식을 확인해주세요.";
       if (password.length < 6) return "비밀번호는 6자 이상이어야 해요.";
       if (password !== password2) return "비밀번호가 서로 달라요.";
       if (!phone.trim()) return "휴대폰번호를 입력해주세요.";
       if (!brandName.trim()) return "브랜드명을 입력해주세요.";
       if (!agree) return "개인정보 수집 및 이용에 동의해주세요.";
       return "";
     };

     const submit = () =>
       start(async () => {
         const v = validate();
         if (v) {
           setErr(v);
           return;
         }
         setErr("");
         const r = await signUpAction({
           email,
           password,
           phone,
           brandName,
           profileImage: image,
         });
         if (r.error) {
           setErr(r.error);
           return;
         }
         setDone(true); // 완료 얼럿 → 확인 시 /login
       });

     return (
       <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
         <h1 className="text-2xl font-bold tracking-tight text-ink">회원가입</h1>
         <p className="mt-2 text-[15px] text-mute">브랜드 계정을 만들고 소개서를 관리해보세요.</p>

         <div className="mt-6 space-y-4">
           <Field label="이메일">
             <input
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               placeholder="you@brand.com"
               className={inputCls}
             />
           </Field>
           <Field label="비밀번호">
             <input
               type="password"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               placeholder="6자 이상"
               className={inputCls}
             />
           </Field>
           <Field label="비밀번호 확인">
             <input
               type="password"
               value={password2}
               onChange={(e) => setPassword2(e.target.value)}
               placeholder="한 번 더 입력해주세요"
               className={inputCls}
             />
           </Field>
           <Field label="휴대폰번호">
             <input
               type="tel"
               value={phone}
               onChange={(e) => setPhone(e.target.value)}
               placeholder="010-0000-0000"
               className={inputCls}
             />
           </Field>
           <Field label="브랜드명">
             <input
               value={brandName}
               onChange={(e) => setBrandName(e.target.value)}
               placeholder="예: 캔버스가든"
               className={inputCls}
             />
           </Field>
           <Field label="로고 또는 브랜드 사진" optional>
             <div className="flex items-center gap-3">
               <Avatar image={image || undefined} name={brandName || "?"} size={48} />
               <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink">
                 이미지 선택
                 <input
                   type="file"
                   accept="image/*"
                   className="hidden"
                   onChange={(e) => onImage(e.target.files)}
                 />
               </label>
               {image && (
                 <button
                   type="button"
                   onClick={() => setImage("")}
                   className="text-sm text-faint hover:text-ink"
                 >
                   지우기
                 </button>
               )}
             </div>
           </Field>
           <label className="flex cursor-pointer items-start gap-2 text-sm text-body">
             <input
               type="checkbox"
               checked={agree}
               onChange={(e) => setAgree(e.target.checked)}
               className="mt-0.5 h-4 w-4 accent-[var(--color-primary,theme(colors.lime.400))]"
             />
             <span>
               개인정보 수집 및 이용에 동의합니다. <span className="text-faint">(필수)</span>
             </span>
           </label>
         </div>

         {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
         <button
           type="button"
           onClick={submit}
           disabled={pending}
           className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
         >
           {pending ? "가입 중…" : "가입하기"}
         </button>
         <p className="mt-4 text-center text-sm text-mute">
           이미 계정이 있나요?{" "}
           <a href="/login" className="font-medium text-primary-on underline-offset-2 hover:underline">
             로그인
           </a>
         </p>

         {done && (
           <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
             <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
               <p className="text-lg font-bold text-ink">🎉 가입이 완료됐어요!</p>
               <p className="mt-2 text-[15px] text-body">이제 로그인해서 시작해보세요.</p>
               <button
                 type="button"
                 onClick={() => router.push("/login")}
                 className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on"
               >
                 로그인하러 가기
               </button>
             </div>
           </div>
         )}
       </main>
     );
   }

   const inputCls =
     "h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus";

   function Field({
     label,
     optional,
     children,
   }: {
     label: string;
     optional?: boolean;
     children: React.ReactNode;
   }) {
     return (
       <div>
         <label className="mb-1.5 block text-[15px] font-medium text-body">
           {label}
           {optional && <span className="ml-1 font-normal text-faint">· 선택</span>}
         </label>
         {children}
       </div>
     );
   }
   ```
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/signup/page.tsx`
3. Verify: 에러 0.
4. Commit: `git commit -am "feat(auth): 회원가입 페이지(브랜드명·로고·동의 + 완료 얼럿)"`

**Expected output:** /signup 렌더, 유효성 인라인 에러, 로고 미리보기=Avatar, 완료 얼럿 → /login.

---

## Task 7: 비밀번호 재설정 2페이지

**Goal:** 이메일 입력 → 링크 발송 안내 / 링크 랜딩 → 새 비번 설정.

**Steps:**

1. CREATE `src/app/reset-password/page.tsx`:
   ```tsx
   "use client";

   import { useState, useTransition } from "react";
   import { requestPasswordResetAction } from "@/lib/auth-actions";

   export default function ResetPasswordPage() {
     const [pending, start] = useTransition();
     const [email, setEmail] = useState("");
     const [err, setErr] = useState("");
     const [sent, setSent] = useState(false);

     const submit = () =>
       start(async () => {
         setErr("");
         const r = await requestPasswordResetAction(email);
         if (r.error) {
           setErr(r.error);
           return;
         }
         setSent(true);
       });

     return (
       <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
         <h1 className="text-2xl font-bold tracking-tight text-ink">비밀번호 찾기</h1>
         {sent ? (
           <p className="mt-4 rounded-md bg-primary-pale px-3 py-3 text-[15px] leading-relaxed text-body">
             재설정 링크를 이메일로 보냈어요. 메일함을 확인해주세요.
           </p>
         ) : (
           <>
             <p className="mt-2 text-[15px] text-mute">
               가입한 이메일을 입력하면 재설정 링크를 보내드려요.
             </p>
             <input
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
               }}
               placeholder="이메일"
               className="mt-5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
             />
             {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
             <button
               type="button"
               onClick={submit}
               disabled={pending || !email.trim()}
               className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
             >
               {pending ? "보내는 중…" : "재설정 링크 보내기"}
             </button>
           </>
         )}
         <p className="mt-4 text-center text-sm">
           <a href="/login" className="text-mute underline-offset-2 hover:underline">
             로그인으로 돌아가기
           </a>
         </p>
       </main>
     );
   }
   ```

2. CREATE `src/app/reset-password/update/page.tsx`:
   ```tsx
   "use client";

   // 재설정 메일 링크 랜딩 — 브라우저 클라이언트가 URL의 code를 세션으로 교환한 뒤 새 비번 저장.
   import { useState, useTransition } from "react";
   import { useRouter } from "next/navigation";
   import { createBrowserAuthClient } from "@/lib/supabase/client";

   export default function UpdatePasswordPage() {
     const router = useRouter();
     const [pending, start] = useTransition();
     const [pw, setPw] = useState("");
     const [pw2, setPw2] = useState("");
     const [err, setErr] = useState("");

     const submit = () =>
       start(async () => {
         if (pw.length < 6) {
           setErr("비밀번호는 6자 이상이어야 해요.");
           return;
         }
         if (pw !== pw2) {
           setErr("비밀번호가 서로 달라요.");
           return;
         }
         setErr("");
         const supabase = createBrowserAuthClient();
         const { error } = await supabase.auth.updateUser({ password: pw });
         if (error) {
           setErr("재설정에 실패했어요. 메일의 링크로 다시 접속해주세요.");
           return;
         }
         await supabase.auth.signOut();
         router.push("/login");
       });

     return (
       <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
         <h1 className="text-2xl font-bold tracking-tight text-ink">새 비밀번호 설정</h1>
         <div className="mt-5 space-y-3">
           <input
             type="password"
             value={pw}
             onChange={(e) => setPw(e.target.value)}
             placeholder="새 비밀번호 (6자 이상)"
             className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
           />
           <input
             type="password"
             value={pw2}
             onChange={(e) => setPw2(e.target.value)}
             placeholder="새 비밀번호 확인"
             className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
           />
         </div>
         {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
         <button
           type="button"
           onClick={submit}
           disabled={pending || !pw || !pw2}
           className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
         >
           {pending ? "저장 중…" : "비밀번호 변경"}
         </button>
       </main>
     );
   }
   ```
3. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/reset-password`
4. Verify: 에러 0.
5. Commit: `git commit -am "feat(auth): 비밀번호 재설정 요청·변경 페이지"`

**Expected output:** 메일 링크 → /reset-password/update 랜딩 → 새 비번 → /login.

---

## Task 8: 헤더(SiteHeader) + /my 골격

**Goal:** 로그인 상태별 헤더(아바타·내 소개서·로그아웃) + /my 가드 페이지.

**Steps:**

1. CREATE `src/components/SiteHeader.tsx`:
   ```tsx
   // 전 페이지 공용 헤더 — 서버 컴포넌트. 세션 유무로 우측 영역 분기.
   import { getSessionUser } from "@/lib/supabase/server";
   import { getProfile } from "@/lib/profiles";
   import { signOutAction } from "@/lib/auth-actions";
   import { Avatar } from "./Avatar";

   export async function SiteHeader() {
     const user = await getSessionUser();
     const profile = user ? await getProfile(user.id) : null;
     const displayName = profile?.brandName || user?.email?.split("@")[0] || "";

     return (
       <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 sm:px-6">
         {/* eslint-disable-next-line @next/next/no-img-element */}
         <a href="/" className="flex items-center">
           <img src="/logo-lockup.svg" alt="collab5" className="h-7 w-auto" />
         </a>
         <nav className="flex items-center gap-1 text-sm">
           <a href="/search" className="rounded-md px-3 py-1.5 text-mute hover:text-ink">
             찾기
           </a>
           <a
             href="/register"
             className="rounded-md border border-border-strong bg-surface px-3 py-1.5 font-medium text-ink"
           >
             콜라보 카드 만들기
           </a>
           {user ? (
             <>
               <a
                 href="/my"
                 className="ml-1 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-soft"
                 aria-label="내 소개서"
               >
                 <Avatar image={profile?.profileImage || undefined} name={displayName || "?"} size={30} />
                 <span className="hidden font-medium text-ink sm:inline">{displayName}</span>
               </a>
               <form action={signOutAction}>
                 <button type="submit" className="rounded-md px-2 py-1.5 text-mute hover:text-ink">
                   로그아웃
                 </button>
               </form>
             </>
           ) : (
             <a href="/login" className="ml-1 rounded-md px-3 py-1.5 font-medium text-mute hover:text-ink">
               로그인
             </a>
           )}
         </nav>
       </header>
     );
   }
   ```

2. MODIFY `src/app/layout.tsx` — 기존 `<header>…</header>` 블록 전체를 `<SiteHeader />`로 교체하고 import 추가:
   ```tsx
   import { SiteHeader } from "@/components/SiteHeader";
   ```
   ```tsx
       <body className="min-h-full flex flex-col">
         <SiteHeader />
         <div className="flex-1">{children}</div>
       </body>
   ```

3. CREATE `src/app/my/page.tsx`:
   ```tsx
   // 내 소개서 — 로그인 필수. 목록은 플랜 B(소유권)에서 채움.
   import { redirect } from "next/navigation";
   import { getSessionUser } from "@/lib/supabase/server";
   import { getProfile } from "@/lib/profiles";
   import { Avatar } from "@/components/Avatar";

   export default async function MyPage() {
     const user = await getSessionUser();
     if (!user) redirect("/login");
     const profile = await getProfile(user.id);
     const displayName = profile?.brandName || user.email?.split("@")[0] || "내 브랜드";

     return (
       <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
         <div className="flex items-center gap-3">
           <Avatar image={profile?.profileImage || undefined} name={displayName} size={56} />
           <div>
             <h1 className="text-2xl font-bold tracking-tight text-ink">{displayName}</h1>
             <p className="text-sm text-mute">{user.email}</p>
           </div>
         </div>

         <section className="mt-9 border-t border-hairline pt-8">
           <h2 className="text-[19px] font-bold text-ink">내 소개서</h2>
           <div className="mt-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
             <p className="text-[15px] text-mute">아직 계정에 연결된 소개서가 없어요.</p>
             <a
               href="/register"
               className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-on"
             >
               소개서 만들기
             </a>
           </div>
         </section>
       </main>
     );
   }
   ```
4. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/components/SiteHeader.tsx src/app/layout.tsx src/app/my/page.tsx`
5. Verify: 에러 0. 로컬(env 없음)에서 헤더=기존 모습+`로그인` 버튼, `/my` → /login 리다이렉트.
6. Commit: `git commit -am "feat(auth): 세션 헤더(아바타·로그아웃) + 내 소개서 골격"`

**Expected output:** 비로그인=로그인 버튼 / 로그인=아바타+브랜드명+로그아웃. /my 가드 동작.

---

## 최종 검증
- `npx tsc --noEmit` + eslint 전체 클린. 로컬 `/login`·`/signup`·`/reset-password` 렌더(HTTP 200) + env 없음 안내 확인.
- **대표 작업(배포 전):** ① Supabase SQL Editor에서 Task 2 블록 실행 ② Vercel env: `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`(+선택 `NEXT_PUBLIC_SITE_URL`) ③ Supabase Auth 설정: Confirm email **off** · Site URL=`https://collab5.vercel.app` · Redirect URLs에 `https://collab5.vercel.app/reset-password/update` 추가.
- 배포 후: 가입→완료얼럿→로그인→헤더 아바타 확인, 비번찾기 메일 수신→재설정→재로그인.
