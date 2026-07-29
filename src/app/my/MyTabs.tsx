"use client";

// /my 탭 — 내 소개서 / 찜한 콜라보 / 콜라보 리포트 / 성사된 콜라보(⭐북극성). 목록을 서버에서 미리 렌더해 슬롯으로 받고,
// 탭 클릭 시 서버 왕복 없이 화면만 토글(즉시 전환). URL은 history.replaceState로만 동기화
// (router.replace를 거치면 RSC payload를 백그라운드 재요청해 낭비 — PreviewTabs와 동일 이유).
import { useState, useRef, useEffect } from "react";

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
      <div
        ref={rowRef}
        className="no-scrollbar flex gap-5 overflow-x-auto overscroll-x-contain border-b border-hairline"
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
        <TabButton active={active === "collabs"} onClick={() => go("collabs")} count={collabCount}>
          성사된 콜라보
        </TabButton>
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
