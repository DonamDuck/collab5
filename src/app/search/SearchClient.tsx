"use client";

// 콜라보 찾기 — 검색어·필터·페이지네이션(클라 상태). **데이터는 서버가 미리 주입한다**(page.tsx).
// 예전엔 마운트 후 서버액션으로 받아왔는데, 그러면 "페이지 도착 → 하이드레이션 → 요청 → 렌더"라
// 카드가 한 박자 늦게 떴다. 지금은 첫 페인트에 카드가 함께 온다.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CollabType, Maker } from "@/lib/types";

const COLLAB_TYPES: CollabType[] = [
  "제품콜라보",
  "팝업",
  "워크숍",
  "공동굿즈",
  "공동콘텐츠",
  "행사참여",
  "공간대여",
];

const PAGE_SIZE = 15; // 페이지당 카드 수 (3열 그리드라 3의 배수 15, 대표 지시 2026-07-23)

export function SearchClient({ all }: { all: Maker[] }) {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<CollabType[]>([]);
  const [page, setPage] = useState(1);

  const results = useMemo(() => {
    let r = all;
    const t = q.trim().toLowerCase();
    if (t) {
      r = r.filter((m) =>
        [m.name, m.oneLiner, ...m.keywords, ...m.offers, ...m.seeks]
          .join(" ")
          .toLowerCase()
          .includes(t)
      );
    }
    if (types.length) {
      r = r.filter((m) =>
        types.some((ty) => m.offers.includes(ty) || m.seeks.includes(ty))
      );
    }
    return r;
  }, [all, q, types]);

  // 기본 = 등록된 전체 카드 노출. 검색/필터는 그 위에서 좁힘.
  const shown = results;
  // 사용자가 좁혔는가 — 빈 화면의 말이 달라진다(필터 풀기 vs 첫 등록 권하기)
  const narrowed = !!q.trim() || types.length > 0;

  // 검색어·필터 바뀌면 1페이지로
  useEffect(() => setPage(1), [q, types]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleType = (t: CollabType) =>
    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6 lg:max-w-4xl">
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] text-ink sm:text-[32px]">콜라보 찾기</h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">잘 맞는 콜라보 파트너를 찾아보세요.</p>

      {/* 검색바 — 데스크탑 폭 캡(QA P2)
          포커스 표시는 파란 outline 대신 **테두리 하나가 은은히 뜨는 것**으로(07-28 대표 지시).
          이 입력칸엔 자체 테두리가 없어서, 전역 링을 뺀 뒤 여기서 focus-within으로 대신한다. */}
      <div className="mt-5 flex h-11 max-w-xl items-center gap-2 rounded-pill bg-surface-soft px-4 ring-1 ring-transparent transition-[box-shadow] duration-[var(--dur-fast)] focus-within:ring-border-strong">
        <span className="text-faint" aria-hidden="true">🔎</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상호, 분위기, 콜라보 유형으로 검색"
          aria-label="브랜드 검색"
          className="h-full flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-faint"
        />
      </div>

      {/* 필터 칩 */}
      <div className="mt-3 flex flex-wrap gap-2">
        {COLLAB_TYPES.map((t) => {
          const on = types.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`inline-flex h-8 items-center rounded-pill border px-3 text-[14px] transition-colors ${
                on
                  ? "border-primary bg-primary-tint text-primary-on"
                  : "border-hairline bg-surface text-mute"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* 결과 */}
      <div className="mt-6">
        {shown.length > 0 && <p className="mb-3 text-[14px] text-mute">총 {shown.length}곳</p>}

        {/* Empty State — **콜드스타트(등록 0건)와 무결과는 다른 상황이다**(QA #33).
            전엔 한 문구로 뭉뚱그려서, 필터를 걸어 0건이 된 사람에게도 "직접 등록해보세요"라고 했다.
            좁혀서 0건이면 할 일은 등록이 아니라 **필터를 푸는 것**이다. */}
        {shown.length === 0 && (
          <div className="rounded-lg border border-hairline bg-surface px-4 py-10 text-center">
            {narrowed ? (
              <>
                <p className="text-[16px] font-medium text-ink">조건에 맞는 브랜드가 없어요</p>
                <p className="mt-1 text-[14px] text-mute">
                  검색어나 콜라보 유형을 바꾸면 더 많은 브랜드를 볼 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setTypes([]);
                  }}
                  className="mt-4 inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink"
                >
                  검색·필터 초기화
                </button>
              </>
            ) : (
              <>
                <p className="text-[16px] font-medium text-ink">아직 등록된 브랜드가 없어요</p>
                <p className="mt-1 text-[14px] text-mute">
                  첫 소개서를 만들어 콜라보를 시작해보세요.
                </p>
                <Link
                  href="/register"
                  className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-[14px] font-medium text-primary-on"
                >
                  브랜드 소개서 만들기
                </Link>
              </>
            )}
          </div>
        )}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((m) => (
            <li key={m.id}>
              <Link
                href={`/m/${m.slug}`}
                className="block overflow-hidden rounded-lg border border-hairline bg-surface transition-colors hover:bg-surface-soft"
              >
                {/* 썸네일 — 브랜드 1번 사진, 없으면 collab5 로고 */}
                <div className="aspect-[3/2] w-full overflow-hidden bg-surface-soft">
                  {m.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photos[0]}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary-pale">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-mark.svg" alt="collab5" className="h-10 w-10 opacity-70" />
                    </div>
                  )}
                </div>
                <div className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* 공백 없는 긴 상호가 카드(overflow-hidden)에 잘려버리지 않고 말줄임되도록 */}
                    <span className="min-w-0 truncate text-[16px] font-medium text-ink">{m.name}</span>
                    {m.region && <span className="shrink-0 text-[12px] text-mute">· {m.region}</span>}
                  </div>
                  {m.oneLiner && (
                    <p className="mt-0.5 line-clamp-1 text-[14px] text-body">{m.oneLiner}</p>
                  )}
                  {m.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.keywords.slice(0, 3).map((v) => (
                        <span
                          key={v}
                          className="rounded-sm bg-mint-pale px-1.5 py-0.5 text-[11px] font-medium text-mint-on"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* 페이지네이션 — 결과가 있으면 1페이지여도 항상 노출(대표 지시). 0건은 위 빈 상태가 담당 */}
        {shown.length > 0 && (
          // flex-wrap: 페이지 번호를 전부 그리는 구조라 375px·5페이지부터 '이전'이 화면 밖으로
          //   밀려 누를 수 없었고 페이지 전체에 가로 스크롤이 생겼다(QA 07-29).
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="페이지">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 items-center rounded-md border border-hairline bg-surface px-3 text-[14px] text-mute disabled:opacity-40"
            >
              이전
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={`h-9 min-w-9 rounded-md border px-2.5 text-[14px] ${
                  n === page
                    ? "border-primary bg-primary-tint font-medium text-primary-on"
                    : "border-hairline bg-surface text-mute hover:text-ink"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-9 items-center rounded-md border border-hairline bg-surface px-3 text-[14px] text-mute disabled:opacity-40"
            >
              다음
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
