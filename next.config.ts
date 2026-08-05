import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
