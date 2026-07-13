// /m/[slug] 로딩 경계 — Link/router 이동 시 즉시 표시되는 스켈레톤.
// 동적 라우트라 이 loading 경계까지 prefetch됨(체감속도↑). 실제 레이아웃(max-w-640)과 폭·리듬 일치.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6" aria-hidden="true">
      <div className="animate-pulse">
        {/* 헤더 — 브랜드명 + 한 줄 소개 */}
        <div className="h-9 w-1/2 rounded-md bg-surface-soft" />
        <div className="mt-3 h-5 w-3/4 rounded-md bg-surface-soft" />
        {/* 신뢰 뱃지 */}
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-28 rounded-sm bg-surface-soft" />
          <div className="h-8 w-24 rounded-sm bg-surface-soft" />
        </div>
        {/* 사진 슬라이드 */}
        <div className="mt-7 aspect-[4/3] w-full max-w-[460px] rounded-lg bg-surface-soft" />
        {/* 본문 섹션 2개 */}
        <div className="mt-8 space-y-2.5">
          <div className="h-5 w-40 rounded-md bg-surface-soft" />
          <div className="h-4 w-full rounded-md bg-surface-soft" />
          <div className="h-4 w-11/12 rounded-md bg-surface-soft" />
          <div className="h-4 w-4/5 rounded-md bg-surface-soft" />
        </div>
        <div className="mt-8 space-y-2.5">
          <div className="h-5 w-32 rounded-md bg-surface-soft" />
          <div className="h-4 w-full rounded-md bg-surface-soft" />
          <div className="h-4 w-3/4 rounded-md bg-surface-soft" />
        </div>
      </div>
    </main>
  );
}
