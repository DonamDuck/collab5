"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId, getProfileById, savePhoneIfEmpty } from "./profiles";
// 🧪09-17 목 데이터 — 목 쿠키가 있으면 쓰기 액션은 첫 줄에서 멈춘다(DB·토스·메일 전부 안 건드린다). 개발 빌드 전용.
import { getRentMock, rentMockOn, RENT_MOCK_BLOCKED } from "./rent-mock";
import {
  saveSpace, getSpaceFull, getBooking, createPendingBooking, getBookingByOrderId,
  decideBooking, requestRefund, clearRefundRequest,
  setBookingStatus, listSpacesByOwner, listSpacesByIds, payout, FEE_RATE,
  createPayment, getPaymentByOrderId, rentSync,
  type SpaceSaveInput,
  listLiveBookings, setSpaceStatus, approveSpace,
} from "./spaces";
// 🧾🏪09-18 사업자 확인 · 네이버 상호 매칭(대표 09-17). 규칙은 순수 함수(`bizcheck`·`place-match`), 바깥 호출은 서버 전용 파일에.
import {
  BIZ_CERT_MAX_BYTES, BIZ_CERT_TYPES, BIZ_MISMATCH_LINE, bizCertPathOk, bizDigits, bizNumberProblem, hasAnyBiz, openDateProblem,
} from "./bizcheck";
import { checkBusiness } from "./nts-bizcheck";
import { matchPlace } from "./naver-local";
import { signCertUpload } from "./host-docs";
import { hasPayoutAccount, savePayoutAccount, toMasked, validatePayoutInput, type PayoutAccountInput, type PayoutAccountMasked } from "./payout-accounts";
import { approvePayment, cancelPayment, guestCancelRefundRate, GRACE_MINUTES } from "./rent-payment";
import { geocode } from "./geocode";
import { repo } from "./repo";
import {
  notifyBookingPaid, notifyBookingConfirmed, notifyBookingRejected, notifyBookingCancelled,
  notifyBookingPaidToGuest, notifyBookingConfirmedToHost, notifyBookingCancelledToGuest, notifyAdminRefund,
  notifySpacePublished,
} from "./rent-notify";
import { bookingStarted, dateLabel, kstDaysUntil, hoursBetween, fitsOpenSlot, nowHhmmKst, overlaps, toMinutes, todayKst } from "./rent-time";
import type { Space, SpaceBooking, SpaceUseType, SpaceCategory, OpenSlot, AccessHow, RentProduct, BizCheckStatus } from "./types";
import { bookingAmount, compatScopePrice, isRentProduct, productOn } from "./rent-products";
import { PRODUCT_LABEL, withJosa } from "./rent-copy";

// 하루 가게 — 쓰기 서버 액션 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
//
// 🚨**이 파일은 «async 함수»만 export한다.** 타입이나 상수를 하나라도 내보내면 빌드가
//   `Export X doesn't exist in target module`로 죽는데, **tsc는 못 잡는다**(09-13에 실제로 당했다).
//   화면이 쓸 타입은 `lib/types.ts`에서 직접 가져간다.
//
// 🚨**모든 함수가 첫 줄에서 로그인·권한을 검사한다.** 화면에서 버튼을 숨기는 건 UX일 뿐이고,
//   주소를 직접 치거나 액션을 직접 호출하는 경로는 늘 열려 있다(08-06 소개서 편집에서 실제로 났던 구멍).

export interface ActionResult {
  ok: boolean; message: string; slug?: string; bookingId?: number;
  /** 🧾09-18 화면이 이 말을 어느 칸 밑에 띄울지(`f-<field>`). 지금은 사업자 칸(`biz`)만 쓴다. */
  field?: string;
  /** 🧾09-18 저장 뒤 국세청 조회 결과. `mismatch`면 폼이 고치기 화면으로 가서 그 칸에 말을 띄운다. */
  bizStatus?: BizCheckStatus;
}

/** 공간을 공개로 넘길 수 있는 사람 — 지금은 대표뿐이다.
 *  ⚠️`lib/staff.ts`를 안 쓴다. 그 파일 주석이 *「소유·권한 판정에는 쓰지 마라」*고 못 박았고,
 *    이건 남의 등록을 세상에 내보내는 판정이라 성격이 다르다(매거진이 같은 이유로 별도 파일을 뒀다). */
export async function isRentAdmin(): Promise<boolean> {
  // 🧪09-17 목 데이터(개발 빌드 전용) — 케이스가 관리자 보기인지로 정한다.
  const mock = await getRentMock();
  if (mock) return mock.viewer.admin;
  // ⭐export하는 이유 — 화면이 [공개하기] 버튼을 보일지 정할 때 같은 규칙을 «다시 적으면»
  //   환경변수 이름이 어긋나는 날 버튼은 보이는데 안 눌리는 상태가 된다. 판정은 한 벌만 둔다.
  const raw = process.env.RENT_ADMIN_EMAILS ?? process.env.MAGAZINE_EDITOR_EMAILS ?? "dudejrthd@gmail.com";
  const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const uid = await getSessionUserId();
  if (!uid) return false;
  const p = await getProfileById(uid);
  return !!p?.email && allow.includes(p.email.toLowerCase());
}

/** 주소 후보를 슬러그로. 한글 이름이면 옮길 글자가 없어 난수로 떨어진다(매거진이 같은 함정을 겪었다). */
function makeSlug(name: string): string {
  // 🩸09-13 실측: 「을지로 옥상 작업실」이 `----efpa`가 됐다. 한글을 떼고 나면 공백 자리의 대시만 남는데,
  //   그 대시 넉 자가 「3자 이상」을 통과했다. 그래서 대시를 접고 양끝을 자른 «뒤에» 길이를 잰다.
  const ascii = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-").replace(/^-+|-+$/g, "");
  const tail = Date.now().toString(36).slice(-4);
  return ascii.length >= 3 ? `${ascii}-${tail}` : `space-${Date.now().toString(36)}`;
}

export interface SpaceFormInput {
  slug?: string;
  name: string; body: string; photos: string[];
  address: string;
  category: SpaceCategory;
  useType: SpaceUseType; facilities: string[]; facilitiesNote: string; capacity?: number;
  rules: string;
  /** 🛍상품 셋(09-18). 옛 `scope`·`priceHour`는 화면이 안 보낸다 — 서버가 이 값에서 호환 값을 만든다. */
  rentSpaceOn: boolean; rentSpacePrice: number; rentSpaceNote: string;
  rentFullOn: boolean; rentFullPrice: number; rentFullNote: string;
  minHours: number; openSlots: OpenSlot[];
  /** 🔁매주 계속 여는 요일(09-17). `openSlots`에 펼친 날짜가 섞여 와도 된다 — 저장(`saveSpace`)이 도로 뺀다. */
  repeatWeekly: Space["repeatWeekly"];
  coffeeChat: boolean; coffeeChatMinutes: number; coffeeChatPrice: number; coffeeChatTopics: string;
  accessHow: AccessHow; contactPhone: string;
  /** 📜호스트 약관 동의. 화면의 체크 하나지만 계약의 근거라 서버가 다시 본다. */
  hostTermsOk: boolean;
  brandSlug: string;
  /** 🧾09-18 사업자 확인(대표 09-17: 필수). 새 공간은 넷 다 필수, 고치기는 옛 공간이 비어 있으면 그대로 저장된다.
   *  번호는 숫자 10자리(하이픈이 섞여 와도 서버가 걷는다) · 개업일 `YYYYMMDD` · 등록증은 `createBizCertUploadAction`이 준 경로. */
  bizNumber: string;
  bizOwnerName: string;
  bizOpenDate: string;
  bizCertPath: string;
}

/** 공간 등록·수정. 저장하면 `pending`(검토 대기)로 들어간다. */
export async function saveSpaceAction(input: SpaceFormInput): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  // 🔻09-16 대표 — 음식 여부·임대인 동의 «칸»을 없앴다.
  //   전대 확인은 등록 화면의 체크박스가 아니라 **호스트 약관 한 줄**로 옮겼다(약관규제법 제3조③④).
  //   음식 차단도 뺐다 — 무신고 영업 문제는 호스트 명의의 영업신고 범위 안에서 호스트 관리·감독으로
  //   푸는 것이 맞고(식품위생법 제37조④), 그것도 약관이 맡는다.
  // ⭐「사용 유의 사항」은 이 서비스에서 제일 중요한 칸이라 빈칸으로 못 넘어간다.
  if (input.rules.trim().length < 10) {
    return { ok: false, message: "유의 사항을 열 글자 넘게 담아 주세요. 이 칸이 사장님을 지켜 줘요." };
  }
  if (!input.name.trim()) return { ok: false, message: "공간 이름을 적어 주세요." };
  if (!input.category) return { ok: false, message: "어떤 업종인지 골라 주세요." };
  // 🔁09-17 — 매주 계속 여는 요일이 있으면 그걸로 «하루 이상»이 찬다.
  const repeat = Array.isArray(input.repeatWeekly) ? input.repeatWeekly : [];
  if (input.openSlots.length === 0 && repeat.length === 0) {
    return { ok: false, message: "빌려줄 수 있는 날과 시간을 하나 이상 정해 주세요." };
  }
  if (input.photos.length === 0) return { ok: false, message: "사진을 한 장 이상 올려 주세요. 사진 없는 공간은 아무도 안 빌려요." };
  // 🛍09-18 상품 셋 — 공간 상품은 하나 이상, 켠 상품은 값과 설명이 있어야 한다. 화면도 막지만 관문은 여기다.
  if (!input.rentSpaceOn && !input.rentFullOn) {
    return { ok: false, message: `파실 상품을 하나는 켜 주세요. ${PRODUCT_LABEL.space}, ${PRODUCT_LABEL.full} 중에서요.` };
  }
  for (const [on, price, note, label] of [
    [input.rentSpaceOn, input.rentSpacePrice, input.rentSpaceNote, PRODUCT_LABEL.space],
    [input.rentFullOn, input.rentFullPrice, input.rentFullNote, PRODUCT_LABEL.full],
  ] as const) {
    if (!on) continue;
    if (!(price > 0)) return { ok: false, message: `${withJosa(label, "은/는")} 한 시간에 얼마인지 적어 주세요.` };
    if ((note ?? "").trim().length < 10) {
      return { ok: false, message: `${label} 설명이 짧아요. 손님이 무엇을 쓰고 할 수 있는지 열 글자 넘게 담아 주세요.` };
    }
  }
  if (input.minHours < 1) return { ok: false, message: "최소 대여 시간은 한 시간 이상이어야 해요." };
  // ☎️🚨청약 «전»에 보여야 하는 값이라 빈칸으로 못 넘어간다.
  //   전자상거래법 제20조②(시행 2026-07-21): 중개자는 사업자 호스트의 성명·주소·전화번호를 확인해
  //   청약 전에 소비자에게 제공해야 하고, 안 하면 제20조의2②로 **우리가 연대 책임**을 진다.
  if (!input.contactPhone.trim()) {
    // 🔁09-17 QA — 「법에 따라」가 위협조로 읽혔다. 근거는 위 주석에 두고 사장님께는 쓰임만 말한다.
    return { ok: false, message: "매장 전화번호가 비어 있어요. 손님이 신청하기 전에 보는 번호예요." };
  }
  // 📜호스트 약관 동의. 없으면 수수료·정산·구상을 나중에 주장할 근거가 없다.
  if (!input.hostTermsOk) {
    return { ok: false, message: "공간 제공자 약관에 동의해 주세요." };
  }
  // 열어 둔 시간대가 말이 되는지. 거꾸로거나 최소 시간보다 짧은 칸은 아무도 못 빌린다.
  for (const sl of input.openSlots) {
    const h = hoursBetween(sl.start, sl.end);
    if (h <= 0) return { ok: false, message: `${dateLabel(sl.date)}의 시간이 거꾸로예요. 끝나는 시각이 더 늦어야 해요.` };
    if (h < input.minHours) {
      return { ok: false, message: `${dateLabel(sl.date)}은 ${h}시간만 열려 있어서 최소 ${input.minHours}시간을 못 채워요.` };
    }
  }

  // 🔁요일 규칙 검사(09-17). 화면이 막아도 여기서 다시 본다 — 깨진 규칙 하나가 12주치 날짜를 만든다.
  const dows = new Set<number>();
  for (const r of repeat) {
    const dayName = `매주 ${"일월화수목금토"[r?.dow] ?? "?"}요일`;
    if (!r || !Number.isInteger(r.dow) || r.dow < 0 || r.dow > 6) return { ok: false, message: "매주 여는 요일을 알아보지 못했어요. 요일 줄에서 한 번 껐다 켜 주세요." };
    if (dows.has(r.dow)) return { ok: false, message: `${dayName}이 두 번 들어 있어요. 하나만 남겨 주세요.` };
    dows.add(r.dow);
    if (!/^\d{2}:\d{2}$/.test(r.start ?? "") || !/^\d{2}:\d{2}$/.test(r.end ?? "") || toMinutes(r.start) < 0 || toMinutes(r.end) < 0) {
      return { ok: false, message: `${dayName} 여는 시각이 비어 있어요.` };
    }
    const h = hoursBetween(r.start, r.end);
    if (h <= 0) return { ok: false, message: `${dayName}의 시간이 거꾸로예요. 끝나는 시각이 더 늦어야 해요.` };
    if (h < input.minHours) return { ok: false, message: `${dayName}은 ${h}시간만 열려 있어서 최소 ${input.minHours}시간을 못 채워요.` };
    if (r.skip !== undefined && (!Array.isArray(r.skip) || r.skip.length > 200 || r.skip.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d)))) {
      return { ok: false, message: `${dayName} 쉬는 날 목록이 깨져 있어요. 새로고침하고 한 번 더 올려 주세요.` };
    }
  }

  // 수정이면 주인 확인부터. ⚠️입력에 실린 slug를 믿지 않고 DB에서 소유자를 다시 읽는다.
  if (input.slug) {
    const cur = await getSpaceFull(input.slug);
    if (!cur) return { ok: false, message: "그 공간을 찾지 못했어요." };
    if (cur.ownerUserId !== uid) return { ok: false, message: "내 공간만 고칠 수 있어요." };
  }

  // 📍주소가 «바뀔 때만» 좌표를 다시 잰다(대표 09-14 지도 요청). 유료 호출이라 매번 부르지 않고,
  //   실패해도 저장은 그대로 간다 — 지도는 있으면 좋은 것이지 올리기를 막을 것이 아니다.
  const prev = input.slug ? await getSpaceFull(input.slug) : null;

  // 🧾사업자 정보(대표 09-17: 「개인까지 받으면 너무 무방비」). 바깥 호출(좌표·국세청·네이버) «전에» 모양부터 본다.
  //   ⭐필수인 경우 = 새 공간 · 이미 사업자 정보가 있던 공간(지우지 못한다) · 넷 중 하나라도 적은 고치기.
  //   옛 공간(09-18 전)이 넷 다 비운 채 고치면 그대로 저장한다 — 공개 중인 공간의 저장을 막지 않는다(대표 설계).
  //   그 공간은 확인 표시가 없고, 검토로 다시 가면 공개가 막힌다(`publishSpaceAction`).
  const biz = {
    bizNumber: bizDigits(input.bizNumber ?? ""),
    bizOwnerName: (input.bizOwnerName ?? "").trim(),
    bizOpenDate: (input.bizOpenDate ?? "").trim(),
    bizCertPath: (input.bizCertPath ?? "").trim(),
  };
  const bizRequired = !prev || hasAnyBiz(prev) || hasAnyBiz(biz);
  if (bizRequired) {
    const problem =
      bizNumberProblem(biz.bizNumber) ||
      (!biz.bizOwnerName ? "대표자 이름을 사업자등록증 그대로 적어 주세요." : "") ||
      (biz.bizOwnerName.length > 50 ? "대표자 이름이 너무 길어요. 사업자등록증 그대로 적어 주세요." : "") ||
      openDateProblem(biz.bizOpenDate, todayKst()) ||
      (!biz.bizCertPath ? "사업자등록증 파일을 올려 주세요." : "");
    if (problem) return { ok: false, message: problem, field: "biz" };
    // 🔒새로 올린 경로면 «이 사람 폴더»의 모양인지. 남의 등록증 경로를 끼워 넣어 확인 표시를 받는 길을 막는다.
    if (biz.bizCertPath !== (prev?.bizCertPath ?? "") && !bizCertPathOk(biz.bizCertPath, uid)) {
      return { ok: false, message: "사업자등록증 파일을 다시 올려 주세요.", field: "biz" };
    }
  }

  let lat = prev?.lat;
  let lng = prev?.lng;
  if (input.address.trim() && input.address.trim() !== (prev?.address ?? "")) {
    const hit = await geocode(input.address);
    if (hit) { lat = hit.lat; lng = hit.lng; }
  }

  const slug = input.slug || makeSlug(input.name);
  // 🔁09-16 대표 — **고쳐도 공개가 유지된다.** 전엔 글자 하나만 바꿔도 검토 대기로 내려가 목록에서 사라졌다.
  //   다시 검토받는 건 «가게가 바뀌는» 둘뿐이다: 주소와 매장 이름. 나머지는 사장님이 알아서 고친다.
  const renamed = !!prev && prev.name.trim() !== input.name.trim();
  const moved = !!prev && prev.address.trim() !== input.address.trim();
  const status: Space["status"] = !prev ? "pending" : renamed || moved ? "pending" : prev.status;

  // 🧾국세청 조회 — 번호·대표자·개업일이 «바뀌었을 때»만 부른다(대표 설계). 🔁그리고 지난번에 못 물어본 경우(`none`·`error`)도
  //   다시 부른다. 키가 생기기 전에 올린 공간이 영영 「조회 전」으로 남지 않게.
  const idChanged =
    !prev || prev.bizNumber !== biz.bizNumber || prev.bizOwnerName !== biz.bizOwnerName || prev.bizOpenDate !== biz.bizOpenDate;
  const bizChanged = idChanged || !prev || prev.bizCertPath !== biz.bizCertPath;
  const needCheck = bizRequired && (idChanged || prev?.bizCheckStatus === "none" || prev?.bizCheckStatus === "error");
  // 🏪네이버 상호 — 이름·주소가 바뀌었거나 아직 매칭이 없을 때. 매칭이 있고 둘 다 그대로면 안 부른다.
  const placeStale = !prev || renamed || moved;
  const needPlace = placeStale || !prev?.placeMatchedAt;
  const [checked, placeHit] = await Promise.all([
    needCheck ? checkBusiness({ number: biz.bizNumber, ownerName: biz.bizOwnerName, openDate: biz.bizOpenDate }) : null,
    needPlace ? matchPlace({ name: input.name.trim(), address: input.address.trim(), lat, lng }) : null,
  ]);
  // 🚫휴업·폐업은 올릴 수 없다(대표 설계). 저장하지 않고 그 칸에 말한다.
  if (checked?.status === "closed") {
    const what = checked.detail.bSttCd === "02" ? "휴업 중인" : "폐업한";
    return {
      ok: false,
      message: `국세청 기록에 ${what} 사업자로 나와요. 지금 영업 중인 사업자만 공간을 올릴 수 있어요.`,
      field: "biz",
    };
  }
  const bizCheckStatus: BizCheckStatus = !bizRequired ? "none" : checked ? checked.status : prev?.bizCheckStatus ?? "none";
  const bizCheckDetail = !bizRequired ? undefined : checked ? checked.detail : prev?.bizCheckDetail;
  const bizCheckedAt = !bizRequired ? undefined : checked ? new Date().toISOString() : prev?.bizCheckedAt;
  // 🔒사업자 정보(등록증 포함)가 바뀌면 관리자 승인을 지운다. 승인은 «그 등록증»을 본 것이지 사람을 본 게 아니다.
  //   공개는 그대로 두고 확인 표시만 내려간다. 관리자 검토 목록에 「확인 표시만」으로 다시 뜬다(`listSpacesForReview`).
  const bizApprovedAt = bizChanged ? undefined : prev?.bizApprovedAt;

  const noPlace = { placeName: "", placeAddress: "", placeLat: undefined, placeLng: undefined, placeMatchedAt: undefined };
  let place: Pick<Space, "placeName" | "placeAddress" | "placeLat" | "placeLng" | "placeMatchedAt"> = prev
    ? { placeName: prev.placeName, placeAddress: prev.placeAddress, placeLat: prev.placeLat, placeLng: prev.placeLng, placeMatchedAt: prev.placeMatchedAt }
    : noPlace;
  if (placeHit?.status === "matched") {
    place = {
      placeName: placeHit.place.name, placeAddress: placeHit.place.address,
      placeLat: placeHit.place.lat, placeLng: placeHit.place.lng, placeMatchedAt: new Date().toISOString(),
    };
  } else if (placeHit?.status === "nomatch" || placeStale) {
    // 같은 가게가 없거나, 이름·주소가 바뀌었는데 네이버에 못 물어봤다. 옛 매칭은 이제 다른 가게를 가리킬 수 있어 지운다.
    place = noPlace;
  }

  const row: SpaceSaveInput = {
    slug, ownerUserId: uid, brandSlug: input.brandSlug,
    name: input.name.trim(), tagline: "", body: input.body, photos: input.photos,
    // 동네는 이제 안 묻는다(대표 09-16: 「주소면 충분」). 옛 칸은 주소에서 앞 두 조각만 넣어 둔다 —
    // 목록의 동네 거르개가 아직 이 칸을 본다.
    area: input.address.trim().split(/\s+/).slice(0, 2).join(" "),
    address: input.address.trim(), lat, lng, accessNote: "",
    useType: input.useType, facilities: input.facilities,
    facilitiesNote: input.facilitiesNote.trim(), capacity: input.capacity,
    hours: "", rules: input.rules.trim(),
    priceDay: 0, mentorMinutes: 0, mentorPrice: 0,
    openDates: [], servesFood: false, subleaseOk: true,

    category: input.category,
    // 🛍켠 상품만 값·설명을 남긴다. 꺼진 상품의 값이 남아 있으면 「N원부터」가 안 파는 값을 집는다.
    rentSpaceOn: input.rentSpaceOn,
    rentSpacePrice: input.rentSpaceOn ? Math.round(input.rentSpacePrice) : 0,
    rentSpaceNote: input.rentSpaceOn ? input.rentSpaceNote.trim() : "",
    rentFullOn: input.rentFullOn,
    rentFullPrice: input.rentFullOn ? Math.round(input.rentFullPrice) : 0,
    rentFullNote: input.rentFullOn ? input.rentFullNote.trim() : "",
    // ⚠️옛 칸 둘은 호환 값으로 같이 쓴다(읽는 곳이 남아 있다). 계산은 `compatScopePrice` 한 곳.
    ...compatScopePrice({
      rentSpaceOn: input.rentSpaceOn, rentSpacePrice: input.rentSpaceOn ? input.rentSpacePrice : 0, rentSpaceNote: "",
      rentFullOn: input.rentFullOn, rentFullPrice: input.rentFullOn ? input.rentFullPrice : 0, rentFullNote: "",
    }),
    minHours: input.minHours, openSlots: input.openSlots,
    repeatWeekly: repeat.map((r) => ({ dow: r.dow, start: r.start, end: r.end, ...(r.skip?.length ? { skip: r.skip } : {}) })),
    coffeeChat: input.coffeeChat,
    coffeeChatMinutes: input.coffeeChat ? input.coffeeChatMinutes : 0,
    coffeeChatPrice: input.coffeeChat ? input.coffeeChatPrice : 0,
    coffeeChatTopics: input.coffeeChat ? input.coffeeChatTopics.trim() : "",
    accessHow: input.accessHow, contactPhone: input.contactPhone.trim(),
    hostTermsAt: prev?.hostTermsAt ?? new Date().toISOString(),
    ...biz,
    bizCheckStatus, bizCheckDetail, bizCheckedAt, bizApprovedAt,
    ...place,
    status,
  };
  const saved = await saveSpace(row);
  if (!saved) return { ok: false, message: "저장에 실패했어요. 잠시 뒤 다시 시도해 주세요." };
  revalidatePath("/rent");
  revalidatePath(`/rent/${slug}`);
  revalidatePath("/rent/review");
  // 화면은 이 말을 안 띄운다 — 저장 뒤 `/rent/my?saved=…`가 상황별 한 줄을 띄운다(09-17).
  // 🧾국세청 기록과 다르면 저장은 하고(관리자가 등록증과 같이 본다) 폼이 그 칸에 고칠 말을 띄운다. 공개는 막힌다.
  if (bizCheckStatus === "mismatch") return { ok: true, message: BIZ_MISMATCH_LINE, slug, bizStatus: bizCheckStatus, field: "biz" };
  return { ok: true, message: "올렸어요. 읽어 보고 목록에 열어 드릴게요.", slug, bizStatus: bizCheckStatus };
}

/** 🧾사업자등록증 올릴 자리(09-18) — 비공개 버킷 `host-docs`의 이 사람 폴더에 서명 업로드 URL.
 *  🔒공개 URL을 만들지 않는다. 돌려주는 경로는 폼이 저장할 때 다시 보내고, 서버가 «이 사람 폴더»인지 또 본다.
 *  크기·형식은 여기서 한 번, 버킷 설정에서 한 번 더 막는다(서명 URL로 직접 올리는 길이 있어서). */
export async function createBizCertUploadAction(
  mime: string,
  size: number,
): Promise<{ path: string; token: string } | { error: string }> {
  if (await rentMockOn()) return { error: RENT_MOCK_BLOCKED.message };
  const uid = await getSessionUserId();
  if (!uid) return { error: "로그인이 필요해요." };
  if (!BIZ_CERT_TYPES[mime]) return { error: "사진(JPG·PNG·HEIC)이나 PDF 파일로 올려 주세요." };
  if (!(size > 0) || size > BIZ_CERT_MAX_BYTES) return { error: "10MB가 넘는 파일은 못 올려요. 사진으로 찍어 올려 주셔도 돼요." };
  const r = await signCertUpload(uid, mime);
  if ("error" in r) return { error: "파일을 올릴 자리를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  return r;
}

/** 검토 통과 — 대표만. 검토 대기면 공개하고, 이미 공개·쉬는 중이면 사업자 확인 승인만 적는다(09-18).
 *
 *  🧾09-18 대표 — 사업자 확인이 공개의 조건이다.
 *   · 등록증·사업자 정보가 비었으면 못 연다
 *   · 국세청 기록과 다르거나(mismatch) 휴업·폐업(closed)이면 못 연다
 *   · 국세청에 아직 못 물어봤거나(none, 키 없음) 조회가 실패했으면(error) 관리자가 등록증을 눈으로 보고 연다.
 *     승인 시각은 적되 「사업자 확인된 가게」는 안 붙는다(`bizVerified` = 승인 && valid).
 *  ⭐행 전체를 다시 쓰지 않는다(`approveSpace`). 옛 코드는 `saveSpace({ ...sp, status })`라 관리자가 누르는 순간
 *    사장님이 옆 탭에서 고친 내용을 옛 값으로 덮을 수 있었다. */
export async function publishSpaceAction(slug: string): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  if (!(await isRentAdmin())) return { ok: false, message: "권한이 없어요." };
  const sp = await getSpaceFull(slug);
  if (!sp) return { ok: false, message: "그 공간을 찾지 못했어요." };
  if (!sp.bizCertPath || !sp.bizNumber || !sp.bizOwnerName || !sp.bizOpenDate) {
    return { ok: false, message: "사업자등록증이나 사업자 정보가 비어 있어 열 수 없어요. 사장님께 채워 달라고 연락해 주세요." };
  }
  if (sp.bizCheckStatus === "mismatch") {
    return { ok: false, message: "국세청 기록과 달라 열 수 없어요. 사장님이 사업자 정보를 고치시면 다시 조회돼요." };
  }
  if (sp.bizCheckStatus === "closed") {
    return { ok: false, message: "휴업이나 폐업으로 나오는 사업자라 열 수 없어요." };
  }
  const saved = await approveSpace(slug, { status: sp.status, bizNumber: sp.bizNumber, bizCertPath: sp.bizCertPath });
  revalidatePath("/rent");
  revalidatePath(`/rent/${slug}`);
  revalidatePath("/rent/review");
  revalidatePath("/rent/my");
  if (!saved) return { ok: false, message: "그 사이 사장님이 고치셨을 수 있어요. 새로고침하고 다시 봐 주세요." };
  // 📨09-17 대표 — 공개되면 사장님께 한 통. 🪤버튼을 두 번 누르거나 이미 열린 공간에 다시 누르면
  //   이 함수가 또 불린다. «이번에 처음 열렸을 때만» 보낸다. 메일이 실패해도 공개는 그대로 성공이다.
  const opened = sp.status !== "open" && saved.status === "open";
  if (opened) {
    await safeNotify(async () => {
      const [host, hasAccount] = await Promise.all([getProfileById(sp.ownerUserId), hasPayoutAccount(sp.ownerUserId)]);
      await notifySpacePublished(saved, host, hasAccount);
    });
  }
  const badge = sp.bizCheckStatus === "valid";
  // none = 아직 못 물어봄(키 없음), error = 물어봤는데 실패. 관리자에게 둘을 다르게 말한다.
  const why = sp.bizCheckStatus === "error" ? "국세청 조회가 실패해서" : "국세청 조회 전이라";
  return {
    ok: true,
    message: opened
      ? badge ? "공개했어요. 사업자 확인 표시도 붙었어요." : `공개했어요. ${why} 확인 표시는 아직 안 붙어요.`
      : badge ? "확인 표시를 붙였어요." : `승인해 뒀어요. ${why} 확인 표시는 국세청 기록과 맞춰 본 뒤에 붙어요.`,
    slug,
  };
}

/** ⏸공간 잠시 쉬기 / 다시 열기 — 주인만(09-17). `open` ↔ `paused` 둘만 오간다.
 *  검토 대기(`pending`)·작성 중(`draft`)은 여기서 못 바꾼다. 쉬기로 검토를 건너뛰는 길이 생기면 안 된다. */
export async function setSpacePausedAction(slug: string, paused: boolean): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };
  const sp = await getSpaceFull(slug);
  if (!sp) return { ok: false, message: "그 공간을 찾지 못했어요." };
  if (sp.ownerUserId !== uid) return { ok: false, message: "내 공간만 바꿀 수 있어요." };
  const from = paused ? "open" : "paused";
  if (sp.status === (paused ? "paused" : "open")) {
    return { ok: true, message: paused ? "이미 쉬는 중이에요." : "이미 열려 있어요.", slug };
  }
  if (sp.status !== from) {
    return { ok: false, message: "검토가 끝나 공개된 공간만 쉬거나 다시 열 수 있어요.", slug };
  }
  const changed = await setSpaceStatus(slug, from, paused ? "paused" : "open");
  if (!changed) return { ok: false, message: "바꾸지 못했어요. 잠시 뒤 다시 눌러 주세요." };
  revalidatePath("/rent");
  revalidatePath(`/rent/${slug}`);
  revalidatePath("/rent/my");
  // ⭐쉬어도 이미 결제된 예약은 살아 있다. 사장님이 「쉬면 예약도 사라지나」를 걱정하지 않게 결과에서 말한다.
  return paused
    ? { ok: true, message: "잠시 쉬게 해 뒀어요. 목록에서만 빠지고, 이미 받은 예약은 그대로 살아 있어요.", slug }
    : { ok: true, message: "다시 열었어요. 목록에 바로 보여요.", slug };
}

/** 🏦정산 받을 계좌 저장 — 로그인 + 공간을 하나 이상 올린 사람만(09-17).
 *  🔒응답에 계좌번호 원문을 싣지 않는다. 화면이 받는 건 뒷자리만 남긴 모양(`PayoutAccountMasked`)이다. */
export async function savePayoutAccountAction(
  input: PayoutAccountInput,
): Promise<ActionResult & { account?: PayoutAccountMasked }> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };
  const mine = await listSpacesByOwner(uid);
  if (mine.length === 0) return { ok: false, message: "공간을 올리신 뒤에 계좌를 등록할 수 있어요." };
  const v = validatePayoutInput(input);
  if (!v.ok) return { ok: false, message: v.message };
  const saved = await savePayoutAccount(uid, v.value);
  if (!saved) return { ok: false, message: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  revalidatePath("/rent/my");
  revalidatePath("/rent/payouts");
  return { ok: true, message: "계좌를 저장했어요.", account: toMasked(saved) };
}

export interface BookingFormInput {
  spaceSlug: string;
  useDate: string;
  plan: string;
  headcount?: number;
  /** ⏱`HH:MM`. 하루 통째가 아니라 「그날 몇 시부터 몇 시까지」를 받는다(09-16). */
  startTime: string;
  endTime: string;
  withChat: boolean;
  /** 🛍고른 공간 상품(09-18). 서버가 «켜진 상품인가»를 다시 본다. */
  product: RentProduct;
  guestBrandSlug: string;
  /** ☎️손님 연락처 — 필수(대표 09-17). 예약 행(`guest_phone`)에 적고, 프로필이 비었으면 거기도 채운다. */
  guestPhone: string;
}

export interface StartBookingResult extends ActionResult {
  orderId?: string;
  amount?: number;
  orderName?: string;
}

/** ① 결제창으로 보내기 «직전» — 검사하고 자리를 잡는다.
 *
 *  ⭐**금액을 여기서 정한다.** 화면이 보내 온 금액은 받지도 않는다. 공간 행에서 다시 계산한 값만
 *  `pending` 행에 적히고, 돌아왔을 때 그 값으로 승인을 건다. 화면을 조작해도 값이 안 바뀐다.
 *  🚨`pending` 행은 호스트에게 안 보인다(`listBookingsForHost`가 거른다). */
export async function startBookingAction(input: BookingFormInput): Promise<StartBookingResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  const sp = await getSpaceFull(input.spaceSlug);
  if (!sp || sp.status !== "open") return { ok: false, message: "지금은 신청할 수 없는 공간이에요." };
  if (sp.ownerUserId === uid) return { ok: false, message: "내 공간은 내가 빌릴 수 없어요." };
  if (input.plan.trim().length < 10) return { ok: false, message: "그날 무엇을 하실지 열 글자 이상 적어 주세요." };
  // 🛍09-18 — 사장님이 켜 둔 상품인지. 화면을 거치지 않은 호출이면 꺼진 상품 이름이 올 수 있다.
  if (!isRentProduct(input.product) || !productOn(sp, input.product)) {
    return { ok: false, message: "이 공간에서 팔지 않는 상품이에요. 새로고침하고 다시 골라 주세요." };
  }
  // ☎️09-17 대표 — 손님 번호는 필수. 화면도 막지만 관문은 여기다(액션은 화면 없이도 불린다).
  //   숫자만 세서 0으로 시작하는 9~11자리면 받는다(지역번호 02 포함). 모양은 손님이 적은 그대로 둔다.
  const phoneDigits = (input.guestPhone ?? "").replace(/\D/g, "");
  if (!/^0\d{8,10}$/.test(phoneDigits)) {
    return { ok: false, message: "연락받을 전화번호를 다시 봐 주세요. 숫자 9~11자리예요." };
  }

  // ⏳지난 «날»은 여기서 자른다. 화면도 거르지만(`futureSlots`) 관문은 여기다 —
  //   열어 둔 날이 지나가도 목록에는 남아 있어서, 주소를 그대로 들고 온 사람은 화면을 안 거친다.
  const today = todayKst();
  if (input.useDate < today) return { ok: false, message: "지난 날짜는 신청할 수 없어요." };

  // ⏱시간 검사 — 화면에서도 막지만 관문은 여기다.
  const hours = hoursBetween(input.startTime, input.endTime);
  if (hours <= 0) return { ok: false, message: "끝나는 시각이 시작보다 늦어야 해요." };
  // ⚠️지난 «시각» 검사는 모양 검사 «뒤»다. 앞에 두면 못 읽은 시각(`-1`)이 「이미 지났다」로 잡혀
  //   글자가 깨졌을 때 엉뚱한 지적이 나간다.
  if (input.useDate === today && toMinutes(input.startTime) <= toMinutes(nowHhmmKst())) {
    return { ok: false, message: "이미 지난 시간이에요. 다른 시간을 골라 주세요." };
  }
  if (hours < sp.minHours) return { ok: false, message: `이 공간은 최소 ${sp.minHours}시간부터 빌릴 수 있어요.` };
  if (!fitsOpenSlot(sp.openSlots, input.useDate, input.startTime, input.endTime)) {
    return { ok: false, message: "사장님이 열어 두신 시간 안에서 골라 주세요." };
  }
  // 이미 팔린 시간과 겹치는지. ⚠️여기서 막아도 «관문은 DB»다 — 두 사람이 같은 순간에 들어오면
  //   이 검사는 둘 다 통과시키고, 승인 때 배제 제약이 뒤에 온 쪽을 떨어뜨린다.
  const taken = await listLiveBookings(sp.id, input.useDate);
  if (taken.some((b) => overlaps(b.startTime, b.endTime, input.startTime, input.endTime))) {
    return { ok: false, message: "그 시간은 이미 찼어요. 다른 시간을 골라 주세요." };
  }

  // ⭐금액은 공간 행의 «고른 상품 값»으로 다시 계산한다(09-18). 화면이 본 값과 같은 함수(`bookingAmount`)다.
  const amt = bookingAmount(sp, input.product, hours, input.withChat);
  if (!amt || amt.total <= 0) return { ok: false, message: "아직 값이 안 정해진 공간이라 신청할 수 없어요." };
  const { space: amountSpace, chat: amountChat, total: amountTotal } = amt;

  // 주문번호는 우리가 만든다. 토스에 그대로 실려 가고 돌아올 때 이 값으로 행을 찾는다.
  const orderId = `rent-${sp.id}-${input.useDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 10)}`;

  const booking = await createPendingBooking({
    spaceId: sp.id, guestUserId: uid, guestBrandSlug: input.guestBrandSlug, guestPhone: input.guestPhone.trim(),
    useDate: input.useDate, hours: `${input.startTime}~${input.endTime}`, plan: input.plan.trim(),
    startTime: input.startTime, endTime: input.endTime, hoursCount: hours, product: input.product,
    headcount: input.headcount, withChat: amountChat > 0, amountChat,
    withMentor: false, amountMentor: 0,
    amountSpace, amountTotal,
    paymentKey: "", orderId,
  });
  if (!booking) return { ok: false, message: "신청을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." };

  // ☎️프로필에 번호가 비어 있으면 채운다. 사장님이 보는 번호는 예약 행의 `guestPhone`이 먼저다(09-17).
  //   실패해도 신청은 계속한다 — 이메일이라는 연락 길이 남아 있고, 번호 하나로 결제를 막을 일은 아니다.
  await savePhoneIfEmpty(uid, input.guestPhone);

  // 💳결제 줄도 여기서 만든다(READY). 승인·환불은 전부 이 줄을 기준으로 한다(09-16 결제 테이블).
  //   판매자 = 공간 주인. 지급대행이 돈을 보낼 상대다.
  const payment = await createPayment({
    orderId, bookingId: booking.id, buyingUserId: uid, sellingUserId: sp.ownerUserId, amount: amountTotal,
  });
  if (!payment) {
    // 결제 줄 없이 결제창을 열면 돌아왔을 때 승인할 근거가 없다. 신청을 닫고 멈춘다.
    await setBookingStatus(booking.id, "expired");
    return { ok: false, message: "신청을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }

  return {
    ok: true, message: "", orderId, amount: amountTotal,
    orderName: `${sp.name} ${PRODUCT_LABEL[input.product]} · ${input.useDate} ${input.startTime}~${input.endTime}`,
    bookingId: booking.id,
  };
}

/** 알림에 실을 세 당사자 — 공간 원본(주소 포함)·사장님·손님. 없으면 null(알림만 빠지고 본작업은 그대로).
 *  ⚠️예약 행엔 공간 id만 있고 `getSpaceFull`은 slug를 받는다. 그래서 요약본으로 slug를 찾아 한 번 더 읽는다. */
async function notifyParties(b: SpaceBooking): Promise<{ space: Space; host: Awaited<ReturnType<typeof getProfileById>>; guest: Awaited<ReturnType<typeof getProfileById>> } | null> {
  const brief = (await listSpacesByIds([b.spaceId])).get(b.spaceId);
  if (!brief) return null;
  const space = await getSpaceFull(brief.slug);
  if (!space) return null;
  const [host, guest] = await Promise.all([getProfileById(space.ownerUserId), getProfileById(b.guestUserId)]);
  return { space, host, guest };
}

/** 알림 한 통 — 🚨**결과에 영향을 주면 안 된다.** `rent-notify.ts`가 스스로 삼키지만, 조회 단계(`notifyParties`)가
 *  던질 수도 있어 한 겹 더 감싼다. 결제는 끝났는데 메일 때문에 「실패」가 뜨는 일은 없어야 한다. */
async function safeNotify(run: () => Promise<unknown>): Promise<void> {
  try { await run(); } catch (e) { console.error("[rent-actions] 알림 실패(본작업은 정상)", e); }
}

/** ② 결제창에서 돌아온 뒤 — 승인하고 신청을 성립시킨다.
 *
 *  🚨**돌아온 금액을 안 믿는다.** `pending` 행에 적어 둔 금액으로 승인을 건다.
 *    주소창의 `amount`를 고쳐도 승인 금액은 안 바뀐다.
 *  🩸승인은 됐는데 `paid`로 못 올리면 **돈만 받고 예약이 없는** 상태다. 그 자리에서 되돌린다. */
export async function confirmBookingAction(
  paymentKey: string, orderId: string
): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  const b = await getBookingByOrderId(orderId);
  if (!b) return { ok: false, message: "그 신청을 찾지 못했어요." };
  if (b.guestUserId !== uid) return { ok: false, message: "내 신청만 결제할 수 있어요." };
  // 새로고침·뒤로가기로 이 함수가 두 번 불릴 수 있다. 이미 끝난 건 조용히 성공으로 돌려준다.
  if (b.status !== "pending") return { ok: true, message: "이미 신청이 끝났어요.", bookingId: b.id };

  // 🚨승인 금액은 «결제 줄»에 적힌 값이다. 주소창의 amount는 안 믿는다.
  const pay = await getPaymentByOrderId(orderId);
  if (!pay) return { ok: false, message: "결제 기록을 찾지 못했어요. 처음부터 다시 신청해 주세요." };

  const approved = await approvePayment(paymentKey, orderId, pay.amount);
  if (!approved.ok || !approved.payment) {
    // 돈은 안 움직였다. 결제 줄만 ABORTED로 남기고 예약은 그대로 둔다(30분 안이면 다시 시도할 수 있다).
    await rentSync(orderId, { toss: { status: "ABORTED" } });
    return { ok: false, message: approved.message };
  }

  // ⭐예약 paid + 결제 DONE을 «한 트랜잭션»으로. 시간이 겹쳐 예약이 막히면 결제 기록도 같이 안 바뀐다.
  const synced = await rentSync(orderId, { bookingStatus: "paid", toss: approved.payment });
  if (!synced.ok) {
    // 🩸돈은 승인됐는데 예약을 못 올렸다(대개 그 사이 누가 같은 시간을 먼저 결제했다).
    //   돈만 받고 예약이 없는 상태를 남기면 안 된다 — 들어온 돈을 먼저 적고, 바로 전액 환불한다.
    await rentSync(orderId, { toss: approved.payment });
    const key = approved.payment.paymentKey || paymentKey;
    const refund = await cancelPayment(key, "예약 확정 실패 — 자동 환불", undefined, pay.amount);
    if (refund.ok) {
      await rentSync(orderId, { bookingStatus: "cancelled", toss: refund.payment });
      return { ok: false, message: "그 사이 그 시간이 찼어요. 결제는 자동으로 취소했습니다." };
    }
    // 환불까지 실패하면 손님 돈이 붙잡혀 있다. 정산 화면 「손이 필요한 예약」에 뜨게 rejected로 둔다.
    console.error(`[rent-actions] 🚨승인 뒤 예약 실패 + 자동 환불 실패 — 수동 환불 필요 order=${orderId}`);
    await rentSync(orderId, { bookingStatus: "rejected" });
    return { ok: false, message: "그 사이 그 시간이 찼어요. 환불을 처리하고 있으니 곧 연락드릴게요." };
  }
  const paid = (await getBookingByOrderId(orderId)) ?? { ...b, status: "paid" as const };

  // 🔻09-16 `setOpenDate` 삭제 — 하루를 통째로 파는 모델이 아니다. 시간대가 겹치는지는
  //   DB의 배제 제약(`no_time_overlap`)이 판정하고, 호스트가 연 시간대는 그대로 둔다.
  revalidatePath("/rent");
  revalidatePath("/rent/my");
  await safeNotify(async () => {
    const p = await notifyParties(paid);
    if (!p) return;
    // 📨대표 09-16 — 예약 신청(결제 완료) 때 사장님과 손님 둘 다. 사장님 메일엔 손님이 고른 소개서를 붙인다.
    const brand = paid.guestBrandSlug ? await repo.getMakerBySlug(paid.guestBrandSlug) : null;
    const guestBrand = brand ? { name: brand.name, slug: brand.slug } : undefined;
    await notifyBookingPaid(paid, p.space, p.host, p.guest, guestBrand);
    await notifyBookingPaidToGuest(paid, p.space, p.host, p.guest);
  });
  return { ok: true, message: "예약을 완료했어요.", bookingId: paid.id }; // 👀09-16 대표 phase 1 — 결제를 마치면 곧 예약 완료, 기다리게 하지 않는다
}

/** 호스트의 수락·거절. 거절이면 **전액 환불**한다(대표 09-13). */
export async function decideBookingAction(
  bookingId: number, accept: boolean, message: string
): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  const b = await getBooking(bookingId);
  if (!b) return { ok: false, message: "그 요청을 찾지 못했어요." };
  // ⚠️권한은 "이 사람이 그 공간의 주인인가"다. booking에는 주인이 안 적혀 있어 공간을 거쳐 확인한다.
  const mine = await listSpacesByOwner(uid);
  const sp = mine.find((x) => x.id === b.spaceId);
  if (!sp) return { ok: false, message: "내 공간에 들어온 요청만 답할 수 있어요." };

  // ⏯이용 시간이 이미 시작했으면 «수락»은 뜻이 없다. 거절(= 전액 환불)은 그대로 열어 둔다 —
  //   답을 못 한 채 날이 간 신청은 손님 돈이 붙잡혀 있는 것이라, 사장님이 돌려줄 길은 남아 있어야 한다.
  // ⏯이용 시간이 이미 시작했으면 수락도 거절도 안 받는다(phase 1, 대표 09-16).
  //   손님은 결제 때 이미 「예약 완료」를 봤고 다녀갔을 수 있다. 그때 사장님이 거절을 누르면 다녀간 손님에게
  //   전액이 돌아간다. 문제가 있으면 «관리자에게 환불 신청»으로 — 우리가 양쪽에 전화로 확인한다.
  if (bookingStarted(b)) {
    return {
      ok: false,
      message: accept
        ? "이용 시간이 이미 지나 따로 수락하지 않으셔도 돼요."
        : "이용 시간이 이미 지나 거절할 수 없어요. 문제가 있으면 관리자에게 환불을 신청해 주세요.",
    };
  }

  const decided = await decideBooking(bookingId, accept, message.trim());
  if (!decided) return { ok: false, message: "이미 답하신 요청이에요." };

  if (!accept) {
    // 예약은 이미 rejected다(`decideBooking`). 환불이 «성공»하면 예약 refunded + 결제 CANCELED를 같이 옮긴다.
    //   실패하면 rejected로 남는다 — 정산 화면 「손이 필요한 예약」에 뜬다.
    const pay = await getPaymentByOrderId(b.orderId);
    const refund = pay
      ? await cancelPayment(pay.paymentKey || b.paymentKey, "사장님 거절 — 전액 환불", undefined, pay.balanceAmount)
      : { ok: false as const };
    const refunded = refund.ok && !!(await rentSync(b.orderId, { bookingStatus: "refunded", toss: refund.payment })).ok;
    if (!refunded) console.error(`[rent-actions] 거절 환불 실패 order=${b.orderId} (결제 줄 ${pay ? "있음" : "없음"})`);
    revalidatePath("/rent/my");
    // 🩸환불이 실패했는데 「전액 돌려드려요」 메일이 나가면 안 된다. 돈이 아직 안 돌아왔다.
    //   그 예약은 rejected로 남아 정산 화면 「손이 필요한 예약」에 뜨고, 환불이 끝나면 그때 알린다.
    if (refunded) await safeNotify(async () => {
      const p = await notifyParties(decided);
      if (p) await notifyBookingRejected(decided, p.space, p.host, p.guest);
    });
    return refunded
      ? { ok: true, message: "거절했어요. 손님께 전액 돌려드렸어요." }
      : { ok: true, message: "거절했어요. 환불이 늦어지고 있어 저희가 확인하고 있어요." };
  }
  revalidatePath("/rent/my");
  await safeNotify(async () => {
    const p = await notifyParties(decided);
    if (!p) return;
    // 📨대표 09-16 — 예약 확정 때 손님과 사장님 둘 다.
    await notifyBookingConfirmed(decided, p.space, p.host, p.guest);
    // 🏦계좌가 없으면 메일에 등록 한 줄이 붙는다(09-17).
    await notifyBookingConfirmedToHost(decided, p.space, p.host, p.guest, await hasPayoutAccount(uid));
  });
  return { ok: true, message: "수락했어요. 아래에 손님 연락처가 열렸어요." };
}

/** 취소 환불액 — 견적과 실제 취소가 **같은 계산**을 써야 한다. 둘이 따로 계산하면 팝업엔 70%라 적고 50%만 돌려주는 날이 온다. */
function cancelRefund(b: SpaceBooking, paidAt?: string): { rate: number; refund: number } {
  // 🩸09-16까지 `new Date(useDate)`를 썼다. 그건 **UTC 자정 = KST 오전 9시**라, 낮에 취소하면 남은 날이
  //   하루씩 모자랐다 — 전날 오전 10시 취소가 50% 대신 0%, 7일 전 오전 10시가 100% 대신 70%.
  //   규정의 「이용일 N일 전」은 한국 달력의 날짜 차이다. 시각을 빼고 날짜끼리 뺀다.
  const days = kstDaysUntil(b.useDate);
  // ⏳결제한 지 얼마나 됐나 — 1시간 안이면 남은 날과 무관하게 전액이다(대표 09-16).
  //   🩸09-17 QA: 예약 행이 생긴 시각(결제창을 연 때)부터 셌다. 결제 화면에 오래 머문 손님은 결제 뒤 한 시간을 다 못 받았다.
  //     화면은 「결제하고 1시간 안에」라고 말하니 승인 시각부터 센다. 승인 기록이 없는 옛 예약만 행 생성 시각으로.
  const mins = minutesSincePaid(b, paidAt);
  const rate = guestCancelRefundRate(days, mins);
  return { rate, refund: Math.floor(b.amountTotal * rate) };
}

function minutesSincePaid(b: SpaceBooking, paidAt?: string): number {
  return Math.floor((Date.now() - new Date(paidAt || b.createdAt).getTime()) / 60_000);
}

/** 취소 «전» 팝업에 보여줄 환불액. 환불표는 서버 전용 파일(`rent-payment.ts`)에만 있다 —
 *  화면에 표를 다시 적으면 표가 바뀌는 날 화면만 뒤처진다. 그래서 화면은 늘 이걸 부른다. */
export async function quoteCancelAction(
  bookingId: number,
): Promise<{ ok: boolean; message: string; total: number; refund: number; rate: number; daysBefore: number; grace: boolean }> {
  const none = { total: 0, refund: 0, rate: 0, daysBefore: 0, grace: false };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요.", ...none };
  const b = await getBooking(bookingId);
  if (!b || b.guestUserId !== uid) return { ok: false, message: "내 신청만 볼 수 있어요.", ...none };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 신청이에요.", ...none };
  if (bookingStarted(b)) return { ok: false, message: "이미 시작한 예약은 취소할 수 없어요.", ...none };
  const pay = await getPaymentByOrderId(b.orderId);
  const { rate, refund } = cancelRefund(b, pay?.approvedAt);
  // 💬09-17 QA — 팝업이 「왜 그 %인지」를 한 줄로 말하게 재료를 같이 준다. 비율은 위 계산 그대로고,
  //   이 둘은 설명에만 쓴다(`cancelRefund`와 같은 식으로 센다).
  const daysBefore = kstDaysUntil(b.useDate);
  const grace = minutesSincePaid(b, pay?.approvedAt) <= GRACE_MINUTES;
  return { ok: true, message: "", total: b.amountTotal, refund, rate, daysBefore, grace };
}

/** 게스트 취소 — 환불률은 우리 규정표가 정한다(호스트 자율 금지). */
export async function cancelBookingAction(bookingId: number): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };
  const b = await getBooking(bookingId);
  if (!b || b.guestUserId !== uid) return { ok: false, message: "내 예약만 취소할 수 있어요." };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 신청이에요." };
  // 🚨이미 시작한 예약은 취소할 수 없다(09-16). 막지 않으면 다 쓴 예약을 「취소」로 바꿔
  //   환불은 0원인데 사장님 정산에서 통째로 빠진다. 화면도 버튼을 숨기지만 관문은 여기다.
  if (bookingStarted(b)) return { ok: false, message: "이미 시작한 예약은 취소할 수 없어요." };

  const pay = await getPaymentByOrderId(b.orderId);
  if (!pay) return { ok: false, message: "결제 기록을 찾지 못해 취소하지 않았어요. 문의해 주세요." };

  const { refund } = cancelRefund(b, pay.approvedAt);
  if (refund > 0) {
    const r = await cancelPayment(
      pay.paymentKey || b.paymentKey, "게스트 취소",
      refund >= pay.balanceAmount ? undefined : refund, pay.balanceAmount,
    );
    // 🩸09-16까지 이 결과를 안 봤다. 토스 환불이 실패해도 상태는 「취소」가 됐고 손님에겐
    //   「환불됩니다」라고 말했다. 돈은 안 돌아갔는데 예약은 사라진다. 실패면 아무것도 바꾸지 않는다.
    if (!r.ok) return { ok: false, message: "환불을 처리하지 못해 취소하지 않았어요. 잠시 뒤 다시 시도해 주세요." };
    // 💸예약 cancelled + 결제 CANCELED/PARTIAL_CANCELED(남은 돈)를 같이. 약관 제8조의 «남은 돈»이 여기 적힌다.
    // 🔁기록이 한 번 실패하면 한 번 더 한다(09-16 점검 v2). 환불은 이미 나갔는데 결제 줄이 DONE으로 남으면,
    //   이용일이 지나 정리 작업이 돌 때 «돌려준 돈»까지 사장님 지급 대기에 올라갈 수 있다.
    //   두 번 다 실패하면 크게 남긴다 — 정산 화면에서 사람이 봐야 하는 자리다.
    let synced = await rentSync(b.orderId, { bookingStatus: "cancelled", toss: r.payment });
    if (!synced.ok) synced = await rentSync(b.orderId, { bookingStatus: "cancelled", toss: r.payment });
    if (!synced.ok) console.error(`[rent-actions] 🚨🚨환불은 됐는데 상태 기록이 두 번 실패 — 수동 확인 필요 order=${b.orderId}`);
  } else {
    // 당일 취소 — 돈은 그대로 남는다(결제 DONE). 이용일이 지나면 그 돈은 사장님 몫으로 지급 대기에 오른다.
    await rentSync(b.orderId, { bookingStatus: "cancelled" });
  }
  revalidatePath("/rent/my");
  await safeNotify(async () => {
    const p = await notifyParties(b);
    if (!p) return;
    // 📨대표 09-16 — 취소 완료 때 사장님과 손님 둘 다. 손님 메일엔 실제로 돌려드린 금액을 넘긴다(다시 계산하지 않는다).
    await notifyBookingCancelled({ ...b, status: "cancelled" }, p.space, p.host, p.guest);
    await notifyBookingCancelledToGuest({ ...b, status: "cancelled" }, p.space, p.host, p.guest, refund);
  });
  // ✍️09-17 — 「환불됩니다」·「없습니다」 피동·합니다체를 걷었다. 누가 돌려주는지 주어가 보이게.
  return { ok: true, message: refund > 0 ? `취소했어요. ${refund.toLocaleString()}원을 돌려드릴게요.` : "취소했어요. 당일 취소라 돌려드릴 돈은 없어요." };
}

/** 화면에서 금액을 보여줄 때 쓰는 계산 — 호스트에게 얼마가 가는지 정직하게 적기 위한 것. */
export async function quotePayout(total: number): Promise<{ fee: number; payout: number; rate: number }> {
  const out = payout(total);
  return { fee: total - out, payout: out, rate: FEE_RATE };
}

// 🔻`markPaidOutAction`(대표가 손으로 입금했다고 적는 버튼)은 09-16에 지웠다.
//   정산은 토스 «지급대행»이다 — 돈이 우리 계좌를 거치지 않는다(볼트 [[결제-모듈-토스]], 대표 확정).

// ─── 사장님의 «관리자에게 환불 신청» (대표 09-16) ───
// 확정된 예약을 사장님 사정으로 무를 땐 사장님이 바로 환불하지 않는다. 신청 → 우리가 사장님·손님께 전화로 확인
// → 관리자 승인 → 전액 환불. 숙박업이 이렇게 한다(대표). 신청 중에도 예약은 원래 상태로 살아 있다.

/** 사장님이 신청한다. 🔒권한 = 그 공간의 주인. */
export async function requestRefundAction(bookingId: number, note: string): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };
  const b = await getBooking(bookingId);
  if (!b) return { ok: false, message: "그 예약을 찾지 못했어요." };
  const mine = await listSpacesByOwner(uid);
  if (!mine.some((x) => x.id === b.spaceId)) return { ok: false, message: "내 공간의 예약만 신청할 수 있어요." };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 예약이에요." };
  // 수락 전(결제 완료)이고 아직 시작 전이면 거절이 곧 전액 환불이다. 관리자 승인은 확정 뒤에만 거친다(대표 09-16).
  if (b.status === "paid" && !bookingStarted(b)) {
    return { ok: false, message: "아직 수락 전이라 거절하시면 손님께 바로 전액 돌아가요." };
  }
  if (b.refundRequestedAt) return { ok: true, message: "이미 신청하셨어요. 저희가 곧 연락드릴게요." };
  const saved = await requestRefund(bookingId, note.trim());
  if (!saved) return { ok: false, message: "신청을 받지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  revalidatePath("/rent/my");
  revalidatePath("/rent/payouts");
  return { ok: true, message: "환불 신청을 받았어요. 사장님과 손님께 전화로 확인한 뒤 처리해 드릴게요." };
}

/** 관리자가 승인한다 — 손님께 «남은 돈 전액»을 돌려주고 예약 refunded + 결제 CANCELED를 같이 옮긴다. 🔒대표만. */
export async function approveRefundAction(bookingId: number): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  if (!(await isRentAdmin())) return { ok: false, message: "권한이 없어요." };
  const b = await getBooking(bookingId);
  if (!b || !b.refundRequestedAt) return { ok: false, message: "환불 신청이 없는 예약이에요." };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 예약이에요." };
  const pay = await getPaymentByOrderId(b.orderId);
  if (!pay) return { ok: false, message: "결제 기록을 찾지 못했어요." };
  const refundAmount = pay.balanceAmount;
  const r = await cancelPayment(pay.paymentKey || b.paymentKey, "사장님 사정 — 관리자 승인 전액 환불", undefined, refundAmount);
  if (!r.ok) return { ok: false, message: "토스 환불이 실패했어요. 토스 관리자 화면에서 확인해 주세요." };
  let synced = await rentSync(b.orderId, { bookingStatus: "refunded", toss: r.payment });
  if (!synced.ok) synced = await rentSync(b.orderId, { bookingStatus: "refunded", toss: r.payment });
  if (!synced.ok) console.error(`[rent-actions] 🚨🚨관리자 환불은 됐는데 기록 실패 — 수동 확인 order=${b.orderId}`);
  revalidatePath("/rent/payouts");
  revalidatePath("/rent/my");
  // 📨대표 09-16 — 관리자 승인 환불도 «취소 완료»라 손님과 사장님 둘 다에게.
  await safeNotify(async () => {
    const p = await notifyParties(b);
    if (p) await notifyAdminRefund({ ...b, status: "refunded" }, p.space, p.host, p.guest, refundAmount);
  });
  return { ok: true, message: `${refundAmount.toLocaleString()}원을 손님께 돌려드렸어요.` };
}

/** 관리자가 신청을 닫는다 — 확인해 보니 환불할 일이 아니었을 때. 예약은 그대로. 🔒대표만. */
export async function dismissRefundAction(bookingId: number): Promise<ActionResult> {
  if (await rentMockOn()) return { ...RENT_MOCK_BLOCKED };
  if (!(await isRentAdmin())) return { ok: false, message: "권한이 없어요." };
  const ok = await clearRefundRequest(bookingId);
  revalidatePath("/rent/payouts");
  revalidatePath("/rent/my");
  return ok ? { ok: true, message: "신청을 닫았어요. 예약은 그대로예요." } : { ok: false, message: "닫지 못했어요." };
}
