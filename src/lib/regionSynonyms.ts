// 지역 동의어 테이블 — enrich 크롤의 negative-region 재랭킹용(2026-07-15).
// 목적: 동명 브랜드 충돌 차단. "순자네 반찬 창원"을 검색했는데 "전주 순자네 반찬"
//       블로그가 섞여올 때, 문서가 '전주/전북'을 언급하면 사용자 지역(경남)과
//       충돌 → 감점/드롭. ⚠️ 지역명을 아예 언급 안 한 문서는 건드리지 않는다
//       (본인 후기가 동네명을 안 적는 경우가 흔해서 — false-negative 역전 방지).
//
// 원칙:
//  - 광역(시/도) 단위 그룹. 문서가 사용자와 '다른 광역'을 명시하면 충돌.
//  - primary = 그 자체로 지역임이 뚜렷한 토큰. ambiguous = 음식·일반어와 겹쳐
//    맥락(시·구·동·군·역 인접 or 같은 그룹 primary 동반) 있을 때만 인정.
//  - 콜 0(순수 정적 데이터). day-1 로깅으로 오탐/미탐 모니터링(레드팀 합의).

export interface RegionGroup {
  key: string; // 광역 canonical (예: "경남")
  primary: string[]; // 뚜렷한 지역 토큰
  ambiguous?: string[]; // 음식·일반어와 겹쳐 맥락 필요한 토큰
}

// 17 시·도 + 주요 시/군/구/상권. 커버리지는 점진 확장(백로그).
export const REGION_GROUPS: RegionGroup[] = [
  {
    key: "서울",
    primary: [
      "서울", "서울특별시", "성수동", "성수", "홍대", "연남", "연남동", "이태원",
      "을지로", "종로", "성동구", "마포", "마포구", "강남", "강남구", "압구정",
      "가로수길", "삼청동", "북촌", "익선동", "한남", "한남동", "신사동", "청담",
      "여의도", "잠실", "송파", "용산", "서촌", "망원", "망원동", "합정",
    ],
  },
  {
    key: "경기",
    primary: [
      "경기", "경기도", "수원", "성남", "판교", "분당", "일산", "고양", "용인",
      "부천", "안양", "화성", "동탄", "광교", "평택", "의정부", "남양주", "파주",
      "김포", "하남", "구리", "안산",
    ],
    ambiguous: ["광명"],
  },
  { key: "인천", primary: ["인천", "인천광역시", "송도", "청라", "부평"] },
  {
    key: "부산",
    primary: [
      "부산", "부산광역시", "해운대", "서면", "광안리", "전포동", "전포", "남포동",
      "센텀", "기장", "영도",
    ],
  },
  { key: "대구", primary: ["대구광역시", "동성로", "수성구"], ambiguous: ["대구"] },
  { key: "대전", primary: ["대전", "대전광역시", "둔산동", "유성구"] },
  { key: "광주", primary: ["광주광역시", "충장로", "동명동"], ambiguous: ["광주"] },
  { key: "울산", primary: ["울산", "울산광역시", "삼산동"] },
  { key: "세종", primary: ["세종특별자치시", "세종시"], ambiguous: ["세종"] },
  {
    key: "강원",
    primary: ["강원", "강원도", "춘천", "강릉", "속초", "원주", "양양", "평창"],
  },
  { key: "충북", primary: ["충북", "충청북도", "청주", "충주", "제천"] },
  { key: "충남", primary: ["충남", "충청남도", "천안", "아산", "공주", "서산"] },
  {
    key: "전북",
    primary: ["전북", "전라북도", "전주", "군산", "익산", "정읍", "남원"],
  },
  {
    key: "전남",
    primary: ["전남", "전라남도", "여수", "순천", "목포", "광양", "나주"],
  },
  {
    key: "경북",
    primary: ["경북", "경상북도", "포항", "경주", "안동", "구미", "영주", "김천"],
  },
  {
    key: "경남",
    primary: [
      "경남", "경상남도", "창원", "상남동", "김해", "진주", "통영", "양산",
      "거제", "마산", "진해",
    ],
  },
  { key: "제주", primary: ["제주", "제주도", "서귀포", "제주시", "애월", "성산"] },
];

// 토큰 → 그룹 역인덱스(1회 구축).
const PRIMARY_INDEX = new Map<string, string>();
const AMBIGUOUS_INDEX = new Map<string, string>();
for (const g of REGION_GROUPS) {
  for (const t of g.primary) PRIMARY_INDEX.set(t, g.key);
  for (const t of g.ambiguous ?? []) AMBIGUOUS_INDEX.set(t, g.key);
}
// 긴 토큰 우선 매칭(성수동 > 성수)용 정렬 목록.
const PRIMARY_TOKENS = [...PRIMARY_INDEX.keys()].sort((a, b) => b.length - a.length);
const AMBIGUOUS_TOKENS = [...AMBIGUOUS_INDEX.keys()].sort((a, b) => b.length - a.length);
const LOC_SUFFIX = /(시|군|구|동|읍|면|역|로)/;

/** 텍스트에 등장한 지역 그룹 키 집합. ambiguous 토큰은 지역 맥락이 있을 때만 인정. */
export function resolveRegionGroups(text: string): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const t of PRIMARY_TOKENS) {
    if (text.includes(t)) out.add(PRIMARY_INDEX.get(t)!);
  }
  for (const t of AMBIGUOUS_TOKENS) {
    const i = text.indexOf(t);
    if (i < 0) continue;
    const group = AMBIGUOUS_INDEX.get(t)!;
    // 이미 같은 그룹 primary가 잡혔으면 인정. 아니면 바로 뒤 글자가 지역 접미사일 때만.
    if (out.has(group)) continue;
    const after = text.slice(i + t.length, i + t.length + 1);
    if (LOC_SUFFIX.test(after)) out.add(group);
  }
  return out;
}

/**
 * 문서가 사용자 지역과 '충돌'하는가.
 * true = 문서가 지역을 명시했고 그게 사용자 지역 그룹과 하나도 안 겹침 → 다른 지역 동명 업체 의심.
 * false = 지역 언급 없음(안전) 또는 사용자 지역과 겹침(본인 가능성).
 */
export function regionConflict(userRegion: string, docText: string): boolean {
  const userGroups = resolveRegionGroups(userRegion);
  if (!userGroups.size) return false; // 사용자 지역 해석 불가 → 필터 미적용(안전)
  const docGroups = resolveRegionGroups(docText);
  if (!docGroups.size) return false; // 문서가 지역 언급 없음 → 건드리지 않음
  for (const g of docGroups) if (userGroups.has(g)) return false; // 겹침 → 본인 가능성
  return true; // 문서 지역 전부가 사용자와 다른 광역 → 충돌
}

/** 텍스트가 사용자 지역과 같은 광역을 명시하는가(지도 교차검증·corroboration용). */
export function regionMatches(userRegion: string, docText: string): boolean {
  const userGroups = resolveRegionGroups(userRegion);
  if (!userGroups.size) return false;
  const docGroups = resolveRegionGroups(docText);
  for (const g of docGroups) if (userGroups.has(g)) return true;
  return false;
}
