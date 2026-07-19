import type { Enrichment, EnrichmentChip } from "./types";

// 반환 null = 저장 가치 0(업종 없음 + 선택 칩 0). 호출부는 null이면 enrichment를 세팅하지 않는다
// → not-null 빈 스냅샷을 만들지 않아 미래 "has enrichment?" 판정이 깨지지 않음.
export function buildEnrichment(params: {
  region: string;
  businessType: string;
  tier: "rich" | "thin";      // 크롤 응답 tier 그대로(여기서 재계산 안 함)
  createdAt: string;          // ISO
  selected: string[];         // 선택 칩 텍스트
  starred: string[];
  confirmed: Set<string>;     // factualOk
  sectionOf: (text: string) => string | undefined;
  factualOf: (text: string) => boolean;
}): Enrichment | null {
  const businessType = params.businessType.trim();
  const chips: EnrichmentChip[] = params.selected.map((text) => ({
    text,
    section: params.sectionOf(text) ?? "직접",
    factual: params.factualOf(text),
    starred: params.starred.includes(text),
    confirmed: params.confirmed.has(text),
  }));
  if (!businessType && chips.length === 0) return null;
  return {
    createdAt: params.createdAt,
    tier: params.tier,
    seed: { region: params.region.trim(), businessType },
    chips,
  };
}
