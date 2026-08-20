"use client";

// 콜라보 찾기 — 검색어·필터·페이지네이션(클라 상태). **데이터는 서버가 미리 주입한다**(page.tsx).
// 예전엔 마운트 후 서버액션으로 받아왔는데, 그러면 "페이지 도착 → 하이드레이션 → 요청 → 렌더"라
// 카드가 한 박자 늦게 떴다. 지금은 첫 페인트에 카드가 함께 온다.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COLLAB_TYPES, type CollabType, type Maker } from "@/lib/types";
import { track } from "@/lib/track";
import type { Spotlight } from "./daily";

const PAGE_SIZE = 15; // 페이지당 카드 수 (3열 그리드라 3의 배수 15, 대표 지시 2026-07-23)

// 🎨칩 한 벌 — 유형(button)과 키워드(Link)가 **똑같이 보이게** 하는 게 목적이다(대표 08-20 "색은 통일").
//   ⚠️`text-[14px]`로 맞췄다 — 키워드 칩은 13px이었는데, 1px 차이가 한 줄에 섞이면 들쭉날쭉해 보인다.
const CHIP_BASE = "inline-flex h-8 shrink-0 items-center rounded-pill border px-3 text-[14px] transition-colors";
const CHIP_IDLE = "border-hairline bg-surface text-mute";

export function SearchClient({
  all,
  initialTypes = [],
  spotlights = [],
}: {
  /** ⭐이미 「오늘의 순서」로 섞여서 온다(page.tsx). 여기선 다시 정렬하지 않는다 —
   *  아래 `filter`는 순서를 보존하므로 검색·필터를 걸어도 그 순서가 그대로 유지된다. */
  all: Maker[];
  /** 홈 유형 칩에서 넘어온 초기 필터(`/search?type=팝업`, 08-16). 서버가 검증해 내려준다. */
  initialTypes?: CollabType[];
  /** 오늘의 키워드 레일(브랜드당 1개). 개수 근거는 daily.ts `SPOTLIGHT_MAX` 주석. */
  spotlights?: Spotlight[];
}) {
  const [q, setQ] = useState("");
  // ⚠️초기값으로만 쓴다 — 이후엔 사용자가 칩을 눌러 자유롭게 바꾼다. URL을 계속 따라가게 만들면
  //   "홈에서 팝업으로 들어왔는데 필터를 못 푸는" 화면이 된다(주소는 그대로 남아 있으므로).
  const [types, setTypes] = useState<CollabType[]>(initialTypes);
  /** 켜 둔 키워드 칩. 유형 칩과 **같은 문법**이다(누르면 켜지고 다시 누르면 꺼진다).
   *  ⭐값이 아니라 `keywords` 배열 원소와 정확히 일치하는 문자열이다 — 자유 검색어(`q`)와 달리
   *    부분 일치를 쓰지 않는다. 「수선」이 「수선조형」까지 끌어오면 칩을 누른 결과가 예측을 벗어난다. */
  const [words, setWords] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const results = useMemo(() => {
    let r = all;
    const t = q.trim().toLowerCase();
    if (t) {
      r = r.filter((m) =>
        // ⭐`m.region`이 08-20에 추가됐다 — **카드마다 「서울 성북」이라고 써 있는데 "성북"을 치면
        //   0건이 나왔다.** 화면에 보이는 값이 검색에 안 걸리는 건 그냥 고장이다.
        //   (서버 쪽 `repo.searchMakers(q)`는 원래 region을 봤는데, 이 페이지는 항상 `q=""`로
        //    전체를 받아 와 여기서 거르는 구조라 그 혜택을 못 받고 있었다.)
        // ⚠️`m.seeks`는 07-22 통합 이후 항상 빈 배열이다(저장 시 offers로 흡수). 지우지 않고 두는 건
        //   옛 저장본 대비 + 축 이원화를 되살릴 때 그대로 쓰기 위함이다.
        [m.name, m.oneLiner, m.region ?? "", ...m.keywords, ...m.offers, ...m.seeks]
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
    // 키워드 칩 — 무리 안에서는 OR(여러 개 켜면 넓어진다), 유형·검색어와는 AND. 유형 칩과 같은 규칙.
    // 🔒`dailySpotlights`가 **소개서에 실제로 있는 말만** 칩으로 내보내므로, 켠 칩이 0건이 되는 일은 없다.
    if (words.length) {
      r = r.filter((m) => words.some((w) => m.keywords.includes(w)));
    }
    return r;
  }, [all, q, types, words]);

  // 기본 = 등록된 전체 카드 노출. 검색/필터는 그 위에서 좁힘.
  const shown = results;
  // 사용자가 좁혔는가 — 빈 화면의 말이 달라진다(필터 풀기 vs 첫 등록 권하기)
  const narrowed = !!q.trim() || types.length > 0 || words.length > 0;

  // 검색어·필터 바뀌면 1페이지로
  useEffect(() => setPage(1), [q, types, words]);

  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const pageItems = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleType = (t: CollabType) =>
    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const toggleWord = (w: string) =>
    setWords((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]));

  /** 유형 칩과 키워드 칩을 **번갈아** 한 줄로. 유형이 먼저 와서 짝수 자리를 고정한다.
   *  ⚠️좁혀도 **줄어들지 않는다** — 이제 키워드도 필터라, 켜 둔 칩이 화면에서 사라지면 끌 수가 없다
   *    (유형 칩이 좁힌 뒤에도 남아 있는 것과 같은 이유). 08-20에 키워드가 링크였을 땐 숨겼었다. */
  const chipRow = useMemo(() => {
    const row: (
      | { kind: "type"; type: CollabType }
      | { kind: "word"; text: string; slug: string }
    )[] = [];
    for (let i = 0; i < Math.max(COLLAB_TYPES.length, spotlights.length); i++) {
      if (i < COLLAB_TYPES.length) row.push({ kind: "type", type: COLLAB_TYPES[i] });
      const sp = spotlights[i];
      if (sp) row.push({ kind: "word", text: sp.text, slug: sp.slug });
    }
    return row;
  }, [spotlights]);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6 lg:max-w-4xl">
      <h1 className="text-[26px] font-bold leading-[1.25] tracking-[-0.025em] text-ink sm:text-[32px]">콜라보 찾기</h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">잘 맞는 콜라보 파트너를 찾아보세요.</p>

      {/* 🔍검색바 — **디자인팀 확정값**(08-20, 대표 지시 "좀만 아주 좀만 더 눈에 띄웠음").
          ⭐진단이 뒤집혔다: 「회색이라 안 보인다」의 실체는 **색이 옅어서가 아니라 칸의 경계가 없어서**다.
             면(#F5F5F6) 대 지면(순백)의 대비가 **1.090**(1팀 실측) — 면만으로는 어떤 회색을 골라도
             칸이 안 생긴다. **경계가 할 일을 면에 시키고 있었다.**
          ⚠️원인이 둘이었다 — placeholder `faint`가 이 면 위에서 대비 **2.58**로 AA(4.5) 미달이었다.
             「칸이 안 보인다」와 「내용이 안 보인다」는 고치는 자리가 다르다(테두리 / 글자색).
          📐볼트 [[디자인-시스템]] 포커스 규칙과 **충돌하지 않는다**: `focus-within:ring-`은
             「자체 테두리가 없는 경우」의 **예외**였다. 테두리가 생겼으니 예외를 벗어나 표준형
             (`border` + `focus:border-focus`)으로 **복귀**한 것. 🚨그래서 옛 `ring-1 ring-transparent`는
             반드시 같이 뗀다 — 남기면 포커스 때 테두리와 링이 **두 겹**으로 겹친다.
          🎨`border-strong`(#D7D7DB)인 이유 — `hairline`은 이 필면 위에서 대비 1.103이라 면(1.090)에서
             거의 안 올라간다. ⛔`#DFDFE3` 같은 **생색 금지**(토큰이 아니라 다크 테마가 안 따라온다).
          🔤16→17px — 볼트 입력칸 표준이 17이고 이 저장소 입력칸 29곳이 전부 17인데 **여기만 16**이었다. */}
      <div className="mt-5 flex h-11 max-w-xl items-center gap-2 rounded-pill border border-border-strong bg-surface-soft px-4 transition-colors duration-[var(--dur-fast)] focus-within:border-focus">
        <span className="text-mute" aria-hidden="true">🔎</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="브랜드 이름, 분위기, 콜라보 유형으로 검색"
          aria-label="브랜드 검색"
          className="h-full flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-mute"
        />
      </div>

      {/* 🔗**칩 한 무리 — 전부 「목록을 좁히는 것」이다.**
          대표 지시 08-20 ①*"chip ui가 2개 타입으로 있잖아 이거 헷갈리거든..? 색은 통일"*
          ②*"chip 눌렀을때 별도로 소개서로 넘어가지말고, 하단의 카드 sorting만 정리하는걸로.
            왜냐면 키워드가 나중에 분명 겹칠 수 있을거거든!"*
          ⭐②가 ①의 진짜 문제까지 없앴다 — 전엔 **생김새가 같은데 하나는 좁히고 하나는 페이지를 떠났다.**
             지금은 둘 다 토글이라 문법이 하나다. 그래서 색을 통일해도 안전하다.
          🥝**Kiwi(`primary-tint`)는 「켜져 있음」 하나의 뜻만 갖는다**(디자인팀 08-20).
             평상시는 전부 흰 pill이고, 켜진 칩만 Kiwi. ⛔색을 아예 하나로 합쳐 초록을 없애면
             **켜짐을 표시할 수단을 잃는다** — 초록으로 통일한 시안을 실제로 띄워보니
             `mint-pale`(#E3F6EA)과 `primary-tint`(#D6FFC0)가 나란히 놓여 선택이 거의 안 보였다.
          🚨Kiwi 위 흰 글자 금지(휘도 0.77) — 글자는 항상 `primary-on`.
          배치 = **유형·키워드 번갈아** → 유형 칩이 짝수 자리에 늘 같은 순서로 앉고 사이사이에 키워드가 낀다.
          📱모바일은 한 줄 가로 스크롤(세로를 안 먹는다), 데스크탑은 폭이 넓어 wrap. */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chipRow.map((c) => {
          const on = c.kind === "type" ? types.includes(c.type) : words.includes(c.text);
          return (
            <button
              key={`${c.kind}:${c.kind === "type" ? c.type : c.slug}`}
              type="button"
              aria-pressed={on}
              onClick={() => {
                if (c.kind === "type") return toggleType(c.type);
                if (!words.includes(c.text)) track("search_keyword_click", { keyword: c.text, slug: c.slug });
                toggleWord(c.text);
              }}
              className={`${CHIP_BASE} ${
                on ? "border-primary bg-primary-tint text-primary-on" : `${CHIP_IDLE} hover:bg-surface-soft`
              }`}
            >
              {c.kind === "type" ? c.type : c.text}
            </button>
          );
        })}
      </div>

      {/* 결과 */}
      <div className="mt-6">
        {/* ~~「오늘의 순서」를 말로 알린다~~ → **08-20 대표 지시로 뺐다**("이건 일단 빼자").
            순서를 날마다 돌리는 동작 자체는 그대로 살아 있다(daily.ts) — 화면에 적지 않을 뿐이다.
            되살릴 자리는 여기다: `{!narrowed && <span…>· 날마다 순서를 바꿔 보여드려요</span>}`. */}
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
                    setWords([]);
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
                      {/* 🚨`w-10`(정사각) 금지 — 08-16 새 마크는 가로:세로가 1.28이라 폭을 높이와
                          같게 박으면 찌그러진다. 예전 마크는 파일이 56×56 정사각이라 우연히 멀쩡했던 것. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo-mark.png" alt="collab5" className="h-[34px] w-auto opacity-70" />
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

        {/* 페이지네이션 — ~~결과가 있으면 1페이지여도 항상 노출(대표 지시 07-23)~~
            → **08-20 대표 확정으로 뒤집음**: 한 페이지뿐이면 감춘다. 07-23 당시엔 15장 상한이
            차오를 걸 전제했는데, 08-20 실측 10곳이라 「1」 버튼 하나가 늘 떠 있으면서 아무 일도
            안 했다. 2페이지가 생기는 순간(16곳~) 저절로 다시 나타난다. 0건은 위 빈 상태가 담당. */}
        {shown.length > 0 && totalPages > 1 && (
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
