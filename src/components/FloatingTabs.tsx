import Link from "next/link";

// 🫧가운데 떠 있는 알약 탭 — 한 화면 안을 두 칸으로 나눌 때 (2026-09-18 대표)
//
// 대표 코멘트: *「이거 플로팅 탭으로 하는 거 어때?」* · *「뭔가 중앙 플로팅이면 어떨까?」*
// ⭐생김새는 하루 가게 메뉴바(`app/rent/RentMenuBar.tsx`)와 같은 값이다 — 가운데 · 0.5px 선 · shadow-e2 · 켜진 칸 primary-tint.
//   같은 사이트의 같은 층이라 새 어휘를 만들지 않는다.
// ⚠️메뉴바와 달리 **칸 사이를 미끄러지는 알약은 없다.** 칸마다 주소(`?tab=`·`?area=`)가 바뀌어 서버가 다시 그리므로
//   움직일 «같은 요소»가 남지 않는다. 대신 누르는 순간 서버 응답 전까지 기다리는 느낌을 줄이려고 `prefetch`는 기본값을 둔다.
// 📌헤더 밑에 붙어 따라온다(`sticky top-14` = 헤더 높이, 루트 17px이라 실제 59.5px — RentMenuBar와 같은 기준).
export function FloatingTabs({
  label,
  items,
  active,
  className = "",
}: {
  /** 바깥 여백(`mt-6` 등). ⚠️래퍼를 따로 감싸면 sticky가 그 상자 안에서만 붙어 따라오지 않는다 — 여백은 여기로. */
  className?: string;
  label: string;
  items: { key: string; label: string; href: string; dot?: boolean }[];
  active: string;
}) {
  return (
    // 🚨래퍼는 화면 폭을 다 차지하는 투명 띠라 클릭을 뒤로 흘려보내고(`pointer-events-none`), 알약만 받는다.
    <div className={`pointer-events-none sticky top-14 z-[6] -mx-4 flex justify-center px-2 py-2 sm:-mx-6 ${className}`}>
      <nav
        aria-label={label}
        className="pointer-events-auto inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface p-1 shadow-e2"
      >
        {items.map((it) => {
          const on = it.key === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`flex h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 text-[15px] font-medium transition-colors sm:px-6 ${
                on ? "bg-primary-tint text-primary-on" : "text-mute hover:text-primary-on"
              }`}
            >
              {it.label}
              {/* 다른 칸을 보고 있어도 «할 일이 있다»를 알 수 있게 작은 점. */}
              {it.dot && <span aria-hidden="true" className="size-[7px] rounded-full bg-lemon-on" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
