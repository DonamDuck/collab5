// 버튼 위에 덮는 로딩 막 — 소셜 로그인 버튼 공용(카카오·구글).
//
// ⭐ 왜 버튼 안에서 처리하나 (대표 지시 08-15 "레이어 처리해서 좀 극적으로")
//    ①버튼 밖에 문구를 덧붙이면 **레이아웃이 밀린다** — 아래 버튼이 눌리는 순간 내려앉는다.
//    ②소셜 로그인은 여기서 끝이 아니라 **다른 화면으로 넘어가는 중**이라, 눌린 버튼 자체가
//      "지금 이걸 하는 중"이라고 말해주는 게 가장 정확하다.
//    원래 라벨을 지우지 않고 **반투명으로 덮으므로**, 무엇을 누른 건지가 뒤에 비쳐 남는다.
//
// ⚠️ `inset-0`으로 부모를 채우므로 **부모가 `relative`(또는 `[data-gsi]`처럼 grid 한 칸)** 여야 한다.
// ⚠️ 클릭을 **막는다**(pointer-events 기본값) — 로딩 중 한 번 더 눌러 팝업이 두 번 뜨는 걸 방지.
export function ButtonBusyVeil({ label }: { label: string }) {
  return (
    <span
      data-gsi-veil
      // aria-live 없이 role="status" — 문구가 바뀌는 게 아니라 나타났다 사라지므로 등장만 읽히면 된다.
      role="status"
      className="absolute inset-0 z-30 flex items-center justify-center gap-2 rounded-md bg-surface/80 backdrop-blur-[2px]"
    >
      <style>{`
@keyframes koko-veil-dot{0%,100%{opacity:.25}50%{opacity:1}}
.koko-veil-dot{animation:koko-veil-dot 1.1s infinite}
@media (prefers-reduced-motion: reduce){.koko-veil-dot{animation:none;opacity:.6}}
`}</style>
      <span className="flex items-center gap-1" aria-hidden="true">
        {/* 점은 **글자색을 따른다**(bg-current) — 카카오는 검정 글자, 구글은 본문색이라 각 버튼에 맞는다.
            LoadingDots(연두 14px)를 안 쓴 이유: 브랜드 면색 위에서 우리 primary가 튄다. */}
        <span className="koko-veil-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: "-0.3s" }} />
        <span className="koko-veil-dot h-1.5 w-1.5 rounded-full bg-current" style={{ animationDelay: "-0.15s" }} />
        <span className="koko-veil-dot h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      <span className="text-[15px] font-medium">{label}</span>
    </span>
  );
}
