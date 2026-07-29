"use server";

import { createClient } from "@supabase/supabase-js";
import { repo } from "./repo";
import { deriveRegion } from "./region";
import { getSessionUser } from "./supabase/server";
import { getSessionUserId } from "./profiles";
import { updateProfileImage } from "./profiles";
import { sha256 } from "./hash";
import { mapLinkLabel } from "./links";
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
  link?: string;
}
export interface HistoryWire {
  partner: string;
  types: string[];
  desc?: string;
  year?: string;
  photos: PhotoWire[];
  link?: string;
}
const unwrapPhotos = (photos?: PhotoWire[]): string[] =>
  (photos ?? []).map((p) => p.u).filter(Boolean);

// 항목 링크 위생 처리 — http(s) 절대 URL만 통과(press·콜라보·활동 항목 공용, 수기입력·크롤 프리필). enrich.ts sanitizeHttpUrl과 동일 규칙.
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
  keywords: string[]; // 브랜드를 표현하는 키워드 칩
  targetAudience: string[]; // 이런 분들과 만나요
  collabHistory: HistoryWire[]; // 함께한 콜라보
  story?: string;
  activities?: ActivityWire[];
  offersDescription?: string;
  seeksDescription?: string;
  photos?: PhotoWire[]; // 브랜드 사진(리사이즈 data URL, 객체 래핑)
  showcases?: Block[]; // 선택 블록(사진=Storage URL이라 그대로 전송)
  introFileUrl?: string; // 소개자료 PDF URL
  collabOpen: boolean;
  searchVisible: boolean; // 검색 결과 노출 on/off
  instagram?: string;
  homepage?: string;
  mapUrl?: string; // 지도 링크(네이버·카카오·구글). 화이트리스트 밖이면 저장 시 버림
  address?: string; // 지역은 여기서 자동 추출
  description?: string;
  editPassword?: string; // 비회원 수정 비밀번호(로그인 상태면 무시)
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시만 기록)
}

/** 이름 → slug. 한글 등 비ASCII면 랜덤 핸들로 폴백(mock 단계).
 *  ⚠️"캔앤코르크A"처럼 한글+ASCII 한두 글자면 ascii가 "a"만 남아 /m/a 같은
 *  한 글자 slug가 나온다(2026-07-21 실측) — 3자 미만이면 랜덤 핸들로 폴백. */
function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.length >= 3 ? ascii : "m-" + Math.random().toString(36).slice(2, 8);
}

export async function createMakerAction(
  input: RegisterInput
): Promise<{ slug: string }> {
  const user = await getSessionUser();
  // 소유권은 정수 profiles.user_id 기준(07-25 전환). profiles 없으면 미소유로 떨어진다.
  const ownerUserId = (await getSessionUserId()) ?? undefined;
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
      link: sanitizePressLink(h.link),
    })),
    description: input.description?.trim() ?? "",
    story: input.story?.trim() ?? "",
    activities: (input.activities ?? []).map((a) => ({
      title: a.title,
      desc: a.desc,
      photos: unwrapPhotos(a.photos),
      link: sanitizePressLink(a.link),
    })),
    offersDescription: input.offersDescription?.trim() ?? "",
    seeksDescription: input.seeksDescription?.trim() ?? "",
    photos: unwrapPhotos(input.photos),
    showcases: sanitizeBlocks(input.showcases),
    introFileUrl: input.introFileUrl?.trim() || undefined,
    keywords: input.keywords,
    trust: {
      instagram: input.instagram?.trim() || undefined,
      homepage: input.homepage?.trim() || undefined,
      // 지도 칩이 "네이버 지도"라 써놓고 딴 데로 가면 안 되니 서버에서도 서비스 검증(클라 우회 차단)
      mapUrl: mapLinkLabel(input.mapUrl) ? input.mapUrl!.trim() : undefined,
      address: input.address?.trim() || undefined,
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
  fromBrandId: number;
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
    fromBrandId: input.fromBrandId,
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

/** 등록 폼 '텍스트형 소개서 예시' 바텀시트용 — 텍스트 데모 소개서(고정 slug) 조회. 유료 콜 없음(DB 1회). */
export async function getPreviewDemoNoneAction(): Promise<{ maker: Maker; logoUrl: string | null } | null> {
  const { DEMO_SLUG_NONE } = await import("./demo");
  const { getProfileById } = await import("./profiles");
  const maker = await repo.getMakerBySlug(DEMO_SLUG_NONE);
  if (!maker) return null;
  const logoUrl = maker.ownerUserId ? (await getProfileById(maker.ownerUserId))?.profileImage ?? null : null;
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
  const sessionUserId = await getSessionUserId();
  if (sessionUserId && maker.ownerUserId === sessionUserId) return { ok: true };
  if (maker.editPasswordHash && sha256(password.trim()) === maker.editPasswordHash) return { ok: true };
  return { ok: false };
}

/** 로그인 상태에서 비번으로 진입한 소개서를 내 계정에 귀속 */
export async function claimMakerAction(
  slug: string,
  password: string
): Promise<{ error?: string }> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return { error: "로그인이 필요해요." };
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  if (maker.ownerUserId && maker.ownerUserId !== sessionUserId)
    return { error: "이미 다른 계정에 연결된 소개서예요." };
  if (!maker.ownerUserId) {
    if (!maker.editPasswordHash || sha256(password.trim()) !== maker.editPasswordHash)
      return { error: "비밀번호가 일치하지 않아요." };
    await repo.setMakerOwner(slug, sessionUserId);
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
  const sessionUserId = await getSessionUserId();
  const isOwner = !!sessionUserId && maker.ownerUserId === sessionUserId;
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
      link: sanitizePressLink(h.link),
    })),
    description: input.description?.trim() ?? "",
    story: input.story?.trim() ?? "",
    activities: (input.activities ?? []).map((a) => ({
      title: a.title, desc: a.desc, photos: unwrapPhotos(a.photos), link: sanitizePressLink(a.link),
    })),
    offersDescription: input.offersDescription?.trim() ?? "",
    seeksDescription: input.seeksDescription?.trim() ?? "",
    photos: unwrapPhotos(input.photos),
    showcases: sanitizeBlocks(input.showcases),
    introFileUrl: input.introFileUrl?.trim() || undefined,
    keywords: input.keywords,
    trust: {
      instagram: input.instagram?.trim() || undefined,
      homepage: input.homepage?.trim() || undefined,
      // 지도 칩이 "네이버 지도"라 써놓고 딴 데로 가면 안 되니 서버에서도 서비스 검증(클라 우회 차단)
      mapUrl: mapLinkLabel(input.mapUrl) ? input.mapUrl!.trim() : undefined,
      address: input.address?.trim() || undefined,
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
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return { error: "로그인이 필요해요." };
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  if (maker.ownerUserId !== sessionUserId) return { error: "권한이 없어요." };
  const updated = await repo.setMakerFlags(slug, flags);
  if (!updated) return { error: "저장에 실패했어요." };
  return {};
}

/** 찜(저장) 토글 — 로그인만 하면 누구나 관심 업체 저장. 소유권 무관(방향성 시그널). */
/** 이 브랜드가 내 것인가 — 자기 자신에게 하는 행동(찜·제안)을 서버에서 걸러내는 공용 판정.
 *  ⭐**북극성 지표의 순도 장치다.** UI를 아무리 막아도 서버가 받아주면 언젠가 섞인다
 *  (딥링크·구버전 화면·자동화). 실패는 조용히 no-op — 사용자에겐 아무 일도 아니어야 한다. */
async function ownsBrand(sessionUserId: number, brandId: number): Promise<boolean> {
  try {
    const m = await repo.getMakerById(brandId);
    return !!m && m.ownerUserId === sessionUserId;
  } catch {
    return false; // 판정 실패 시엔 막지 않는다 — 정상 사용자를 잠그는 게 더 나쁘다
  }
}

export async function setMakerSavedAction(
  makerId: number,
  saved: boolean
): Promise<{ error?: string }> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return { error: "찜하려면 로그인이 필요해요." };
  // 내 소개서를 내가 찜하는 건 신호가 아니라 잡음이다 — 찜은 "누가 누굴 눈여겨보나"의 방향성 지표라서.
  // UI에서도 막지만(소유자 모드) 서버가 마지막 관문이다(07-29, 디자인팀 QA 지적).
  if (await ownsBrand(sessionUserId, makerId)) return {};
  try {
    await repo.setMakerSaved(sessionUserId, makerId, saved);
    return {};
  } catch {
    return { error: "저장에 실패했어요." };
  }
}

/** 콜라보 제안 인텐트 기록 — "콜라보 시작하기" 계측. 로그인 필수(누가→누구 방향 시그널). */
export async function recordCollabRequestAction(
  toBrandId: number,
  channel: string,
  fromBrandId?: number // 어떤 소개서로 제안했나(제안자가 여럿일 때 선택값)
): Promise<{ error?: string }> {
  // ⚠️ 로그인은 계측의 조건이 아니다(2026-07-29 수정). 전엔 비로그인이면 여기서 조기 반환해
  //    **연락 시도가 통째로 유실**됐다 — 호출부는 에러를 무시하고 복사·채널 오픈은 그대로 되므로
  //    사용자는 멀쩡히 연락했는데 북극성 퍼널엔 안 잡혔다. 무계정 열람이 제품 컨셉이라 더 컸다.
  //    스키마도 이미 `from_user_id` nullable("비로그인 null")로 이 경우를 전제하고 있었다.
  const sessionUserId = await getSessionUserId();
  // 🚨 자기 자신에게 보내는 '연락 시도'는 북극성 퍼널을 오염시킨다(07-29, 디자인팀 QA 지적).
  //    소유자가 자기 소개서에서 [콜라보 시작하기]를 누르면 자기→자기 1건이 그대로 쌓였다.
  //    조용히 no-op — 사용자에겐 복사·채널 열기가 그대로 되고, 지표만 안 더럽힌다.
  if (sessionUserId && (await ownsBrand(sessionUserId, toBrandId))) return {};
  try {
    await repo.recordCollabRequest(sessionUserId, toBrandId, channel, fromBrandId ?? null);
    return {};
  } catch {
    return { error: "기록에 실패했어요." };
  }
}

/** ⭐성사된 콜라보 기록 — 북극성을 실제로 세는 자리. 스펙 = Obsidian [[성사-기록-계측]]
 *
 *  권한 규칙: **A(제안한 쪽)는 내 소개서여야 한다.** 이렇게 두면
 *   ① 아무나 남의 브랜드끼리 성사를 지어낼 수 없고
 *   ② 나중에 채팅에서 자동 기록될 때도 같은 규칙이 그대로 성립한다(각자 자기 쪽을 소유).
 *  ⚠️ 대표가 **양쪽 다 소유하지 않은 쌍**(이미 지인에게 넘긴 소개서끼리)은 여기로 못 넣는다 →
 *     그 경우는 Supabase에서 INSERT. 운영 노트에 템플릿을 둔다.
 */
export async function recordCollabAction(input: {
  brandAId: number;
  brandBId: number;
  origin: "product" | "concierge";
  title: string;
  year?: string;
  description?: string;
  photos?: PhotoWire[]; // 사진 URL은 짧지만 배열 한도 이슈를 피하려 다른 경로와 같은 래핑을 쓴다
  link?: string;
  alsoAddToProfile?: boolean; // 소개서 "함께한 콜라보"에도 남길지(기본 켬)
}): Promise<{ error?: string }> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return { error: "로그인이 필요해요." };
  if (input.brandAId === input.brandBId) return { error: "서로 다른 두 브랜드를 골라주세요." };
  const title = input.title.trim();
  if (!title) return { error: "어떤 콜라보였는지 한 줄만 적어주세요." };

  const a = await repo.getMakerById(input.brandAId);
  if (!a || a.ownerUserId !== sessionUserId) return { error: "내 소개서 중에서 골라주세요." };
  const b = await repo.getMakerById(input.brandBId);
  if (!b) return { error: "상대 브랜드를 찾을 수 없어요." };

  const photos = (input.photos ?? []).map((p) => p.u).filter(Boolean).slice(0, 5);
  const description = (input.description ?? "").trim();
  const year = (input.year ?? "").trim();
  const link = (input.link ?? "").trim();

  try {
    await repo.recordCollab(
      { brandAId: a.id, brandBId: b.id, origin: input.origin, title, year, description, photos, link },
      sessionUserId
    );
  } catch {
    // 조용히 성공한 척하면 북극성이 유실된다 — 실패는 반드시 화면에 띄운다.
    return { error: "기록에 실패했어요. 표가 아직 없으면 SQL을 먼저 실행해주세요." };
  }

  // F5 → F6: 성사가 소개서 이력으로 흘러간다(대표 지시 07-29).
  // ⚠️ 여기 실패는 **삼킨다** — 성사 기록(북극성)은 이미 남았고, 소개서 반영은 부가 효과다.
  //    이걸로 전체를 실패 처리하면 "기록이 안 됐나?" 하고 다시 눌러 중복이 생긴다.
  if (input.alsoAddToProfile !== false) {
    try {
      await repo.appendCollabHistory(a.id, {
        partner: b.name,
        types: [],
        desc: description || title,
        year: year || undefined,
        photos,
        link: link || undefined,
      });
    } catch {
      /* 소개서 반영 실패는 무시 — 성사 기록은 살아 있다 */
    }
  }
  return {};
}

/** 소개서 삭제 — 로그인 소유자만. /my에서 사용. 카드·지표는 FK CASCADE로 함께 삭제. */
export async function deleteMakerAction(slug: string): Promise<{ error?: string }> {
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { error: "소개서를 찾을 수 없어요." };
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId || maker.ownerUserId !== sessionUserId) return { error: "삭제 권한이 없어요." };
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
