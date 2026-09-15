import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔻개발 표시(왼쪽 아래 N 배지)를 끈다 (2026-09-15, 대표 QA에서 나옴)
  //
  // 🩸**이 배지가 제품 화면을 깔고 앉는다.** 폰 폭에서 토스 결제창의 「신용카드 무이자 할부 안내」 줄
  //   왼쪽 55px을 덮고 있었다(`elementFromPoint`로 x=40이 `NEXTJS-PORTAL`로 잡혔다).
  //   대표가 그 줄 앞부분을 누르면 배지가 먹어서 **「더보기가 아예 안 나온다」**로 보였다.
  //   같은 날 우리 코멘트 위젯이 화면 아래 고정 바를 덮은 것과 **같은 병**이다.
  // ⭐개발 도구는 개발자 자리에선 안 보이고(데스크톱은 여백이 넓다) 좁은 화면에서만 제품을 가린다.
  //   자리를 옮겨 봐야 폰에선 어디든 무언가와 겹친다 — 아래는 고정 바, 위는 헤더다. 그래서 끈다.
  // ✅끄더라도 **컴파일·런타임 에러는 그대로 화면에 뜬다**(Next 16 문서 명시). 잃는 건 배지뿐이다.
  devIndicators: false,

  // 📱**폰으로 로컬을 볼 때 필요하다** (2026-09-16 대표 QA에서 나옴)
  // Next 16 개발 서버는 localhost가 아닌 주소에서 오는 스크립트·HMR 요청을 기본으로 막는다.
  // 그러면 폰은 HTML만 받고 페이지 코드는 한 줄도 못 받아서, 화면은 그려지는데 아무것도 안 눌리고
  // 로그인 버튼은 옛날식 GET 제출(`/login?email=…`)로 떨어진다. 서버 로그에 ⚠ Blocked cross-origin … 이 찍힌다.
  // ⭐IP는 와이파이를 옮길 때마다 바뀌니 Bonjour 이름(`<맥 이름>.local`)도 같이 연다.
  //   운영 빌드에는 영향이 없는 개발 전용 설정이다.
  allowedDevOrigins: ["192.168.35.121", "song-yeongdeog-ui-MacBookAir-5.local", "*.local"],

  experimental: {
    // 브랜드 사진(리사이즈 data URL)을 서버 액션으로 저장 → 기본 1MB보다 여유 필요
    serverActions: { bodySizeLimit: "12mb" },
  },

  // Vercel이 자동으로 붙여주는 collab5.vercel.app을 공식 도메인으로 넘긴다.
  // 그냥 두면 **같은 사이트가 두 주소로 색인돼** 검색 신호가 갈리고, 소개서 링크도
  // 사람마다 다른 도메인으로 퍼진다(카톡 미리보기·공유 링크가 뒤섞임).
  //
  // ⭐ 308(permanent)인 이유 — 검색엔진에 "이쪽이 정본"이라고 확정해줘야 색인이 합쳐진다.
  //    307이면 캐시도 색인 통합도 안 된다.
  // ⚠️ 대신 브라우저가 이 리다이렉트를 오래 캐시한다. 되돌리려면 캐시를 지워야 하니
  //    "vercel.app으로 직접 확인"이 필요한 디버깅은 **프리뷰 URL**을 쓸 것 —
  //    프리뷰는 collab5-git-<브랜치>-….vercel.app이라 아래 host 매칭에 안 걸린다(의도된 것).
  async redirects() {
    return [
      {
        source: "/:path*", // 경로 보존 — /m/xxx 같은 소개서 링크도 그대로 따라간다
        has: [{ type: "host", value: "collab5.vercel.app" }],
        destination: "https://collab5.co.kr/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
