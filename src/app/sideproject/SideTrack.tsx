"use client";

// 딴짓 페이지 열림 기록 — 주소가 바뀔 때마다 한 줄(설계 = src/lib/sideprojectEvents.ts 머리말).
// 처음 열린 페이지만 document.referrer 를 싣는다. 사이트 안에서 옮겨 다니면 그 값이 처음 것 그대로 남아서
// 두 번째부터는 우리 주소를 타고 온 것으로 적는다.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mineFlag, sendSideEvent, sideProjectOf } from "@/lib/sideprojectEvents";

let lastPath = "";

export function SideTrack() {
  const pathname = usePathname();
  useEffect(() => {
    // 개발 모드의 effect 두 번 실행 · 같은 주소 재렌더를 한 번으로
    if (!pathname || pathname === lastPath) return;
    const first = lastPath === "";
    lastPath = pathname;
    const project = sideProjectOf(pathname);
    if (!project) return;
    sendSideEvent({
      kind: "view",
      project,
      path: pathname,
      ref: first ? document.referrer : location.origin,
      mine: mineFlag(),
    });
  }, [pathname]);
  return null;
}
