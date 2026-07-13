// /my 로딩 — 클릭 즉시 표시(서버 렌더 대기 동안 빈 화면/멈춤 방지).
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[640px] flex-col items-center justify-center px-4 text-center">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
        <span className="h-3 w-3 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
        <span className="h-3 w-3 rounded-full bg-primary animate-bounce" />
      </div>
      <p className="mt-4 text-[15px] text-mute">내 소개서를 불러오는 중이에요…</p>
    </main>
  );
}
