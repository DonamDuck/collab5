"use client";

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

export default function SearchPage() {
  const [all, setAll] = useState<Maker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<CollabType[]>([]);

  useEffect(() => {
    searchAction("").then((r) => {
      setAll(r);
      setLoaded(true);
    });
  }, []);

  const active = q.trim() !== "" || types.length > 0;

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

  // MVP: 업체 리스트 노출 X (등록 업체 적음·cold-start). 검색/필터 시에만 결과.
  const shown = active ? results : [];

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
        {!active && (
          <div className="rounded-lg border border-hairline bg-surface px-4 py-10 text-center">
            <p className="text-base text-body">찾는 메이커가 있나요?</p>
            <p className="mt-1 text-sm text-mute">
              상호·분위기·콜라보 유형으로 검색해보세요.
            </p>
          </div>
        )}

        {/* §9.5 Empty State — 검색 무결과 */}
        {loaded && active && shown.length === 0 && (
          <div className="rounded-lg border border-hairline bg-surface px-4 py-10 text-center">
            <p className="text-base font-medium text-ink">
              잘 맞는 곳을 아직 못 찾았어요
            </p>
            <p className="mt-1 text-sm text-mute">
              검색어·필터를 바꿔보거나 직접 등록해도 좋아요.
            </p>
            <a
              href="/register"
              className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-on"
            >
              메이커 등록하기
            </a>
          </div>
        )}

        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <li key={m.id}>
              <a
                href={`/m/${m.slug}`}
                className="block rounded-lg border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-surface-soft"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-ink">{m.name}</span>
                  {m.collabOpen && (
                    <span className="inline-flex h-5 items-center rounded-sm bg-primary-pale px-1.5 text-[11px] font-medium text-primary-on">
                      콜라보 받는 중
                    </span>
                  )}
                  {m.region && <span className="text-xs text-mute">· {m.region}</span>}
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
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
