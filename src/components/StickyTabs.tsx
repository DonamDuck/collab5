import Link from "next/link";

// 🗂한 화면을 두 칸으로 나누는 탭 — 헤더 밑에 붙어 따라오는 밑줄 탭 (2026-09-18 대표)
//
// 🔁09-18 같은 날 두 번 바뀌었다.
//   ① 가운데 떠 있는 흰 알약(`FloatingTabs`) — 대표: *「플로팅 안 이쁘다」* · *「알약이 중앙에 조그마하게 있으니 어색함」*.
//      작은 알약은 «이 화면 안의 큰 갈래»를 말하기엔 무게가 모자라고, 가운데 떠 있어 옆의 헤더·제목과 줄이 안 맞았다.
//   ② 칸 폭을 꽉 채운 두 칸 + 켜진 칸 밑의 굵은 선 — 대표: *「살짝 올드하지 않아? 너무 크고」*.
//   ③ 지금 — 폭을 채운 세그먼트 컨트롤(아래 주석).
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
    <div className={`sticky top-14 z-[6] -mx-4 bg-canvas/90 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 ${className}`}>
      {/* 🔁09-18 ③ 밑줄 탭도 「살짝 올드하고 너무 크다」(대표) → **세그먼트 컨트롤**: 옅은 회색 판 위에 켜진 칸만 흰 판으로 떠오른다.
          폭은 칸을 꽉 채워 두 세계의 무게를 같게 두고(①의 «작게 떠 있음» 문제), 선·굵은 글자 대신 면의 높낮이로 켜짐을 말한다(②의 무거움). */}
      <nav aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-soft p-1">
        {items.map((it) => {
          const on = it.key === active;
          return (
            <Link
              key={it.key}
              href={it.href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              // 👆09-18 밤 QA(G-22·H-28) — 40px이라 4px 모자랐다. 판(`p-1`) 안쪽 여백을 히트영역으로 빌려 44를 채운다.
              className={`relative flex h-[40px] items-center justify-center gap-1.5 rounded-lg text-[15px] transition-colors after:absolute after:-inset-y-[2px] after:content-[''] ${
                on ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "font-medium text-mute hover:text-body"
              }`}
            >
              {it.label}
              {/* 다른 칸을 보고 있어도 «할 일이 있다»를 알 수 있게 작은 점. */}
              {it.dot && <span aria-label="새 요청 있음" className="size-[7px] rounded-full bg-lemon-on" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
