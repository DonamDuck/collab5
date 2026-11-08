// 로그인 뒤 돌아갈 주소 (2026-11-09) — 브라우저에서만 부른다.
//
// ⭐ 왜 탭 저장소(sessionStorage)에 맡기나
//    이메일 로그인은 `/login?redirect=…`을 그대로 읽고 끝난다. 그런데 카카오·구글은
//    카카오(또는 구글) → `/welcome`을 한 바퀴 돌고 오는 사이에 그 쿼리가 사라져서, 늘 홈으로 갔다.
//    카카오 `redirectTo`에 쿼리를 붙이는 길은 피했다 — Supabase가 그 주소를 허용 목록과 맞춰 보는데
//    쿼리가 붙은 주소가 통과하는지 확인하지 못했고, 안 맞으면 «사이트 기본 주소(홈)»로 떨어져
//    온보딩을 건너뛴 계정이 생길 수 있다(KakaoButton 머리말). 카카오 왕복은 우리가 직접 시험할 수 없다.
//    그래서 주소는 건드리지 않고, 로그인 화면에 들어온 순간 같은 탭 저장소에 적어 두었다가
//    `/welcome`이 홈으로 보내려던 자리에서 꺼낸다. 같은 탭·같은 사이트라 카카오를 다녀와도 남는다.
//    ⚠️못 꺼내면(저장소 막힘·다른 탭에서 끝냄) 예전처럼 홈으로 간다. 망가지는 쪽은 없다.
//
// 🔒 우리 사이트 안 경로만 돌려준다 (09-18 밤 QA — login/page.tsx에서 옮겨 왔다).
//    예전 검사(`/`로 시작하고 `//`로 시작하지 않음)는 `/\evil.example`이나 탭이 낀 `/\t/evil.example`을
//    통과시켰고, 브라우저는 그걸 남의 사이트 주소로 읽었다. 글자 모양 대신 «실제로 해석한 주소의 origin»을 비교한다.

const KEY = "collab5:return-path";

/** 우리 사이트 안 경로면 그 경로, 아니면 null. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** 로그인 화면에 들어올 때 부른다. 돌아갈 곳이 없으면 예전 값을 지운다(남은 값이 엉뚱한 로그인에 붙지 않게). */
export function rememberReturnPath(raw: string | null | undefined): void {
  try {
    const p = safeReturnPath(raw);
    if (p && p !== "/") sessionStorage.setItem(KEY, p);
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장소가 막힌 브라우저 — 소셜 로그인은 예전처럼 홈으로 간다
  }
}

/** 로그인이 끝난 자리에서 한 번 꺼내고 지운다. 없으면 홈. */
export function takeReturnPath(): string {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safeReturnPath(v) ?? "/";
  } catch {
    return "/";
  }
}
