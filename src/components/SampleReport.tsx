"use client";

// 홈 "콜라보 분석 실물 구경" — 예시 리포트 축약 카드 + 전체 보기(기존 ReportSheet sampleMode 재사용).
// 스펙: Obsidian [[홈-콜라보-프레임-개편]] §새 홈 위계 ③ (2026-07-31, 레드팀 3라운드 통과)
//
// ⚠️ 리포트를 새로 만들지 않는다 — sample-report.json(가상 쌍 "모루초 스튜디오 × 밑줄서점",
//    실제 파이프라인으로 1회 생성된 것)을 /m 잠금 티저와 공유한다. 손으로 쓴 가짜 예시는 금지(신뢰 폭탄).
// ⚠️ 톤은 '재미'가 아니라 '안목'(왜 맞는지의 근거) — MD·기관이 봐도 장난감으로 안 읽히게.
// ⚠️ source="home" — /m 잠금 티저 지표(report_locked_view)와 유입을 구분(계측 오염 방지).
// ⚠️ 시트는 **portal로 body에** 띄운다 — 홈 섹션들이 home-rise 애니메이션(transform)을 쓰는데,
//    transform이 있는 조상은 fixed의 컨테이닝 블록이 돼 시트가 섹션 박스 안에 갇힌다(실측 07-31:
//    overlay가 341×375로 히어로 안에 렌더됨). open일 때만 포털하므로 SSR document 문제 없음.
import { useState } from "react";
import { createPortal } from "react-dom";
import { ReportSheet } from "@/app/m/[slug]/ReportSheet";
import { track } from "@/lib/track";
import sampleData from "@/lib/sample-report.json";

/** open일 때만 body 포털로 샘플 시트를 띄운다(홈 전용 래퍼) */
function PortalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return createPortal(
    <ReportSheet
      open={open}
      onClose={onClose}
      fromBrands={[]}
      toSlug=""
      toName=""
      sampleMode
      onPropose={() => {}}
      source="home"
    />,
    document.body
  );
}

/** 히어로 보조 링크 — 텍스트 링크 모양, 누르면 예시 리포트 시트가 열린다(페이지 이동 없음). */
export function SampleReportLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary-on underline-offset-4 hover:underline"
      >
        콜라보 분석 리포트 예시 보기
        <span aria-hidden="true">→</span>
      </button>
      <PortalSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** ③ 실물 구경 — 리포트 축약 카드. 한줄 요약 + 어울리는 점 2개만 보여주고 전체는 시트로. */
export function SampleReportPeek() {
  const [open, setOpen] = useState(false);
  const report = sampleData.report;
  return (
    <div className="mx-auto max-w-[560px]">
      <div className="rounded-xl border border-hairline bg-surface p-5 text-left shadow-e1">
        {/* 식별 캡션 — 가상 쌍임을 정직하게 밝힌다(과장 금지) */}
        <p className="text-[12px] font-medium tracking-wide text-mute">
          {sampleData.fromName} × {sampleData.toName} · 가상의 두 브랜드로 만든 예시예요
        </p>
        <p className="mt-2 break-keep text-[18px] font-bold leading-snug text-ink">
          {report.oneLiner}
        </p>
        <ul className="mt-3 space-y-1.5">
          {report.matchPoints.slice(0, 2).map((p, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-body">
              <span className="shrink-0">✔</span>
              <span className="break-keep line-clamp-2">{p.text}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            track("home_report_peek_open");
            setOpen(true);
          }}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-[15px] font-medium text-ink hover:bg-surface-soft"
        >
          예시 리포트 전체 보기
        </button>
      </div>
      {/* 정책을 셀링으로 — "전시되나?" 오해 방지 겸 신뢰 신호 */}
      <p className="mt-3 text-center text-[13px] text-faint">
        분석 결과는 요청한 분만 볼 수 있어요.
      </p>
      <PortalSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
