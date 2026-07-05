# Implementation Plan: 소유권·수정 (플랜 B, 비밀번호)

Date: 2026-07-05
Spec: [docs/superpowers/specs/2026-07-05-auth-ownership-design.md](../specs/2026-07-05-auth-ownership-design.md)

## Goal
소개서에 소유권을 붙인다: 비회원은 생성 시 수정 비밀번호, 로그인 유저는 계정 자동 귀속. 수정 버튼·edit 모드·/my 연결·모바일 플로팅 링크복사까지.

## Architecture
- DB: 플랜 A에서 추가한 `makers.owner_user_id`·`makers.claim_token_hash`(= 수정 비번 sha256 해시로 재활용) 사용.
- 권한 검사·비번 대조·update = **서버 액션(service_role)**. 비번 검증 성공 시 짧은 수명 **HttpOnly 쿠키** `edit_grant_{slug}`로 edit 페이지 진입 허용.
- 세션 유무는 `getSessionUser()`(플랜 A). register는 클라 컴포넌트라 `loggedIn`을 서버액션으로 조회.
- env 없으면(로컬 mock): 소유권/비번은 DB 필요 → 로컬은 UI만, 실검증은 prod.

## Tech Stack
Next.js 16 · React 19 · TS · Supabase(service_role) · Node crypto(sha256) · next/headers cookies.

## Files
CREATE src/lib/hash.ts
MODIFY src/lib/types.ts
MODIFY src/lib/repo.ts
MODIFY src/lib/actions.ts
MODIFY src/app/register/page.tsx
MODIFY src/app/m/[slug]/page.tsx
CREATE src/app/m/[slug]/EditButton.tsx
MODIFY src/app/m/[slug]/CopyLinkButton.tsx
MODIFY src/app/my/page.tsx
CREATE src/app/my/ConnectMaker.tsx

---

## Task 1: 해시 유틸 + 소유권 필드 + repo 메서드

**Goal:** Maker에 소유권 필드, repo에 update/owner/password/listByOwner.

**Steps:**

1. CREATE `src/lib/hash.ts`:
   ```ts
   import { createHash } from "crypto";
   // 수정 비밀번호 해시 (규칙 없음, 단방향). 서버 전용.
   export function sha256(text: string): string {
     return createHash("sha256").update(text).digest("hex");
   }
   ```

2. MODIFY `src/lib/types.ts` — `Maker` 인터페이스의 `createdAt: string; // ISO` 위에 추가:
   ```ts
     ownerUserId?: string; // 소유 계정(로그인 생성/연결 시)
     editPasswordHash?: string; // 수정 비밀번호 해시(비회원 생성 시). DB=claim_token_hash
   ```

3. MODIFY `src/lib/repo.ts`:
   - `interface MakerRow`의 `collab_open: boolean; created_at: string;` 를 다음으로 교체:
     ```ts
       collab_open: boolean; created_at: string;
       owner_user_id: string | null; claim_token_hash: string | null;
     ```
   - `rowToMaker`의 `collabOpen: r.collab_open, createdAt: r.created_at,` 를 다음으로 교체:
     ```ts
       collabOpen: r.collab_open, createdAt: r.created_at,
       ownerUserId: r.owner_user_id ?? undefined,
       editPasswordHash: r.claim_token_hash ?? undefined,
     ```
   - `SupabaseRepo.createMaker`의 insert row에서 `soul: input.soul, trust: input.trust, collab_open: input.collabOpen, created_at: now(),` 를 다음으로 교체:
     ```ts
       soul: input.soul, trust: input.trust, collab_open: input.collabOpen, created_at: now(),
       owner_user_id: input.ownerUserId ?? null, claim_token_hash: input.editPasswordHash ?? null,
     ```
   - `Repo` 인터페이스(파일 상단 `getMakerBySlug(slug: string): Promise<Maker | null>;` 부근)에 메서드 추가:
     ```ts
       updateMakerContent(slug: string, content: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">): Promise<Maker | null>;
       setMakerOwner(slug: string, ownerUserId: string): Promise<void>;
       setMakerPasswordHash(slug: string, hash: string): Promise<void>;
       listMakersByOwner(ownerUserId: string): Promise<Maker[]>;
     ```
   - `SupabaseRepo`에 구현 추가(클래스 안, `getMakerById` 아래 아무 곳):
     ```ts
     async updateMakerContent(
       slug: string,
       c: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">
     ): Promise<Maker | null> {
       const patch = {
         name: c.name, one_liner: c.oneLiner,
         region: c.region ?? null, offers: c.offers, seeks: c.seeks,
         target_audience: c.targetAudience, collab_history: c.collabHistory,
         story: c.story, activities: c.activities, offers_note: c.offersNote, seeks_note: c.seeksNote,
         photos: c.photos, soul: c.soul, trust: c.trust, collab_open: c.collabOpen,
       };
       const { data } = await this.db.from("makers").update(patch).eq("slug", slug).select().maybeSingle();
       return data ? rowToMaker(data as MakerRow) : null;
     }
     async setMakerOwner(slug: string, ownerUserId: string): Promise<void> {
       await this.db.from("makers").update({ owner_user_id: ownerUserId }).eq("slug", slug);
     }
     async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
       await this.db.from("makers").update({ claim_token_hash: hash }).eq("slug", slug);
     }
     async listMakersByOwner(ownerUserId: string): Promise<Maker[]> {
       const { data } = await this.db.from("makers").select().eq("owner_user_id", ownerUserId).order("created_at", { ascending: false });
       return (data ?? []).map((r) => rowToMaker(r as MakerRow));
     }
     ```
   - `InMemoryRepo`에도 동일 시그니처 스텁 추가(클래스 안). InMemory는 배열 필드명을 실제 코드에서 확인해 맞출 것(예: `this.makers`):
     ```ts
     async updateMakerContent(slug: string, c: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">): Promise<Maker | null> {
       const m = this.makers.find((x) => x.slug === slug);
       if (!m) return null;
       Object.assign(m, c);
       return m;
     }
     async setMakerOwner(slug: string, ownerUserId: string): Promise<void> {
       const m = this.makers.find((x) => x.slug === slug);
       if (m) m.ownerUserId = ownerUserId;
     }
     async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
       const m = this.makers.find((x) => x.slug === slug);
       if (m) m.editPasswordHash = hash;
     }
     async listMakersByOwner(ownerUserId: string): Promise<Maker[]> {
       return this.makers.filter((x) => x.ownerUserId === ownerUserId);
     }
     ```
     (InMemory의 실제 배열 프로퍼티명이 `this.makers`가 아니면 그 이름으로 교체.)

4. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/lib/hash.ts src/lib/types.ts src/lib/repo.ts`
5. Verify: 에러 0.
6. Commit: `git commit -am "feat(ownership): Maker 소유권 필드 + repo update/owner/password/listByOwner"`

---

## Task 2: 소유권 서버 액션

**Goal:** create 세션귀속 + 비번설정/검증/연결/업데이트/조회 액션.

**Steps:**

1. MODIFY `src/lib/actions.ts`:
   - 상단 import에 추가:
     ```ts
     import { cookies } from "next/headers";
     import { getSessionUser } from "./supabase/server";
     import { sha256 } from "./hash";
     ```
   - `RegisterInput` 인터페이스에 `description?: string;` 아래 추가:
     ```ts
       editPassword?: string; // 비회원 수정 비밀번호(로그인 상태면 무시)
     ```
   - `createMakerAction`에서 `const maker = await repo.createMaker({` 위에 세션 판정 추가하고, createMaker 인자에 owner/hash를 얹는다. 구체적으로 `export async function createMakerAction(...)` 본문 첫 줄에:
     ```ts
       const user = await getSessionUser();
       const ownerUserId = user?.id;
       const editPasswordHash =
         !user && input.editPassword?.trim() ? sha256(input.editPassword.trim()) : undefined;
     ```
     그리고 `repo.createMaker({` 객체의 `collabOpen: input.collabOpen,` 아래에 추가:
     ```ts
         ownerUserId,
         editPasswordHash,
     ```
   - 파일 끝에 새 액션들 추가:
     ```ts
     const GRANT_PREFIX = "edit_grant_";
     const GRANT_MAX_AGE = 60 * 30; // 30분

     /** 비회원이 완료 얼럿에서 뒤늦게 비번을 설정(소유자·기존 비번 없을 때만) */
     export async function setMakerPasswordAction(
       slug: string,
       password: string
     ): Promise<{ error?: string }> {
       const pw = password.trim();
       if (!pw) return { error: "비밀번호를 입력해주세요." };
       const maker = await repo.getMakerBySlug(slug);
       if (!maker) return { error: "소개서를 찾을 수 없어요." };
       if (maker.ownerUserId || maker.editPasswordHash) return {}; // 이미 소유/비번 있음 — 무시
       await repo.setMakerPasswordHash(slug, sha256(pw));
       return {};
     }

     /** 수정 진입용 비번 검증 → 통과 시 edit_grant 쿠키 발급 */
     export async function verifyMakerPasswordAction(
       slug: string,
       password: string
     ): Promise<{ ok: boolean }> {
       const maker = await repo.getMakerBySlug(slug);
       if (!maker) return { ok: false };
       const user = await getSessionUser();
       if (user && maker.ownerUserId === user.id) {
         await grantEdit(slug);
         return { ok: true };
       }
       if (maker.editPasswordHash && sha256(password.trim()) === maker.editPasswordHash) {
         await grantEdit(slug);
         return { ok: true };
       }
       return { ok: false };
     }

     async function grantEdit(slug: string): Promise<void> {
       const store = await cookies();
       store.set(GRANT_PREFIX + slug, "1", {
         httpOnly: true,
         sameSite: "lax",
         path: "/",
         maxAge: GRANT_MAX_AGE,
       });
     }

     export async function hasEditGrant(slug: string): Promise<boolean> {
       const maker = await repo.getMakerBySlug(slug);
       const user = await getSessionUser();
       if (user && maker?.ownerUserId === user.id) return true;
       const store = await cookies();
       return store.get(GRANT_PREFIX + slug)?.value === "1";
     }

     /** 로그인 상태에서 비번으로 진입한 소개서를 내 계정에 귀속 */
     export async function claimMakerAction(
       slug: string,
       password: string
     ): Promise<{ error?: string }> {
       const user = await getSessionUser();
       if (!user) return { error: "로그인이 필요해요." };
       const maker = await repo.getMakerBySlug(slug);
       if (!maker) return { error: "소개서를 찾을 수 없어요." };
       if (maker.ownerUserId && maker.ownerUserId !== user.id)
         return { error: "이미 다른 계정에 연결된 소개서예요." };
       if (!maker.ownerUserId) {
         if (!maker.editPasswordHash || sha256(password.trim()) !== maker.editPasswordHash)
           return { error: "비밀번호가 일치하지 않아요." };
         await repo.setMakerOwner(slug, user.id);
       }
       return {};
     }

     /** /my에서 URL 또는 슬러그 + 비번으로 연결 */
     export async function claimBySlugAction(
       slugOrUrl: string,
       password: string
     ): Promise<{ error?: string; slug?: string }> {
       const m = slugOrUrl.trim().match(/([a-z0-9-]+)\/?$/i);
       const slug = m?.[1] ?? "";
       if (!slug) return { error: "소개서 링크를 확인해주세요." };
       const r = await claimMakerAction(slug, password);
       if (r.error) return r;
       return { slug };
     }

     /** edit 모드 제출 → 권한 재검증 후 내용 업데이트 */
     export async function updateMakerAction(
       slug: string,
       input: RegisterInput
     ): Promise<{ error?: string; slug?: string }> {
       if (!(await hasEditGrant(slug))) return { error: "수정 권한이 없어요." };
       const updated = await repo.updateMakerContent(slug, {
         name: input.name.trim(),
         oneLiner: input.oneLiner.trim(),
         region: deriveRegion(input.address ?? "") || undefined,
         offers: input.offers,
         seeks: input.seeks,
         targetAudience: input.targetAudience,
         collabHistory: input.collabHistory.map((h) => ({
           partner: h.partner, types: h.types,
           desc: h.desc?.trim() || undefined, year: h.year, photos: unwrapPhotos(h.photos),
         })),
         story: input.story?.trim() ?? "",
         activities: (input.activities ?? []).map((a) => ({
           title: a.title, desc: a.desc, photos: unwrapPhotos(a.photos),
         })),
         offersNote: input.offersNote?.trim() ?? "",
         seeksNote: input.seeksNote?.trim() ?? "",
         photos: unwrapPhotos(input.photos),
         soul: { values: input.values, tone: "", trajectory: "" },
         trust: {
           instagram: input.instagram?.trim() || undefined,
           homepage: input.homepage?.trim() || undefined,
           address: input.address?.trim() || undefined,
           description: input.description?.trim() || undefined,
         },
         collabOpen: input.collabOpen,
       });
       if (!updated) return { error: "업데이트에 실패했어요." };
       return { slug };
     }

     /** register 완료 얼럿 버전 분기용 */
     export async function getAuthStateAction(): Promise<{ loggedIn: boolean }> {
       const user = await getSessionUser();
       return { loggedIn: !!user };
     }

     /** edit 모드 프리필 데이터(권한 있을 때만) */
     export async function getEditDataAction(slug: string): Promise<Maker | null> {
       if (!(await hasEditGrant(slug))) return null;
       return repo.getMakerBySlug(slug);
     }
     ```
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/lib/actions.ts`
3. Verify: 에러 0.
4. Commit: `git commit -am "feat(ownership): create 세션귀속 + 비번설정/검증/연결/업데이트 서버 액션"`

---

## Task 3: register 완료 얼럿 2버전 + 비번칸

**Goal:** 세션 여부로 완료 얼럿을 회원/비회원 버전으로 분기, 비회원은 비번 입력→저장 후 이동.

**Steps:**

1. MODIFY `src/app/register/page.tsx`:
   - import에 추가: `import { createMakerAction, setMakerPasswordAction, getAuthStateAction } from "@/lib/actions";` (기존 createMakerAction import 라인을 이 형태로 확장).
   - 상태 추가(`const [createdSlug, setCreatedSlug] = useState("");` 아래):
     ```ts
     const [loggedIn, setLoggedIn] = useState(false);
     const [editPw, setEditPw] = useState("");
     const [savingPw, setSavingPw] = useState(false);
     ```
   - 세션 조회 effect(데모 프리필 effect 아래에 별도 추가):
     ```ts
     useEffect(() => {
       getAuthStateAction().then((s) => setLoggedIn(s.loggedIn)).catch(() => {});
     }, []);
     ```
   - `goToPage`를 다음으로 교체(비회원이면 비번 저장 후 이동):
     ```ts
     const goToPage = async () => {
       if (!loggedIn) {
         if (!editPw.trim()) return;
         setSavingPw(true);
         await setMakerPasswordAction(createdSlug, editPw.trim()).catch(() => {});
         setSavingPw(false);
       }
       setGoingToPage(true);
       router.push(`/m/${createdSlug}`);
     };
     ```
     (`goToPage`가 async가 되므로 호출부 `onClick={goToPage}` 그대로 OK.)
   - 완료 얼럿(`{portfolioOpen && ( ... )}`) 내부 카드 안을 loggedIn 분기로 교체. 기존 카드 콘텐츠(타이틀 `p`, 안내 `p` 2개, 버튼, 하단 안내)를 다음으로 교체:
     ```tsx
             <p className="text-lg font-bold text-ink">✨ 브랜드 소개서가 완성됐어요!</p>
             {loggedIn ? (
               <>
                 <p className="mt-3 text-[15px] leading-relaxed text-body">
                   브랜드 소개서 페이지에서 내용을 확인해보세요.
                 </p>
                 <p className="mt-2 text-[15px] leading-relaxed text-body">
                   이제, 링크를 복사해 협업을 제안할 수 있어요.
                 </p>
               </>
             ) : (
               <>
                 <p className="mt-3 text-[15px] leading-relaxed text-body">
                   이제 링크를 복사해 협업을 제안해 볼 수 있어요! 비회원 상태라 관리용 비밀번호를 입력해주세요.
                 </p>
                 <div className="mt-4 text-left">
                   <label className="mb-1.5 block text-sm font-medium text-body">
                     소개서 관리 비밀번호 <span className="text-red-500">*</span>{" "}
                     <span className="font-normal text-faint">(입력 규칙 없음)</span>
                   </label>
                   <input
                     type="password"
                     value={editPw}
                     onChange={(e) => setEditPw(e.target.value)}
                     placeholder="비밀번호를 입력해주세요"
                     className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                   />
                   <p className="mt-2 text-[13px] leading-relaxed text-faint">
                     잊어버리면 고객센터를 통해서만 찾을 수 있으니 기억해주세요.
                   </p>
                 </div>
               </>
             )}
             <button
               type="button"
               onClick={goToPage}
               disabled={goingToPage || savingPw || (!loggedIn && !editPw.trim())}
               className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
             >
               {goingToPage || savingPw ? "이동 중…" : "소개서 확인하러 가기"}
             </button>
             <p className="mt-3 text-[13px] text-faint">언제든 ‘내 소개서’에서 수정할 수 있어요.</p>
     ```
     (기존 스피너 로직이 `goingToPage`만 쓰던 것을 `savingPw`도 포함. 기존 `{goingToPage && <spinner/>}` 조각이 있으면 조건에 `|| savingPw` 추가.)
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/register/page.tsx`
3. Verify: 에러 0. 로컬(env 없음)에선 `getAuthStateAction`이 loggedIn=false → 비회원 얼럿(비번칸) 노출.
4. Commit: `git commit -am "feat(register): 완료 얼럿 회원/비회원 2버전 + 수정 비번 입력"`

---

## Task 4: register edit 모드 (프리필 + update)

**Goal:** `/register?edit={slug}`로 오면 기존 값 프리필 + 제출 시 update.

**Steps:**

1. MODIFY `src/app/register/page.tsx`:
   - import 확장: `updateMakerAction, getEditDataAction` 추가.
   - 상태 추가: `const [editSlug, setEditSlug] = useState<string | null>(null);`
   - edit 프리필 effect(세션 effect 아래). 데모 프리필과 같은 setter들을 재사용:
     ```ts
     /* eslint-disable react-hooks/set-state-in-effect */
     useEffect(() => {
       if (typeof window === "undefined") return;
       const slug = new URLSearchParams(window.location.search).get("edit");
       if (!slug) return;
       getEditDataAction(slug).then((m) => {
         if (!m) return; // 권한 없음 — 일반 생성 폼으로 남음
         setEditSlug(slug);
         setName(m.name);
         setOneLiner(m.oneLiner);
         setDescription(m.trust.description ?? "");
         setStory(m.story ?? "");
         setValues(m.soul.values ?? []);
         setActivities(
           (m.activities.length ? m.activities : [{ title: "", desc: "", photos: [] }]).map((a) => ({
             title: a.title, desc: a.desc, photos: a.photos.map((u) => ({ url: u })),
           }))
         );
         setOffers(m.offers);
         setSeeks(m.seeks);
         setOffersNote(m.offersNote ?? "");
         setSeeksNote(m.seeksNote ?? "");
         setTargetAudience(m.targetAudience ?? []);
         setCollabHistory(
           (m.collabHistory.length ? m.collabHistory : [emptyHist()]).map((h) => ({
             partner: h.partner, types: h.types, desc: h.desc ?? "", year: h.year ?? "",
             photos: h.photos.map((u) => ({ url: u })), typeInput: "",
           }))
         );
         setInstagram(m.trust.instagram ?? "");
         setHomepage(m.trust.homepage ?? "");
         setAddress(m.trust.address ?? "");
         setCollabOpen(m.collabOpen);
         setPhotos(m.photos.map((u) => ({ name: "", url: u, file: undefined as unknown as File })));
       }).catch(() => {});
     }, []);
     /* eslint-enable react-hooks/set-state-in-effect */
     ```
     ⚠️ `photos` 상태 타입이 `{name,url,file:File}[]`라 기존 사진은 file 없이 url만. 제출 시 리사이즈 로직이 `p.file`을 참조하므로, submit의 브랜드 사진 매핑을 `p.file ? fileToResizedDataUrl(p.file,1000) : Promise.resolve(p.url)`로 바꿔 file 없는 기존 사진을 그대로 통과시킨다(활동/콜라보는 이미 이 패턴). 해당 라인:
     ```ts
     photoUrls = await Promise.all(
       photos.map((p) => (p.file ? fileToResizedDataUrl(p.file, 1000) : Promise.resolve(p.url)))
     );
     ```
   - 제출 분기: `createMakerAction({...})` 호출부를 editSlug 유무로 갈라준다. 기존:
     ```ts
     const { slug } = await createMakerAction({ ...payload });
     setCreatedSlug(slug);
     setPortfolioOpen(true);
     ```
     를:
     ```ts
     const payload = { /* 기존 createMakerAction 인자 그대로 */ };
     if (editSlug) {
       const r = await updateMakerAction(editSlug, payload);
       if (!r.error) router.push(`/m/${editSlug}`);
       return;
     }
     const { slug } = await createMakerAction(payload);
     setCreatedSlug(slug);
     setPortfolioOpen(true);
     ```
     (payload = 현재 createMakerAction에 넘기는 객체를 변수로 뽑아 재사용.)
   - 히어로/버튼 문구: 상단 안내 문구·제출 버튼 라벨을 edit 모드일 때 바꿔주면 UX↑(선택). 최소로 제출 버튼: `{editSlug ? "수정 완료" : (pending ? "만드는 중…" : "콜라보 카드 등록하기")}` — 기존 버튼 라벨 삼항에 editSlug 우선 분기 추가.
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/register/page.tsx`
3. Verify: 에러 0.
4. Commit: `git commit -am "feat(register): edit 모드 프리필 + updateMakerAction 제출"`

---

## Task 5: 소개서 페이지 우상단 [수정] 버튼 + 비번 모달

**Goal:** /m/[slug]에 수정 진입점. 소유자=바로, 아니면 비번 모달.

**Steps:**

1. CREATE `src/app/m/[slug]/EditButton.tsx`:
   ```tsx
   "use client";

   import { useState, useTransition } from "react";
   import { useRouter } from "next/navigation";
   import { verifyMakerPasswordAction } from "@/lib/actions";

   // 우상단 수정 버튼 — 소유자면 바로, 아니면 비번 모달. 검증 통과 시 edit 진입.
   export function EditButton({ slug, isOwner }: { slug: string; isOwner: boolean }) {
     const router = useRouter();
     const [open, setOpen] = useState(false);
     const [pw, setPw] = useState("");
     const [err, setErr] = useState("");
     const [pending, start] = useTransition();

     const go = () =>
       start(async () => {
         setErr("");
         const r = await verifyMakerPasswordAction(slug, pw);
         if (!r.ok) {
           setErr("비밀번호가 일치하지 않아요.");
           return;
         }
         router.push(`/register?edit=${slug}`);
       });

     const onClick = () => {
       if (isOwner) {
         start(async () => {
           await verifyMakerPasswordAction(slug, ""); // 소유자면 빈 비번으로도 grant 발급
           router.push(`/register?edit=${slug}`);
         });
         return;
       }
       setOpen(true);
     };

     return (
       <>
         <button
           type="button"
           onClick={onClick}
           className="inline-flex h-9 items-center gap-1 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-soft"
         >
           수정
         </button>
         {open && (
           <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
             <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2">
               <p className="text-base font-bold text-ink">소개서 수정</p>
               <p className="mt-1.5 text-sm text-mute">소개서 관리 비밀번호를 입력해주세요.</p>
               <input
                 type="password"
                 value={pw}
                 onChange={(e) => setPw(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === "Enter" && !e.nativeEvent.isComposing) go();
                 }}
                 placeholder="비밀번호"
                 className="mt-4 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
               />
               {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
               <div className="mt-4 flex gap-2">
                 <button
                   type="button"
                   onClick={() => setOpen(false)}
                   className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
                 >
                   취소
                 </button>
                 <button
                   type="button"
                   onClick={go}
                   disabled={pending || !pw.trim()}
                   className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-50"
                 >
                   {pending ? "확인 중…" : "수정하기"}
                 </button>
               </div>
             </div>
           </div>
         )}
       </>
     );
   }
   ```

2. MODIFY `src/app/m/[slug]/page.tsx`:
   - import: `import { getSessionUser } from "@/lib/supabase/server";` 와 `import { EditButton } from "./EditButton";`
   - `const maker = await repo.getMakerBySlug(slug);` 아래에:
     ```tsx
     const user = await getSessionUser();
     const isOwner = !!user && maker.ownerUserId === user.id;
     ```
   - 헤더 영역(`<header>` 안, 브랜드명 `<h1>`이 있는 `<div className="flex flex-wrap items-center gap-2">`)을 우측 수정 버튼과 나란히 두기 위해, `<header>` 여는 태그 바로 다음 줄에 배치. 가장 간단히 `<header>` 안 최상단에 추가:
     ```tsx
       <div className="mb-2 flex justify-end">
         <EditButton slug={maker.slug} isOwner={isOwner} />
       </div>
     ```
3. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint "src/app/m/[slug]/page.tsx" "src/app/m/[slug]/EditButton.tsx"`
4. Verify: 에러 0.
5. Commit: `git commit -am "feat(profile): 소개서 우상단 수정 버튼 + 비번 모달"`

---

## Task 6: 모바일 플로팅 링크 복사

**Goal:** 모바일에서 링크 복사를 스크롤 따라오는 플로팅 버튼으로.

**Steps:**

1. MODIFY `src/app/m/[slug]/CopyLinkButton.tsx` — 컴포넌트가 반환하는 최상위에, 기존 인라인 버튼은 그대로 두고 **모바일 전용 플로팅 버전**을 하나 더 렌더. 반환 JSX를 프래그먼트로 감싸고 아래를 추가:
   ```tsx
       {/* 모바일 플로팅 — sm 미만에서만 */}
       <button
         type="button"
         onClick={copy}
         aria-label="링크 복사"
         className="fixed bottom-4 right-4 z-40 flex h-12 items-center gap-1.5 rounded-pill bg-primary px-5 text-sm font-medium text-primary-on shadow-e2 sm:hidden"
       >
         {copied ? "✓ 복사됨" : "🔗 링크 복사"}
       </button>
   ```
   (기존 인라인 버튼에는 `sm:` 관련 숨김이 없으면 그대로. 데스크탑=인라인, 모바일=인라인+플로팅 둘 다 보이면 과하니, 인라인 버튼 컨테이너에 `hidden sm:block`을 주거나 인라인은 유지하되 플로팅만 `sm:hidden`으로 — 여기선 플로팅만 `sm:hidden`으로 추가하고 인라인은 유지. 필요 시 QA에서 조정.)
2. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint "src/app/m/[slug]/CopyLinkButton.tsx"`
3. Verify: 에러 0.
4. Commit: `git commit -am "feat(profile): 모바일 링크 복사 플로팅 버튼"`

---

## Task 7: /my 목록 + 기존 소개서 연결하기

**Goal:** 내 소유 소개서 목록 + 연결 UI.

**Steps:**

1. CREATE `src/app/my/ConnectMaker.tsx`:
   ```tsx
   "use client";

   import { useState, useTransition } from "react";
   import { useRouter } from "next/navigation";
   import { claimBySlugAction } from "@/lib/actions";

   // 기존 소개서 연결 — URL/슬러그 + 비번. 성공 시 /my 새로고침.
   export function ConnectMaker() {
     const router = useRouter();
     const [open, setOpen] = useState(false);
     const [link, setLink] = useState("");
     const [pw, setPw] = useState("");
     const [err, setErr] = useState("");
     const [pending, start] = useTransition();

     const submit = () =>
       start(async () => {
         setErr("");
         const r = await claimBySlugAction(link, pw);
         if (r.error) {
           setErr(r.error);
           return;
         }
         setOpen(false);
         router.refresh();
       });

     if (!open)
       return (
         <button
           type="button"
           onClick={() => setOpen(true)}
           className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-ink"
         >
           기존 소개서 연결하기
         </button>
       );

     return (
       <div className="rounded-md border border-hairline bg-surface p-4 text-left">
         <p className="text-sm font-medium text-body">소개서 링크와 관리 비밀번호를 입력해주세요.</p>
         <input
           value={link}
           onChange={(e) => setLink(e.target.value)}
           placeholder="소개서 링크 또는 m-xxxxxx"
           className="mt-3 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
         />
         <input
           type="password"
           value={pw}
           onChange={(e) => setPw(e.target.value)}
           placeholder="관리 비밀번호"
           className="mt-2 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
         />
         {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
         <p className="mt-2 text-[13px] text-faint">
           링크를 모르겠다면 <a href="/search" className="underline">찾기</a>에서 내 브랜드를 검색해 링크를 확인해보세요.
         </p>
         <div className="mt-3 flex gap-2">
           <button
             type="button"
             onClick={() => setOpen(false)}
             className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
           >
             취소
           </button>
           <button
             type="button"
             onClick={submit}
             disabled={pending || !link.trim() || !pw.trim()}
             className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-50"
           >
             {pending ? "연결 중…" : "연결하기"}
           </button>
         </div>
       </div>
     );
   }
   ```

2. MODIFY `src/app/my/page.tsx`:
   - import: `import { repo } from "@/lib/repo";` · `import { ConnectMaker } from "./ConnectMaker";`
   - `const profile = await getProfile(user.id);` 아래에:
     ```tsx
     const makers = await repo.listMakersByOwner(user.id);
     ```
   - "내 소개서" 섹션의 빈 상태 블록(`<div className="mt-4 rounded-md border border-dashed ...">...</div>`)을 다음으로 교체:
     ```tsx
             {makers.length === 0 ? (
               <div className="mt-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
                 <p className="text-[15px] text-mute">아직 연결된 소개서가 없어요.</p>
                 <div className="mt-4 flex flex-col items-center gap-2">
                   <a
                     href="/register"
                     className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-on"
                   >
                     소개서 만들기
                   </a>
                   <ConnectMaker />
                 </div>
               </div>
             ) : (
               <div className="mt-4 space-y-2">
                 {makers.map((m) => (
                   <div
                     key={m.slug}
                     className="flex items-center justify-between rounded-md border border-hairline bg-surface px-4 py-3"
                   >
                     <div className="min-w-0">
                       <p className="truncate text-[15px] font-medium text-ink">{m.name}</p>
                       {m.oneLiner && <p className="truncate text-sm text-mute">{m.oneLiner}</p>}
                     </div>
                     <div className="flex shrink-0 gap-2">
                       <a href={`/m/${m.slug}`} className="rounded-md px-3 py-1.5 text-sm text-mute hover:text-ink">
                         보기
                       </a>
                       <a
                         href={`/register?edit=${m.slug}`}
                         className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink"
                       >
                         수정
                       </a>
                     </div>
                   </div>
                 ))}
                 <div className="pt-2">
                   <ConnectMaker />
                 </div>
               </div>
             )}
     ```
     (소유자의 `/register?edit=` 직행은 edit 페이지가 서버에서 소유자 grant를 발급하도록 Task 4의 getEditDataAction이 `hasEditGrant`로 소유자 통과시킴 — 소유자는 쿠키 없이도 owner 매칭으로 통과.)
3. Run: `cd ~/Desktop/collab5 && npx tsc --noEmit && npx eslint src/app/my/page.tsx src/app/my/ConnectMaker.tsx`
4. Verify: 에러 0.
5. Commit: `git commit -am "feat(my): 내 소개서 목록 + 기존 소개서 연결하기"`

---

## 최종 검증
- `npx tsc --noEmit` + 전체 eslint 클린. prod build(`npx next build`) 통과.
- **대표 작업:** 레거시 `m-6tjod7` 귀속 SQL(가입 후 user_id 확인): `UPDATE makers SET owner_user_id='(내 user_id)' WHERE slug='m-6tjod7';`
- **배포 후 QA(대표):** 비회원 생성→비번 설정→로그아웃 다른 기기서 수정(비번)→로그인 후 /my 연결(URL+비번)→소유자 바로 수정. + ⚠️ **비번 소유권 UX 마음에 드는지 판정**(스펙 게이트).
