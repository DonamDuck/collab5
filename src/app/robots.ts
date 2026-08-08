// robots.txt — 검색엔진에게 "여기는 봐도 되고 여기는 보지 마라"를 알려준다.
// 없으면(08-07 이전 상태) 크롤러가 아무 말도 못 들은 채 전부 훑는다 — 개인 화면까지.
//
// ⛔막는 기준 = **남에게 보이면 안 되거나, 검색 결과에 있어봤자 쓸모없는 곳.**
//   - `/c/` 콜라보 카드는 **특정 상대에게 보내는 청첩장**이다. 링크를 아는 사람만 열라고 만든 것이라
//     검색에 뜨면 제안 내용이 통째로 공개된다. 여기서 막는 게 가장 중요한 한 줄.
//   - `/my`·`/register`·로그인 계열은 로그인해야 의미가 있고, 검색에서 들어오면 빈 화면만 본다.
//   - `/preview`는 캔버스가든을 복제한 데모라, 색인되면 진짜 소개서와 **같은 내용이 둘**이 된다
//     (검색엔진은 이걸 싫어하고, 둘 중 뭘 보여줄지 자기가 고른다).
//   - `/api`는 사람이 볼 화면이 아니다.
// ⭕반대로 `/m/`(소개서)은 **열어둔다** — 이번 작업의 목적이 그거다(대표 확정 08-07).
//   ⚠️소개서는 **예외 없이 전부** 웹 검색에 연다(08-07 2차). [콜라보 찾기에 보이기] 토글은
//   사이트 안 목록(홈·`/search`)만 정하지, 구글·네이버 노출과는 무관하다.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/my",
        "/register",
        "/login",
        "/signup",
        "/reset-password",
        "/welcome",
        "/preview",
        "/c/", // 개인에게 보낸 콜라보 제안 카드 — 링크를 아는 사람만
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
