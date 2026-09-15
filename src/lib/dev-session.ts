import type { User } from "@supabase/supabase-js";

// 로컬 전용 «가짜 로그인» (2026-09-14)
//
// 대표 09-14: *「로컬에 아이디 만들지 말고, 그냥 임의 계정으로 로그인 상태로 만들어서 my 페이지에 ui 하나만」*
//
// 왜 필요한가 — 로컬 작업트리엔 `NEXT_PUBLIC_SUPABASE_*`가 없다. 그래서 `authEnabled()`가 false이고
// `getSessionUser()`가 늘 null이라 `/my`가 무조건 `/login`으로 튕긴다. 화면을 볼 방법이 없다.
// ⛔그렇다고 계정을 만들 수는 없다 — 로컬이 바라보는 인증은 결국 «운영»이라, 만들면 진짜 계정이 된다.
// ⭕그래서 **계정을 만들지 않고 «세션만» 흉내 낸다.** DB도 안 건드린다(설정이 없어 InMemoryRepo가 뜬다).
//
// 🚨**게이트가 셋이다. 하나라도 풀면 안 된다.**
//   ① `NODE_ENV === "development"` — 운영 번들에선 이 값이 상수로 박혀 아래가 통째로 죽는다
//   ② `!authEnabled()` — **진짜 인증이 설정된 환경에선 절대 끼어들지 않는다.** 로컬에 키를 넣는 순간
//      이 길은 자동으로 닫히고 진짜 로그인이 돌아온다. 「끄는 걸 잊는」 사고가 구조적으로 안 난다
//   ③ 이 파일은 «읽기»만 한다 — 쿠키도 안 굽고 토큰도 안 만든다. 서버가 잠깐 그렇다고 «치는» 것뿐이다
//
// ⚠️이 사람으로는 아무것도 못 바꾼다. 프로필 조회가 null이라 소유·찜·리포트가 전부 빈 목록이고,
//   저장 경로는 어차피 프로필을 요구한다. **보기 전용이다.**

/** 로컬에서만 쓰는 임의 사람. 실재하지 않는 주소를 쓴다(누구의 계정과도 안 겹치게). */
const DEV_USER = {
  id: "00000000-0000-4000-8000-00000000dev1",
  email: "local@dev.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { brand_name: "로컬 미리보기" },
  created_at: "2026-01-01T00:00:00.000Z",
} as unknown as User;

/** 지금 «가짜 로그인»을 쓸 상황인가. 게이트 ①②가 여기 한 곳에 모여 있다. */
export function devSessionActive(authConfigured: boolean): boolean {
  return process.env.NODE_ENV === "development" && !authConfigured;
}

export function devUser(): User {
  return DEV_USER;
}

/** 로컬 세션이 «가진 것으로 칠» 소개서 slug.
 *  ⭐우회가 아니라 «입력»이다 — 화면은 여전히 진짜 규칙(내 소개서 slug와 맞는 브리프만)을 탄다.
 *    그래서 이 목록을 비우면 절이 사라지는 것까지 로컬에서 확인할 수 있다.
 *  ⚠️실재하는 slug를 쓴다. 배포본에는 이 파일이 통째로 안 들어간다. */
export const DEV_OWNED_SLUGS = ["m-7wu2d0", "m-m71m0b"];
