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
import { listOpenSpaces } from "@/lib/spaces";
import { SITE_URL } from "@/lib/site";

/** 사이트맵에 싣는 하루 가게 공간 수의 상한. 목록 화면의 기본값(60)을 그대로 쓰면 61번째 공간부터 조용히 빠진다.
 *  사이트맵 한 장의 한도(주소 5만 개)보다 한참 아래라 넉넉히 잡았다. */
const RENT_SITEMAP_LIMIT = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, articles, spaces] = await Promise.all([
    repo.listSitemapBrands(),
    repo.listPublishedArticles(200),
    listOpenSpaces({ limit: RENT_SITEMAP_LIMIT }),
  ]);

  // 고정 페이지 — 약관·개인정보는 넣되 우선순위를 낮게(있어야 하지만 찾아올 글은 아니다).
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/magazine`, changeFrequency: "weekly", priority: 0.7 },
    // 하루 가게 목록 — 빈 시간이 예약될 때마다 바뀌는 화면이라 daily(09-18 밤 QA SC-18).
    { url: `${SITE_URL}/rent`, changeFrequency: "daily", priority: 0.7 },
    // 🔓09-19 대표 [L1] — 공간 올리기 화면을 검색에 연다. 「내 가게 빌려주기」를 찾는 사장님이 들어오는 문이다.
    //   로그인 전엔 제목·소개와 로그인 버튼만 보이는 화면이라 검색에 걸려도 새는 것이 없다. noindex도 없다.
    { url: `${SITE_URL}/rent/new`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // 매거진 — **발행분만**(초안은 공개 상세가 404라 넣으면 크롤러에게 죽은 주소를 주는 꼴).
  // ⭐매거진을 만든 이유의 절반이 검색 노출인데 08-13까지 여기서 통째로 빠져 있었다 —
  //   **색인 통로가 없으면 아무리 잘 써도 아무도 안 온다.** 글은 한 번 쓰면 잘 안 고치니
  //   changeFrequency는 monthly, 대신 소개서보다 우선순위를 높게 둔다(우리 고유 콘텐츠).
  const articlePages: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/magazine/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "monthly",
    priority: 0.9,
  }));

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

  // 하루 가게 공간 — **공개 중인 것만**(09-18 밤 QA SC-18). 검토 대기·쉬는 중·초안은 남에게 404라 넣으면 죽은 주소가 된다.
  //   `listOpenSpaces`가 공개 목록과 같은 조건(`status = open`)으로 읽는다. 고치면 lastModified가 따라 올라간다.
  // 🔓`/rent/new`는 09-19 대표 결정으로 위 고정 페이지에 넣었다. 판매자 정보(`/rent/[slug]/seller`)는 싣지 않는다(noindex).
  const rentPages: MetadataRoute.Sitemap = spaces.map((sp) => ({
    url: `${SITE_URL}/rent/${sp.slug}`,
    lastModified: new Date(sp.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...articlePages, ...makerPages, ...rentPages];
}
