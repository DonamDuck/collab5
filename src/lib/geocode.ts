// 주소 → 좌표 (NCP Geocoding). 서버 전용. (2026-09-14)
//
// 대표: *「지도 UI 하나 있어야 할 거 같아. 사장님이 당연히 주소 입력해서 등록해야 하고」*
//
// ⚠️**키는 `lib/ncp-map.ts`와 같은 것**(NCP 콘솔 Maps Application). 검색용 `NAVER_CLIENT_ID`가
//   아니다 — 그걸로 부르면 401이다(07-31 실측, ncp-map.ts 머리말 참조).
//
// ⭐**저장할 때 한 번만 부른다.** 화면을 그릴 때마다 부르면 같은 주소를 수백 번 묻게 되고,
//   유료 호출이며, 사장님이 주소를 안 고쳤는데도 값이 흔들릴 수 있다.
//   좌표는 `spaces.lat/lng`에 굳혀 두고 주소가 바뀔 때만 다시 잰다.
const ENDPOINT = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";

/** 못 찾으면 `null`. 🚨**실패가 저장을 막지 않는다** — 지도는 있으면 좋은 것이고,
 *  좌표 하나 때문에 사장님이 올리기를 못 끝내면 그게 더 큰 손해다(notify.ts와 같은 규율). */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const id = process.env.NCP_MAP_CLIENT_ID;
  const secret = process.env.NCP_MAP_CLIENT_SECRET;
  const q = address.trim();
  if (!id || !secret || !q) return null;

  try {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(q)}`, {
      headers: { "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret },
    });
    if (!res.ok) {
      console.warn(`[geocode] ${res.status} for ${q.slice(0, 20)}…`);
      return null;
    }
    const body = (await res.json()) as { addresses?: { x: string; y: string }[] };
    const hit = body.addresses?.[0];
    if (!hit) return null;
    // ⚠️네이버는 x=경도, y=위도다. 순서를 뒤집으면 지도가 조용히 바다 한가운데를 가리킨다.
    const lng = Number(hit.x);
    const lat = Number(hit.y);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch (e) {
    console.warn("[geocode] error", e);
    return null;
  }
}
