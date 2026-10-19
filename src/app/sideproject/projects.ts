// 사적인 프로젝트 목록 — 대표가 collab5와 따로 만든 개인 도구들(10-06).
// /side 목록 카드와 각 상세 페이지가 같은 이름·한 줄 소개를 쓰도록 여기 한 곳에 둔다.
// ⚠️collab5 서비스와는 별개다. 카드·상세 하단에 그 사실을 늘 같이 적는다.

/** 후원 창구 하나. `url`이 빈 문자열이면 화면에 그리지 않는다. */
export type SupportLink = { label: string; url: string; note?: string };

export type SideProject = {
  slug: string;
  name: string;
  /** 목록 카드용 한 줄. 상세 히어로 문장은 페이지에서 따로 쓴다(길이가 다르다). */
  tagline: string;
  /** 카드 아래 작은 글씨(지원 OS · 가격) */
  meta: string;
  icon: string;
  /**
   * 후원 창구 — 언어별. 상세 페이지의 응원 절(`#support`)이 이걸 그린다.
   *   · `ko` = 한국어 페이지 · `en` = 영어 페이지(한국어 페이지에도 「해외에서는」 아래 작게 나온다)
   *   · url이 빈 항목은 숨고, 그 언어에 남는 게 없으면 응원 절이 통째로 숨는다.
   * ⛔**version.json에 넣지 말 것** — 앱 업데이터가 그 파일을 엄격하게 읽어서 모양이 바뀌면 깨진다.
   * ⛔**계좌번호는 어디에도 적지 않는다**(대표 결정 보류, 권하지 않음). 링크형 창구만.
   */
  support?: { ko: SupportLink[]; en: SupportLink[] };
};

export const SIDE_PROJECTS: SideProject[] = [
  {
    slug: "monitoralign",
    name: "MonitorAlign",
    tagline: "여러 모니터를 사용할 때 클릭 두 번으로 모니터 정렬을 맞출 수 있어요.",
    meta: "macOS · Windows · 무료",
    icon: "/sideproject/monitoralign/icon-256.png",
    support: {
      ko: [{ label: "토스로 응원하기", url: "" }],
      en: [
        { label: "GitHub Sponsors", url: "" },
        { label: "Ko-fi", url: "" },
      ],
    },
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
    name: "한마디",
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
