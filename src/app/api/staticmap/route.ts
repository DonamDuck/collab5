// GET /api/staticmap?lat=&lng=&w=&h= — NCP Static Map 프록시.
//
// ⚠️ **키를 클라이언트에 노출하지 않으려고 이 라우트가 있다.** `<img>`는 좌표만 우리 서버로
//    보내고, NCP Secret은 서버(lib/ncp-map.ts)에서만 쓴다. 직접 NCP를 클라에서 호출하면 안 된다.
//
// 캐싱: 같은 좌표는 계속 같은 이미지다(가게가 이사하지 않는 한). CDN에 1일 캐싱해서
//   호출 사이드 부담 없이 반복 노출해도 NCP 콜 수는 늘지 않는다(무료 한도 300만/월이지만
//   그래도 아낄 이유가 없진 않다 — 캐시가 공짜다).
import { fetchStaticMap } from "@/lib/ncp-map";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  // 폭·높이는 화면에서만 결정하게 두되, 남용 방지로 상한(NCP 자체 상한 1024와 별개로 우리 쪽도 캡).
  const w = Math.min(Math.max(Number(searchParams.get("w")) || 640, 1), 1024);
  const h = Math.min(Math.max(Number(searchParams.get("h")) || 320, 1), 1024);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response("bad coordinates", { status: 400 });
  }

  const map = await fetchStaticMap({ lat, lng, w, h });
  if (!map) return new Response("unavailable", { status: 503 });

  return new Response(new Uint8Array(map.buf), {
    headers: {
      "Content-Type": map.contentType,
      // CDN 1일 + 브라우저 1시간. 좌표가 URL에 그대로 있어 키가 같으면 캐시가 그대로 맞아떨어진다.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
