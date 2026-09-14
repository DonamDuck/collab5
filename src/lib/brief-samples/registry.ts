// 브리프 목록 (2026-09-14)
//
// ⚠️**아직 DB가 없다.** 대표 지시로 로컬에서 만들고 그대로 배포한다 — 스키마는 나중에
// (기획서 `docs/superpowers/specs/2026-09-14-brief-page-design.md` §데이터 모델).
// 여기 한 줄이 곧 한 페이지다. 새 브리프가 나오면 파일 하나 + 이 목록 한 줄.
//
// 🔑**주소는 «소개서 slug»를 그대로 쓴다.** `/brief/m-7wu2d0` ↔ `/m/m-7wu2d0`.
//   ⭐짐작 못 할 문자열이라 **소개서와 «같은 수준»의 노출**이 된다. 새 규칙을 만들지 않는다.
//   ⛔`/brief/rapha` 같은 예쁜 주소를 쓰지 마라 — 짐작이 되고, 그 순간 노출 수준이 바뀐다.
//
// 🚨**접근 제어가 아직 없다.** 대표 확정은 「브리프 주인만」인데(기획서 §대표 확정 사항)
//   계정 연결과 로컬 인증이 아직이라 지금은 «링크를 아는 사람»이 볼 수 있다.
//   👉이건 **지금 노션 링크와 같은 수준**이라 노출이 늘지 않는다(09-14 로그아웃 브라우저로 8건 전수 확인).
//   owner 연결이 되는 대로 서버에서 세션과 대조하는 분기를 넣는다.

export interface BriefSample {
  /** 소개서 slug = 브리프 주소 */
  slug: string;
  brandName: string;
  /** 발행일 (노션 최종 수정 기준) */
  publishedAt: string;
  /** 원본 노션 (대표 작업본 — 정본은 늘 노션이다) */
  notionUrl: string;
  markdown: string;
}

import { RAPHA } from "./rapha";

export const BRIEFS: BriefSample[] = [RAPHA];

export const BRIEF_BY_SLUG = new Map(BRIEFS.map((b) => [b.slug, b]));
