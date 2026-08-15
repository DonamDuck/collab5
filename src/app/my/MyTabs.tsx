"use client";

// /my 탭 — 내 소개서 / 찜한 콜라보 / 콜라보 리포트 / 성사된 콜라보(⭐북극성). 목록을 서버에서 미리 렌더해 슬롯으로 받고,
// 탭 클릭 시 서버 왕복 없이 화면만 토글(즉시 전환). URL은 history.replaceState로만 동기화
// (router.replace를 거치면 RSC payload를 백그라운드 재요청해 낭비 — PreviewTabs와 동일 이유).
import { useState, useRef, useEffect, useCallback } from "react";

type Tab = "mine" | "saved" | "reports" | "collabs";

export function MyTabs({
  initialTab,
  mine,
  mineCount,
  saved,
  savedCount,
  reports,
  reportCount,
  collabs,
  collabCount,
}: {
  initialTab: Tab;
  mine: React.ReactNode;
  mineCount: number;
  saved: React.ReactNode;
  savedCount: number;
  reports: React.ReactNode;
  reportCount: number;
  collabs: React.ReactNode;
  collabCount: number;
}) {
  const [active, setActive] = useState<Tab>(initialTab);

  // 탭이 4개라 모바일에선 가로로 넘친다 → **활성 탭을 보이는 곳으로 끌어온다.**
  // 없으면 `?tab=collabs`로 들어왔을 때 정작 그 탭이 화면 밖에 잘려 있다(실측).
  //
  // ⚠️ `scrollIntoView`를 쓰지 않는다 — `block:"nearest"`를 줘도 **조상 중 스크롤 가능한 요소를
  //    전부 훑으며 맞추는** 동작이라 문서 세로 스크롤이 딸려 움직일 수 있다(디자인팀 QA #31).
  //    레일의 `scrollLeft`만 직접 옮기면 건드리는 축이 하나뿐이라 그 위험이 아예 없다.
  //    좌표 차이로 계산 — offsetLeft는 offsetParent가 레일이라는 보장이 없어 못 쓴다.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>('[data-active="true"]');
    if (!row || !el) return;
    row.scrollLeft += el.getBoundingClientRect().left - row.getBoundingClientRect().left - 16;
  }, [active]);

  // 우측 페이드 — **넘칠 때만**, 그리고 **끝에 닿으면 감춘다**.
  // 넘치지 않는 데스크탑에서까지 그라데이션이 깔리면 그건 거짓 신호다.
  const [showFade, setShowFade] = useState(false);
  const updateFade = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const overflowing = row.scrollWidth > row.clientWidth + 1;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
    setShowFade(overflowing && !atEnd);
  }, []);
  // 마운트·탭 전환 직후 + 창 크기 변경 시 재계산(가로폭이 바뀌면 넘침 여부가 뒤집힌다).
  useEffect(() => {
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
  }, [active, updateFade]);

  const go = (tab: Tab) => {
    setActive(tab);
    window.history.replaceState(null, "", `/my?tab=${tab}`);
  };

  return (
    <div>
      {/* 탭이 4개가 되며 모바일(375px)에서 한 줄에 안 들어간다 → 가로 스크롤 + 간격 축소.
          no-scrollbar는 globals.css 유틸(스크롤바 숨김, 넘김 제스처만).
          overscroll-x-contain — 레일 끝에서 한 번 더 밀 때 넘침이 문서로 새어 **브라우저 뒤로가기가
          발동**하던 것 차단(디자인팀 QA #12). 세로축은 건드리지 않는다. */}
      {/* 레일을 감싸는 relative — 우측 페이드를 얹기 위한 그릇.
          ⚠️ 스크롤바를 숨긴 레일은 "옆에 더 있다"는 단서가 **아무것도 없다**. 4번째 탭이 있는 줄
             모르고 지나간다(QA #13). 페이드가 그 유일한 신호다. */}
      <div className="relative">
        <div
          ref={rowRef}
          onScroll={updateFade}
          // gap-5 → gap-4: 4탭이 375px에서 약 100px 넘쳤다. 간격만 줄여 51px을 회수한다(QA #13).
          className="no-scrollbar flex gap-4 overflow-x-auto overscroll-x-contain border-b border-hairline px-0.5 py-1"
        >
          <TabButton active={active === "mine"} onClick={() => go("mine")} count={mineCount}>
            내 소개서
          </TabButton>
          <TabButton active={active === "saved"} onClick={() => go("saved")} count={savedCount}>
            찜한 콜라보
          </TabButton>
          <TabButton active={active === "reports"} onClick={() => go("reports")} count={reportCount}>
            콜라보 리포트
          </TabButton>
          {/* 08-15 대표 확정: 「성사된 콜라보」 → 「콜라보 기록하기」. '성사'는 내부 지표 어휘라 걷어냈다.
              ⚠️다른 셋은 명사인데 여기만 동사형 — 대표가 세 안을 보고 고른 값이다(추천은 「기록한 콜라보」였다). */}
          <TabButton active={active === "collabs"} onClick={() => go("collabs")} count={collabCount}>
            콜라보 기록하기
          </TabButton>
        </div>
        {/* 우측 페이드 — 넘칠 때만, 끝에 닿으면 사라진다. bottom-px로 밑줄(border-b) 1px은 살린다.
            pointer-events-none: 페이드 아래 탭을 그대로 누를 수 있어야 한다. */}
        {showFade && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 bottom-px w-8 bg-gradient-to-l from-canvas to-transparent"
          />
        )}
      </div>
      <div className="mt-6">
        <div hidden={active !== "mine"}>{mine}</div>
        <div hidden={active !== "saved"}>{saved}</div>
        <div hidden={active !== "reports"}>{reports}</div>
        <div hidden={active !== "collabs"}>{collabs}</div>
      </div>
    </div>
  );
}

// 언더라인 탭 — 선택 시 하단 라이닝(primary) + 볼드. (PreviewTabs와 동일 스타일)
// 건수는 **라벨과 다른 서체 취급**(작게·mute·tabular-nums) — 라벨에 숫자를 문자열로 붙이면
// 굵기·크기가 같아 이름의 일부처럼 읽힌다. 4탭 중 '내 소개서'만 건수가 없어 규칙도 깨져 있었다(QA #31).
function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={`-mb-px flex h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-[15px] transition-colors ${
        active ? "border-primary font-bold text-ink" : "border-transparent font-medium text-mute hover:text-body"
      }`}
    >
      {children}
      {!!count && count > 0 && <span className="ml-1 text-[13px] font-medium tabular-nums text-mute">{count}</span>}
    </button>
  );
}
