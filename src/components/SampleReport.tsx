"use client";

// 홈 "콜라보 분석 실물 구경" — 예시 리포트 축약 카드 + 전체 보기(기존 ReportSheet sampleMode 재사용).
// 스펙: Obsidian [[홈-콜라보-프레임-개편]] §새 홈 위계 ③ (2026-07-31, 레드팀 3라운드 통과)
//
// ⚠️ 리포트를 새로 만들지 않는다 — sample-report.json을 /m 잠금 티저와 공유한다.
//    손으로 쓴 가짜 예시는 금지(신뢰 폭탄) — 반드시 실제 파이프라인 산출물이어야 한다.
// ⚠️ 2026-08-01 교체: 가상 쌍("모루초 스튜디오 × 밑줄서점") → **실제 쌍**(캔버스가든 × 호락호락도서관,
//    collab_reports id=37). 실제 브랜드라 캡션에서 "가상"이라고 말하면 거짓이 된다 — 아래 식별 캡션 참조.
// ⚠️ 톤은 '재미'가 아니라 '안목'(왜 맞는지의 근거) — MD·기관이 봐도 장난감으로 안 읽히게.
// ⚠️ source="home" — /m 잠금 티저 지표(report_locked_view)와 유입을 구분(계측 오염 방지).
// ⚠️ 시트는 **portal로 body에** 띄운다 — 홈 섹션들이 home-rise 애니메이션(transform)을 쓰는데,
//    transform이 있는 조상은 fixed의 컨테이닝 블록이 돼 시트가 섹션 박스 안에 갇힌다(실측 07-31:
//    overlay가 341×375로 히어로 안에 렌더됨). open일 때만 포털하므로 SSR document 문제 없음.
import { useState } from "react";
import { createPortal } from "react-dom";
import { ReportSheet } from "@/app/m/[slug]/ReportSheet";
import { collabMethodLabel } from "@/lib/dna-pool";
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

/** 히어로 보조 버튼 — 주 CTA(소개서) 아래 보더 버튼. 누르면 예시 리포트 시트(페이지 이동 없음).
 *  처음엔 텍스트 링크였는데 대표 QA(07-31) "가시적이지 못하다" → 보더 버튼으로 승격.
 *  주 CTA와의 위계는 면색(primary vs 보더)으로 유지 — 분석을 1번 자리로 올리는 건 아니다. */
export function SampleReportLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-md border border-border-strong bg-surface text-[16px] font-medium text-ink hover:bg-surface-soft"
      >
        콜라보 추천 리포트 미리보기
        <span aria-hidden="true" className="text-primary-on">→</span>
      </button>
      <PortalSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** ③ 실물 구경 — 리포트 축약 카드.
 *  구성 = ①콜라보 아이디어 예시 ②이런 점이 잘 어울려요 (대표 확정 07-31).
 *  ⚠️ 한줄 요약은 **뺐다** — 결론만 던지면 "그래서 뭘 해준다는 건데"가 안 남는다.
 *     아이디어(구체 산출물)를 먼저 보여주고 근거를 뒤에 붙이는 편이 '안목'으로 읽힌다.
 *     (2026-08-01: 이 판단이 리포트 전체로 확대돼 oneLiner 자체가 폐지됐다 — 홈은 구조 변화 없음) */
export function SampleReportPeek() {
  const [open, setOpen] = useState(false);
  const report = sampleData.report;
  return (
    <div className="mx-auto max-w-[560px]">
      <div className="rounded-xl border border-hairline bg-surface p-5 text-left shadow-e1">
        {/* 식별 캡션 — 예시임을 정직하게 밝힌다(과장 금지).
            실제 등록 브랜드 쌍이라 "가상"이라고 쓸 수 없다. 대신 **실제 소개서로 만든 것**임을 밝혀
            "손으로 쓴 홍보 문구가 아니다"라는 신뢰 신호로 쓴다. */}
        {/* ⚠️ break-keep 필수 — 실제 브랜드명은 가상 쌍보다 길어 두 줄이 된다. 없으면 "예시 / 예요"처럼
            어절 한가운데서 끊긴다(08-01 실측). */}
        <p className="break-keep text-[12px] font-medium tracking-wide text-mute">
          {sampleData.fromName} × {sampleData.toName} · 실제 소개서로 만든 예시예요
        </p>

        <p className="mt-3 text-[14px] font-bold text-ink">콜라보 아이디어 예시</p>
        <div className="mt-2 space-y-2">
          {report.ideas.slice(0, 2).map((idea, i) => (
            <div key={i} className="rounded-md border border-hairline p-3">
              {/* 아이브로 — 시트·/my와 같은 카드 문법(08-01 시안 C). method를 제목 오른쪽 칩에서
                  윗줄로 올려 제목과 폭을 다투지 않게 한다. 11px 유지(홈은 축약 카드라 한 급 작게). */}
              <p className="text-[11px] font-medium tracking-wide text-faint">
                아이디어 {i + 1}
                {idea.method ? ` · ${collabMethodLabel(idea.method)}` : ""}
              </p>
              <p className="mt-1 break-keep text-[14px] font-bold text-ink">{idea.title}</p>
              <p className="mt-1 line-clamp-2 break-keep text-[13px] leading-[1.55] text-body">
                {idea.desc}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[14px] font-bold text-ink">이런 점이 잘 어울려요</p>
        <ul className="mt-2 space-y-1.5">
          {report.matchPoints.slice(0, 2).map((p, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-[1.55] text-body">
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
