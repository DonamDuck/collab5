"use server";

import { repo } from "./repo";
import { deriveRegion } from "./region";
import type { CollabType, Maker } from "./types";

// 사진(리사이즈 data URL)은 개당 수십만~100만 자에 달해, 배열에 문자열로 담아
// 서버액션으로 보내면 React Flight의 배열 누적 한도(1e6)에 걸려 터진다.
// → base64를 객체로 한 겹 감싸 전송하면 디코딩 시 배열 카운트 체인이 끊겨 통과.
//   (도메인 타입은 여전히 string[]; 이 경계에서만 감쌌다가 서버에서 되푼다.)
export interface PhotoWire {
  u: string; // data URL
}
export interface ActivityWire {
  title: string;
  desc: string;
  photos: PhotoWire[];
}
export interface HistoryWire {
  partner: string;
  types: string[];
  year?: string;
  photos: PhotoWire[];
}
const unwrapPhotos = (photos?: PhotoWire[]): string[] =>
  (photos ?? []).map((p) => p.u).filter(Boolean);

export interface RegisterInput {
  name: string;
  oneLiner: string;
  offers: CollabType[];
  seeks: CollabType[];
  values: string[]; // 분위기칩(우리를 표현하는 말)
  targetAudience: string[]; // 이런 분들과 만나요
  collabHistory: HistoryWire[]; // 함께한 콜라보
  story?: string;
  activities?: ActivityWire[];
  offersNote?: string;
  seeksNote?: string;
  photos?: PhotoWire[]; // 브랜드 사진(리사이즈 data URL, 객체 래핑)
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
    collabHistory: input.collabHistory.map((h) => ({
      partner: h.partner,
      types: h.types,
      year: h.year,
      photos: unwrapPhotos(h.photos),
    })),
    story: input.story?.trim() ?? "",
    activities: (input.activities ?? []).map((a) => ({
      title: a.title,
      desc: a.desc,
      photos: unwrapPhotos(a.photos),
    })),
    offersNote: input.offersNote?.trim() ?? "",
    seeksNote: input.seeksNote?.trim() ?? "",
    photos: unwrapPhotos(input.photos),
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
