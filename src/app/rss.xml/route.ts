// RSS — 네이버에게 "새 글이 나왔다"를 알리는 통로.
//
// 🩸**왜 만들었나** (08-25): 네이버 서치어드바이저 「수집 현황」이 **08-09 하루 13페이지, 그 뒤 16일간 0**이었다.
//   신규 도메인이라 느린 게 아니라 **한 번 오고 다시 안 온 것**이다. 그사이 소개서는 18개로 늘었는데
//   새 페이지는 아예 안 긁혔다. sitemap은 「목록이 여기 있다」고 말할 뿐이고,
//   RSS는 **「새 것이 나왔다」**를 말한다 — 네이버는 후자로 재방문 주기를 잡는다.
//
// 🪤**함정**: `/magazine/rss.xml`이 200을 주길래 RSS가 있는 줄 알았는데 **내용이 HTML**이었다
//   (매거진 상세 라우트가 `rss.xml`을 slug로 잡아먹었다). ⭐**상태코드 200을 「있다」로 읽지 말 것.**
//
// ⚠️`pubDate`는 **RFC822**여야 한다(ISO 8601 아님). 여기서 틀리면 파서가 항목을 통째로 버린다.
export const revalidate = 3600;

import { repo } from "@/lib/repo";
import { SITE_URL } from "@/lib/site";

/** XML에서 뜻을 가진 다섯 글자를 막는다. 브랜드명에 `&`가 흔해서 이게 없으면 피드가 통째로 깨진다. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [brands, articles] = await Promise.all([
    repo.listSitemapBrands(),
    repo.listPublishedArticles(50),
  ]);

  type Item = { title: string; link: string; desc: string; date: Date };

  // 매거진이 우리 고유 콘텐츠라 먼저 놓지만, 아래에서 결국 날짜순으로 다시 섞는다.
  const items: Item[] = [
    ...articles.map((a) => ({
      title: a.title,
      link: `${SITE_URL}/magazine/${a.slug}`,
      desc: a.summary || a.title,
      date: new Date(a.publishedAt || a.updatedAt),
    })),
    ...brands.map((b) => ({
      title: `${b.name} 소개서`,
      link: `${SITE_URL}/m/${b.slug}`,
      desc: b.oneLiner || `${b.name}의 브랜드 소개서`,
      date: new Date(b.updatedAt),
    })),
  ]
    .filter((i) => !Number.isNaN(i.date.getTime()))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    // 상한 40 — 네이버는 피드가 길다고 더 긁지 않는다. 최신이 위에 있는 게 중요하다.
    .slice(0, 40);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>collab5 — 내 이야기로 시작하는 콜라보 공간</title>
<link>${SITE_URL}</link>
<description>브랜드 소개서와 콜라보 이야기를 새로 올라오는 순서대로 전합니다.</description>
<language>ko</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (i) => `<item>
<title>${esc(i.title)}</title>
<link>${esc(i.link)}</link>
<guid isPermaLink="true">${esc(i.link)}</guid>
<description>${esc(i.desc)}</description>
<pubDate>${i.date.toUTCString()}</pubDate>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
