// 주소 → 거친 지역 단위 파생. 등록은 주소만 받고, 검색·카드 노출용 지역은 여기서 자동 추출.
// 예: "서울특별시 성북구 보문로 56 5층" → "서울 성북"

const SIDO: [RegExp, string][] = [
  [/^서울/, "서울"], [/^부산/, "부산"], [/^대구/, "대구"], [/^인천/, "인천"],
  [/^광주/, "광주"], [/^대전/, "대전"], [/^울산/, "울산"], [/^세종/, "세종"],
  [/^경기/, "경기"], [/^강원/, "강원"], [/^충청북도|^충북/, "충북"],
  [/^충청남도|^충남/, "충남"], [/^전라북도|^전북/, "전북"],
  [/^전라남도|^전남/, "전남"], [/^경상북도|^경북/, "경북"],
  [/^경상남도|^경남/, "경남"], [/^제주/, "제주"],
];

export function deriveRegion(address: string): string {
  const a = address.trim();
  if (!a) return "";
  const tokens = a.split(/\s+/);
  let sido = "";
  for (const [re, label] of SIDO) {
    if (re.test(tokens[0])) {
      sido = label;
      break;
    }
  }
  // 시도 토큰(0번) 이후에서 구/군/시 찾고 행정단위 접미 제거
  // ⚠️ 단 떼고 나서 한 글자만 남으면 그대로 둔다 — "남구"→"남"은 방위사로 읽혀 지명이 아니게 된다
  //    (남·동·서·북·중구는 광역시마다 있어 "부산 남" 같은 카드가 실제로 나갔다, 대표 지적 08-22).
  //    반면 "마포구"→"마포", "영도구"→"영도"처럼 두 글자 이상 남으면 접미를 떼는 게 자연스럽다.
  const guRaw = tokens.slice(1).find((t) => /(구|군|시)$/.test(t));
  const guTrimmed = guRaw ? guRaw.replace(/(구|군|시)$/, "") : "";
  const gu = guTrimmed.length >= 2 ? guTrimmed : (guRaw ?? "");
  return [sido, gu].filter(Boolean).join(" ");
}
