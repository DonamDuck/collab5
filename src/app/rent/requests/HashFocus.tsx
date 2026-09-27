"use client";

// 하루 팝업 — 「내 예약」 목록에서 한 줄을 짚어 주는 조각 (2026-09-27)
//
// 🔗대표 D2 — *「이건 결제화면에서 넘기는거라면 → 이건 그 해당건에 한해 가는게 맞는거 같음」*.
//   예약 한 건 화면(`/rent/done/[bookingId]`)의 「예약 내역 확인」이 `/rent/requests?g=<탭>#b-<예약번호>`로 온다.
//   도착하면 그 줄로 내려가고, 어느 줄인지 보이게 1초 남짓 옅은 면을 깔았다가 걷는다.
//   주소에 해시가 없으면 아무것도 안 한다 — 메뉴 바·메일로 온 사람은 지금처럼 목록 맨 위에서 시작한다.
// 🗂09-27 대표 #162 — 목록이 탭으로 나뉘었다. 해시가 짚은 줄이 지금 탭에 없으면(탭 없이 온 옛 주소 `/rent/requests#b-12` 등)
//   그 줄이 선 탭으로 주소를 바꿔 옮겨 간다(문서를 새로 연다). 새 탭 화면에서 이 조각이 한 번 더 돌아 그 줄을 칠한다.
//   ⚠️화면 안 이동(`router.replace`)을 안 쓰는 이유 — 드문 길(탭 없는 옛 주소)이라 새로 여는 값이 싸고, 라우터가 없는 자리
//     (하네스의 서버 렌더)에서도 이 조각이 그려져야 한다. 예약 한 건 화면은 처음부터 탭을 붙여 온다(`guestBookingHref`).
//   🔻전엔 결제 안 한 신청이 접힌 칸(`<details>`) 안에 있어서 그 칸부터 열었다. 그 신청은 이제 목록에 안 선다.
// 🎨면은 인라인 스타일로 얹는다. 줄에 이미 `bg-surface`가 있어서, 클래스를 하나 더 얹으면 스타일시트 순서에 따라 안 먹을 수 있다.
import { useEffect } from "react";

/** 한 줄을 칠해 두는 시간과 걷히는 시간(ms). 합쳐 2초 안쪽 — 눈에 띄되 오래 남지 않게. */
const HOLD_MS = 1200;
const FADE_MS = 600;

export function HashFocus({ active, where }: {
  /** 지금 열린 탭(`?g=`). */
  active: string;
  /** 예약 번호 → 그 줄이 선 탭. 목록에 서는 줄만 들어 있다. */
  where: Record<string, string>;
}) {
  useEffect(() => {
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const m = /^b-(\d+)$/.exec(id);
    if (!m) return;
    const el = document.getElementById(id);
    if (!el) {
      // 이 탭에 없는 줄 — 그 줄이 선 탭으로 옮긴다. 뒤로 가기에 이 한 번이 안 쌓이게 `replace`.
      const tab = where[m[1]];
      if (tab && tab !== active) window.location.replace(`/rent/requests?g=${tab}#${id}`);
      return;
    }
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
    // 탭마다 새로 붙는 조각이라(`key`) 붙을 때 한 번만 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
