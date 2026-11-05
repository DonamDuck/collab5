// 사적인 프로젝트 목록 — 대표가 collab5와 따로 만든 개인 도구들(10-06).
// /side 목록 카드와 각 상세 페이지가 같은 이름·한 줄 소개를 쓰도록 여기 한 곳에 둔다.
// ⚠️collab5 서비스와는 별개다. 카드·상세 하단에 그 사실을 늘 같이 적는다.
// ⭐후원 창구는 앱마다 두지 않고 한 곳(./support/channels.ts)에 모았다(10-15). 앱 상세의 응원 절은
//   후원하기 페이지(/sideproject/support)로 링크만 건다. 후원하기 페이지의 「후원받는 앱」은 이 목록을 그대로 읽는다.

export type SideProject = {
  slug: string;
  name: string;
  /** 목록 카드용 한 줄. 상세 히어로 문장은 페이지에서 따로 쓴다(길이가 다르다). */
  tagline: string;
  /** 카드 아래 작은 글씨(지원 OS · 가격) */
  meta: string;
  icon: string;
};

export const SIDE_PROJECTS: SideProject[] = [
  {
    slug: "monitoralign",
    name: "MonitorAlign",
    tagline: "여러 모니터를 사용할 때 클릭 두 번으로 모니터 정렬을 맞출 수 있어요.",
    meta: "macOS · Windows · 무료",
    icon: "/sideproject/monitoralign/icon-256.png",
  },
  {
    slug: "limitglance",
    name: "LimitGlance",
    tagline: "Claude 사용량을 메뉴 막대에 늘 띄워 둬요. 챗, 코워크, Claude Code를 합친 숫자예요.",
    meta: "macOS · Windows · 브라우저 확장 · 무료",
    icon: "/sideproject/limitglance/icon-256.png",
  },
  {
    slug: "hanmadi",
    name: "Hanmadi",
    tagline: "스크린샷을 찍고 메모를 함께 남길 수 있어요. 컴퓨터의 기존 메모들도 가져와 함께 관리해 보세요.",
    meta: "macOS · 무료",
    icon: "/sideproject/hanmadi/icon-256.png",
  },
];

export function getSideProject(slug: string): SideProject {
  const p = SIDE_PROJECTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`unknown side project: ${slug}`);
  return p;
}
