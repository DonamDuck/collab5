"use client";

// /my 탭 — 내 소개서 / 찜한 콜라보 / 콜라보 리포트 / 성사된 콜라보(⭐북극성). 목록을 서버에서 미리 렌더해 슬롯으로 받고,
// 탭 클릭 시 서버 왕복 없이 화면만 토글(즉시 전환). URL은 history.replaceState로만 동기화
// (router.replace를 거치면 RSC payload를 백그라운드 재요청해 낭비 — PreviewTabs와 동일 이유).
import { useState, useRef, useEffect } from "react";

type Tab = "mine" | "saved" | "reports" | "collabs";

export function MyTabs({
  initialTab,
  mine,
  saved,
  savedCount,
  reports,
  reportCount,
  collabs,
  collabCount,
}: {
  initialTab: Tab;
  mine: React.ReactNode;
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
  // block:"nearest" — 가로만 맞추고 세로 스크롤은 건드리지 않는다.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rowRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);

  const go = (tab: Tab) => {
    setActive(tab);
    window.history.replaceState(null, "", `/my?tab=${tab}`);
  };

  return (
    <div>
      {/* 탭이 4개가 되며 모바일(375px)에서 한 줄에 안 들어간다 → 가로 스크롤 + 간격 축소.
          no-scrollbar는 globals.css 유틸(스크롤바 숨김, 넘김 제스처만). */}
      <div ref={rowRef} className="no-scrollbar flex gap-5 overflow-x-auto border-b border-hairline">
        <TabButton active={active === "mine"} onClick={() => go("mine")}>
          내 소개서
        </TabButton>
        <TabButton active={active === "saved"} onClick={() => go("saved")}>
          찜한 콜라보{savedCount > 0 ? ` ${savedCount}` : ""}
        </TabButton>
        <TabButton active={active === "reports"} onClick={() => go("reports")}>
          콜라보 리포트{reportCount > 0 ? ` ${reportCount}` : ""}
        </TabButton>
        <TabButton active={active === "collabs"} onClick={() => go("collabs")}>
          성사된 콜라보{collabCount > 0 ? ` ${collabCount}` : ""}
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
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
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
    </button>
  );
}
