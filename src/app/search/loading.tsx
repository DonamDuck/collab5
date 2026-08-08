// 콜라보 찾기 로딩 — 이동 즉시 표시. 스피너 대신 **실제 레이아웃의 스켈레톤**을 그린다.
// 목록 화면은 "무엇이 올지" 모양이 정해져 있어, 뼈대를 먼저 보여주면 체감 대기가 짧고
// 데이터 도착 시 레이아웃이 덜컹거리지 않는다(제목·검색바는 정적이라 진짜 내용으로 그린다).
const CARDS = 6;

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6 lg:max-w-4xl">
      <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">콜라보 찾기</h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">잘 맞는 콜라보 파트너를 찾아보세요.</p>

      <div className="mt-5 h-11 max-w-xl animate-pulse rounded-pill bg-surface-soft" />

      <div className="mt-3 flex flex-wrap gap-2">
        {[64, 48, 56, 72, 72, 64, 64].map((w, i) => (
          <div key={i} className="h-8 animate-pulse rounded-pill bg-surface-soft" style={{ width: w }} />
        ))}
      </div>

      <ul className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: CARDS }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-hairline bg-surface">
            <div className="aspect-[3/2] w-full animate-pulse bg-surface-soft" />
            <div className="px-4 py-3">
              <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-soft" />
              <div className="mt-2 h-3 w-full animate-pulse rounded-sm bg-surface-soft" />
              <div className="mt-2 flex gap-1.5">
                <div className="h-4 w-12 animate-pulse rounded-sm bg-surface-soft" />
                <div className="h-4 w-10 animate-pulse rounded-sm bg-surface-soft" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="sr-only">브랜드 목록을 불러오는 중이에요…</p>
    </main>
  );
}
