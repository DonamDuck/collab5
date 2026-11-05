// 딴짓 페이지 열림 · 내려받기 기록 (대표 11-04: 「딴짓에서 다운로드한 횟수, 딴짓 페이지 조회 수 측정」)
// 표 = sideproject_events (supabase/migrations/2026-11-05-sideproject-events.sql)
//
// 🗂길은 하나다. 브라우저가 POST /api/sideproject/event 로 한 줄을 보내고 서버가 표에 적는다.
//   · 페이지 열림 = src/app/sideproject/layout.tsx 의 SideTrack 이 주소가 바뀔 때마다 보낸다(목록·상세·개인정보 다).
//   · 내려받기 = DownloadButtons 가 버튼을 누를 때 보낸다. ⭐버튼 주소는 그대로 zip이다 — 기록이 실패해도 내려받기는 된다.
//   · 앱이 스스로 하는 업데이트(version.json을 읽고 zip을 바로 받는 길)는 적지 않는다. 그 파일 모양도 건드리지 않는다.
// 🙋대표 본인 기기는 `?me=1` 로 한 번 열면 그 브라우저의 기록에 mine=true 가 붙는다(`?me=0` 으로 끈다).
// 🔒IP는 저장하지 않는다. visitor 는 서버가 IP·브라우저·날짜를 섞어 만든 익명 번호라 날이 바뀌면 같은 사람도 달라진다.
// 이 파일은 브라우저에서도 읽힌다 — 서버 전용 모듈을 넣지 말 것.

export type SideEventKind = "view" | "download";

/** 표에 들어가는 project 값. list = 딴짓 목록 페이지(/sideproject) · support = 후원하기(/sideproject/support) */
export const SIDE_EVENT_PROJECTS = ["list", "monitoralign", "limitglance", "hanmadi", "support"] as const;
export type SideEventProject = (typeof SIDE_EVENT_PROJECTS)[number];

/** /sideproject/monitoralign/ja → monitoralign · /sideproject → list · 모르는 주소 → null */
export function sideProjectOf(pathname: string): SideEventProject | null {
  const seg = pathname.split("/")[2] ?? "";
  if (!seg) return "list";
  return (SIDE_EVENT_PROJECTS as readonly string[]).includes(seg) ? (seg as SideEventProject) : null;
}

const ME_KEY = "c5-sideproject-me";

/** `?me=1`이면 이 브라우저를 대표 기기로 기억하고(0이면 잊고) 지금 값을 돌려준다 */
export function mineFlag(): boolean {
  try {
    const me = new URLSearchParams(location.search).get("me");
    if (me === "1") localStorage.setItem(ME_KEY, "1");
    if (me === "0") localStorage.removeItem(ME_KEY);
    return localStorage.getItem(ME_KEY) === "1";
  } catch {
    return false;
  }
}

export type SideEventBody = {
  kind: SideEventKind;
  project: SideEventProject;
  path: string;
  os?: "mac" | "windows";
  version?: string;
  /** 타고 온 주소(서버가 사이트 이름만 남긴다) */
  ref?: string;
  mine?: boolean;
};

export function sendSideEvent(body: SideEventBody) {
  const data = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/sideproject/event", new Blob([data], { type: "application/json" }))) return;
  } catch {
    // 아래 fetch로
  }
  fetch("/api/sideproject/event", { method: "POST", body: data, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}
