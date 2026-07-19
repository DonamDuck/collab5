"use server";

import { createClient } from "@supabase/supabase-js";
import { repo } from "./repo";
import { deriveRegion } from "./region";
import { getSessionUser } from "./supabase/server";
import { updateProfileImage } from "./profiles";
import { sha256 } from "./hash";
import type { Block, CollabType, Maker, Enrichment } from "./types";

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
  desc?: string;
  year?: string;
  photos: PhotoWire[];
}
const unwrapPhotos = (photos?: PhotoWire[]): string[] =>
  (photos ?? []).map((p) => p.u).filter(Boolean);

// press item 링크 위생 처리 — http(s) 절대 URL만 통과(크롤 프리필·수기입력 공용 검증). enrich.ts sanitizeHttpUrl과 동일 규칙.
function sanitizePressLink(raw?: string): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

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
  blocks?: Block[]; // 선택 블록(사진=Storage URL이라 그대로 전송)
  introFileUrl?: string; // 소개자료 PDF URL
  collabOpen: boolean;
  searchVisible: boolean; // 검색 결과 노출 on/off
  instagram?: string;
  homepage?: string;
  address?: string; // 지역은 여기서 자동 추출
  description?: string;
  editPassword?: string; // 비회원 수정 비밀번호(로그인 상태면 무시)
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시만 기록)
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
  const user = await getSessionUser();
  const ownerUserId = user?.id;
  const editPasswordHash =
    !user && input.editPassword?.trim() ? sha256(input.editPassword.trim()) : undefined;
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
      desc: h.desc?.trim() || undefined,
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
    blocks: sanitizeBlocks(input.blocks),
    introFileUrl: input.introFileUrl?.trim() || undefined,
    soul: { values: input.values, tone: "", trajectory: "" },
    trust: {
      instagram: input.instagram?.trim() || undefined,
      homepage: input.homepage?.trim() || undefined,
      address: input.address?.trim() || undefined,
      description: input.description?.trim() || undefined,
    },
    collabOpen: input.collabOpen,
    searchVisible: input.searchVisible,
    enrichment: input.enrichment,
    ownerUserId,
    editPasswordHash,
  });
  return { slug: maker.slug };
}

export interface CardInput {
  fromMakerId: number;
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
export async function recordViewAction(cardId: number): Promise<void> {
  await repo.recordView(cardId, "share-link");
}

/** 보조 지표: RSVP 반응 */
export async function recordReactionAction(
  cardId: number,
  type: "관심" | "패스"
): Promise<void> {
  await repo.recordReaction(cardId, type);
}

/** 1차 검색 (MVP) — 등록 업체 공개 디렉토리. '전체 둘러보기' 벽은 절제. */
export async function searchAction(q: string): Promise<Maker[]> {
  return repo.searchMakers(q);
}

/** 등록 폼 '사진 없는 소개서 예시보기' 바텀시트용 — 텍스트 데모 소개서(고정 slug) 조회. 유료 콜 없음(DB 1회). */
export async function getPreviewDemoNoneAction(): Promise<{ maker: Maker; logoUrl: string | null } | null> {
  const { DEMO_SLUG_NONE } = await import("./demo");
  const { getProfile } = await import("./profiles");
  const maker = await repo.getMakerBySlug(DEMO_SLUG_NONE);
  if (!maker) return null;
  const logoUrl = maker.ownerUserId ? (await getProfile(maker.ownerUserId))?.profileImage ?? null : null;
  return { maker, logoUrl };
}

/** 비회원이 완료 얼럿에서 뒤늦게 비번을 설정(소유자·기존 비번 없을 때만) */
export async function setMakerPasswordAction(
  slug: string,
  password: string
): Promise<{ error?: string }> {
  const pw = password.trim();
  if (!pw) return { error: "비밀번호를 입력해주세요." };
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  if (maker.ownerUserId || maker.editPasswordHash) return {}; // 이미 소유/비번 있음 — 무시
  await repo.setMakerPasswordHash(slug, sha256(pw));
  return {};
}

/** 수정 진입용 비번 검증 — 소유자 세션이거나 비번 일치면 ok (쿠키 없음, 클라가 pw를 세션스토리지 보관) */
export async function verifyMakerPasswordAction(
  slug: string,
  password: string
): Promise<{ ok: boolean }> {
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { ok: false };
  const user = await getSessionUser();
  if (user && maker.ownerUserId === user.id) return { ok: true };
  if (maker.editPasswordHash && sha256(password.trim()) === maker.editPasswordHash) return { ok: true };
  return { ok: false };
}

/** 로그인 상태에서 비번으로 진입한 소개서를 내 계정에 귀속 */
export async function claimMakerAction(
  slug: string,
  password: string
): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "로그인이 필요해요." };
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  if (maker.ownerUserId && maker.ownerUserId !== user.id)
    return { error: "이미 다른 계정에 연결된 소개서예요." };
  if (!maker.ownerUserId) {
    if (!maker.editPasswordHash || sha256(password.trim()) !== maker.editPasswordHash)
      return { error: "비밀번호가 일치하지 않아요." };
    await repo.setMakerOwner(slug, user.id);
  }
  return {};
}

/** /my에서 URL 또는 슬러그 + 비번으로 연결 */
export async function claimBySlugAction(
  slugOrUrl: string,
  password: string
): Promise<{ error?: string; slug?: string }> {
  const m = slugOrUrl.trim().match(/([a-z0-9-]+)\/?$/i);
  const slug = m?.[1] ?? "";
  if (!slug) return { error: "소개서 링크를 확인해주세요." };
  const r = await claimMakerAction(slug, password);
  if (r.error) return r;
  return { slug };
}

/** edit 모드 제출 → 소유자 세션 또는 수정 비번 재검증 후 내용 업데이트 (쿠키 비의존) */
export async function updateMakerAction(
  slug: string,
  input: RegisterInput,
  password?: string
): Promise<{ error?: string; slug?: string }> {
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  const user = await getSessionUser();
  const isOwner = !!user && maker.ownerUserId === user.id;
  const pwOk =
    !!maker.editPasswordHash && !!password && sha256(password.trim()) === maker.editPasswordHash;
  if (!isOwner && !pwOk) return { error: "수정 권한이 없어요." };
  // enrichment는 의도적으로 전달하지 않음 — 전달하면 일반 수정마다 저장된 크롤 스냅샷을 덮어씀(보존 불변식).
  const updated = await repo.updateMakerContent(slug, {
    name: input.name.trim(),
    oneLiner: input.oneLiner.trim(),
    region: deriveRegion(input.address ?? "") || undefined,
    offers: input.offers,
    seeks: input.seeks,
    targetAudience: input.targetAudience,
    collabHistory: input.collabHistory.map((h) => ({
      partner: h.partner, types: h.types,
      desc: h.desc?.trim() || undefined, year: h.year, photos: unwrapPhotos(h.photos),
    })),
    story: input.story?.trim() ?? "",
    activities: (input.activities ?? []).map((a) => ({
      title: a.title, desc: a.desc, photos: unwrapPhotos(a.photos),
    })),
    offersNote: input.offersNote?.trim() ?? "",
    seeksNote: input.seeksNote?.trim() ?? "",
    photos: unwrapPhotos(input.photos),
    blocks: sanitizeBlocks(input.blocks),
    introFileUrl: input.introFileUrl?.trim() || undefined,
    soul: { values: input.values, tone: "", trajectory: "" },
    trust: {
      instagram: input.instagram?.trim() || undefined,
      homepage: input.homepage?.trim() || undefined,
      address: input.address?.trim() || undefined,
      description: input.description?.trim() || undefined,
    },
    collabOpen: input.collabOpen,
    searchVisible: input.searchVisible,
  });
  if (!updated) return { error: "업데이트에 실패했어요." };
  return { slug };
}

/** /my 프로필 사진 변경 — 로그인 사용자 본인 프로필만. */
export async function updateProfileImageAction(imageUrl: string): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "로그인이 필요해요." };
  try {
    await updateProfileImage(user.id, imageUrl);
    return {};
  } catch {
    return { error: "저장에 실패했어요." };
  }
}

/** /my 토글 — 로그인 소유자만 collab_open·search_visible 부분 갱신. */
export async function updateMakerFlagsAction(
  slug: string,
  flags: { collabOpen?: boolean; searchVisible?: boolean }
): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "로그인이 필요해요." };
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  if (maker.ownerUserId !== user.id) return { error: "권한이 없어요." };
  const updated = await repo.setMakerFlags(slug, flags);
  if (!updated) return { error: "저장에 실패했어요." };
  return {};
}

/** 소개서 삭제 — 로그인 소유자만. /my에서 사용. 카드·지표는 FK CASCADE로 함께 삭제. */
export async function deleteMakerAction(slug: string): Promise<{ error?: string }> {
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  const user = await getSessionUser();
  if (!user || maker.ownerUserId !== user.id) return { error: "삭제 권한이 없어요." };
  await repo.deleteMaker(slug);
  return {};
}

/** register 완료 얼럿 버전 분기용 */
export async function getAuthStateAction(): Promise<{ loggedIn: boolean }> {
  const user = await getSessionUser();
  return { loggedIn: !!user };
}

/** edit 모드 프리필 데이터 — 공개 데이터(/m과 동일)라 게이트 없이 반환.
 *  단 민감 필드(비번 해시·소유자 id)는 절대 클라로 내보내지 않음. 실제 저장은 updateMakerAction에서 재검증. */
export async function getEditDataAction(slug: string): Promise<Maker | null> {
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return null;
  return { ...maker, editPasswordHash: undefined, ownerUserId: undefined };
}

const PHOTO_BUCKET = "maker-photos";

/** Storage 서명 업로드 URL 발급. env 미설정 시 error(클라는 base64 폴백). */
export async function createUploadUrlAction(
  kind: "photo" | "pdf" = "photo"
): Promise<
  { path: string; token: string; publicUrl: string } | { error: string }
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "storage-disabled" };
  const admin = createClient(url, key);
  const path =
    kind === "pdf"
      ? `d/${crypto.randomUUID()}.pdf`
      : `p/${crypto.randomUUID()}.jpg`;
  const { data, error } = await admin.storage
    .from(PHOTO_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "sign-failed" };
  const { data: pub } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, token: data.token, publicUrl: pub.publicUrl };
}

/** 저장 정리: 빈 링크·빈 아이템 제거 + 편집기 전용 uid 제거 → 내용이 빈 블록은 저장 제외.
 *  (⑦ 콜라보 빈 카드 제외 패턴. 사진/링크만 있어도 유의미하므로 보존.) */
function sanitizeBlocks(blocks?: Block[]): Block[] {
  return (blocks ?? [])
    .map((b) => {
      const links = b.links.filter((l) => l.url.trim());
      // 타입별로 재구성하며 uid를 떨궈 저장 데이터를 깨끗이 유지.
      if (b.type === "metrics")
        return { type: b.type, photos: b.photos, links, items: b.items.filter((i) => i.label.trim() || i.value.trim()) };
      if (b.type === "press")
        return {
          type: b.type,
          photos: b.photos,
          links,
          items: b.items
            .filter((i) => i.title.trim())
            .map((i) => ({
              title: i.title,
              year: i.year,
              desc: i.desc?.trim() || undefined,
              link: sanitizePressLink(i.link),
              photos: i.photos ?? [],
            })),
        };
      if (b.type === "reviews")
        return { type: b.type, photos: b.photos, links, items: b.items.filter((i) => i.quote.trim()) };
      if (b.type === "team")
        return { type: b.type, photos: b.photos, links, intro: b.intro };
      if (b.type === "space")
        return { type: b.type, photos: b.photos, links, desc: b.desc, features: b.features };
      return { type: b.type, photos: b.photos, links, title: b.title, body: b.body };
    })
    .filter((b) => {
      const extra = b.photos.length > 0 || b.links.length > 0;
      if (b.type === "metrics" || b.type === "press" || b.type === "reviews")
        return b.items.length > 0 || extra;
      if (b.type === "team") return b.intro.trim().length > 0 || extra;
      if (b.type === "space")
        return b.desc.trim().length > 0 || b.features.length > 0 || extra;
      return b.title.trim().length > 0 || b.body.trim().length > 0 || extra;
    });
}
