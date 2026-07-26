"use client";

// /my 탭 — 내 소개서 / 찜한 콜라보 / 콜라보 리포트. 목록을 서버에서 미리 렌더해 슬롯으로 받고,
// 탭 클릭 시 서버 왕복 없이 화면만 토글(즉시 전환). URL은 history.replaceState로만 동기화
// (router.replace를 거치면 RSC payload를 백그라운드 재요청해 낭비 — PreviewTabs와 동일 이유).
import { useState } from "react";

type Tab = "mine" | "saved" | "reports";

export function MyTabs({
  initialTab,
  mine,
  saved,
  savedCount,
  reports,
  reportCount,
}: {
  initialTab: Tab;
  mine: React.ReactNode;
  saved: React.ReactNode;
  savedCount: number;
  reports: React.ReactNode;
  reportCount: number;
}) {
  const [active, setActive] = useState<Tab>(initialTab);

  const go = (tab: Tab) => {
    setActive(tab);
    window.history.replaceState(null, "", `/my?tab=${tab}`);
  };

  return (
    <div>
      <div className="flex gap-7 border-b border-hairline">
        <TabButton active={active === "mine"} onClick={() => go("mine")}>
          내 소개서
        </TabButton>
        <TabButton active={active === "saved"} onClick={() => go("saved")}>
          찜한 콜라보{savedCount > 0 ? ` ${savedCount}` : ""}
        </TabButton>
        <TabButton active={active === "reports"} onClick={() => go("reports")}>
          콜라보 리포트{reportCount > 0 ? ` ${reportCount}` : ""}
        </TabButton>
      </div>
      <div className="mt-6">
        <div hidden={active !== "mine"}>{mine}</div>
        <div hidden={active !== "saved"}>{saved}</div>
        <div hidden={active !== "reports"}>{reports}</div>
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
      onClick={onClick}
      className={`-mb-px flex h-11 items-center border-b-2 text-[15px] transition-colors ${
        active ? "border-primary font-bold text-ink" : "border-transparent font-medium text-mute hover:text-body"
      }`}
    >
      {children}
    </button>
  );
}
