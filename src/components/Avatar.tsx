// 아바타 — image 있으면 사진, 없으면 name 첫 글자(예: 송영덕 → 송).
// 헤더·/my·signup 미리보기·(추후) 찾기 카드에서 공용.
// 디자인 확정(2026-07-05, design.md §Avatar):
//  - 폴백 배경 = 4색 로테이션(kiwi/mint/lemon/corn pale, 이름 해시 결정론 — 같은 브랜드는 항상 같은 색).
//    Kiwi 틴트 "고정"이면 그리드 도배(희소성 위반)라, 4색 중 하나로만 등장(≈25%)해 브랜드색은 살리되 도배는 피함.
//  - shape: circle(기본, 계정·프로필) / square(rounded-md, 브랜드 로고 맥락 — 로고는 원형 크롭하지 않는다).
//  - 사이즈 표준 스텝: 24 / 32 / 40 / 48 / 56 / 64.

const FALLBACK_PALETTES = [
  { bg: "bg-primary-tint", text: "text-primary-on" },
  { bg: "bg-mint-pale", text: "text-mint-on" },
  { bg: "bg-lemon-pale", text: "text-lemon-on" },
  { bg: "bg-corn-pale", text: "text-corn-on" },
] as const;

/** 이름 → 고정 파스텔 (결정론 해시) */
function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_PALETTES[Math.abs(h) % FALLBACK_PALETTES.length];
}

export function Avatar({
  image,
  name,
  size = 32,
  shape = "circle",
}: {
  image?: string;
  name: string;
  size?: number;
  /** circle=계정·프로필(기본) / square=브랜드 로고 맥락(찾기 카드 등, rounded-md) */
  shape?: "circle" | "square";
}) {
  const rounded = shape === "square" ? "rounded-md" : "rounded-pill";
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 border border-hairline object-cover ${rounded}`}
      />
    );
  }
  const palette = paletteFor(name.trim() || "?");
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      className={`inline-flex shrink-0 items-center justify-center font-bold ${rounded} ${palette.bg} ${palette.text}`}
      aria-label={name}
    >
      {initial}
    </span>
  );
}
