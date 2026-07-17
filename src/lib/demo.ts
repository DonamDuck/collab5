// 소개서 미리보기 데모 — 고정 복제본 slug. 원본과 분리(동결), 갱신은 재복제 스크립트.
// spec: docs/superpowers/specs/2026-07-17-preview-photo-relief-design.md
export const DEMO_SLUG_PHOTO = "m-demo-photo";
export const DEMO_SLUG_NONE = "m-demo-none";
export const isDemoSlug = (slug: string) => slug.startsWith("m-demo-");
