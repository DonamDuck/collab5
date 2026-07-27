// 화면 중앙 로딩 오버레이 — 점 3개가 통통 튀는 로더(LoadingDots) + 라벨.
// 로그인·가입 등 처리 대기 중 화면 위 레이어로 표시.
import { LoadingDots } from "./LoadingDots";

export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface/45 backdrop-blur-[1.5px]">
      <LoadingDots />
      {label && <p className="mt-5 text-[15px] text-mute">{label}</p>}
    </div>
  );
}
