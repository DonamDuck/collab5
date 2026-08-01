// NCP(네이버 클라우드 플랫폼) Maps — Static Map 이미지. `lib/naver-local.ts`와 키가 다르다.
//
// ⚠️ **두 개의 다른 네이버 API다** — 헷갈리기 쉬워서 명시해둔다.
//   · `NAVER_CLIENT_ID/SECRET`  = 개발자센터 Open API(검색). naver-local.ts가 쓰는 것.
//   · `NCP_MAP_CLIENT_ID/SECRET` = NCP 콘솔의 Maps Application. 이 파일이 쓰는 것.
//   실측(07-31): 검색 키로 Static Map을 호출하면 401. 계정·발급 경로 자체가 다르다
//   (ncloud.com 콘솔 → AI·Application Service → Maps → Application 등록).
//
// 응답은 이미지 바이트라 여기서 그대로 반환하고, 호출부(app/api/staticmap)가
// Response로 감싸 캐싱 헤더를 붙인다. **클라이언트에서 직접 호출하면 Secret이 노출되므로
// 반드시 이 서버 함수 → 우리 프록시 라우트 → <img src="/api/staticmap?...">** 경로를 지킨다.

const ENDPOINT = "https://maps.apigw.ntruss.com/map-static/v2/raster";

export type StaticMapParams = {
  lat: number;
  lng: number;
  /** 이미지 크기(px), 1~1024 */
  w: number;
  h: number;
  /** 줌 레벨 0~20. 동네 가게 정도면 16이 적당(건물 단위 식별) */
  level?: number;
};

/** 좌표 → 정적 지도 이미지(핀 포함) 바이트. 키 없거나 실패하면 null(호출부가 폴백 처리). */
export async function fetchStaticMap(p: StaticMapParams): Promise<{ buf: Buffer; contentType: string } | null> {
  const id = process.env.NCP_MAP_CLIENT_ID;
  const secret = process.env.NCP_MAP_CLIENT_SECRET;
  if (!id || !secret) return null; // 로컬(키 없음) — 조용히 비활성

  const level = p.level ?? 16;
  const center = `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
  // 핀은 markers로 직접 찍는다 — center만 쓰면 지도 중심 표시일 뿐 마커가 없다.
  const markers = `type:d|size:mid|pos:${p.lng.toFixed(6)} ${p.lat.toFixed(6)}`;
  // ⭐ scale=2 — Retina용 고해상도. **w/h를 키우는 것과 전혀 다르다**(08-01 실측으로 배운 것):
  //    · w/h를 키우면 같은 줌에서 **더 넓은 지역**이 담긴다 → 축소된 것처럼 보인다(실제로 그랬다)
  //    · scale=2는 w/h(=지역 범위)는 그대로 두고 **픽셀 밀도만 2배**로 준다
  //      (실측: w=640&h=280&scale=2 → 실제 1280×560px 수신. 512 타일 기반)
  //    NCP w/h 상한 1024는 요청값 기준이라 scale=2를 붙여도 여유가 있다.
  const url =
    `${ENDPOINT}?w=${p.w}&h=${p.h}&center=${center}&level=${level}&scale=2` +
    `&markers=${encodeURIComponent(markers)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-ncp-apigw-api-key-id": id,
        "x-ncp-apigw-api-key": secret,
      },
    });
    if (!res.ok) {
      console.warn(`[ncp-map] ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { buf, contentType: res.headers.get("content-type") ?? "image/jpeg" };
  } catch (e) {
    console.warn("[ncp-map] error", e);
    return null;
  }
}
