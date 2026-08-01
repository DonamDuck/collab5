// 네이버 지역검색 — 상호명 → 도로명 주소(+좌표). 소개서 폼의 주소 자동 채움에 쓴다.
//
// ⚠️ **왜 지도 URL을 파싱하지 않나**(07-31 실측):
//    사장님이 붙여넣는 링크는 `map.naver.com/p/entry/place/{id}` 형태인데,
//      · 그 페이지 HTML은 2.3KB짜리 빈 껍데기(JS로 그리는 앱) — 주소 텍스트 0건
//      · 내부 API `/p/api/place/summary/{id}` → 403
//      · `pcmap.place.naver.com/place/{id}` → 429 (차단)
//      · place ID를 주소로 바꿔주는 **공식 API가 없다**(Open API는 키워드 검색 전용)
//    → URL에서 주소를 얻는 길은 막혀 있다. 대신 **상호명으로 지역검색**하면
//      roadAddress에 상세주소(층수)까지 그대로 온다(실측: "서울특별시 성북구 보문로 56 5층").
//
// enrich 파이프라인도 같은 API를 쓰지만(NaverGeminiProvider), 거긴 조사 메모를 만드는 큰 흐름이라
// 폼에서 가볍게 1콜만 쓰려고 여기 별도로 뺐다. 키(NAVER_CLIENT_ID/SECRET)는 공유.

import { deriveRegion } from "./region";

export type NaverPlace = {
  name: string;
  /** 도로명 주소(상세주소 포함). 없으면 지번 주소로 폴백 */
  address: string;
  /** 지역검색이 준 좌표로 조립한 네이버 지도 링크(AI 개입 0) */
  mapUrl: string | null;
  category: string;
};

type NaverItem = {
  title?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  mapx?: string;
  mapy?: string;
};

/** 네이버가 감싸는 <b> 태그·HTML 엔티티 제거 */
function clean(s?: string): string {
  return (s ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** 비교용 정규화 — 공백·특수문자 제거 후 소문자 */
function norm(s: string): string {
  return s.replace(/[\s·・.,'"()[\]-]/g, "").toLowerCase();
}

/** 좌표 → 네이버 지도 딥링크. mapx/mapy는 WGS84 ×10^7 정수 문자열.
 *  좌표가 깨졌으면 null(엉뚱한 위치로 보내느니 링크를 포기). enrich.naverMapLink와 같은 규칙. */
function toMapUrl(name: string, mapx?: string, mapy?: string): string | null {
  if (!name) return null;
  const lng = Number(mapx) / 1e7;
  const lat = Number(mapy) / 1e7;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < 124 || lng > 132 || lat < 33 || lat > 39) return null; // 대한민국 밖
  return `https://map.naver.com/p/search/${encodeURIComponent(name)}?c=${lng.toFixed(6)},${lat.toFixed(6)},17,0,0,0,dh`;
}

/**
 * 상호명으로 네이버 지역검색 → 확신할 수 있을 때만 1건을 돌려준다.
 *
 * ⚠️ **동명이인 가드가 이 함수의 핵심이다.** "캔버스가든" 검색에 "드로잉가든화실"이 같이 나온다(실측).
 *    주소를 자동으로 덮어쓰는 기능이라, 애매하면 채우는 것보다 **안 채우는 게 맞다**.
 *    - 상호명이 정확히 일치하는 후보만 남긴다(공백·특수문자 무시).
 *    - `regionHint`(이미 아는 지역)가 있으면 광역이 같은 것만 남긴다 — 동명 타지역 업체 차단.
 *    - 그러고도 2건 이상이면 포기(null). 잘못 채우느니 비워두고 사장님이 직접 쓰게 한다.
 */
export async function lookupPlaceByName(
  name: string,
  regionHint?: string
): Promise<NaverPlace | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null; // 로컬(키 없음) — 조용히 비활성

  let items: NaverItem[] = [];
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
    });
    if (!res.ok) {
      console.warn(`[naver-local] ${res.status}`);
      return null;
    }
    items = ((await res.json()) as { items?: NaverItem[] }).items ?? [];
  } catch (e) {
    console.warn("[naver-local] error", e);
    return null;
  }
  if (!items.length) return null;

  // ① 상호명 정확 일치만
  const target = norm(q);
  let hits = items.filter((it) => norm(clean(it.title)) === target);
  if (!hits.length) return null;

  // ② 지역 힌트가 있으면 광역이 같은 것만 (동명 타지역 차단)
  if (regionHint?.trim() && hits.length > 1) {
    const wantTop = regionHint.trim().split(/\s+/)[0]; // "경기 양주" → "경기"
    const narrowed = hits.filter((it) => {
      const addr = `${clean(it.roadAddress)} ${clean(it.address)}`;
      return deriveRegion(addr).split(/\s+/)[0] === wantTop;
    });
    if (narrowed.length) hits = narrowed;
  }

  // ③ 그래도 여러 곳이면 포기 — 자동으로 덮어쓰는 값이라 틀리면 피해가 크다
  if (hits.length !== 1) return null;

  const hit = hits[0];
  const cleanName = clean(hit.title);
  const address = clean(hit.roadAddress) || clean(hit.address);
  if (!address) return null;

  return {
    name: cleanName,
    address,
    mapUrl: toMapUrl(cleanName, hit.mapx, hit.mapy),
    category: clean(hit.category),
  };
}
