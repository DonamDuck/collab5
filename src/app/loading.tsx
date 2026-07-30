// 홈 로딩 폴백 — **없어서 홈 이동이 "멈춘 것처럼" 느렸다**(대표 제보 07-31).
// 홈은 `revalidate = 300`이라 정적일 것 같지만, 레이아웃의 SiteHeader가 세션·프로필을 읽어
// 매 요청 동적 렌더가 된다. 그런데 /search·/my·/m와 달리 홈에만 loading.tsx가 없어서,
// 로고를 눌러도 서버 응답이 올 때까지 **화면이 이전 페이지에 그대로 멈춰** 있었다.
// 이 파일 하나로 클릭 즉시 골격이 뜬다(실제 응답 속도가 아니라 '반응하는 느낌'의 문제였다).
import { LoadingDots } from "@/components/LoadingDots";

export default function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
      {/* 히어로 골격 — 실제 홈과 같은 폭·정렬이라 도착 시 덜컹거리지 않는다 */}
      <section className="mx-auto max-w-[600px] text-center">
        <div className="mx-auto mb-4 h-7 w-28 rounded-pill bg-surface-soft" />
        <div className="mx-auto h-9 w-[86%] rounded-md bg-surface-soft sm:h-12" />
        <div className="mx-auto mt-3 h-9 w-[70%] rounded-md bg-surface-soft sm:h-12" />
        <div className="mx-auto mt-6 h-6 w-[64%] rounded-md bg-surface-soft" />
        <div className="mx-auto mt-2.5 h-5 w-[52%] rounded-md bg-surface-soft" />
        <div className="mt-7 flex justify-center">
          <div className="h-12 w-full rounded-md bg-surface-soft sm:w-52" />
        </div>
      </section>
      <div className="mt-16 flex justify-center" role="status" aria-label="홈을 불러오는 중이에요">
        <LoadingDots />
      </div>
    </main>
  );
}
