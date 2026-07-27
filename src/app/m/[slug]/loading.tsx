// 소개서 페이지 로딩 — 클릭 즉시 표시(서버 렌더 대기 동안 빈 화면/멈춤 방지).
import { LoadingDots } from "@/components/LoadingDots";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[640px] flex-col items-center justify-center px-4 text-center">
      <LoadingDots />
      <p className="mt-4 text-[15px] text-mute">소개서를 불러오는 중이에요…</p>
    </main>
  );
}
