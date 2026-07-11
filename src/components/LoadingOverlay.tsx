// 화면 중앙 로딩 오버레이 — 점 3개가 순서대로 통통 튀는 애니메이션(1·2·3).
// 로그인·가입 등 처리 대기 중 화면 위 레이어로 표시.
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-3.5 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
        <span className="h-3.5 w-3.5 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
        <span className="h-3.5 w-3.5 rounded-full bg-primary animate-bounce" />
      </div>
      {label && <p className="mt-5 text-[15px] text-mute">{label}</p>}
    </div>
  );
}
