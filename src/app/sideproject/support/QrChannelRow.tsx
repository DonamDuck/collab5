"use client";

// QR을 펼치는 창구 줄(지금은 카카오페이 하나, 11-12 대표).
// 카카오페이 송금 링크는 데스크탑 브라우저에서 열면 「모바일에서 이용 가능해요」 화면만 나온다.
//   · 폰·태블릿(손가락) → 지금처럼 링크. 누르면 카카오페이 앱이 열린다.
//   · 데스크탑(마우스) → 같은 줄을 누르면 그 자리에 QR이 펼쳐진다. 휴대폰 카메라로 찍으면 된다.
// 둘을 나누는 건 화면 폭이 아니라 «주로 쓰는 포인터»다(pointer-fine). 좁게 줄인 데스크탑 창도 QR, 큰 태블릿도 링크.
// 두 모양을 다 그려 두고 CSS로 하나만 보인다 → 서버 그림과 브라우저 그림이 달라지지 않는다.
import { useId, useState, type ReactNode } from "react";
import type { QrPath } from "./qr";

type Props = {
  /** 왼쪽 아이콘과 이름(서버에서 그린 것 그대로) */
  head: ReactNode;
  /** 창구 이름(QR 그림의 읽기 이름에 쓴다) */
  label: string;
  action: string;
  close: string;
  hint: string;
  url: string;
  qr: QrPath;
  /** 닫혀 있을 때 줄 색(눌림 색 포함) */
  tone: string;
};

const BOX = "flex min-h-[64px] items-center justify-between gap-3 rounded-[16px] px-5";
const QUIET = 2; // QR 둘레 흰 여백(칸 수). 바깥이 밝은 노랑이라 이만큼이면 카메라가 잘 잡는다.

export function QrChannelRow({ head, label, action, close, hint, url, qr, tone }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const view = `${-QUIET} ${-QUIET} ${qr.size + QUIET * 2} ${qr.size + QUIET * 2}`;

  return (
    <>
      <a href={url} target="_blank" rel="noreferrer" className={`${BOX} transition-colors ${tone} pointer-fine:hidden`}>
        {head}
        <span className="shrink-0 text-[15px] font-bold">{action}</span>
      </a>

      <div className={`hidden rounded-[16px] transition-colors pointer-fine:block ${open ? "bg-[#FEE500] text-[#191919]" : tone}`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={`${BOX} w-full cursor-pointer text-left`}
        >
          {head}
          <span className="shrink-0 text-[15px] font-bold">{open ? close : action}</span>
        </button>
        {open && (
          <div id={panelId} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 pb-5">
            <svg
              role="img"
              aria-label={`${label} QR`}
              viewBox={view}
              shapeRendering="crispEdges"
              className="size-[168px] shrink-0 rounded-[12px]"
            >
              <rect x={-QUIET} y={-QUIET} width={qr.size + QUIET * 2} height={qr.size + QUIET * 2} fill="#FFFFFF" />
              <path d={qr.d} fill="#000000" />
            </svg>
            <p className="min-w-0 flex-1 basis-[180px] text-[15px] leading-relaxed font-medium break-keep text-pretty">{hint}</p>
          </div>
        )}
      </div>
    </>
  );
}
