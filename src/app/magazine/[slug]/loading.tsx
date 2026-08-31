// 매거진 글 로딩 — 클릭 즉시 표시(`/m/[slug]`의 같은 파일과 짝).
// 누른 직후 빈 화면 대신 이 화면이 뜬다(서버 렌더를 기다리는 동안 멈춘 것처럼 보이지 않게).
//
// 🩸**08-31 정정 — 이 파일의 첫 주석은 «틀린 실측»을 근거로 쓰여 있었다.**
//    처음엔 *"loading.tsx를 넣어도 프리페치가 0건이었다"*고 적었는데,
//    그때 **브라우저 탭이 `hidden` 상태**였다. 브라우저는 안 보이는 탭에서 프리페치를 하지 않는다.
//    ⭐창을 앞으로 띄우고 다시 재니 **정상 동작**이었다(운영 실측, 2회 재현):
//      `/search` 한 화면에서 프리페치 42건 · 그중 소개서 28건 · **서로 다른 소개서 15곳 전부**.
//    👉프리페치는 **원래 잘 되고 있었다.** 이 파일이 그걸 켜거나 끄지 않는다.
//    📌교훈 = **「저쪽은 되는데 이쪽만 안 된다」의 «저쪽»을 직접 확인하라.**
//      그때 대조군으로 삼은 정적 라우트의 요청은 «다른 페이지에서 넘어온 옛 것»이었다.
import { LoadingDots } from "@/components/LoadingDots";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[720px] flex-col items-center justify-center px-4 text-center">
      <LoadingDots />
      <p className="mt-4 text-[15px] text-mute">글을 불러오는 중이에요…</p>
    </main>
  );
}
