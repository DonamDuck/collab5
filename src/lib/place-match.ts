// 하루 가게 — 사장님이 적은 가게 ↔ 네이버 지역검색 결과, «같은 가게인가» 판정 (2026-09-18 대표)
//
// 대표: 사장님이 적은 매장 이름과 네이버 지도의 가게가 «일치한다고 판단된 경우에만» 네이버 상호로 보인다.
// ⭐틀리게 붙이면 손님은 딴 가게를 찾아간다. 그래서 애매하면 «안 붙인다»(`naver-local.ts` 동명이인 가드와 같은 규율).
//   조건 = 이름 일치 AND 같은 건물. 둘 중 하나라도 아니면 null. 둘 다 맞는 후보가 여럿이어도 null.
// 🚨fetch 없는 순수 함수. 네이버 호출은 `naver-local.ts`의 `matchPlace`가 하고 판정만 여기로 넘긴다(검사 스크립트로 표를 돌린다).

export interface PlaceCandidate {
  name: string;
  /** 도로명 주소(없으면 지번) */
  address: string;
  lat?: number;
  lng?: number;
}

/** 비교용 이름 — 공백·기호를 빼고 소문자. 「느린오후 로스터리 2층」 → 「느린오후로스터리2층」. */
export function normPlaceName(s: string): string {
  return (s ?? "").normalize("NFC").replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase();
}

/** 이름 일치 — 같거나 한쪽이 다른 쪽을 품는다. 사장님은 「느린오후 로스터리 2층」처럼 공간 이름을 적고
 *  네이버엔 「느린오후 로스터리」로 올라 있다. ⚠️짧은 쪽이 두 글자 미만이면 품기만으로는 안 친다(「카페」가 다 걸린다). */
export function namesMatch(a: string, b: string): boolean {
  const x = normPlaceName(a), y = normPlaceName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && long.includes(short);
}

/** 도로명 주소에서 «시군구 + 도로명 + 건물번호»를 뽑는다. 「서울 성동구 연무장길 00, 2층」 → { gu: "성동구", road: "연무장길00" }.
 *  ⚠️도로명만 보면 안 된다. 「중앙로 1」은 전국에 수십 곳이라 시군구까지 같이 본다. 층·호는 버린다(같은 건물이면 된다). */
export function roadKey(address: string): { gu: string; road: string } | null {
  const a = (address ?? "").replace(/\([^)]*\)/g, " ").replace(/,/g, " ");
  const m = a.match(/([가-힣A-Za-z0-9·.]+(?:로|길))\s*(\d+(?:-\d+)?)(?![\d-])/);
  if (!m) return null;
  // 시군구 — 「특별시·광역시·특별자치시·도」는 넓어서 빼고, 구·군을 먼저 찾고 없으면 일반 시.
  const tokens = a.split(/\s+/).filter(Boolean);
  const gu =
    tokens.find((t) => /^[가-힣]+(구|군)$/.test(t)) ??
    tokens.find((t) => /^[가-힣]+시$/.test(t) && !/(특별시|광역시|특별자치시)$/.test(t)) ??
    "";
  return { gu, road: `${m[1].replace(/\s/g, "")}${m[2]}` };
}

/** 두 좌표 사이 거리(m). 하버사인. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 같은 건물인가 — 도로명+건물번호가 같고(시군구가 둘 다 있으면 그것도 같고), 아니면 좌표가 50m 안. */
export const SAME_BUILDING_METERS = 50;
export function sameBuilding(
  ours: { address: string; lat?: number; lng?: number },
  theirs: PlaceCandidate,
): boolean {
  const a = roadKey(ours.address), b = roadKey(theirs.address);
  if (a && b && a.road === b.road && (!a.gu || !b.gu || a.gu === b.gu)) return true;
  if (ours.lat != null && ours.lng != null && theirs.lat != null && theirs.lng != null) {
    return distanceMeters({ lat: ours.lat, lng: ours.lng }, { lat: theirs.lat, lng: theirs.lng }) <= SAME_BUILDING_METERS;
  }
  return false;
}

/** 후보 중 «확실한 하나»만. 이름·건물 둘 다 맞는 후보가 하나면 그것, 여럿이면 이름이 정확히 같은 것이 하나일 때만. */
export function pickPlace(
  ours: { name: string; address: string; lat?: number; lng?: number },
  candidates: PlaceCandidate[],
): PlaceCandidate | null {
  const hits = candidates.filter((c) => namesMatch(ours.name, c.name) && sameBuilding(ours, c));
  // 같은 가게가 검색 두 번에 겹쳐 올 수 있다. 이름+주소가 같으면 하나로 센다.
  const uniq = Array.from(new Map(hits.map((c) => [`${normPlaceName(c.name)}|${normPlaceName(c.address)}`, c])).values());
  if (uniq.length === 1) return uniq[0];
  if (uniq.length > 1) {
    const exact = uniq.filter((c) => normPlaceName(c.name) === normPlaceName(ours.name));
    return exact.length === 1 ? exact[0] : null;
  }
  return null;
}
