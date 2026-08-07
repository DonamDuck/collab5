import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SITE_URL } from "@/lib/site";

const TITLE = "collab5 — 마음 맞는 브랜드들의 콜라보 플랫폼";
const DESCRIPTION =
  "소소하고 소중한 아기자기한 곳들이 자기 이야기를 세상에 더 펼쳐나가는 교두보. 브랜드 소개서로 부담 없이 제안하세요.";

export const metadata: Metadata = {
  // ⭐모든 절대주소의 기준점. 이게 없으면 하위 페이지가 링크 미리보기에 **상대 경로**를 넣게 되는데,
  //   카톡·구글은 상대 경로를 못 읽는다(빌드 에러로도 잡힌다). 값은 lib/site.ts 한 곳에서만.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // 이 페이지의 '정본 주소' — 같은 화면이 여러 주소로 열려도(쿼리 파라미터·프리뷰 도메인)
  // 구글이 하나로 합쳐 세게 해준다. 하위 페이지는 자기 것으로 덮어쓴다.
  alternates: { canonical: "/" },
  // 🆕링크 미리보기 카드(08-07) — 소개서(/m)는 08-02에 넣었는데 **홈은 빠져 있었다.**
  //   영업 DM에 홈 링크를 붙이면 글자만 뜨고 카드가 안 펼쳐졌다는 뜻이다.
  //   ⚠️이미지는 아직 없다 — 지금 있는 로고는 전부 SVG인데 카톡·페북은 SVG를 og:image로 안 받는다.
  //      제대로 된 대표 이미지(1200×630 PNG)를 만들면 여기 `images`를 더한다.
  openGraph: {
    type: "website",
    siteName: "collab5",
    locale: "ko_KR",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  // 검색엔진 소유확인 — 구글은 `public/google...html` 파일로 이미 확인됨(07-31).
  // 네이버는 서치어드바이저에서 받은 값을 여기 `other`에 넣거나 같은 방식으로 파일을 올리면 된다.
  // ⚠️이 자리를 쓰는 이유: 예전에 GA 스크립트로 소유확인을 시도했다가 실패했다 —
  //    `next/script`가 태그를 <body>에 넣는데, 검증 로봇은 <head>만 본다. metadata는 <head>로 간다.
  verification: {},
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
