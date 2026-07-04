// 원형 아바타 — image 있으면 사진, 없으면 name 첫 글자(예: 송영덕 → 송).
// 헤더·/my·(추후) 찾기 카드에서 공용.
export function Avatar({
  image,
  name,
  size = 32,
}: {
  image?: string;
  name: string;
  size?: number;
}) {
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
        className="shrink-0 rounded-pill border border-hairline object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      className="inline-flex shrink-0 items-center justify-center rounded-pill bg-primary-tint font-bold text-primary-on"
      aria-label={name}
    >
      {initial}
    </span>
  );
}
