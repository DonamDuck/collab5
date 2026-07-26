// 화면 중앙 로딩 오버레이 — 점 3개가 순서대로 통통 튀는 애니메이션(1·2·3).
// 로그인·가입 등 처리 대기 중 화면 위 레이어로 표시.
// 바운스: 진폭 95%(점 높이 기준) · 1s · 중력 타이밍(위로 감속·아래로 가속).
//  keyframe은 이 컴포넌트에 자족적으로 둔다(globals.css 미의존). delay만 인라인.
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface/45 backdrop-blur-[1.5px]">
      <style>{`
@keyframes koko-dot-bounce{0%,100%{transform:translateY(0);animation-timing-function:cubic-bezier(.8,0,1,1)}50%{transform:translateY(-95%);animation-timing-function:cubic-bezier(0,0,.2,1)}}
.koko-dot{animation:koko-dot-bounce 1s infinite}
`}</style>
      <div className="flex items-center gap-2">
        <span className="koko-dot h-3.5 w-3.5 rounded-full bg-primary" style={{ animationDelay: "-0.32s" }} />
        <span className="koko-dot h-3.5 w-3.5 rounded-full bg-primary" style={{ animationDelay: "-0.16s" }} />
        <span className="koko-dot h-3.5 w-3.5 rounded-full bg-primary" />
      </div>
      {label && <p className="mt-5 text-[15px] text-mute">{label}</p>}
    </div>
  );
}
