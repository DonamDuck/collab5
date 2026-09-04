import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SITE_URL, OG_IMAGE } from "@/lib/site";

// ⭐브랜드 슬로건 그대로(08-19 대표 확정 · 정본 = 볼트 [[브랜드-보이스]] §슬로건).
//   인스타 공식 계정 바이오와 **같은 문장**이다 — DM으로 받은 링크를 눌렀을 때 같은 말이 보여야 한다.
// ⚠️「플랫폼」→「공간」은 의도적이다. 대표가 인스타 바이오에서도 플랫폼을 공간으로 되돌렸다
//   (작은 가게 사장님에게 보내는 말이라 「플랫폼」이 차갑다는 판단).
// 🔎SEO — 옛 제목에 있던 **「브랜드」가 이 문장엔 없다.** 검색어 매칭은 아래 DESCRIPTION이 받는다
//   (거기에 '브랜드'가 두 번 나온다). 제목에 억지로 끼워 넣어 슬로건을 변형하지 않기로 했다.
const TITLE = "collab5 — 내 이야기로 시작하는 콜라보 공간";
// 링크 카드·검색 결과에 나가는 설명(대표 개정 08-07). 앞 문장은 소명, 뒤 문장은 할 일.
// ⭐고친 이유 — 구문("…자기 이야기를 세상에 더 펼쳐나가는 교두보")은 **우리끼리 쓰는 말**이었다.
//   `교두보`를 "더 많은 사람에게 닿을 수 있도록"으로 풀어 뜻은 그대로 두고 읽히게 했고,
//   `소소하고 소중한`→**`소소하지만 소중한`**으로 바꿔 대조를 세웠다(작지만 귀하다가 문장에서 성립).
//   끝맺음도 "부담 없이 제안하세요"→**"첫 콜라보를 시작해보세요"** — '첫'이 문턱을 낮춘다.
// ⚠️서명(`- collab5`)은 넣지 않는다 — 카톡 카드엔 제목의 "collab5 —"와 하단 도메인이 이미 있어
//   한 카드에 상호가 세 번 나오고, 구글 스니펫에선 설명문 끝의 서명이 어색하게 읽힌다.
const DESCRIPTION =
  "소소하지만 소중한 브랜드의 이야기가 더 많은 사람에게 닿을 수 있도록. 브랜드 소개서로 첫 콜라보를 시작해보세요.";

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
  //   이미지 = `public/og-image.png`(1200×630) — 로고만, 장식·슬로건 없음(대표 지정 구성).
  //   🆕09-04에 **홈 헤더와 같은 워드마크**로 갈았다 — 그전엔 옛 아톰 로고가 나가서
  //   카톡 카드의 로고가 사이트 로고와 달랐다(대표 발견). 재생성 = `python3 assets/build-og.py`.
  //   **주소는 `OG_IMAGE`(=`?v=` 붙은 값)를 쓴다** — 카톡·페북은 이미지를 URL 단위로
  //   캐시해서 파일만 갈면 옛 그림이 계속 나간다. 자세한 건 lib/site.ts.
  openGraph: {
    type: "website",
    siteName: "collab5",
    locale: "ko_KR",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
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
