"use client";

// 내려받기 버튼 두 개 — 방문자의 OS에 맞는 쪽을 주 버튼으로 남기고 다른 쪽은 한 단 낮춘다.
// 서버 렌더(=OS 모름)에선 둘 다 주 버튼이다. OS를 못 알아내면(폰·리눅스) 그대로 둔다.
// url이 빈 항목은 OS와 상관없이 잠근 모양(「준비 중」).
import { useSyncExternalStore } from "react";

export type DownloadItem = {
  os: "mac" | "windows";
  label: string;
  sub: string;
  url: string;
  version: string;
  soon: string;
};

type Os = "mac" | "windows" | null;

function detectOs(): Os {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const plat = nav.userAgentData?.platform || nav.platform || "";
  const ua = nav.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return null;
  // iPadOS는 MacIntel로 보고하지만 터치 포인트가 여럿이다.
  if (/Mac/i.test(plat)) return nav.maxTouchPoints > 1 ? null : "mac";
  if (/Win/i.test(plat)) return "windows";
  return null;
}
const subscribe = () => () => {};

export function DownloadButtons({ items }: { items: DownloadItem[] }) {
  const os = useSyncExternalStore<Os>(subscribe, detectOs, () => null);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => {
        if (!it.url) {
          return (
            <span
              key={it.os}
              aria-disabled="true"
              className="flex min-h-[64px] cursor-not-allowed flex-col items-center justify-center rounded-md bg-surface-soft px-4 py-3 text-center text-mute"
            >
              <span className="text-[16px] font-bold">{it.label}</span>
              <span className="mt-0.5 text-[13px]">{it.soon}</span>
            </span>
          );
        }
        const secondary = os !== null && os !== it.os;
        return (
          <a
            key={it.os}
            href={it.url}
            className={
              secondary
                ? "flex min-h-[64px] flex-col items-center justify-center rounded-md border border-border-strong bg-surface px-4 py-3 text-center text-ink transition-colors hover:bg-surface-soft"
                : "flex min-h-[64px] flex-col items-center justify-center rounded-md bg-primary px-4 py-3 text-center text-primary-on transition-colors hover:bg-primary-strong"
            }
          >
            <span className="text-[16px] font-bold">{it.label}</span>
            <span className="mt-0.5 text-[13px]">
              {it.sub} · v{it.version}
            </span>
          </a>
        );
      })}
    </div>
  );
}
