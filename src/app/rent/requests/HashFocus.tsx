"use client";

// 하루 팝업 — 「내 예약」 목록에서 한 줄을 짚어 주는 조각 (2026-09-27)
//
// 🔗대표 D2 — *「이건 결제화면에서 넘기는거라면 → 이건 그 해당건에 한해 가는게 맞는거 같음」*.
//   완료 화면(`/rent/done/[bookingId]`)의 「내 예약 보기」가 `/rent/requests#b-<예약번호>`로 온다.
//   도착하면 그 줄로 내려가고, 어느 줄인지 보이게 1초 남짓 옅은 면을 깔았다가 걷는다.
//   주소에 해시가 없으면 아무것도 안 한다 — 메뉴 바·메일로 온 사람은 지금처럼 목록 맨 위에서 시작한다.
// ⚠️결제 안 한 신청은 접힌 칸(`<details>`) 안에 있다. 그 줄을 짚으면 접힌 칸부터 연다.
// 🎨면은 인라인 스타일로 얹는다. 줄에 이미 `bg-surface`가 있어서, 클래스를 하나 더 얹으면 스타일시트 순서에 따라 안 먹을 수 있다.
import { useEffect } from "react";

/** 한 줄을 칠해 두는 시간과 걷히는 시간(ms). 합쳐 2초 안쪽 — 눈에 띄되 오래 남지 않게. */
const HOLD_MS = 1200;
const FADE_MS = 600;

export function HashFocus() {
  useEffect(() => {
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!/^b-\d+$/.test(id)) return;
    const el = document.getElementById(id);
    if (!el) return;
    const fold = el.closest("details");
    if (fold && !fold.open) fold.open = true;
    el.scrollIntoView({ block: "center" });
    el.style.backgroundColor = "var(--primary-pale)";
    const fade = window.setTimeout(() => {
      el.style.transition = `background-color ${FADE_MS}ms ease`;
      el.style.backgroundColor = "";
    }, HOLD_MS);
    const done = window.setTimeout(() => {
      el.style.transition = "";
    }, HOLD_MS + FADE_MS + 100);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
      el.style.backgroundColor = "";
      el.style.transition = "";
    };
  }, []);
  return null;
}
