// 매거진 글 로딩 — 클릭 즉시 표시(`/m/[slug]`의 같은 파일과 짝).
//
// 🚨**「미리 읽어두기(prefetch)」를 켜려고 만든 게 아니다 — 그건 안 됐다**(2026-08-31 실측).
//    Next 문서는 *"Dynamic Route: … partially prefetched if loading.tsx is present"*라고 하지만,
//    이 앱에선 이 파일을 넣어도 `/magazine/[slug]` 프리페치 요청이 **한 건도 안 나갔다.**
//    ⭐대조군까지 확인한 값이다 — 같은 화면·같은 브라우저에서 정적 라우트(`/`·`/login`·`/search`·
//      `/magazine`)는 `?_rsc=` 요청이 정상적으로 나갔고, 동적 라우트만 안 나갔다.
//      `/m/[slug]`도 마찬가지다(loading.tsx가 예전부터 있는데 /search의 브랜드 링크 15개 중 0건).
//    👉원인은 링크 방식이 아니라 **레이아웃이 요청 시점에 세션을 읽는 것**으로 보인다
//      (`app/layout.tsx` → `SiteHeader` → `getSessionUserLight`). 확증 아님 — 손대려면 따로 잰다.
//
// ✅그래서 이 파일이 실제로 버는 것은 하나다: **누른 직후 빈 화면 대신 이 화면이 뜬다.**
//    작지만 진짜다(서버 렌더를 기다리는 동안 멈춘 것처럼 보이지 않는다).
import { LoadingDots } from "@/components/LoadingDots";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[720px] flex-col items-center justify-center px-4 text-center">
      <LoadingDots />
      <p className="mt-4 text-[15px] text-mute">글을 불러오는 중이에요…</p>
    </main>
  );
}
