"use client";

// 모바일 메뉴(10-21 대표 A안 확정 + 로컬 코멘트). 헤더 오른쪽 메뉴 버튼 → 오른쪽에서 목록이 밀려 나온다.
// 대표: 「일반 앱들처럼, 햄버거 메뉴 클릭하면 오른쪽에서 list가 나오는 정도. 슬라이드로 슝 하고 나오는 기본」.
//   시험판(?mnav=a)의 「골라 보여 주는 메뉴(최신 매거진·딴짓 앱 카드)」는 이 말로 접었다 — 목록만 둔다.
// 데스크톱(sm 이상)에선 버튼도 패널도 없다. 데스크톱 헤더엔 매거진·딴짓·콜라보 찾기가 이미 한 줄로 보인다.
// ⚠️Tailwind v4의 translate-x-*는 `transform`이 아니라 `translate` 속성이다 → 전환도 `translate`로 걸어야 움직인다.
// ⚠️패널은 닫혀 있어도 DOM에 남긴다(밀려 들어가는 애니메이션 때문). 닫힘 = 화면 밖 + invisible이라
//   탭 이동·스크린리더에 안 잡힌다(visibility는 전환이 끝난 뒤에 꺼진다).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const ITEMS = [
  { href: "/", label: "홈" },
  { href: "/search", label: "콜라보 찾기" },
  { href: "/my", label: "내 소개서" }, // 대표 10-21: 「내 소개서는 /my로」
  { href: "/magazine", label: "콜라보 매거진" },
  { href: "/sideproject", label: "딴짓" },
  { href: "/help", label: "고객센터" },
];

const noop = () => () => {};

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

export function MobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // 패널은 body로 옮겨 그린다(포털). 헤더가 sticky + z-10이라 그 안에 두면 패널의 z-50이 헤더 층에 갇혀
  // 카톡 상담 버튼(z-40)이 메뉴 위로 뜬다(10-21 실측). 서버 렌더엔 body가 없으니 붙은 뒤에만 그린다.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  // 다른 페이지로 넘어가면 닫는다(렌더 중 비교 — effect 안 setState를 피한다).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() =>
      panel.current
        ?.querySelector<HTMLElement>("a,button")
        ?.focus({ preventScroll: true }),
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const btn = button.current;
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      btn?.focus({ preventScroll: true });
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="sm:hidden">
      <button
        ref={button}
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => {
          setOpenedAt(pathname);
          setOpen(true);
        }}
        className="-mr-2 flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-[22px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mounted &&
        createPortal(
          <>
            {/* 뒤 화면 어둡게 — 누르면 닫힌다. */}
            <div
              aria-hidden="true"
              onClick={close}
              className={`fixed inset-0 z-[45] bg-black/40 transition-opacity sm:hidden duration-200 motion-reduce:transition-none ${
                open ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
            <div
              ref={panel}
              id="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="메뉴"
              className={`fixed inset-y-0 right-0 z-50 flex w-[min(80vw,320px)] sm:hidden flex-col bg-canvas shadow-e3 transition-[translate,visibility] duration-250 ease-out motion-reduce:transition-none ${
                open ? "visible translate-x-0" : "invisible translate-x-full"
              }`}
            >
              <div className="flex h-14 shrink-0 items-center justify-end border-b border-hairline px-2">
                <button
                  type="button"
                  aria-label="메뉴 닫기"
                  onClick={close}
                  className="flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-[22px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col overflow-y-auto py-2">
                {ITEMS.map((it) => {
                  const on = isActive(pathname, it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={close}
                      aria-current={on ? "page" : undefined}
                      className={`flex h-[52px] items-center px-6 text-[16px] ${on ? "font-bold text-ink" : "text-body"}`}
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
