// 점 3개 바운스 로더 (공용) — 진폭 95%(점 높이 기준) · 1s · 중력 타이밍(위로 감속·아래로 가속).
// keyframe은 자족(globals.css 미의존), delay만 인라인. LoadingOverlay·route loading.tsx 등에서 재사용.
export function LoadingDots() {
  return (
    <div className="flex items-center gap-2">
      <style>{`
@keyframes koko-dot-bounce{0%,100%{transform:translateY(0);animation-timing-function:cubic-bezier(.8,0,1,1)}50%{transform:translateY(-95%);animation-timing-function:cubic-bezier(0,0,.2,1)}}
.koko-dot{animation:koko-dot-bounce 1s infinite}
`}</style>
      <span className="koko-dot h-3.5 w-3.5 rounded-full bg-primary" style={{ animationDelay: "-0.32s" }} />
      <span className="koko-dot h-3.5 w-3.5 rounded-full bg-primary" style={{ animationDelay: "-0.16s" }} />
      <span className="koko-dot h-3.5 w-3.5 rounded-full bg-primary" />
    </div>
  );
}
