// GA4 이벤트 헬퍼 — gtag가 로드된 환경(prod)에서만 발화, 로컬은 no-op.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md §6
export function track(event: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.("event", event, params ?? {});
}
