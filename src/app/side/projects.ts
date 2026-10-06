// 사적인 프로젝트 목록 — 대표가 collab5와 따로 만든 개인 도구들(10-06).
// /side 목록 카드와 각 상세 페이지가 같은 이름·한 줄 소개를 쓰도록 여기 한 곳에 둔다.
// ⚠️collab5 서비스와는 별개다. 카드·상세 하단에 그 사실을 늘 같이 적는다.
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
    tagline: "틀어진 듀얼 모니터 배치를 클릭 두 번으로 맞춰요.",
    meta: "macOS · Windows · 무료",
    icon: "/side/monitoralign/icon-256.png",
  },
];
