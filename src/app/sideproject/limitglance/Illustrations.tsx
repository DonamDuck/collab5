// LimitGlance 설명 그림 — 인라인 SVG 셋(메뉴 막대·흐름·윈도우 작업 표시줄).
// 그림 속 글자는 언어별 문안(_copy/의 `fig`)에서 받는다. 메뉴 줄은 실제 앱 화면 그대로 옮긴 것이다.
// ⛔Claude·Anthropic 로고나 그 주황색을 그리지 않는다. 우리 아이콘은 계기판(반원 + 바늘)이다.
import type { ReactNode } from "react";
import type { FigCopy } from "./_copy";

const C = {
  desk: "#EEF1F6",
  bar: "#F9FAFB",
  line: "#D9DEE7",
  panel: "#FFFFFF",
  ink: "#1F2430",
  body: "#3A4150",
  mute: "#8A92A3",
  accent: "#3B82F6",
  green: "#2EC478",
  orange: "#F59E0B",
  taskbar: "#EDEFF3",
  gauge: "#3B6EF0",
};
const FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', sans-serif";

function Frame({ label, children, viewBox }: { label: string; children: ReactNode; viewBox: string }) {
  return (
    <figure className="mt-4 max-w-[600px] overflow-hidden rounded-md border border-hairline bg-surface-faint">
      <svg role="img" aria-label={label} viewBox={viewBox} className="block h-auto w-full" fontFamily={FONT}>
        {children}
      </svg>
    </figure>
  );
}

/** 우리 계기판 글리프: 반원 + 바늘. 쓴 몫(pct)은 앱 아이콘과 같은 파랑으로 찬다(실제 메뉴 막대와 같다). */
function Gauge({ x, y, r, pct, color = C.ink, width = 1.8 }: { x: number; y: number; r: number; pct: number; color?: string; width?: number }) {
  const a = Math.PI - (Math.min(Math.max(pct, 0), 100) / 100) * Math.PI;
  const nx = x + Math.cos(a) * r * 0.78;
  const ny = y - Math.sin(a) * r * 0.78;
  const ex = x + Math.cos(a) * r;
  const ey = y - Math.sin(a) * r;
  return (
    <g strokeWidth={width} strokeLinecap="round" fill="none">
      <path d={`M${x - r} ${y} A${r} ${r} 0 0 1 ${x + r} ${y}`} stroke={C.line} />
      <path d={`M${x - r} ${y} A${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`} stroke={C.gauge} />
      <path d={`M${x} ${y} L${nx.toFixed(2)} ${ny.toFixed(2)}`} stroke={color} />
      <circle cx={x} cy={y} r={width * 0.9} fill={color} stroke="none" />
    </g>
  );
}

function Wifi({ x, y, color = C.ink }: { x: number; y: number; color?: string }) {
  return (
    <g stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none">
      <path d={`M${x - 7} ${y - 3} Q${x} ${y - 9} ${x + 7} ${y - 3}`} />
      <path d={`M${x - 4.3} ${y} Q${x} ${y - 4} ${x + 4.3} ${y}`} />
      <circle cx={x} cy={y + 3} r="1.3" fill={color} stroke="none" />
    </g>
  );
}

function Battery({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y - 5} width="20" height="10" rx="2.5" fill="none" stroke={C.ink} strokeWidth="1.2" />
      <rect x={x + 2} y={y - 3} width="13" height="6" rx="1.2" fill={C.ink} />
      <rect x={x + 21} y={y - 2} width="1.8" height="4" rx="0.9" fill={C.ink} />
    </g>
  );
}

// ── 1. 메뉴 막대 + 펼친 메뉴 ─────────────────────────────────
export function MenuFigure({ t, font }: { t: FigCopy; font?: string }) {
  const px = 146;
  const pw = 362;
  // 줄마다 y 위치를 미리 계산한다(렌더 중에 변수를 고치지 않게).
  const rowY = t.rows.reduce<number[]>((acc, r, i) => [...acc, i === 0 ? 56 : acc[i - 1] + (t.rows[i - 1].sub ? 30 : 22)], []);
  const last = t.rows.length ? rowY[rowY.length - 1] + (t.rows[t.rows.length - 1].sub ? 30 : 22) : 56;
  const rowNodes = t.rows.map((r, i) =>
    r.sub ? (
      <text key={`r${i}`} x={px + 30} y={rowY[i]} fontSize="13.5" fill={C.mute}>
        {r.label}
      </text>
    ) : (
      <g key={`r${i}`}>
        <text x={px + 16} y={rowY[i]} fontSize="15.5" fill={C.ink}>
          {r.label}
        </text>
        {r.value && (
          <text x={px + pw - 16} y={rowY[i]} fontSize="15.5" fontWeight="700" fill={C.ink} textAnchor="end">
            {r.value}
          </text>
        )}
      </g>
    ),
  );
  const sep1 = last - 8;
  const metaY = last + 12;
  const sep2 = metaY + 14;
  const itemY = (i: number) => sep2 + 24 + i * 27;
  const itemNodes = t.items.map((it, i) => (
    <g key={`i${i}`}>
      {i === 1 && (
        <path d={`M${px + 12} ${itemY(i) - 5} l3.5 3.5 l7 -8`} stroke={C.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      <text x={px + 30} y={itemY(i)} fontSize="15.5" fill={C.ink}>
        {it}
      </text>
    </g>
  ));
  const iy = itemY(t.items.length);
  const ph = iy - 16 - 34;

  return (
    <Frame label={t.menuLabel} viewBox={`0 0 520 ${Math.ceil(iy + 2)}`}>
      <g fontFamily={font ?? FONT}>
        <rect x="0" y="0" width="520" height={iy + 2} fill={C.desk} />
        {/* 메뉴 막대 */}
        <rect x="0" y="0" width="520" height="26" fill={C.bar} />
        <rect x="0" y="26" width="520" height="1" fill={C.line} />
        <rect x="14" y="9" width="40" height="8" rx="4" fill={C.line} />
        <rect x="64" y="9" width="28" height="8" rx="4" fill={C.line} />
        {/* 눌린 상태의 우리 아이콘 */}
        <rect x="292" y="3" width="56" height="20" rx="5" fill="#E3E7EE" />
        <Gauge x={306} y={17} r={7} pct={42} />
        <text x="318" y="18" fontSize="12.5" fontWeight="600" fill={C.ink}>
          42%
        </text>
        <Wifi x={372} y={14} />
        <Battery x={392} y={13} />
        <text x="508" y="18" fontSize="12" fill={C.ink} textAnchor="end">
          12:50
        </text>
        {/* 펼친 메뉴 */}
        <rect x={px + 1} y="35" width={pw} height={ph} rx="9" fill="#000" opacity="0.06" />
        <rect x={px} y="33" width={pw} height={ph} rx="9" fill={C.panel} stroke={C.line} />
        {rowNodes}
        <rect x={px + 10} y={sep1} width={pw - 20} height="1" fill={C.line} />
        <text x={px + 16} y={metaY} fontSize="13.5" fill={C.mute}>
          {t.meta}
        </text>
        <rect x={px + 10} y={sep2} width={pw - 20} height="1" fill={C.line} />
        {itemNodes}
      </g>
    </Frame>
  );
}

// ── 2. 흐름: 로그인된 브라우저 → 앱 (숫자만 건너간다) ─────────────
export function FlowFigure({ t, font }: { t: FigCopy; font?: string }) {
  return (
    <Frame label={t.flowLabel} viewBox="0 0 520 176">
      <g fontFamily={font ?? FONT}>
        <rect x="0" y="0" width="520" height="176" fill={C.desk} />
        {/* 브라우저 창 */}
        <rect x="20" y="28" width="190" height="122" rx="10" fill={C.panel} stroke={C.line} />
        <rect x="20" y="28" width="190" height="26" rx="10" fill={C.bar} />
        <rect x="20" y="44" width="190" height="10" fill={C.bar} />
        <rect x="20" y="54" width="190" height="1" fill={C.line} />
        <circle cx="35" cy="41" r="3.5" fill="#F87171" />
        <circle cx="47" cy="41" r="3.5" fill="#FBBF24" />
        <circle cx="59" cy="41" r="3.5" fill="#34D399" />
        {/* 확장 아이콘 + 배지 */}
        <rect x="170" y="32" width="30" height="18" rx="5" fill="#E3E7EE" />
        <Gauge x={180} y={46} r={6} pct={42} width={1.6} />
        <rect x="188" y="35" width="15" height="11" rx="5.5" fill={C.gauge} />
        <text x="195.5" y="43.5" fontSize="8" fontWeight="700" fill="#fff" textAnchor="middle">
          42
        </text>
        <text x="115" y="96" fontSize="15" fontWeight="700" fill={C.ink} textAnchor="middle">
          {t.browser}
        </text>
        <text x="115" y="118" fontSize="12" fill={C.body} textAnchor="middle">
          {t.browserSub}
        </text>
        {/* 화살표 */}
        <path d="M220 89 L298 89" stroke={C.accent} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M298 82 L308 89 L298 96 z" fill={C.accent} />
        <text x="264" y="74" fontSize="11.5" fontWeight="600" fill={C.accent} textAnchor="middle">
          {t.only}
        </text>
        <rect x="236" y="100" width="56" height="20" rx="10" fill={C.panel} stroke={C.line} />
        <text x="264" y="114" fontSize="11" fontWeight="700" fill={C.ink} textAnchor="middle">
          42%
        </text>
        {/* 앱 */}
        <rect x="316" y="28" width="184" height="122" rx="10" fill={C.panel} stroke={C.line} />
        <rect x="316" y="28" width="184" height="24" rx="10" fill={C.bar} />
        <rect x="316" y="42" width="184" height="10" fill={C.bar} />
        <rect x="316" y="52" width="184" height="1" fill={C.line} />
        <Gauge x={432} y={45} r={6.5} pct={42} />
        <text x="443" y="46" fontSize="11.5" fontWeight="600" fill={C.ink}>
          42%
        </text>
        <text x="408" y="96" fontSize="15" fontWeight="700" fill={C.ink} textAnchor="middle">
          {t.app}
        </text>
        <text x="408" y="118" fontSize="12" fill={C.body} textAnchor="middle">
          {t.appSub}
        </text>
      </g>
    </Frame>
  );
}

// ── 3. 윈도우 작업 표시줄 오른쪽 ─────────────────────────────
export function TrayFigure({ t, font }: { t: FigCopy; font?: string }) {
  return (
    <Frame label={t.trayLabel} viewBox="0 0 520 132">
      <g fontFamily={font ?? FONT}>
        <rect x="0" y="0" width="520" height="132" fill={C.desk} />
        {/* 말풍선 */}
        <rect x="196" y="22" width="240" height="30" rx="6" fill={C.panel} stroke={C.line} />
        <text x="316" y="42" fontSize="12.5" fill={C.ink} textAnchor="middle">
          {t.trayTip}
        </text>
        {/* 작업 표시줄 */}
        <rect x="0" y="86" width="520" height="46" fill={C.taskbar} />
        <rect x="0" y="86" width="520" height="1" fill={C.line} />
        <rect x="22" y="100" width="18" height="18" rx="4" fill={C.line} />
        <rect x="50" y="100" width="18" height="18" rx="4" fill={C.line} />
        <path d="M276 113 l5 -5 l5 5" stroke={C.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* 우리 아이콘: 숫자를 그린 트레이 아이콘 */}
        <rect x="298" y="98" width="24" height="24" rx="5" fill="#E1E5EC" />
        <text x="310" y="115" fontSize="12.5" fontWeight="800" fill="#2556D6" textAnchor="middle">
          42
        </text>
        <Wifi x={344} y={110} />
        <path d="M360 106 h4 l5 -4 v16 l-5 -4 h-4 z" fill={C.ink} />
        <Battery x={378} y={110} />
        <text x="496" y="106" fontSize="11" fill={C.ink} textAnchor="end">
          12:50
        </text>
        <text x="496" y="121" fontSize="11" fill={C.ink} textAnchor="end">
          2026-10-14
        </text>
      </g>
    </Frame>
  );
}
