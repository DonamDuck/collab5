// MonitorAlign 설명 그림 — 앱 아이콘과 같은 색(남색·파란 모니터·보라 노트북·초록 점)으로 그린 인라인 SVG.
// 정렬 화면 그림은 실제 앱 모습(어두운 막 · 고른 가장자리의 파란 막대 · 클릭한 점)을 따른다.
// 글자가 들어가는 그림은 lang으로 한·영을 고른다.
import type { ReactNode } from "react";

type Lang = "ko" | "en";

const C = {
  bezel: "#E9EDF6",
  bezelLine: "#CBD2E1",
  stand: "#C9CFDD",
  monitor: "#3A6EF0",
  laptop: "#805CF6",
  dim: "#1E2436",
  accent: "#3B82F6",
  green: "#2EC478",
  red: "#EF4444",
  ink: "#1F2430",
  mute: "#6B7280",
};
const FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif";

function Frame({ label, children, viewBox = "0 0 520 236" }: { label: string; children: ReactNode; viewBox?: string }) {
  return (
    <figure className="mt-3 overflow-hidden rounded-md border border-hairline bg-surface-faint">
      <svg role="img" aria-label={label} viewBox={viewBox} className="block h-auto w-full" fontFamily={FONT}>
        {children}
      </svg>
    </figure>
  );
}

// 책상 장면: 모니터는 왼쪽 위, 노트북은 오른쪽 아래(대표 책상 사진 속 배치)
function Desk({ dimMonitor = false, dimLaptop = false }: { dimMonitor?: boolean; dimLaptop?: boolean }) {
  return (
    <g>
      <rect x="110" y="14" width="200" height="122" rx="8" fill={C.bezel} stroke={C.bezelLine} />
      <rect x="118" y="22" width="184" height="106" rx="4" fill={dimMonitor ? C.dim : C.monitor} />
      <rect x="200" y="136" width="20" height="17" fill={C.stand} />
      <rect x="178" y="151" width="64" height="7" rx="3.5" fill={C.stand} />
      <rect x="290" y="140" width="150" height="86" rx="6" fill={C.bezel} stroke={C.bezelLine} />
      <rect x="297" y="147" width="136" height="72" rx="3" fill={dimLaptop ? C.dim : C.laptop} />
      <rect x="275" y="226" width="180" height="7" rx="3.5" fill={C.stand} />
    </g>
  );
}

function ArrowHead({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="15" markerHeight="15" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0 L10 5 L0 10 z" fill={color} />
      </marker>
    </defs>
  );
}

function Cursor({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y} l0 16 l4.2 -4 l3 6.6 l2.6 -1.2 l-3 -6.4 l5.8 0 z`}
      fill="#fff"
      stroke="#111"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
}

function Dot({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="8" fill="#fff" />
      <circle cx={x} cy={y} r="5.5" fill={C.accent} />
    </g>
  );
}

function Badge({ x, y, n }: { x: number; y: number; n: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="13" fill={C.accent} stroke="#fff" strokeWidth="2.5" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">
        {n}
      </text>
    </g>
  );
}

// ── 왜: 책상 위 실제 모습 vs 컴퓨터가 기억하는 배치 ──
export function WhyFigure({ lang }: { lang: Lang }) {
  const t =
    lang === "ko"
      ? { desk: "책상 위 실제 모습", mem: "컴퓨터가 기억하는 배치", label: "모니터는 왼쪽 위에 있는데 컴퓨터는 오른쪽에 있다고 기억해서, 마우스를 위로 올리면 막히는 그림" }
      : { desk: "On your desk", mem: "What your computer remembers", label: "The monitor sits up and to the left, but the computer thinks it is on the right, so moving the pointer up hits a wall" };
  return (
    <Frame label={t.label} viewBox="0 0 560 236">
      {/* 왼쪽: 실제 책상(작게) */}
      <g transform="translate(-36 26) scale(0.62)">
        <Desk />
        <ArrowHead id="ma-arrow-why" color={C.green} />
        <path d="M322 204 Q 306 160 290 118" fill="none" stroke={C.green} strokeWidth="4" strokeLinecap="round" markerEnd="url(#ma-arrow-why)" />
      </g>
      <text x="140" y="226" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.ink}>
        {t.desk}
      </text>
      <line x1="280" y1="20" x2="280" y2="210" stroke={C.bezelLine} />
      {/* 오른쪽: 시스템 설정의 네모 두 개 */}
      <rect x="330" y="104" width="96" height="62" rx="6" fill={C.laptop} />
      <rect x="426" y="62" width="112" height="72" rx="6" fill={C.monitor} />
      <rect x="330" y="104" width="96" height="62" rx="6" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="426" y="62" width="112" height="72" rx="6" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M362 152 L 350 108" fill="none" stroke={C.red} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M340 100 l20 0" stroke={C.red} strokeWidth="4" strokeLinecap="round" />
      <path d="M343 82 l10 10 m0 -10 l-10 10" stroke={C.red} strokeWidth="3" strokeLinecap="round" />
      <text x="420" y="226" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.ink}>
        {t.mem}
      </text>
    </Frame>
  );
}

// ── 쓰는 법 1: 메뉴바 아이콘 → 모니터 정렬하기 ──
function MenuFigure({ lang }: { lang: Lang }) {
  const t =
    lang === "ko"
      ? { items: ["모니터 정렬하기…", "되돌리기", "설정…", "사용법"], label: "메뉴바의 두 화면 아이콘을 눌러 모니터 정렬하기를 고르는 그림" }
      : { items: ["Align Monitors…", "Undo", "Settings…", "How to Use"], label: "Clicking the two-screen icon in the menu bar and choosing Align Monitors" };
  return (
    <Frame label={t.label} viewBox="0 0 520 190">
      <rect x="0" y="0" width="520" height="190" fill="#F6F7FB" />
      <rect x="0" y="0" width="520" height="30" fill="#ECEEF4" />
      <circle cx="22" cy="15" r="6" fill="#9AA1B2" />
      {[60, 96, 128].map((x) => (
        <rect key={x} x={x} y="11" width="24" height="8" rx="4" fill="#C9CEDA" />
      ))}
      {[430, 456, 482].map((x) => (
        <circle key={x} cx={x} cy="15" r="5" fill="#B8BECC" />
      ))}
      {/* 우리 아이콘(눌린 상태) */}
      <rect x="380" y="4" width="34" height="22" rx="5" fill="#D7DBE6" />
      <rect x="386" y="8" width="14" height="10" rx="2" fill="none" stroke={C.ink} strokeWidth="1.8" />
      <rect x="396" y="14" width="13" height="8" rx="2" fill="none" stroke={C.ink} strokeWidth="1.8" />
      <circle cx="397" cy="15" r="2.2" fill={C.ink} />
      {/* 메뉴 */}
      <rect x="250" y="34" width="230" height="140" rx="8" fill="#fff" stroke="#DADDE6" />
      <rect x="256" y="40" width="218" height="28" rx="5" fill={C.accent} />
      <text x="268" y="59" fontSize="13" fontWeight="600" fill="#fff">
        {t.items[0]}
      </text>
      <text x="462" y="59" textAnchor="end" fontSize="12" fill="#fff">
        ⌃⌥⌘A
      </text>
      <text x="268" y="89" fontSize="13" fill={C.ink}>
        {t.items[1]}
      </text>
      <text x="462" y="89" textAnchor="end" fontSize="12" fill={C.mute}>
        ⌃⌥⌘Z
      </text>
      <line x1="262" y1="104" x2="468" y2="104" stroke="#E6E8EF" />
      <text x="268" y="126" fontSize="13" fill={C.ink}>
        {t.items[2]}
      </text>
      <text x="268" y="154" fontSize="13" fill={C.ink}>
        {t.items[3]}
      </text>
      <Cursor x={404} y={50} />
    </Frame>
  );
}

// ── 쓰는 법 2: 지금 화면에서 넘어갈 자리 클릭 ──
function FirstClickFigure({ lang }: { lang: Lang }) {
  const label =
    lang === "ko"
      ? "두 화면이 어두워지고, 노트북 화면 위쪽 가장자리의 왼편을 클릭하면 그 가장자리에 파란 막대와 점이 찍히는 그림"
      : "Both screens dim; clicking the left part of the laptop's top edge marks that edge with a blue bar and a dot";
  return (
    <Frame label={label} viewBox="22 0 520 236">
      <Desk dimMonitor dimLaptop />
      <rect x="297" y="147" width="136" height="4" fill={C.accent} />
      <Dot x={312} y={149} />
      <Cursor x={316} y={156} />
      <Badge x={342} y={169} n="1" />
    </Frame>
  );
}

// ── 쓰는 법 3: 다른 화면에서 들어올 자리 클릭 ──
function SecondClickFigure({ lang }: { lang: Lang }) {
  const label =
    lang === "ko"
      ? "포인터를 모니터로 옮겨 모니터 아래쪽 가장자리의 오른편을 클릭하는 그림"
      : "Moving to the monitor and clicking the right part of its bottom edge";
  return (
    <Frame label={label} viewBox="22 0 520 236">
      <Desk dimMonitor dimLaptop />
      <rect x="297" y="147" width="136" height="4" fill={C.accent} />
      <Dot x={312} y={149} />
      <rect x="118" y="124" width="184" height="4" fill={C.accent} />
      <Dot x={272} y={126} />
      <Cursor x={276} y={133} />
      <Badge x={252} y={107} n="2" />
    </Frame>
  );
}

// ── 쓰는 법 4: 정렬 끝, 마우스가 그대로 넘어감 ──
function DoneFigure({ lang }: { lang: Lang }) {
  const t =
    lang === "ko"
      ? { pill: "정렬했어요", label: "두 점이 맞닿게 정렬되어, 노트북에서 위로 올린 마우스가 모니터 오른쪽 아래로 그대로 넘어가는 그림" }
      : { pill: "Aligned", label: "The two points are joined, so moving the pointer up from the laptop crosses straight into the monitor's lower right" };
  return (
    <Frame label={t.label} viewBox="22 0 520 236">
      <Desk />
      {/* 화살표 끝 너머(같은 방향 왼쪽 위)에 커서를 둬서 서로 안 겹치게 */}
      <ArrowHead id="ma-arrow-done" color={C.green} />
      <path d="M350 206 Q 328 162 300 124" fill="none" stroke={C.green} strokeWidth="4" strokeLinecap="round" markerEnd="url(#ma-arrow-done)" />
      <Cursor x={278} y={84} />
      <g transform="translate(350 40)">
        <rect x="0" y="0" width={lang === "ko" ? 112 : 92} height="30" rx="15" fill="#111827" opacity="0.85" />
        <circle cx="18" cy="15" r="8" fill={C.green} />
        <path d="M14 15 l3 3 l5 -6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="32" y="20" fontSize="13" fontWeight="600" fill="#fff">
          {t.pill}
        </text>
      </g>
    </Frame>
  );
}

export function StepFigure({ step, lang }: { step: number; lang: Lang }) {
  if (step === 0) return <MenuFigure lang={lang} />;
  if (step === 1) return <FirstClickFigure lang={lang} />;
  if (step === 2) return <SecondClickFigure lang={lang} />;
  if (step === 3) return <DoneFigure lang={lang} />;
  return null;
}
