"use client";
// 접힌 스텁 — 탭하면 그 자리에서 기존 편집 UI가 펼쳐진다(시트 이동 없음).
// 펼쳤지만 빈 채 = 추가 아님(제출 시 값 없으면 어차피 저장 안 됨 — 기존 sanitize/빈값 규칙 재사용).
export function StubSection({
  id, label, expanded, hasData, onExpand, onCollapse, children, hiddenWhenCollapsed, badge,
}: {
  id: string; // 완성도 칩 scroll+focus 타깃
  label: string; // 기존 질문 문장 그대로
  expanded: boolean;
  hasData: boolean; // 값 있으면 접기 버튼 숨김(실수 접힘 방지 아님 — 접어도 데이터 유지, 라벨만 "담김" 표시)
  onExpand: () => void;
  onCollapse: () => void;
  children: React.ReactNode;
  hiddenWhenCollapsed?: boolean; // 시트 출신 섹션 — 접힌 상태에선 스텁조차 노출하지 않음
  badge?: React.ReactNode; // 라벨 옆 표시(예: AI가 미리 채운 섹션이면 ✨배지)
}) {
  if (!expanded) {
    if (hiddenWhenCollapsed) return null;
    return (
      <button
        type="button"
        id={id}
        onClick={onExpand}
        className="w-full rounded-md border border-dashed border-border-strong bg-surface px-4 py-3.5 text-left scroll-mt-4"
      >
        <span className="text-[15px] font-medium text-body">
          <span className="mr-1 font-semibold text-primary-on">+</span> {label}
        </span>
        {badge && <span className="ml-2 align-middle">{badge}</span>}
        {hasData && (
          <span className="ml-2 rounded-pill bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-on">담김</span>
        )}
      </button>
    );
  }
  return (
    <div id={id} className="scroll-mt-4">
      <div className="mb-[23px] flex items-center justify-between gap-2 border-b border-hairline pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[17px] font-bold text-ink">{label}</span>
          {badge}
        </div>
        <button type="button" onClick={onCollapse} className="shrink-0 text-sm text-faint hover:text-ink">접기</button>
      </div>
      {children}
    </div>
  );
}
