// 사이트맵 — 구글·네이버에 "우리 사이트에 이런 주소들이 있다"고 내는 목록.
//
// ⭐**정적 파일이 아니라 DB에서 매번 만든다**(대표 지시 08-07: *"앞으로 생성 시 자동으로 다 뜨게"*).
//   손으로 적은 목록이면 소개서를 새로 만들 때마다 누군가 여기 한 줄을 더해야 하고,
//   그 한 줄을 잊는 순간 그 사장님 소개서만 조용히 검색에서 빠진다.
//
// ⚠️`revalidate`가 **이 파일의 심장**이다. Next는 sitemap을 기본적으로 캐시하는데,
//   그대로 두면 **배포 시점의 목록이 그대로 굳어** 새 소개서가 영원히 안 들어간다
//   (= 대표 요청의 '자동'이 조용히 깨진다). 1시간마다 다시 만든다.
export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { repo } from "@/lib/repo";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const brands = await repo.listSitemapBrands();

  // 고정 페이지 — 약관·개인정보는 넣되 우선순위를 낮게(있어야 하지만 찾아올 글은 아니다).
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 소개서 — **살아 있는 것 전부**(대표 확정 08-07 2차). [콜라보 찾기에 보이기] 토글은
  // 사이트 안 목록(홈·`/search`)만 정하고 **웹 검색에는 다 나온다** — `/m`은 어차피 공개 페이지다.
  // 수정하면 lastModified가 따라 올라가
  // 크롤러가 "이 페이지 바뀌었네"를 안다 = 보강 작업이 색인에 반영되는 통로.
  const makerPages: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${SITE_URL}/m/${b.slug}`,
    lastModified: new Date(b.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticPages, ...makerPages];
}
