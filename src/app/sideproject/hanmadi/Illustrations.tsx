// 한마디 설명 그림 — 인라인 SVG 둘(스크린샷 카드 · 메모 목록 창).
// 그림 속 글자는 copy.ts의 `fig`에서 받는다. 버튼·사이드바 이름은 실제 앱 화면 그대로다.
// 목록의 메모 내용은 지어낸 예시다(대표 메모를 옮기지 않는다).
import type { ReactNode } from "react";
import type { HanmadiFig } from "./copy";

const C = {
  desk: "#EEF1F6",
  panel: "#FFFFFF",
  card: "#F5F6F9",
  button: "#E7E9EF",
  line: "#D9DEE7",
  side: "#F3F4F7",
  sideOn: "#DCE5FA",
  ink: "#1F2430",
  mute: "#8A92A3",
  blue: "#3A6EF0",
  green: "#2EC478",
};
const FONT = "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif";

function Frame({ label, children, viewBox }: { label: string; children: ReactNode; viewBox: string }) {
  return (
    <figure className="mt-4 max-w-[600px] overflow-hidden rounded-md border border-hairline bg-surface-faint">
      <svg role="img" aria-label={label} viewBox={viewBox} className="block h-auto w-full" fontFamily={FONT}>
        {children}
      </svg>
    </figure>
  );
}

/** 우리 말풍선 글리프(앱 아이콘·메뉴 막대와 같은 모양): 둥근 몸통 + 왼쪽 아래 꼬리 + 가운데 점. */
function Bubble({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * 0.74;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h * 0.4} fill={C.blue} />
      <path d={`M${x + w * 0.17} ${y + h - 2} L${x + w * 0.4} ${y + h - 2} L${x + w * 0.1} ${y + h * 1.33} Z`} fill={C.blue} />
      <circle cx={x + w / 2} cy={y + h / 2} r={w * 0.11} fill={C.green} />
    </g>
  );
}

function Shot({ x, y, w, h, label, fill }: { x: number; y: number; w: number; h: number; label?: string; fill: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} fill={fill} />
      {label && (
        <>
          <rect x={x + w * 0.12} y={y + h * 0.32} width={w * 0.76} height={h * 0.36} rx={4} fill={C.panel} opacity={0.92} />
          <text x={x + w / 2} y={y + h / 2 + 4} fontSize="11" fill={C.mute} textAnchor="middle">
            {label}
          </text>
        </>
      )}
    </g>
  );
}

// ── 1. 스크린샷을 찍으면 뜨는 카드 ─────────────────────────────
export function CardFigure({ t }: { t: HanmadiFig }) {
  const cx = 236, cy = 124, cw = 344, ch = 156;
  const bx = cx + 156, bw = 174;
  const buttons: [string, string][] = [t.text, t.voice, t.close];
  return (
    <Frame label={t.cardLabel} viewBox="0 0 600 300">
      <defs>
        <linearGradient id="hm-card-shot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E3EFE4" />
          <stop offset="1" stopColor="#B9D5BF" />
        </linearGradient>
        <filter id="hm-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="9" floodColor="#1F2430" floodOpacity="0.16" />
        </filter>
      </defs>
      <rect width="600" height="300" fill={C.desk} />
      {/* 보던 창 */}
      <g opacity="0.75">
        <rect x="24" y="24" width="300" height="196" rx="10" fill={C.panel} stroke={C.line} />
        <circle cx="40" cy="38" r="4.5" fill="#FF5F57" />
        <circle cx="54" cy="38" r="4.5" fill="#FEBC2E" />
        <circle cx="68" cy="38" r="4.5" fill="#28C840" />
        <rect x="40" y="62" width="150" height="10" rx="5" fill={C.line} />
        <rect x="40" y="82" width="220" height="8" rx="4" fill={C.button} />
        <rect x="40" y="98" width="196" height="8" rx="4" fill={C.button} />
        <rect x="40" y="122" width="268" height="80" rx="8" fill="url(#hm-card-shot)" />
      </g>
      {/* 카드 */}
      <g filter="url(#hm-shadow)">
        <rect x={cx} y={cy} width={cw} height={ch} rx="16" fill={C.card} stroke={C.line} />
      </g>
      <Shot x={cx + 14} y={cy + 16} w={128} h={110} label={t.shot} fill="url(#hm-card-shot)" />
      <Bubble x={bx} y={cy + 14} w={20} />
      {buttons.map(([label, key], i) => {
        const y = cy + 42 + i * 34;
        return (
          <g key={label}>
            <rect x={bx} y={y} width={bw} height={28} rx="7" fill={C.button} />
            <text x={bx + 12} y={y + 18.5} fontSize="13" fontWeight="600" fill={C.ink}>
              {label}
            </text>
            <text x={bx + bw - 10} y={y + 18} fontSize="11" fill={C.mute} textAnchor="end">
              {key}
            </text>
          </g>
        );
      })}
      {/* 기다리는 시간 막대 */}
      <rect x={cx + 14} y={cy + ch - 9} width={(cw - 28) * 0.62} height="3" rx="1.5" fill={C.blue} />
    </Frame>
  );
}

// ── 2. 메모 목록 창 ─────────────────────────────────────────
const TONE: Record<HanmadiFig["rows"][number]["tone"], string> = {
  green: "url(#hm-list-shot)",
  blue: "url(#hm-blue)",
  sand: "url(#hm-sand)",
  note: C.side,
  sticky: "#FFF1A8",
};

export function ListFigure({ t }: { t: HanmadiFig }) {
  const sideY = (i: number) => 64 + i * 24;
  return (
    <Frame label={t.listLabel} viewBox="0 0 600 340">
      <defs>
        <linearGradient id="hm-list-shot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E3EFE4" />
          <stop offset="1" stopColor="#B9D5BF" />
        </linearGradient>
        <linearGradient id="hm-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E4EBFB" />
          <stop offset="1" stopColor="#BCCDF3" />
        </linearGradient>
        <linearGradient id="hm-sand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4ECDD" />
          <stop offset="1" stopColor="#E2CFAE" />
        </linearGradient>
      </defs>
      <rect width="600" height="340" fill={C.desk} />
      <rect x="10" y="10" width="580" height="320" rx="12" fill={C.panel} stroke={C.line} />
      {/* 사이드바 */}
      <path d="M10 22 A12 12 0 0 1 22 10 L160 10 L160 330 L22 330 A12 12 0 0 1 10 318 Z" fill={C.side} />
      <circle cx="28" cy="27" r="5" fill="#FF5F57" />
      <circle cx="44" cy="27" r="5" fill="#FEBC2E" />
      <circle cx="60" cy="27" r="5" fill="#28C840" />
      {t.side.map((s, i) => {
        const y = sideY(i);
        if (s.head) {
          return (
            <text key={i} x="22" y={y + 4} fontSize="11" fontWeight="600" fill={C.mute}>
              {s.label}
            </text>
          );
        }
        return (
          <g key={i}>
            {s.on && <rect x="16" y={y - 13} width="138" height="22" rx="6" fill={C.sideOn} />}
            <text x="26" y={y + 2} fontSize="13" fill={C.ink} fontWeight={s.on ? 600 : 400}>
              {s.label}
            </text>
            {s.count !== undefined && (
              <text x="146" y={y + 2} fontSize="11.5" fill={C.mute} textAnchor="end">
                {s.count}
              </text>
            )}
          </g>
        );
      })}
      {/* 검색 칸 */}
      <rect x="174" y="38" width="402" height="26" rx="7" fill={C.side} />
      <circle cx="189" cy="50" r="4.5" fill="none" stroke={C.mute} strokeWidth="1.5" />
      <path d="M192.5 53.5 L196 57" stroke={C.mute} strokeWidth="1.5" strokeLinecap="round" />
      <text x="202" y="55" fontSize="12" fill={C.mute}>
        {t.search}
      </text>
      {/* 줄 */}
      {t.rows.map((r, i) => {
        const y = 78 + i * 48;
        return (
          <g key={i}>
            <rect x="178" y={y + 6} width="60" height="38" rx="6" fill={TONE[r.tone]} stroke={r.tone === "note" ? C.line : "none"} />
            {r.tone === "note" && (
              <g stroke={C.mute} strokeWidth="1.4" strokeLinecap="round">
                <path d={`M198 ${y + 18} H218`} />
                <path d={`M198 ${y + 25} H218`} />
                <path d={`M198 ${y + 32} H211`} />
              </g>
            )}
            <text x="252" y={y + 22} fontSize="13.5" fontWeight="600" fill={C.ink}>
              {r.title}
            </text>
            <text x="252" y={y + 39} fontSize="11.5" fill={C.mute}>
              {r.meta}
            </text>
            {i < t.rows.length - 1 && <path d={`M252 ${y + 49} H576`} stroke={C.line} strokeWidth="0.8" />}
          </g>
        );
      })}
    </Frame>
  );
}
