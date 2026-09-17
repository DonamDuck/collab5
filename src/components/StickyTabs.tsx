import Link from "next/link";

// 🗂한 화면을 두 칸으로 나누는 탭 — 헤더 밑에 붙어 따라오는 밑줄 탭 (2026-09-18 대표)
//
// 🔁09-18 같은 날 두 번 바뀌었다.
//   ① 가운데 떠 있는 흰 알약(`FloatingTabs`) — 대표: *「플로팅 안 이쁘다」* · *「알약이 중앙에 조그마하게 있으니 어색함」*.
//      작은 알약은 «이 화면 안의 큰 갈래»를 말하기엔 무게가 모자라고, 가운데 떠 있어 옆의 헤더·제목과 줄이 안 맞았다.
//   ② 지금 — **칸 폭을 꽉 채운 두 칸 + 켜진 칸 밑의 굵은 선**(원티드·리멤버 웹의 상단 탭). 칸이 화면 폭을 나눠 가져서
//      「두 세계가 같은 무게」가 모양으로 읽히고, 제목·본문과 같은 세로줄에 선다.
// 📌헤더 밑에 붙어 따라온다(`sticky top-14` = 헤더 높이, 루트 17px이라 실제 59.5px). 바탕은 지면색에 살짝 비치게 —
//   스크롤하는 글이 탭 밑으로 지나갈 때 글자가 겹쳐 읽히지 않게 한다.
// ⚠️여백은 `className`으로 — 바깥에 상자를 하나 더 감싸면 sticky가 그 상자 안에서만 붙어 따라오지 않는다.
export function StickyTabs({
  label,
  items,
  active,
  className = "",
}: {
  label: string;
  items: { key: string; label: string; href: string; dot?: boolean }[];
  active: string;
  className?: string;
}) {
  return (
    <div className={`sticky top-14 z-[6] -mx-4 bg-canvas/90 px-4 backdrop-blur-sm sm:-mx-6 sm:px-6 ${className}`}>
      <nav aria-label={label} className="flex border-b border-hairline">
        {items.map((it) => {
          const on = it.key === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`relative flex h-[52px] flex-1 items-center justify-center gap-1.5 text-[16px] transition-colors ${
                on ? "font-bold text-ink" : "font-medium text-mute hover:text-body"
              }`}
            >
              {it.label}
              {/* 다른 칸을 보고 있어도 «할 일이 있다»를 알 수 있게 작은 점. */}
              {it.dot && <span aria-label="새 요청 있음" className="size-[7px] rounded-full bg-lemon-on" />}
              {/* 켜진 칸의 선 — 아래 1px 선 위에 겹쳐 앉는다(-bottom-px). */}
              {on && <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-[2px] bg-ink" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
