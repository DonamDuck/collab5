"use client";
// 접힌 스텁 — 탭하면 그 자리에서 기존 편집 UI가 펼쳐진다(시트 이동 없음).
// 펼쳤지만 빈 채 = 추가 아님(제출 시 값 없으면 어차피 저장 안 됨 — 기존 sanitize/빈값 규칙 재사용).
export function StubSection({
  id, label, expanded, hasData, onExpand, onCollapse, onDelete, children, sub, hiddenWhenCollapsed, badge,
}: {
  id: string; // 완성도 칩 scroll+focus 타깃
  label: string; // 기존 질문 문장 그대로
  expanded: boolean;
  hasData: boolean; // 값 있으면 접기 버튼 숨김(실수 접힘 방지 아님 — 접어도 데이터 유지, 라벨만 "담김" 표시)
  onExpand: () => void;
  onCollapse: () => void;
  onDelete?: () => void; // 있으면 우상단 버튼이 "삭제"(데이터 비우고 시트로 복귀). 없으면 "접기".
  children: React.ReactNode;
  /** 제목 아래 설명 한 줄. 정식 슬롯이다 — 호출부에서 `-mt-4` 음수마진으로 끼워 넣지 말 것(QA #33). */
  sub?: React.ReactNode;
  hiddenWhenCollapsed?: boolean; // 시트 출신 섹션 — 접힌 상태에선 스텁조차 노출하지 않음
  badge?: React.ReactNode; // 라벨 옆 표시(예: AI가 미리 채운 섹션이면 ✨배지)
}) {
  if (!expanded) {
    // ⚠️ hiddenWhenCollapsed(시트 출신 섹션)라도 **값이 있으면 스텁을 반드시 남긴다**.
    //    전엔 통째로 사라져서 폼에서 보지도·고치지도·지우지도 못하는데, 그 내용은
    //    소개서에 실려 외부에 계속 공개됐다(QA 07-29, 데이터 손실). 재진입 경로가 없으면 안 된다.
    //    아래 '담김' 배지도 그동안 이 return null에 막혀 도달조차 못 하던 코드다.
    if (hiddenWhenCollapsed && !hasData) return null;
    return (
      <button
        type="button"
        id={id}
        onClick={onExpand}
        // 빈 스텁 = 점선(‘여기 채우세요’ 입력 어피던스) / 담긴 스텁 = 실선(‘내용 있음, 탭하면 편집’).
        // 정적 장식 점선은 지양하되 어피던스 점선은 유지 — 디자인 시스템 §점선 규칙.
        className={`w-full rounded-md px-4 py-3.5 text-left scroll-mt-4 bg-surface ${
          hasData ? "border border-hairline" : "border border-dashed border-border-strong"
        }`}
      >
        <span className="text-[15px] font-medium text-body">
          {/* 이미 담긴 섹션에 '+'(추가) 기호는 뜻이 어긋난다 — 빈 상태에만 붙인다 */}
          {!hasData && <span className="mr-1 font-semibold text-primary-on">+</span>}
          {label}
        </span>
        {badge && <span className="ml-2 align-middle">{badge}</span>}
        {hasData && (
          <span className="ml-2 rounded-pill bg-primary-tint px-2 py-0.5 text-[12px] font-medium text-primary-on">담김</span>
        )}
      </button>
    );
  }
  return (
    <div id={id} className="scroll-mt-4">
      {/* 설명이 있으면 헤더 아래 여백을 줄인다 — 아래 sub가 그 자리를 채운다.
          전엔 호출부가 `-mt-4`로 이 여백을 **되감아서** 끼워 넣었다(간격이 헤더와 설명 두 곳에 흩어짐). */}
      <div
        className={`flex items-start justify-between gap-2 border-b border-hairline pb-2 ${
          sub ? "mb-3" : "mb-[23px]"
        }`}
      >
        {/* 모바일: 배지를 타이틀 위(왼쪽)에 스택 / 데스크탑: 타이틀 옆 인라인(줄바꿈 방지) */}
        <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          {badge && <span className="sm:order-2">{badge}</span>}
          <span className="text-[17px] font-bold leading-snug text-ink sm:order-1">{label}</span>
        </div>
        <button
          type="button"
          onClick={onDelete ?? onCollapse}
          className="shrink-0 text-[13px] text-faint hover:text-ink"
        >
          {onDelete ? "삭제" : "접기"}
        </button>
      </div>
      {sub && <p className="mb-4 text-[13px] leading-relaxed text-mute">{sub}</p>}
      {children}
    </div>
  );
}
