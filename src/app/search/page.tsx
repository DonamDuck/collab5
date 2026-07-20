"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { searchAction } from "@/lib/actions";
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

const PAGE_SIZE = 12; // 페이지당 카드 수

export default function SearchPage() {
  const [all, setAll] = useState<Maker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<CollabType[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    searchAction("").then((r) => {
      setAll(r);
      setLoaded(true);
    });
  }, []);

  const results = useMemo(() => {
    let r = all;
    const t = q.trim().toLowerCase();
    if (t) {
      r = r.filter((m) =>
        [m.name, m.oneLiner, ...m.soul.values, ...m.offers, ...m.seeks]
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

  // 검색어·필터 바뀌면 1페이지로
  useEffect(() => setPage(1), [q, types]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleType = (t: CollabType) =>
    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6 lg:max-w-4xl">
      <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">메이커 찾기</h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">잘 맞는 콜라보 파트너를 찾아보세요.</p>

      {/* 검색바 — 데스크탑 폭 캡(QA P2) */}
      <div className="mt-5 flex h-11 max-w-xl items-center gap-2 rounded-pill bg-surface-soft px-4">
        <span className="text-faint" aria-hidden="true">🔎</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상호, 분위기, 콜라보 유형으로 검색"
          aria-label="메이커 검색"
          className="h-full flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint"
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
              className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
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
        {loaded && (
          <p className="mb-3 text-sm text-mute">
            {shown.length > 0 ? `총 ${shown.length}곳` : ""}
          </p>
        )}

        {/* Empty State — 등록 0건 또는 검색 무결과 공용 */}
        {loaded && shown.length === 0 && (
          <div className="rounded-lg border border-hairline bg-surface px-4 py-10 text-center">
            <p className="text-base font-medium text-ink">
              잘 맞는 곳을 아직 못 찾았어요
            </p>
            <p className="mt-1 text-sm text-mute">
              검색어·필터를 바꿔보거나 직접 등록해도 좋아요.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-on"
            >
              메이커 등록하기
            </Link>
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
                    <span className="min-w-0 truncate text-base font-medium text-ink">{m.name}</span>
                    {m.collabOpen && (
                      <span className="shrink-0 inline-flex h-5 items-center rounded-sm bg-primary-pale px-1.5 text-[11px] font-medium text-primary-on">
                        콜라보 받는 중
                      </span>
                    )}
                    {m.region && <span className="shrink-0 text-xs text-mute">· {m.region}</span>}
                  </div>
                  {m.oneLiner && (
                    <p className="mt-0.5 line-clamp-1 text-sm text-body">{m.oneLiner}</p>
                  )}
                  {m.soul.values.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.soul.values.slice(0, 3).map((v) => (
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

        {/* 페이지네이션 — 카드가 한 페이지를 넘을 때만 */}
        {totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="페이지">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 items-center rounded-md border border-hairline bg-surface px-3 text-sm text-mute disabled:opacity-40"
            >
              이전
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={`h-9 min-w-9 rounded-md border px-2.5 text-sm ${
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
              className="flex h-9 items-center rounded-md border border-hairline bg-surface px-3 text-sm text-mute disabled:opacity-40"
            >
              다음
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
