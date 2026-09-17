"use client";

// 한 번만 뜨는 알림 줄의 뒷정리 (2026-09-17)
//
// `/rent/my?saved=…` · `?did=…` 는 방금 한 일을 한 줄 알려 주려고 실어 온 표시다.
// 🪤주소에 그대로 남으면 새로고침할 때마다, 북마크로 올 때마다 「올리셨어요」가 또 뜬다.
//   화면이 그려진 뒤 주소에서만 지운다. `history.replaceState`라 페이지를 다시 읽지 않는다
//   (`router.replace`를 쓰면 서버 컴포넌트가 한 번 더 돌고, 그때는 표시가 없으니 줄이 바로 사라진다).
import { useEffect } from "react";

export function ClearQuery() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.search) return;
      // 🗂09-18 칸(`tab`)은 남긴다 — 지우면 새로고침 때 기본 칸(빌린 공간)으로 튄다. 한 번 뜨는 알림 표시만 걷는다.
      const tab = url.searchParams.get("tab");
      window.history.replaceState(window.history.state, "", url.pathname + (tab ? `?tab=${tab}` : "") + url.hash);
    } catch {
      // 주소를 못 고쳐도 화면에는 영향이 없다. 조용히 둔다.
    }
  }, []);
  return null;
}
