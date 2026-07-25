import Script from "next/script";

// GA4 측정 ID — collab5 속성(공개값이라 클라이언트 노출이 정상).
const GA_ID = "G-KLJ4JY6R6G";

// 구글 애널리틱스(gtag.js) — root layout에서 마운트.
// 프로덕션 빌드에서만 로드해 로컬 dev(npm run dev) 트래픽 오염을 막는다.
// SPA 라우트 이동은 GA4 향상된 측정(브라우저 기록 이벤트)이 자동 집계하므로 별도 페이지뷰 코드 불필요.
export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
