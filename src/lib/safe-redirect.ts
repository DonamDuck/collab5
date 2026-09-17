// 로그인·가입·소셜 온보딩이 «돌아갈 주소»를 고르는 한 벌 (2026-09-18 밤 QA SC-05)
//
// 🔒한 벌로 두는 이유 — 로그인 화면(`/login`)만 읽던 `?redirect=`를 가입(`/signup`)과 소셜 온보딩(`/welcome`)도 읽게 됐다.
//   검사를 화면마다 따로 적으면 한 곳이 느슨해지는 날 거기가 남의 사이트로 튕기는 구멍이 된다.
// 🔒글자 모양(`/`로 시작하고 `//`로 시작하지 않음)이 아니라 «실제로 해석한 주소의 origin»을 본다(09-18 밤 보안 QA).
//   예전 검사는 `/\evil.example`이나 탭이 낀 `/\t/evil.example`을 통과시켰고, 브라우저는 그걸 남의 사이트 주소로 읽었다.
// 🩸origin 비교 한 번으로도 모자랐다(09-18 밤 실측). `/.//evil.example`은 우리 origin으로 해석되는데, 경로만 꺼내면
//   `//evil.example`이 되고 브라우저는 그걸 «프로토콜 상대 주소»로 읽어 남의 사이트로 간다. 그래서 꺼낸 경로를 한 번 더 해석해 본다.

/** 렌더 중에 쓰는 기준 origin. 서버에는 `window`가 없어서 둔다.
 *  `.invalid`는 실제로 있을 수 없는 이름이라(RFC 2606) 어떤 사이트와도 겹치지 않는다. 결과는 늘 우리 사이트 안 «경로»만 나온다. */
const RENDER_ORIGIN = "http://collab5.invalid";

/** 돌아갈 주소를 우리 사이트 안 경로로만 돌려준다. 비었거나 밖을 가리키면 `/`.
 *  이동 직전(이벤트 처리 안)에는 `window.location.origin`을 넘긴다. 렌더 중에는 비워 둔다. */
export function safeRedirect(raw: string | null | undefined, origin: string = RENDER_ORIGIN): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw, origin);
    if (u.origin !== origin) return "/";
    const path = u.pathname + u.search + u.hash;
    if (new URL(path, origin).origin !== origin) return "/";
    return path;
  } catch {
    return "/";
  }
}

// ─── 소셜 로그인 왕복 동안 맡겨 두기 ───
// 카카오는 우리 사이트 → 카카오 → supabase → `/welcome`으로 돌아오고, 구글은 팝업 뒤 `/welcome`으로 옮긴다.
// ⭐돌아오는 주소(`redirectTo`)에 복귀 경로를 붙이지 않는다. 붙이면 Supabase의 Redirect URL 허용 목록을 고쳐야 하고,
//   목록에 없는 주소는 조용히 사이트 기본 주소로 떨어진다. 대신 같은 탭의 sessionStorage에 맡긴다.
//   sessionStorage는 같은 탭이 남의 사이트를 다녀와도 남는다. 새 탭으로 열리는 흐름이면 비어 있고, 그땐 예전처럼 홈으로 간다.

const SOCIAL_REDIRECT_KEY = "collab5:social-redirect";

/** 소셜 버튼이 떠나기 직전에 부른다. 지금 화면의 `?redirect=`를 맡긴다.
 *  없으면 예전에 맡긴 값을 지운다. 다른 화면에서 맡겨 둔 경로가 엉뚱한 로그인 뒤에 쓰이지 않게. */
export function stashSocialRedirect(): void {
  try {
    const path = safeRedirect(new URLSearchParams(window.location.search).get("redirect"), window.location.origin);
    if (path === "/") sessionStorage.removeItem(SOCIAL_REDIRECT_KEY);
    else sessionStorage.setItem(SOCIAL_REDIRECT_KEY, path);
  } catch {
    // 저장소를 막아 둔 브라우저면 맡기지 못한다. 그땐 예전처럼 홈으로 간다.
  }
}

/** `/welcome`이 끝날 때 부른다. 맡겨 둔 경로를 꺼내 지우고, 다시 검사해 돌려준다. 없으면 `/`. */
export function takeSocialRedirect(): string {
  try {
    const raw = sessionStorage.getItem(SOCIAL_REDIRECT_KEY);
    sessionStorage.removeItem(SOCIAL_REDIRECT_KEY);
    return safeRedirect(raw, window.location.origin);
  } catch {
    return "/";
  }
}
