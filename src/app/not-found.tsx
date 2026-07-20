import Link from "next/link";

// 전역 404 — 삭제·오타된 소개서 링크의 도착지. 링크 공유가 핵심 동선이라
// 기본 영문 페이지 대신 우리 톤으로 안내하고 다음 행동(찾기·만들기)을 준다.
// 스트리밍 응답이라 HTTP 상태는 200이지만 Next가 noindex 메타를 넣어 색인은 막힌다.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="text-[15px] font-medium text-faint">404</p>
      <h1 className="mt-2 text-[22px] font-bold text-ink">
        찾으시는 페이지가 없어요
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-mute">
        주소가 바뀌었거나 삭제된 소개서일 수 있어요.
      </p>
      <div className="mt-7 flex w-full max-w-[280px] flex-col gap-2">
        <Link
          href="/search"
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
        >
          메이커 찾아보기
        </Link>
        <Link
          href="/"
          className="flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
