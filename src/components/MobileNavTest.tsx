"use client";

// 🧪 모바일 메뉴 시험판 A·B·C (대표 10-21 「내 모바일에서 셋 다 보고 싶다」).
// 주소에 `?mnav=a|b|c`를 붙여 들어온 사람에게만 보인다. 한 번 붙이면 그 탭을 닫을 때까지 유지(sessionStorage),
// `?mnav=off`로 끈다. 스위치가 없으면 아무것도 그리지 않아 다른 방문자 화면은 그대로다.
// 데스크톱(sm 이상)에서는 셋 다 숨는다. 대표가 하나를 고르면 이 파일은 지우고 고른 안만 정식으로 만든다.
//   A = 헤더 오른쪽 메뉴 버튼 + 골라 보여 주는 메뉴(최신 매거진·딴짓 앱)
//   B = 헤더 아래 가로 메뉴 줄
//   C = 화면 아래 탭 막대
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { SIDE_PROJECTS } from "@/app/sideproject/projects";

export type MobileNavVariant = "a" | "b" | "c" | null;
const KEY = "mnav-test";
const isVariant = (x: string | null): x is "a" | "b" | "c" => x === "a" || x === "b" || x === "c";

function readVariant(): MobileNavVariant {
  try {
    const q = new URLSearchParams(window.location.search).get("mnav");
    if (q === "off") return null;
    if (isVariant(q)) return q;
    const s = sessionStorage.getItem(KEY);
    return isVariant(s) ? s : null;
  } catch {
    return null;
  }
}
const subscribe = () => () => {};

export function useMobileNavVariant(): MobileNavVariant {
  const v = useSyncExternalStore<MobileNavVariant>(subscribe, readVariant, () => null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("mnav");
      if (q === "off") sessionStorage.removeItem(KEY);
      else if (isVariant(q)) sessionStorage.setItem(KEY, q);
    } catch {}
  }, []);
  return v;
}

// 시험용으로 박아 둔 값 — 정식판에선 매거진 최신 호를 DB에서 읽는다.
const LATEST_MAGAZINE = {
  href: "/magazine/canga-mole-workshop",
  title: "귀여움과 귀여움이 만나면?",
  meta: "창간호 · 캔가 × 두더지요가원",
  cover: "https://yfvesialziwdacsjlzph.supabase.co/storage/v1/object/public/maker-photos/magazine/p/91c76cdc-a560-44ec-8d18-9f4bf3ca8513.jpg",
};
const APP_HINT: Record<string, string> = { monitoralign: "모니터 정렬", limitglance: "Claude 사용량", hanmadi: "찍고 메모" };

function mine(loggedIn: boolean) {
  return loggedIn ? { href: "/my", label: "내 소개서" } : { href: "/register", label: "내 소개서" };
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

// ── A: 메뉴 버튼 + 펼친 메뉴 ─────────────────────────────────
export function MobileNavMenuButton({ loggedIn }: { loggedIn: boolean }) {
  const variant = useMobileNavVariant();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  // 다른 페이지로 넘어가면 닫는다(렌더 중 비교 — effect에서 setState를 피한다).
  if (open && openedAt !== pathname) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (variant !== "a") return null;
  const my = mine(loggedIn);
  const close = () => setOpen(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((o) => !o);
        }}
        className="-mr-2 flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-20 overflow-y-auto bg-canvas px-4 pt-4 pb-8">
          <div className="flex flex-col gap-3">
            <Link
              href="/search"
              onClick={close}
              className="flex h-[48px] items-center gap-2 rounded-pill bg-surface-soft px-4 text-[15px] text-mute"
            >
              <svg viewBox="0 0 20 20" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" strokeLinecap="round" />
              </svg>
              콜라보 찾기
            </Link>
            <Link
              href={my.href}
              onClick={close}
              className="flex h-[48px] items-center justify-center rounded-md bg-ink text-[15px] font-bold text-canvas"
            >
              {loggedIn ? "내 소개서 보기" : "내 소개서 만들기"}
            </Link>
          </div>

          <section className="mt-7">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-bold text-mute">콜라보 매거진</span>
              <Link href="/magazine" onClick={close} className="py-2 text-mute">
                전체 보기 ›
              </Link>
            </div>
            <Link href={LATEST_MAGAZINE.href} onClick={close} className="mt-1 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LATEST_MAGAZINE.cover} alt="" className="h-[69px] w-[92px] shrink-0 rounded-md object-cover" />
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-snug text-ink">{LATEST_MAGAZINE.title}</p>
                <p className="mt-0.5 text-[13px] text-mute">{LATEST_MAGAZINE.meta}</p>
              </div>
            </Link>
          </section>

          <section className="mt-7">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-bold text-mute">딴짓</span>
              <Link href="/sideproject" onClick={close} className="py-2 text-mute">
                전체 보기 ›
              </Link>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {SIDE_PROJECTS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/sideproject/${p.slug}`}
                  onClick={close}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-hairline px-1 py-3 text-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.icon} alt="" className="size-[52px]" />
                  <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                  <span className="text-[11.5px] text-mute">{APP_HINT[p.slug] ?? ""}</span>
                </Link>
              ))}
            </div>
          </section>

          <div className="mt-8 flex justify-between border-t border-hairline pt-4 text-[14px] text-mute">
            <Link href="/help" onClick={close} className="py-2">
              고객센터
            </Link>
            <Link href="/?mnav=off" onClick={close} className="py-2">
              시험 끄기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── B: 헤더 아래 메뉴 줄 · C: 아래 탭 막대 ────────────────────
export function MobileNavExtras({ loggedIn }: { loggedIn: boolean }) {
  const variant = useMobileNavVariant();
  const pathname = usePathname();
  const my = mine(loggedIn);
  const items = [
    { href: "/", label: "홈" },
    { href: "/search", label: "콜라보 찾기" },
    { href: "/magazine", label: "매거진" },
    { href: "/sideproject", label: "딴짓" },
    my,
  ];

  if (variant === "b") {
    return (
      <nav className="sticky top-14 z-10 flex h-[46px] items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-hairline bg-canvas px-2 text-[15px] sm:hidden print:hidden">
        {items.map((it) => {
          const on = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={
                on
                  ? "flex h-full shrink-0 items-center border-b-2 border-ink px-2.5 font-bold text-ink"
                  : "flex h-full shrink-0 items-center border-b-2 border-transparent px-2.5 text-mute"
              }
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  if (variant === "c") {
    const icons: Record<string, ReactNode> = {
      "/": <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
      "/search": (
        <>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </>
      ),
      "/magazine": <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM17 8h2v12" />,
      "/sideproject": (
        <>
          <rect x="4" y="4" width="7" height="7" rx="2" />
          <rect x="13" y="4" width="7" height="7" rx="2" />
          <rect x="4" y="13" width="7" height="7" rx="2" />
          <rect x="13" y="13" width="7" height="7" rx="2" />
        </>
      ),
      [my.href]: (
        <>
          <circle cx="12" cy="9" r="4" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>
      ),
    };
    return (
      <>
        {/* 아래 막대만큼 본문 끝을 띄우고, 카톡 상담 버튼을 막대 위로 올린다(모바일에서만). */}
        <style>{"@media (max-width: 639px) { body { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); } a[aria-label=\"카카오톡으로 문의하기\"] { bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important; } }"}</style>
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-canvas sm:hidden print:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {items.map((it) => {
            const on = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[11.5px] ${on ? "font-bold text-ink" : "text-mute"}`}
              >
                <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  {icons[it.href]}
                </svg>
                {it.href === "/search" ? "찾기" : it.label}
              </Link>
            );
          })}
        </nav>
      </>
    );
  }

  return null;
}
