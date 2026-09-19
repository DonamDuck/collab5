"use client";

// 🧪목 데이터 띠 (2026-09-17 하루 팝업 → 09-18 사이트 전체) · 개발 빌드 전용
//
// 목 쿠키가 켜져 있는 동안 모든 화면 위에 뜬다. 세션·소개서·매거진까지 사이트 전체가 가상 데이터로 보이므로,
//   진짜 화면으로 착각하지 않게 하려고.
// 🎨화면 구성을 보러 온 사람을 가리지 않게 왼쪽 아래 작은 알약으로 두고, 눌러서 접을 수 있다.
//   하단 고정 신청 바(`BookingForm`) 위로 올려 둔다.
// 서버 쪽 판정은 `RentMockBarSlot`이 한다. 여기는 받은 글자를 그리기만 한다.
import Link from "next/link";
import { useState } from "react";

export function RentMockBar({ label }: { label: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="fixed left-3 z-[1000] print:hidden"
      style={{ bottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}
    >
      {open ? (
        <div className="flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ink px-3 py-2 text-[13px] leading-snug text-on-dark shadow-lg">
          <span className="font-medium">목 데이터 보는 중</span>
          <span className="min-w-0 break-keep opacity-80">{label}</span>
          <Link href="/dev/map" className="underline underline-offset-2">
            지도로
          </Link>
          <a href="/dev/mock?off=1" className="underline underline-offset-2">
            끄기
          </a>
          <button type="button" onClick={() => setOpen(false)} aria-label="띠 접기" className="px-1 opacity-70">
            접기
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-pill bg-ink px-3 py-1.5 text-[13px] font-medium text-on-dark shadow-lg"
        >
          목
        </button>
      )}
    </div>
  );
}
