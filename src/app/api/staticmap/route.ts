// GET /api/staticmap?lat=&lng=&w=&h=&level= — NCP Static Map 프록시.
//
// ⚠️ **키를 클라이언트에 노출하지 않으려고 이 라우트가 있다.** `<img>`는 좌표만 우리 서버로
//    보내고, NCP Secret은 서버(lib/ncp-map.ts)에서만 쓴다. 직접 NCP를 클라에서 호출하면 안 된다.
//
// 캐싱: 같은 좌표는 계속 같은 이미지다(가게가 이사하지 않는 한). CDN에 1일 캐싱해서
//   호출 사이드 부담 없이 반복 노출해도 NCP 콜 수는 늘지 않는다(무료 한도 300만/월이지만
//   그래도 아낄 이유가 없진 않다 — 캐시가 공짜다).
//
// 🔒09-18 밤 QA SC-22 — 좌표·크기·줌을 아무 값이나 받아서, 값을 조금씩 바꾼 주소마다 캐시를 비켜 NCP를 새로 불렀다
//   (남의 나라 좌표·임의 크기도 그대로 그려 줬다). 그래서 셋을 좁힌다.
//   ① 좌표는 소수 다섯째 자리(약 1m)로 반올림 ② 한국 범위(위도 33~39 · 경도 124~132) 밖이면 400
//   ③ 크기·줌은 **코드에서 실제로 쓰는 조합만**. 아래 `ALLOWED`와 호출부가 한 쌍이다.
import { fetchStaticMap } from "@/lib/ncp-map";

/** 허용하는 `폭x높이@줌` — 호출부를 grep해서 모은 것(09-18). 🚨호출부의 크기·줌을 바꾸면 여기도 같이 바꾼다. 안 맞으면 그 지도가 400으로 비어 보인다.
 *  · `640x240@16` — 하루 팝업 공간 상세의 위치 지도(`app/rent/[slug]/AreaMap.tsx`, 줌을 명시해서 보낸다)
 *  · `640x280@16` — 소개서 상세주소 지도(`components/MapCard.tsx` 기본, `app/m/[slug]/MakerArticle.tsx`). 줌을 안 보내 기본 16
 *  · `640x180@16` — 소개서 작성 폼·AI 위저드의 확인용 지도(`MapCard` compact, `app/register/page.tsx`·`EnrichWizard.tsx`) */
const ALLOWED = new Set(["640x240@16", "640x280@16", "640x180@16"]);

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  // 빈 값은 `Number`가 0으로 읽는다. 0은 아래 범위에서 걸리지만, 없는 값은 없는 값으로 먼저 막는다.
  if (!latRaw || !lngRaw) return new Response("bad coordinates", { status: 400 });
  const lat = round5(Number(latRaw));
  const lng = round5(Number(lngRaw));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response("bad coordinates", { status: 400 });
  }
  // 한국(제주 남쪽 마라도 33.1 ~ 강원 북쪽 38.6, 서해 백령도 124.6 ~ 독도 131.9)을 조금 넉넉히 감싼 네모.
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return new Response("coordinates out of range", { status: 400 });
  }

  // 안 보낸 값의 기본은 예전과 같다(폭 640 · 높이 320 · 줌 16). 기본 높이 320은 쓰는 곳이 없어 허용 조합에서 걸린다.
  const w = Number(searchParams.get("w") ?? 640);
  const h = Number(searchParams.get("h") ?? 320);
  const level = Number(searchParams.get("level") ?? 16);
  if (!ALLOWED.has(`${w}x${h}@${level}`)) {
    return new Response("unsupported size", { status: 400 });
  }
  // 🚨`pin=0` = 핀 없이. 하루 팝업이 확정 «전»에 쓰던 모드다 — 건물을 짚지 않고 「이 근처」만 말한다(09-16부터 쓰는 곳은 없다).
  const pin = searchParams.get("pin") !== "0";

  const map = await fetchStaticMap({ lat, lng, w, h, pin, level });
  if (!map) return new Response("unavailable", { status: 503 });

  return new Response(new Uint8Array(map.buf), {
    headers: {
      "Content-Type": map.contentType,
      // CDN 1일 + 브라우저 1시간. 좌표가 URL에 그대로 있어 키가 같으면 캐시가 그대로 맞아떨어진다.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
