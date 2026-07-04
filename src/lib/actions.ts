"use server";

import { repo } from "./repo";
import { deriveRegion } from "./region";
import type { Activity, CollabHistory, CollabType, Maker } from "./types";

export interface RegisterInput {
  name: string;
  oneLiner: string;
  offers: CollabType[];
  seeks: CollabType[];
  values: string[]; // 분위기칩(우리를 표현하는 말)
  targetAudience: string[]; // 이런 분들과 만나요
  collabHistory: CollabHistory[]; // 함께한 콜라보
  story?: string;
  activities?: Activity[];
  offersNote?: string;
  seeksNote?: string;
  photos?: string[]; // 브랜드 사진(리사이즈 data URL)
  collabOpen: boolean;
  instagram?: string;
  homepage?: string;
  address?: string; // 지역은 여기서 자동 추출
  description?: string;
}

/** 이름 → slug. 한글 등 비ASCII면 랜덤 핸들로 폴백(mock 단계). */
function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "m-" + Math.random().toString(36).slice(2, 8);
}

export async function createMakerAction(
  input: RegisterInput
): Promise<{ slug: string }> {
  const maker = await repo.createMaker({
    slug: slugify(input.name),
    name: input.name.trim(),
    oneLiner: input.oneLiner.trim(),
    region: deriveRegion(input.address ?? "") || undefined,
    offers: input.offers,
    seeks: input.seeks,
    targetAudience: input.targetAudience,
    collabHistory: input.collabHistory,
    story: input.story?.trim() ?? "",
    activities: input.activities ?? [],
    offersNote: input.offersNote?.trim() ?? "",
    seeksNote: input.seeksNote?.trim() ?? "",
    photos: input.photos ?? [],
    soul: { values: input.values, tone: "", trajectory: "" },
    trust: {
      instagram: input.instagram?.trim() || undefined,
      homepage: input.homepage?.trim() || undefined,
      address: input.address?.trim() || undefined,
      description: input.description?.trim() || undefined,
    },
    collabOpen: input.collabOpen,
  });
  return { slug: maker.slug };
}

export interface CardInput {
  fromMakerId: string;
  fromSlug: string;
  toName: string;
  why: string;
  picture: string;
  expectedEffect: string;
}

export async function createCardAction(
  input: CardInput
): Promise<{ slug: string }> {
  const slug = `${input.fromSlug}-${Math.random().toString(36).slice(2, 7)}`;
  const card = await repo.createCard({
    slug,
    fromMakerId: input.fromMakerId,
    proposal: {
      toName: input.toName.trim(),
      why: input.why.trim(),
      picture: input.picture.trim(),
      expectedEffect: input.expectedEffect.trim(),
    },
  });
  return { slug: card.slug };
}

/** North Star: 카드 view 기록 (무계정 열람 시 client에서 1회 호출) */
export async function recordViewAction(cardId: string): Promise<void> {
  await repo.recordView(cardId, "share-link");
}

/** 보조 지표: RSVP 반응 */
export async function recordReactionAction(
  cardId: string,
  type: "관심" | "패스"
): Promise<void> {
  await repo.recordReaction(cardId, type);
}

/** 1차 검색 (MVP) — 등록 업체 공개 디렉토리. '전체 둘러보기' 벽은 절제. */
export async function searchAction(q: string): Promise<Maker[]> {
  return repo.searchMakers(q);
}
