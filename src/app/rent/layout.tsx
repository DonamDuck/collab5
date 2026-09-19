import { getSessionUserLight } from "@/lib/supabase/server";
import { RentMenuBar } from "./RentMenuBar";

// 하루 가게 구역 레이아웃 (2026-09-14)
//
// ⭐**바가 여기 있는 이유는 「부드럽게 옮겨 가는」 초록 때문이다**(대표 09-14).
//   처음엔 두 페이지가 각자 `<RentMenuBar />`를 그렸는데, 그러면 탭을 누를 때 컴포넌트가 **통째로
//   새로 태어나서** 옮겨 갈 이전 자리가 없다. CSS 전환은 «같은 요소»가 움직일 때만 생긴다.
//   레이아웃에 두면 페이지만 갈리고 바는 살아 있어서, 알약이 옛 자리에서 새 자리로 미끄러진다.
//
// ⚠️이 레이아웃은 `/rent/**` 전부를 감싼다. 바를 어디에 보일지는 **바가 스스로 정한다**
//   (`RentMenuBar`가 경로를 보고 두 탭 화면이 아니면 `null`). 레이아웃에서 갈라 두면
//   화면이 늘 때마다 여기도 같이 고쳐야 하는데, 판정이 두 군데 있으면 언젠가 어긋난다.
// 🎫09-19 대표 [H] — 로그인한 사람에게만 바에 「내 예약」 칸이 붙는다. 표시용이라 쿠키의 세션만 읽는다
//   (`getSessionUserLight`, 네트워크 없음 — 헤더와 같은 판정). 권한 게이트는 가는 화면(`/rent/my`)이 따로 한다.
export default async function RentLayout({ children }: { children: React.ReactNode }) {
  const signedIn = !!(await getSessionUserLight());
  return (
    <>
      <RentMenuBar signedIn={signedIn} />
      {children}
    </>
  );
}
