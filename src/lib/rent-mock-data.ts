// 하루 가게 — 디자인 확인용 목 데이터 (2026-09-17 대표: 「mock data로 해도 충분해」)
//
// ⭐화면은 안 고치고 «읽기 함수가 돌려주는 값»만 이걸로 갈아 끼운다(`rent-mock.ts`). 그래서 여기 적는 건
//   DB 행이 아니라 읽기 함수가 내놓는 타입(`Space`·`SpaceBooking`·`Payment`…) 그대로다. `satisfies`로 모양을 잠가
//   타입에 칸이 늘면 tsc가 이 파일에서 멈춘다.
// ⛔실제 파트너 이름·계정은 한 글자도 안 쓴다. 이름은 전부 지어낸 것이고(볼트 grep 0건 확인), 주소는 실재하는
//   서울 길 이름에 가상 번지다. 사진은 `public/preview`가 실제 소개서 캡처라 못 쓰고, 색면 SVG를 즉석에서 만든다.
// ⏱날짜는 «오늘(KST)» 기준으로 매번 만든다. 「앞으로 갈 곳」·「이용일 지남」 같은 갈래가 시간에 달려 있어서
//   고정 날짜로 적으면 내일이면 케이스가 틀어진다.
// 🚨서버 전용. `rent-mock.ts`만 부른다.
import type { Maker, Payment, PaymentStatus, PayoutStatus, RepeatRule, Space, SpaceBooking, OpenSlot } from "./types";
import type { Profile } from "./profiles";
import type { PayoutAccount } from "./payout-accounts";
import { addDaysIso, expandRepeat, hoursBetween, todayKst } from "./rent-time";
import { bookingAmount, compatScopePrice, productsFromLegacy } from "./rent-products";
// 🔢정산액은 서버(`payout`)와 같은 정수 계산 함수로(09-18 밤 QA SEC-03). 이 파일은 import가 없어 고리가 안 생긴다.
import { payoutAmount } from "./rent-money";

/** `spaces.ts`의 `FEE_RATE`와 같은 값. ⚠️거기서 가져오면 spaces → rent-mock → 이 파일 → spaces로 고리가 생겨 따로 적었다. */
const MOCK_FEE_RATE = 0.15;

export interface MockWorld {
  spaces: Space[];
  bookings: SpaceBooking[];
  payments: Payment[];
  profiles: Profile[];
  makers: Maker[];
  payoutAccounts: PayoutAccount[];
}

export interface MockViewer {
  /** null = 로그인 안 한 사람 */
  userId: number | null;
  admin: boolean;
  /** 매거진 편집자인가(09-18 사이트 지도). 없으면 아니다. `magazine-auth.ts`가 목 모드에서 이 값만 본다. */
  editor?: boolean;
}

export interface MockCaseDef {
  id: string;
  /** 지도·띠에 보이는 한국어 설명 */
  label: string;
  viewer: MockViewer;
  world: "full" | "full-noaccount" | "empty" | "stress" | "minimal";
}

// ─── 사람 ───

export const MOCK_USER = {
  host: 9001, guest: 9002, admin: 9003, host2: 9004,
  stressHost: 9005, stressGuest: 9006, guest2: 9007, minHost: 9008, minGuest: 9009,
  /** 09-18 사이트 지도 — 가입만 하고 브랜드명을 비워 둔 새 회원(09-17부터 가입 브랜드명이 선택이다). */
  newbie: 9010,
} as const;

/** 목 사용자 번호의 하한. 이보다 작으면 실제 DB로 보낸다(`profiles.ts`·`repo.ts`). */
export const MOCK_USER_MIN = 9000;
/** 목 소개서·공간 주소 앞머리. 이 모양이면 실제 DB로 안 간다. */
export const MOCK_SLUG_PREFIX = "mock-";

export const MOCK_CASES: MockCaseDef[] = [
  { id: "guest-full", label: "손님 · 모든 상태의 신청이 있는 계정", viewer: { userId: MOCK_USER.guest, admin: false }, world: "full" },
  { id: "guest-empty", label: "손님 · 신청 0건, 공간도 0곳", viewer: { userId: MOCK_USER.guest, admin: false }, world: "empty" },
  { id: "anon", label: "로그인 안 한 사람", viewer: { userId: null, admin: false }, world: "full" },
  { id: "host-full", label: "사장님 · 공간 넷, 요청 모든 상태, 계좌 있음", viewer: { userId: MOCK_USER.host, admin: false }, world: "full" },
  { id: "host-noaccount", label: "사장님 · 같은 데이터인데 정산 계좌 없음", viewer: { userId: MOCK_USER.host, admin: false }, world: "full-noaccount" },
  { id: "host-admin", label: "사장님이면서 관리자 · 정산하기 링크와 공개하기 버튼이 보임", viewer: { userId: MOCK_USER.host, admin: true }, world: "full" },
  { id: "host-empty", label: "사장님 · 아직 올린 공간 없음", viewer: { userId: MOCK_USER.host, admin: false }, world: "empty" },
  { id: "admin-full", label: "관리자 · 환불 신청·보낼 돈·손이 필요한 예약", viewer: { userId: MOCK_USER.admin, admin: true }, world: "full" },
  { id: "admin-empty", label: "관리자 · 처리할 것 없음", viewer: { userId: MOCK_USER.admin, admin: true }, world: "empty" },
  { id: "stress-guest", label: "긴 글 · 손님으로 보기", viewer: { userId: MOCK_USER.stressGuest, admin: false }, world: "stress" },
  { id: "stress-host", label: "긴 글 · 사장님으로 보기", viewer: { userId: MOCK_USER.stressHost, admin: false }, world: "stress" },
  { id: "stress-admin", label: "긴 글 · 관리자로 보기", viewer: { userId: MOCK_USER.admin, admin: true }, world: "stress" },
  { id: "minimal-guest", label: "최소 입력 · 손님으로 보기", viewer: { userId: MOCK_USER.minGuest, admin: false }, world: "minimal" },
  { id: "minimal-host", label: "최소 입력 · 사장님으로 보기", viewer: { userId: MOCK_USER.minHost, admin: false }, world: "minimal" },
  // 🗺09-18 사이트 전체 지도(`/dev/map`)가 더한 케이스. 세계는 하루 가게와 같고, 소개서·매거진·찜·리포트 층은
  //   `site-mock-data.ts`가 그 위에 얹는다. 같은 가상 인물(느린오후·밀가루 일기)이 두 서비스에 이어서 나온다.
  { id: "member-full", label: "브랜드 회원 · 소개서 셋, 찜·리포트·성사 기록·요약 리포트 있음", viewer: { userId: MOCK_USER.host, admin: false }, world: "full" },
  { id: "member-new", label: "새 회원 · 브랜드명 비움, 소개서 없음", viewer: { userId: MOCK_USER.newbie, admin: false }, world: "full" },
  { id: "editor", label: "매거진 편집자 · 초안까지 보임", viewer: { userId: MOCK_USER.admin, admin: true, editor: true }, world: "full" },
  { id: "stress-editor", label: "긴 글 · 매거진 편집자로 보기", viewer: { userId: MOCK_USER.admin, admin: true, editor: true }, world: "stress" },
];

function profile(id: number, brandName: string, phone: string, email: string): Profile {
  return { id, uuid: `mock-uuid-${id}`, brandName, phone, email, profileImage: "" } satisfies Profile;
}

// ─── 사진 ───

/** 색면 사진 한 장. 비율을 섞어 두면 슬라이더·커버가 세로 사진에서 어떻게 잘리는지도 같이 본다. */
export function photo(label: string, hue: number, w = 1200, h = 800): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},38%,78%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},32%,52%)"/>` +
    `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" ` +
    `font-size="${Math.round(Math.min(w, h) / 12)}" fill="rgba(255,255,255,.92)">${label}</text>` +
    `<text x="50%" y="${Math.round(h / 2 + Math.min(w, h) / 9)}" text-anchor="middle" font-family="sans-serif" ` +
    `font-size="${Math.round(Math.min(w, h) / 22)}" fill="rgba(255,255,255,.75)">${w}×${h} 목 사진</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ─── 공간 ───

const SPACE_BASE = {
  brandSlug: "", tagline: "", body: "", photos: [] as string[], area: "", address: "",
  lat: undefined, lng: undefined, accessNote: "",
  useType: "both" as Space["useType"], facilities: [] as string[], facilitiesNote: "", capacity: undefined,
  hours: "", rules: "", priceDay: 0, mentorMinutes: 0, mentorPrice: 0, openDates: [] as string[],
  servesFood: false, subleaseOk: true,
  category: "" as Space["category"], scope: "space_only" as Space["scope"],
  priceHour: 0, minHours: 1, openSlots: [] as OpenSlot[], repeatWeekly: [] as RepeatRule[],
  rentSpaceOn: false, rentSpacePrice: 0, rentSpaceNote: "", rentFullOn: false, rentFullPrice: 0, rentFullNote: "",
  coffeeChat: false, coffeeChatMinutes: 0, coffeeChatPrice: 0, coffeeChatTopics: "",
  accessHow: "sms" as Space["accessHow"], contactPhone: "", hostTermsAt: undefined,
  // 🧾🏪09-18 기본은 «아무것도 없음» — 사업자 확인 전 · 네이버 매칭 없음(옛 공간과 같은 모습).
  bizNumber: "", bizOwnerName: "", bizOpenDate: "", bizCertPath: "",
  bizCheckStatus: "none" as Space["bizCheckStatus"], bizCheckDetail: undefined, bizCheckedAt: undefined, bizApprovedAt: undefined,
  placeName: "", placeAddress: "", placeLat: undefined, placeLng: undefined, placeMatchedAt: undefined,
} satisfies Omit<Space, "id" | "slug" | "ownerUserId" | "name" | "status" | "createdAt" | "updatedAt">;

/** 🧾09-18 목 사업자 정보. ⛔실제 사업자와 겹치지 않게 번호는 전부 «000»으로 시작한다(세무서 코드 000은 없다).
 *  검증번호(마지막 자리)는 규칙대로 맞춰 둬서 폼·서버 검사를 통과하는 모양이다. 등록증은 가짜 경로라 열면 안내 문구만 뜬다. */
function bizOf(
  userId: number, n: string, owner: string, open: string, ext: "jpg" | "png" | "pdf", uuidTail: string,
): Pick<Space, "bizNumber" | "bizOwnerName" | "bizOpenDate" | "bizCertPath"> {
  return { bizNumber: n, bizOwnerName: owner, bizOpenDate: open, bizCertPath: `${userId}/00000000-0000-4000-8000-${uuidTail}.${ext}` };
}

function space(
  p: Pick<Space, "id" | "slug" | "ownerUserId" | "name" | "status"> & Partial<Space> & { direct?: OpenSlot[] },
  today: string,
): Space {
  const { direct, ...rest } = p;
  const repeatWeekly = rest.repeatWeekly ?? [];
  const at = `${addDaysIso(today, -30)}T01:00:00.000Z`;
  // 🛍09-18 상품 셋. 상품을 안 적은 공간은 `toSpace`가 SQL 전 DB를 읽을 때처럼 옛 범위·값에서 만든다.
  //   상품을 적었으면 옛 칸 둘은 저장(`saveSpaceAction`)과 같은 호환 값으로 맞춘다.
  const hasProducts = rest.rentSpaceOn !== undefined || rest.rentFullOn !== undefined;
  const products = hasProducts
    ? { ...productsFromLegacy("space_only", 0), rentSpaceOn: false, rentFullOn: false, ...pickProducts(rest) }
    : productsFromLegacy(rest.scope ?? "space_only", rest.priceHour ?? 0);
  return {
    ...SPACE_BASE,
    createdAt: at,
    updatedAt: at,
    ...rest,
    ...products,
    ...(hasProducts ? compatScopePrice(products) : {}),
    repeatWeekly,
    // `toSpace`와 똑같이 «읽을 때 펼친» 값을 담는다.
    openSlots: expandRepeat(direct ?? [], repeatWeekly, today),
  } satisfies Space;
}

function pickProducts(p: Partial<Space>) {
  const out: Partial<Space> = {};
  for (const k of ["rentSpaceOn", "rentSpacePrice", "rentSpaceNote", "rentFullOn", "rentFullPrice", "rentFullNote"] as const) {
    if (p[k] !== undefined) (out as Record<string, unknown>)[k] = p[k];
  }
  return out;
}

// ─── 예약·결제 ───

/** 🛍09-18 — 값은 공간을 넘겨 «고른 상품 값 × 시간»으로 만든다. 서버(`startBookingAction`)와 같은 함수다. */
type BookingSeed = Pick<SpaceBooking, "id" | "spaceId" | "guestUserId" | "status" | "useDate" | "startTime" | "endTime" | "plan">
  & Partial<SpaceBooking> & { sp: Space };

function booking(p: BookingSeed, today: string): SpaceBooking {
  const { sp, ...rest } = p;
  const hoursCount = hoursBetween(p.startTime, p.endTime);
  // 사장님이 안 파는 상품을 적은 시드면 켜진 쪽으로 물러선다(목 데이터가 조용히 0원을 만들지 않게).
  const product = p.product ?? (sp.rentSpaceOn ? "space" : "full");
  const amt = bookingAmount(sp, product, hoursCount, !!p.withChat)
    ?? bookingAmount(sp, product === "space" ? "full" : "space", hoursCount, !!p.withChat);
  const amountSpace = amt?.space ?? 0;
  const amountChat = amt?.chat ?? 0;
  const amountTotal = amountSpace + amountChat;
  // 🕒09-18 밤 — 앞으로 있을 «결제 전» 신청은 «방금» 만든 것으로 둔다. 결제 시간(30분)이 생기면서
  //   이틀 전으로 만들면 목 결제 화면이 늘 「시간이 지났어요」로만 보였다(지난 날짜 신청은 그대로 둔다).
  const fresh = rest.status === "pending" && p.useDate >= today;
  const at = fresh
    ? new Date(Date.now() - 3 * 60 * 1000).toISOString()
    : `${addDaysIso(p.useDate < today ? p.useDate : today, -2)}T03:${String(p.id % 60).padStart(2, "0")}:00.000Z`;
  return {
    // 🪪guestName 빈 값 = 성함 칸이 생기기 전 옛 예약. 화면·메일이 프로필 브랜드명으로 물러서는 모양을 같이 본다.
    guestBrandSlug: "", guestPhone: "", guestName: "", hours: "", headcount: undefined,
    withMentor: false, amountMentor: 0, withChat: false,
    feeRate: MOCK_FEE_RATE, paymentKey: `mock-pay-${p.id}`, orderId: `mock-order-${p.id}`,
    refundRequestedAt: undefined, refundRequestNote: "", hostMessage: "", decidedAt: undefined, remindedAt: undefined,
    createdAt: at, updatedAt: at,
    ...rest,
    product, hoursCount, amountSpace, amountChat, amountTotal,
    amountPayout: payoutAmount(amountTotal, MOCK_FEE_RATE),
  } satisfies SpaceBooking;
}

function payment(
  b: SpaceBooking, sellingUserId: number,
  p: { status: PaymentStatus; balance?: number; payoutStatus?: PayoutStatus; payoutDoneAt?: string; method?: string },
): Payment {
  const balance = p.balance ?? (p.status === "DONE" ? b.amountTotal : p.status === "CANCELED" ? 0 : b.amountTotal);
  const paid = p.status !== "READY" && p.status !== "EXPIRED";
  return {
    id: b.id, orderId: b.orderId, paymentKey: paid ? b.paymentKey : "", purpose: "rent_booking",
    bookingId: b.id, buyingUserId: b.guestUserId, sellingUserId,
    amount: b.amountTotal, balanceAmount: balance, method: p.method ?? (paid ? "카드" : ""),
    status: p.status,
    approvedAt: paid ? b.createdAt : undefined,
    canceledAt: p.status === "CANCELED" || p.status === "PARTIAL_CANCELED" ? b.updatedAt : undefined,
    feeRate: MOCK_FEE_RATE,
    payoutAmount: payoutAmount(balance, MOCK_FEE_RATE),
    payoutStatus: p.payoutStatus ?? "NONE",
    payoutRequestedAt: p.payoutStatus === "REQUESTED" || p.payoutStatus === "DONE" || p.payoutStatus === "FAILED" ? b.updatedAt : undefined,
    payoutDoneAt: p.payoutDoneAt,
    createdAt: b.createdAt, updatedAt: b.updatedAt,
  } satisfies Payment;
}

// ─── 소개서 ───

export function maker(p: Pick<Maker, "id" | "slug" | "name" | "oneLiner" | "ownerUserId"> & Partial<Maker>): Maker {
  return {
    region: "서울", offers: ["팝업", "워크숍"], seeks: ["공동콘텐츠"], targetAudience: [],
    collabHistory: [], description: "", story: "", activities: [], offersDescription: "", seeksDescription: "",
    photos: [], showcases: [], keywords: [], trust: {}, searchVisible: true, collabPaused: false,
    status: "active", createdAt: "2026-06-01T00:00:00.000Z",
    ...p,
  } satisfies Maker;
}

// ─── 세계 ───

const worldCache = new Map<string, MockWorld>();

/** 케이스가 가리키는 세계를 만든다. 같은 날 같은 세계는 한 번만 만든다(한 화면이 읽기 함수를 스무 번 넘게 부른다). */
export function buildWorld(kind: MockCaseDef["world"], today = todayKst()): MockWorld {
  const key = `${kind}:${today}`;
  const hit = worldCache.get(key);
  if (hit) return hit;
  const w =
    kind === "empty" ? emptyWorld()
      : kind === "stress" ? stressWorld(today)
        : kind === "minimal" ? minimalWorld(today)
          : fullWorld(today, kind === "full");
  worldCache.set(key, w);
  return w;
}

function emptyWorld(): MockWorld {
  return {
    spaces: [], bookings: [], payments: [], makers: [], payoutAccounts: [],
    profiles: [
      profile(MOCK_USER.host, "느린오후", "010-2345-6789", "host@example.com"),
      profile(MOCK_USER.guest, "밀가루 일기", "010-3456-7890", "guest@example.com"),
      profile(MOCK_USER.admin, "하루 가게 운영", "010-0000-0000", "admin@example.com"),
    ],
  };
}

/** 🗂풀 — 사장님·손님이 폼의 모든 칸을 채운 세계. 예약은 상태마다 한 건 이상. */
function fullWorld(today: string, withAccount: boolean): MockWorld {
  const d = (n: number) => addDaysIso(today, n);
  const U = MOCK_USER;

  const profiles = [
    profile(U.host, "느린오후", "010-2345-6789", "slow.afternoon@example.com"),
    profile(U.guest, "밀가루 일기", "010-3456-7890", "flour.diary@example.com"),
    profile(U.admin, "하루 가게 운영", "010-0000-0000", "admin@example.com"),
    profile(U.host2, "바늘숲 공방", "010-4567-8901", "needle.forest@example.com"),
    profile(U.guest2, "낮은책상", "010-5678-9012", "low.desk@example.com"),
  ];

  const makers = [
    maker({
      id: 9901, slug: "mock-slow-afternoon", name: "느린오후 로스터리", ownerUserId: U.host,
      oneLiner: "동네 사람들이 오후를 천천히 보내는 작은 로스터리예요.",
      region: "서울 성동", keywords: ["로스팅", "동네 카페", "원데이 클래스"],
      description: "성수동 골목 2층에서 원두를 볶고 커피를 내려요. 평일 오후엔 동네 분들이 책을 읽다 가시고, 주말엔 작은 클래스를 열어요.",
      story: "회사 다니며 주말마다 원두를 볶다가 가게를 열었어요.\n쉬는 월요일마다 비어 있는 2층이 아까워 하루 가게에 올렸어요.",
      photos: [photo("느린오후 로스터리 1층", 28), photo("로스팅 기계", 18, 900, 1200), photo("창가 자리", 45)],
      activities: [
        { title: "월간 핸드드립 클래스", desc: "한 달에 한 번, 여섯 분과 원두 세 가지를 내려 봐요.", photos: [photo("드립 클래스", 32)] },
        { title: "동네 책 교환 선반", desc: "다 읽은 책을 두고 가시면 다른 분이 가져가요.", photos: [] },
      ],
      collabHistory: [
        { partner: "가상 베이커리 한 곳", types: ["팝업"], desc: "주말 이틀 동안 2층에서 빵과 커피를 같이 냈어요.", year: "2026", photos: [photo("팝업 현장", 12)] },
      ],
      trust: { instagram: "https://www.instagram.com/example", address: "서울 성동구 연무장길 00" },
    }),
    maker({
      id: 9902, slug: "mock-flour-diary", name: "밀가루 일기", ownerUserId: U.guest,
      oneLiner: "매일 구운 빵을 기록하는 홈베이커리예요. 가게를 열어 보기 전에 하루씩 연습하고 있어요.",
      region: "서울 마포", keywords: ["홈베이킹", "팝업 준비"],
      description: "집에서 굽던 사워도우를 동네 분들께 나누다가, 언젠가 작은 빵집을 열고 싶어졌어요.",
      photos: [photo("사워도우", 38), photo("오븐 앞", 22, 1080, 1350)],
    }),
  ];

  // 🟢S1 — 풀. 폼의 모든 칸이 차 있다.
  const s1 = space({
    id: 9101, slug: "mock-slow-afternoon-2f", ownerUserId: U.host, status: "open",
    name: "느린오후 로스터리 2층", brandSlug: "mock-slow-afternoon",
    category: "cafe", scope: "with_gear", useType: "both",
    body:
      "성수동 골목 안쪽 2층이에요. 남향 창이 두 면이라 오후 네 시까지 조명 없이도 밝아요.\n\n" +
      "평소엔 로스팅 클래스와 소규모 모임에 쓰는 방이라 긴 원목 테이블 하나와 의자 열두 개가 있어요. " +
      "에스프레소 머신과 그라인더도 같이 쓰실 수 있어서, 카페 창업을 준비하시는 분이 하루 운영을 연습해 보기 좋아요.\n\n" +
      "1층 로스터리는 정상 영업 중이라 커피 향이 계속 올라와요. 조용한 촬영보다는 사람이 오가는 행사에 잘 맞아요.",
    photos: [
      photo("2층 전경", 30), photo("원목 테이블", 24, 1200, 900), photo("에스프레소 머신", 12, 900, 1200),
      photo("창가 오후 빛", 44), photo("계단 입구", 200, 800, 1200), photo("1층 로스터리", 20),
    ],
    area: "성수동", address: "서울 성동구 연무장길 00, 2층",
    lat: 37.5436, lng: 127.0559,
    facilities: ["에스프레소 머신", "그라인더", "냉장고", "와이파이", "빔프로젝터", "블루투스 스피커", "화장실(건물 공용)", "원목 테이블 1", "의자 12"],
    facilitiesNote:
      "빔프로젝터는 HDMI 단자만 있어요. 맥북을 쓰시면 변환 젠더를 챙겨 주세요.\n머신 원두는 따로 가져오셔야 해요. 1층에서 사시면 10% 빼 드려요.",
    capacity: 14,
    rules:
      "쓰신 컵과 도구는 설거지해서 제자리에 둬 주세요\n벽에 테이프·못은 안 돼요. 이젤은 빌려 드려요\n밤 9시 이후엔 1층 이웃을 위해 음악을 줄여 주세요\n음식은 포장해 온 것만 드실 수 있어요\n나가실 때 창문과 머신 전원을 꺼 주세요",
    minHours: 3,
    // 🛍둘 다 켠 공간 — 값과 설명이 다르다(09-18).
    rentSpaceOn: true, rentSpacePrice: 18000,
    rentSpaceNote: "촬영·모임·작은 전시에 좋아요. 원목 테이블과 의자 열두 개, 창가 자리를 써요. 머신과 그라인더는 못 써요.",
    rentFullOn: true, rentFullPrice: 30000,
    rentFullNote: "일일카페·팝업 운영까지 할 수 있어요. 에스프레소 머신·그라인더·냉장고를 같이 써요. 원두는 직접 가져오셔야 해요.",
    coffeeChat: true, coffeeChatMinutes: 60, coffeeChatPrice: 30000,
    coffeeChatTopics:
      "첫 가게 보증금과 인테리어에 얼마 들었는지\n원두 거래처를 어떻게 골랐는지\n혼자 운영하면서 쉬는 날을 어떻게 지키는지",
    accessHow: "both", contactPhone: "02-123-4567", hostTermsAt: `${d(-30)}T01:00:00.000Z`,
    // 🧾🏪신뢰 표시 둘 다 — 국세청 일치 + 관리자 승인 + 네이버 상호 일치.
    ...bizOf(U.host, "0000112347", "김느린", "20210315", "jpg", "000000009101"),
    bizCheckStatus: "valid", bizCheckedAt: `${d(-30)}T01:00:00.000Z`, bizApprovedAt: `${d(-29)}T02:00:00.000Z`,
    bizCheckDetail: { valid: "01", bSttCd: "01", bStt: "계속사업자", taxType: "부가가치세 일반과세자" },
    placeName: "느린오후 로스터리", placeAddress: "서울특별시 성동구 연무장길 00",
    placeLat: 37.5436, placeLng: 127.0559, placeMatchedAt: `${d(-30)}T01:00:00.000Z`,
    repeatWeekly: [
      { dow: 1, start: "09:00", end: "18:00", skip: [nextDow(today, 1, 2)] },
      { dow: 2, start: "12:00", end: "21:00" },
    ],
    direct: [
      { date: d(3), start: "10:00", end: "20:00" },
      { date: d(5), start: "10:00", end: "18:00" },
      { date: d(6), start: "14:00", end: "22:00" },
      { date: d(10), start: "09:00", end: "21:00" },
      { date: d(14), start: "10:00", end: "18:00" },
    ],
  }, today);

  // 🟡S2 — 검토 대기
  const s2 = space({
    id: 9102, slug: "mock-slow-afternoon-showroom", ownerUserId: U.host, status: "pending",
    name: "느린오후 지하 쇼룸", brandSlug: "mock-slow-afternoon", category: "shop", scope: "whole_shop",
    body: "원두 포장재와 굿즈를 두던 지하 공간이에요. 이번에 비워서 팝업용으로 내놓아요.",
    photos: [photo("지하 쇼룸", 260), photo("진열대", 240, 900, 1200)],
    area: "성수동", address: "서울 성동구 연무장길 00, 지하 1층", lat: 37.5436, lng: 127.0559,
    facilities: ["진열대 4", "조명 레일", "와이파이"], facilitiesNote: "환기창이 없어서 향초는 피해 주세요.",
    capacity: 20, rules: "진열대는 옮기지 말아 주세요\n쓰레기는 가져가 주세요",
    minHours: 4, accessHow: "sms", contactPhone: "02-123-4567",
    // 🧾검토 대기 ① 국세청 기록과 다름 — 공개하기를 누르면 막힌다. 네이버 매칭 없음(이름이 안 맞는다).
    ...bizOf(U.host, "0000212344", "김느린", "20230901", "pdf", "000000009102"),
    bizCheckStatus: "mismatch", bizCheckedAt: `${d(-1)}T03:00:00.000Z`,
    bizCheckDetail: { valid: "02", validMsg: "확인할 수 없습니다" },
    rentFullOn: true, rentFullPrice: 18000, rentFullNote: "팝업 매장을 통째로 꾸려요. 진열대 네 개와 조명 레일을 마음대로 쓰세요.",
    direct: [{ date: d(9), start: "11:00", end: "19:00" }],
  }, today);

  // ⏸S3 — 쉬는 중
  const s3 = space({
    id: 9103, slug: "mock-slow-afternoon-rooftop", ownerUserId: U.host, status: "paused",
    name: "느린오후 옥상", brandSlug: "", category: "lounge", scope: "space_only",
    body: "날 좋은 계절에만 여는 옥상이에요. 겨울 동안은 잠시 쉬어요.",
    photos: [photo("옥상", 190)], area: "성수동", address: "서울 성동구 연무장길 00, 옥상",
    facilities: ["파라솔 2", "캠핑 의자 8"], capacity: 10, rules: "난간에 기대지 말아 주세요",
    minHours: 2, accessHow: "onsite", contactPhone: "02-123-4567",
    // 🧾쉬는 중인데 사업자 정보를 새로 채움 → 관리자 검토의 「확인 표시만」 줄. 국세청 조회는 실패(네트워크).
    ...bizOf(U.host, "0000312341", "김느린", "20210315", "png", "000000009103"),
    bizCheckStatus: "error", bizCheckedAt: `${d(-2)}T03:00:00.000Z`, bizCheckDetail: { reason: "network" },
    rentSpaceOn: true, rentSpacePrice: 15000, rentSpaceNote: "야외 모임이나 촬영 자리로 써요. 파라솔 두 개와 캠핑 의자 여덟 개가 있어요.",
    repeatWeekly: [{ dow: 6, start: "13:00", end: "19:00" }],
  }, today);

  // ✏️S4 — 작성 중(초안)
  const s4 = space({
    id: 9104, slug: "mock-slow-afternoon-draft", ownerUserId: U.host, status: "draft",
    name: "느린오후 창고", category: "etc", area: "성수동", address: "서울 성동구 연무장길 00",
    rules: "아직 정리 중이에요", priceHour: 10000,
  }, today);

  // 🚫S5 — 공개 중인데 열린 시간이 없다
  const s5 = space({
    id: 9105, slug: "mock-needle-forest-bench", ownerUserId: U.host2, status: "open",
    name: "바늘숲 공방 작업대", category: "workshop", scope: "with_gear",
    body: "재봉틀 네 대가 있는 공방이에요. 이번 달은 수업이 꽉 차서 열어 둔 시간이 없어요.",
    photos: [photo("재봉틀 작업대", 330), photo("실타래 선반", 300, 1080, 1350)],
    area: "을지로", address: "서울 중구 을지로 000, 3층", lat: 37.5660, lng: 126.9910,
    facilities: ["재봉틀 4", "다리미", "재단 테이블"], capacity: 6,
    rules: "재봉틀 바늘이 부러지면 말씀해 주세요\n원단 자투리는 가져가셔도 돼요",
    minHours: 2, accessHow: "sms", contactPhone: "02-765-4321",
    // 🧾신뢰 표시 하나(사업자 확인만). 네이버엔 못 찾았다.
    ...bizOf(U.host2, "0000456782", "박바늘", "20190402", "jpg", "000000009105"),
    bizCheckStatus: "valid", bizCheckedAt: `${d(-40)}T01:00:00.000Z`, bizApprovedAt: `${d(-40)}T05:00:00.000Z`,
    bizCheckDetail: { valid: "01", bSttCd: "01", bStt: "계속사업자", taxType: "부가가치세 간이과세자" },
    // 🛍하나만 켠 공간 ① — 공간 전체만.
    rentFullOn: true, rentFullPrice: 20000, rentFullNote: "재봉 원데이 클래스를 열 수 있어요. 재봉틀 네 대와 다리미, 재단 테이블을 같이 써요.",
  }, today);

  // 🍽S6 — 다른 사장님, 커피챗·소개서 없음
  const s6 = space({
    id: 9106, slug: "mock-euljiro-evening", ownerUserId: U.host2, status: "open",
    name: "을지로 저녁 한 칸", category: "restaurant", scope: "space_only",
    body: "점심 장사만 하는 백반집이에요. 저녁 다섯 시부터는 비어 있어요.",
    photos: [photo("백반집 저녁", 8)], area: "을지로", address: "서울 중구 수표로 00, 1층",
    lat: 37.5657, lng: 126.9890, facilities: ["4인 테이블 5", "냉장고"], capacity: 20,
    rules: "주방 화구는 쓸 수 없어요\n가게 앞 입간판은 치우지 말아 주세요",
    minHours: 2, accessHow: "onsite", contactPhone: "02-777-0000",
    // 🏪신뢰 표시 하나(네이버만) — 09-18 전에 올린 옛 공간이라 사업자 정보가 비어 있다.
    placeName: "을지로 저녁", placeAddress: "서울특별시 중구 수표로 00 1층",
    placeLat: 37.5657, placeLng: 126.9890, placeMatchedAt: `${d(-20)}T01:00:00.000Z`,
    // 🛍하나만 켠 공간 ② — 대관만. 신청 폼에 고르기 없이 한 줄로 보인다.
    rentSpaceOn: true, rentSpacePrice: 30000, rentSpaceNote: "저녁 모임·시식회·북토크 자리로 써요. 4인 테이블 다섯 개와 냉장고 한 칸을 써요. 주방 화구는 못 써요.",
    direct: [{ date: d(2), start: "17:00", end: "22:00" }, { date: d(4), start: "17:00", end: "22:00" }],
  }, today);

  // 🧾S7 — 검토 대기 ② 국세청 키가 아직 없어 조회 전(none). 관리자가 등록증을 보고 열 수 있다(확인 표시는 안 붙는다).
  //   네이버엔 같은 건물의 「바늘숲 공방」이 있어 매칭됐다 — 검토 화면에서 네이버 상호·주소를 사장님이 적은 것과 나란히 본다.
  const s7 = space({
    id: 9109, slug: "mock-needle-forest-class", ownerUserId: U.host2, status: "pending",
    name: "바늘숲 공방 2층 교실", category: "workshop",
    body: "수업이 없는 평일 오전에 2층 교실을 빌려드려요. 재봉틀은 없고 큰 재단 테이블 두 개가 있어요.",
    photos: [photo("2층 교실", 310)], area: "을지로", address: "서울 중구 을지로 000, 2층", lat: 37.5660, lng: 126.9910,
    facilities: ["재단 테이블 2", "와이파이"], capacity: 10, rules: "테이블 위에서 칼질할 땐 매트를 깔아 주세요",
    minHours: 2, accessHow: "sms", contactPhone: "02-765-4321",
    rentSpaceOn: true, rentSpacePrice: 12000, rentSpaceNote: "모임이나 작은 수업 자리로 써요. 재단 테이블 두 개를 같이 써요.",
    ...bizOf(U.host2, "0008155668", "박바늘", "20190402", "png", "000000009109"),
    bizCheckStatus: "none", bizCheckedAt: `${d(-1)}T02:00:00.000Z`, bizCheckDetail: { reason: "no-key" },
    placeName: "바늘숲 공방", placeAddress: "서울특별시 중구 을지로 000 3층",
    placeLat: 37.5661, placeLng: 126.9911, placeMatchedAt: `${d(-1)}T02:00:00.000Z`,
    direct: [{ date: d(8), start: "09:00", end: "13:00" }],
  }, today);

  const spaces = [s1, s2, s3, s4, s5, s6, s7];
  // 🛍s1은 두 상품을 섞어 판다 — 공간 전체로 산 예약이 줄마다 섞여 보이게.
  const P1 = { sp: s1 };
  const P1F = { sp: s1, product: "full" as const };
  const P6 = { sp: s6 };
  const plan =
    "주말 이틀 동안 사워도우 팝업을 열어 보려고 해요. 오전에 집에서 구워 가져가고, 2층에서는 커피와 같이 팔 생각이에요. " +
    "머신은 아메리카노 정도만 쓸게요. 인스타에 미리 알린 분들이 열 명 남짓 오실 것 같아요.";

  const b = {
    pending: booking({ id: 90001, spaceId: s1.id, guestUserId: U.guest, status: "pending", useDate: d(5), startTime: "10:00", endTime: "14:00", plan, withChat: true, headcount: 3, guestPhone: "010-3456-7890", guestName: "한서윤", guestBrandSlug: "mock-flour-diary", ...P1 }, today),
    pendingPast: booking({ id: 90002, spaceId: s1.id, guestUserId: U.guest, status: "pending", useDate: d(-2), startTime: "12:00", endTime: "15:00", plan: "사진 촬영을 하려고 해요. 두 시간이면 충분해요.", guestPhone: "010-3456-7890", guestName: "한서윤", ...P1 }, today),
    expired1: booking({ id: 90003, spaceId: s1.id, guestUserId: U.guest, status: "expired", useDate: d(6), startTime: "14:00", endTime: "17:00", plan: "결제창만 열어 본 신청이에요.", ...P1 }, today),
    expired2: booking({ id: 90004, spaceId: s6.id, guestUserId: U.guest, status: "expired", useDate: d(2), startTime: "17:00", endTime: "19:00", plan: "결제창만 열어 본 신청이에요.", ...P6 }, today),
    expired3: booking({ id: 90005, spaceId: s1.id, guestUserId: U.guest, status: "expired", useDate: d(-5), startTime: "10:00", endTime: "13:00", plan: "결제창만 열어 본 신청이에요.", ...P1 }, today),
    paid: booking({ id: 90006, spaceId: s1.id, guestUserId: U.guest, status: "paid", useDate: d(3), startTime: "13:00", endTime: "17:00", plan, withChat: true, headcount: 4, guestPhone: "010-3456-7890", guestName: "한서윤", guestBrandSlug: "mock-flour-diary", ...P1F }, today),
    confirmed: booking({ id: 90007, spaceId: s1.id, guestUserId: U.guest, status: "confirmed", useDate: d(10), startTime: "10:00", endTime: "16:00", plan: "동네 분들과 원데이 베이킹 클래스를 열어요. 반죽은 미리 해 가고 굽는 건 집에서 해요.", withChat: true, headcount: 8, guestPhone: "010-3456-7890", guestName: "한서윤", guestBrandSlug: "mock-flour-diary", hostMessage: "머신 쓰는 법은 그날 아침 10분 먼저 오시면 알려 드릴게요.", decidedAt: `${d(-1)}T05:00:00.000Z`, ...P1 }, today),
    confirmedOther: booking({ id: 90008, spaceId: s6.id, guestUserId: U.guest, status: "confirmed", useDate: d(2), startTime: "18:00", endTime: "21:00", plan: "빵 시식회 겸 저녁 모임을 해요. 스무 명 정도예요.", headcount: 18, guestPhone: "010-3456-7890", guestName: "한서윤", decidedAt: `${d(-1)}T05:00:00.000Z`, ...P6 }, today),
    done: booking({ id: 90009, spaceId: s1.id, guestUserId: U.guest, status: "done", useDate: d(-7), startTime: "10:00", endTime: "15:00", plan: "첫 팝업이었어요. 빵 스무 개를 가져갔어요.", withChat: true, headcount: 2, guestPhone: "010-3456-7890", guestName: "한서윤", guestBrandSlug: "mock-flour-diary", ...P1F }, today),
    rejected: booking({ id: 90010, spaceId: s1.id, guestUserId: U.guest, status: "rejected", useDate: d(6), startTime: "15:00", endTime: "19:00", plan: "필사 모임 여섯 명이 조용히 앉아 있다 가려고 해요.", headcount: 6, guestPhone: "010-3456-7890", guestName: "한서윤", hostMessage: "그날 원두 입고가 있어서 2층이 어수선해요. 다음 주 월요일은 어떠세요?", decidedAt: `${d(-1)}T06:00:00.000Z`, ...P1 }, today),
    refunded: booking({ id: 90011, spaceId: s1.id, guestUserId: U.guest, status: "refunded", useDate: d(8), startTime: "11:00", endTime: "14:00", plan: "사워도우 사진을 찍으려고 해요. 창가 자리만 쓰면 돼요.", guestPhone: "010-3456-7890", guestName: "한서윤", hostMessage: "그날 가족 행사가 생겼어요. 정말 미안해요.", decidedAt: `${d(-2)}T06:00:00.000Z`, ...P1 }, today),
    cancelledFuture: booking({ id: 90012, spaceId: s1.id, guestUserId: U.guest, status: "cancelled", useDate: d(14), startTime: "10:00", endTime: "13:00", plan: "친구들과 빵 굽는 모임을 하려다 일정이 바뀌었어요.", headcount: 5, guestPhone: "010-3456-7890", guestName: "한서윤", ...P1 }, today),
    cancelledPast: booking({ id: 90013, spaceId: s1.id, guestUserId: U.guest, status: "cancelled", useDate: d(-3), startTime: "13:00", endTime: "16:00", plan: "전날 취소한 예약이에요. 반만 돌려받았어요.", guestPhone: "010-3456-7890", guestName: "한서윤", ...P1 }, today),
    refundReq: booking({ id: 90014, spaceId: s1.id, guestUserId: U.guest2, status: "confirmed", useDate: d(4), startTime: "10:00", endTime: "18:00", plan: "작은 책 장터를 열어요. 셀러 다섯 팀이 와요.", headcount: 12, guestPhone: "010-5678-9012", guestName: "정다온", decidedAt: `${d(-3)}T06:00:00.000Z`, refundRequestedAt: `${d(-1)}T09:00:00.000Z`, refundRequestNote: "건물 누수 공사가 그 주로 잡혔어요. 2층 천장을 열어야 한대요.", ...P1F }, today),
    paidStarted: booking({ id: 90015, spaceId: s1.id, guestUserId: U.guest, status: "paid", useDate: d(-1), startTime: "10:00", endTime: "13:00", plan: "어제 쓴 예약인데 사장님이 수락을 안 누르셨어요.", guestPhone: "010-3456-7890", ...P1 }, today),
    payoutDone: booking({ id: 90016, spaceId: s6.id, guestUserId: U.guest, status: "done", useDate: d(-20), startTime: "17:00", endTime: "21:00", plan: "저녁 시식회를 했어요.", headcount: 15, ...P6 }, today),
    payoutRequested: booking({ id: 90017, spaceId: s6.id, guestUserId: U.guest2, status: "done", useDate: d(-12), startTime: "17:00", endTime: "20:00", plan: "북토크를 했어요.", headcount: 20, guestPhone: "010-5678-9012", guestName: "정다온", ...P6 }, today),
    payoutFailed: booking({ id: 90018, spaceId: s6.id, guestUserId: U.guest2, status: "done", useDate: d(-15), startTime: "18:00", endTime: "22:00", plan: "동네 모임을 했어요.", headcount: 10, guestPhone: "010-5678-9012", guestName: "정다온", ...P6 }, today),
    payoutWaiting2: booking({ id: 90019, spaceId: s6.id, guestUserId: U.guest, status: "done", useDate: d(-9), startTime: "17:00", endTime: "19:00", plan: "두 시간 짧게 촬영했어요.", ...P6 }, today),
    hostAsGuest: booking({ id: 90020, spaceId: s6.id, guestUserId: U.host, status: "confirmed", useDate: d(4), startTime: "17:00", endTime: "20:00", plan: "원두 시음회를 다른 동네에서 열어 보려고 해요.", headcount: 10, guestPhone: "010-2345-6789", guestName: "문하람", guestBrandSlug: "mock-slow-afternoon", decidedAt: `${d(-1)}T05:00:00.000Z`, ...P6 }, today),
  };
  const bookings = Object.values(b);

  const payments: Payment[] = [
    payment(b.pending, U.host, { status: "READY" }),
    payment(b.pendingPast, U.host, { status: "READY" }),
    payment(b.expired1, U.host, { status: "EXPIRED" }),
    payment(b.expired2, U.host2, { status: "EXPIRED" }),
    payment(b.expired3, U.host, { status: "EXPIRED" }),
    payment(b.paid, U.host, { status: "DONE" }),
    payment(b.confirmed, U.host, { status: "DONE", method: "간편결제" }),
    payment(b.confirmedOther, U.host2, { status: "DONE" }),
    payment(b.done, U.host, { status: "DONE", payoutStatus: "WAITING" }),
    // 거절했는데 환불이 실패한 결제 — 돈이 그대로 남아 있다.
    payment(b.rejected, U.host, { status: "DONE" }),
    payment(b.refunded, U.host, { status: "CANCELED", balance: 0 }),
    payment(b.cancelledFuture, U.host, { status: "PARTIAL_CANCELED", balance: Math.round(b.cancelledFuture.amountTotal * 0.3) }),
    payment(b.cancelledPast, U.host, { status: "PARTIAL_CANCELED", balance: Math.round(b.cancelledPast.amountTotal * 0.5), payoutStatus: "WAITING" }),
    payment(b.refundReq, U.host, { status: "DONE" }),
    payment(b.paidStarted, U.host, { status: "DONE" }),
    // 🕐보낸 시각을 UTC 자정 넘어(한국 아침 0시 30분)로 둔다 — 날짜를 UTC로 자르면 하루 앞 날짜가 찍히는 걸 정산 화면에서 본다(09-18 밤 QA SC-29).
    payment(b.payoutDone, U.host2, { status: "DONE", payoutStatus: "DONE", payoutDoneAt: `${d(-13)}T15:30:00.000Z` }),
    payment(b.payoutRequested, U.host2, { status: "DONE", payoutStatus: "REQUESTED" }),
    payment(b.payoutFailed, U.host2, { status: "DONE", payoutStatus: "FAILED" }),
    payment(b.payoutWaiting2, U.host2, { status: "DONE", payoutStatus: "WAITING" }),
    payment(b.hostAsGuest, U.host2, { status: "DONE" }),
  ];

  const payoutAccounts: PayoutAccount[] = withAccount
    ? [{
      userId: U.host, holderType: "sole_proprietor", holderName: "김느린", businessNumber: "1234567890",
      bankCode: "90", accountNumber: "3333012345678", tossSellerId: "", tossSellerStatus: "",
      updatedAt: `${d(-10)}T00:00:00.000Z`,
    } satisfies PayoutAccount]
    : [];

  return { spaces, bookings, payments, profiles, makers, payoutAccounts };
}

/** 오늘 이후 n번째 «그 요일» 날짜(1 = 가장 가까운 것). 요일 규칙의 «하루만 쉬기»를 그럴듯한 날에 놓으려고. */
function nextDow(today: string, dow: number, nth: number): string {
  for (let k = 0, seen = 0; k < 7 * 20; k++) {
    const iso = addDaysIso(today, k);
    if (new Date(`${iso}T00:00:00Z`).getUTCDay() === dow && ++seen === nth) return iso;
  }
  return today;
}

/** 📏긴 이름·긴 글 — 줄바꿈·말줄임·가로 넘침을 보는 세계. */
function stressWorld(today: string): MockWorld {
  const d = (n: number) => addDaysIso(today, n);
  const U = MOCK_USER;
  const longBrand = "오래된 골목 끝집에서 매일 아침 여섯 시에 문을 여는 동네 사람들의 부엌 겸 작업실";
  const longGuest = "주말마다 서로 다른 동네를 돌아다니며 작은 장터를 여는 여섯 명의 친구들";
  const profiles = [
    profile(U.stressHost, longBrand, "02-0000-0000", "a.very.long.mailbox.name.for.layout.testing@subdomain.example.com"),
    profile(U.stressGuest, longGuest, "010-9999-8888", "weekend.market.friends.six.people.together@example.com"),
    profile(U.admin, "하루 가게 운영", "010-0000-0000", "admin@example.com"),
  ];
  const makers = [
    maker({ id: 9905, slug: "mock-long-kitchen", name: longBrand, ownerUserId: U.stressHost, oneLiner: "이름이 아주 긴 소개서예요. 링크 글자가 몇 줄로 접히는지 보려고 만들었어요." }),
    maker({ id: 9906, slug: "mock-weekend-market", name: longGuest, ownerUserId: U.stressGuest, oneLiner: "손님 쪽 긴 이름 소개서예요." }),
  ];
  const para =
    "아침엔 동네 어르신들이 두유를 드시러 오시고, 점심엔 근처 인쇄소 사장님들이 도시락을 데우러 오세요. " +
    "오후 세 시부터 여섯 시까지는 손님이 거의 없어서 그 시간을 누군가에게 빌려드리면 좋겠다고 생각했어요. " +
    "싱크대 두 개, 6구 인덕션, 업소용 오븐, 반죽기, 작업대 세 개가 있고 냉장고 한 칸은 비워 드릴 수 있어요. ";
  const s = space({
    id: 9107, slug: "mock-long-kitchen-space", ownerUserId: U.stressHost, status: "open",
    name: "오래된 골목 끝집 부엌 겸 작업실 전체와 뒷마당 평상, 그리고 2층 다락방까지 한꺼번에",
    brandSlug: "mock-long-kitchen", category: "restaurant", scope: "whole_shop",
    body: [para, para, para, para, para].join("\n\n"),
    // 📸등록 폼이 받는 최대 장수(`SpaceForm`의 `PhotoGrid max={10}`)와 같게(09-18 밤 QA SC-34). 전엔 12장이라 실제로는 생길 수 없는 공간을 보고 있었다.
    photos: Array.from({ length: 10 }, (_, i) => photo(`사진 ${i + 1}`, (i * 29) % 360, i % 3 === 0 ? 900 : 1200, i % 3 === 0 ? 1600 : 800)),
    area: "망원동", address: "서울 마포구 포은로 000-00, 골목 끝 파란 대문 집 1층과 2층 다락, 뒷마당 포함 (건물 이름 없음)",
    lat: 37.5563, lng: 126.9050,
    facilities: [
      "업소용 컨벡션 오븐", "6구 인덕션", "반죽기 20리터", "작업대 3", "싱크대 2", "냉장고 한 칸", "냉동고",
      "제빙기", "식기 40인분", "평상", "빔프로젝터", "스크린 100인치", "마이크 2", "블루투스 스피커",
      "주차는 골목이 좁아서 한 대만 가능하고 그것도 오전 여덟 시 전에 빼 주셔야 해요",
    ],
    facilitiesNote: [para, para].join("\n"),
    capacity: 120,
    rules: [
      "인덕션은 쓰고 나서 반드시 전원 코드까지 뽑아 주세요. 한 번 과열돼서 차단기가 내려간 적이 있어요",
      "뒷마당 평상은 밤 열 시 이후엔 쓸 수 없어요. 옆집 할머니가 일찍 주무세요",
      "2층 다락은 천장이 낮아요. 키가 180cm 넘는 분은 머리 조심하세요",
      "쓰레기는 음식물·재활용·일반으로 나눠서 대문 옆 통에 넣어 주세요",
      "기름은 싱크대에 버리지 말고 우유갑에 굳혀서 일반 쓰레기로",
      "반려동물은 뒷마당까지만 괜찮아요",
      "촬영 조명은 2층 콘센트 하나에 몰리면 차단기가 내려가요. 1층과 나눠 꽂아 주세요",
      "현관 신발장 위 화분은 옮기지 말아 주세요",
      "술은 드셔도 되지만 병은 가져가 주세요",
      "외부 간판이나 현수막은 대문 안쪽에만 붙여 주세요",
      "끝나면 창문 일곱 개를 다 닫았는지 한 번 더 봐 주세요",
      "문제가 생기면 시간과 상관없이 전화 주세요",
    ].join("\n"),
    minHours: 8,
    rentSpaceOn: true, rentSpacePrice: 950000, rentSpaceNote: [para, para].join("\n"),
    rentFullOn: true, rentFullPrice: 1000000, rentFullNote: [para, para, para].join("\n"),
    coffeeChat: true, coffeeChatMinutes: 120, coffeeChatPrice: 150000,
    coffeeChatTopics: Array.from({ length: 8 }, (_, i) => `${i + 1}. 식당을 열고 첫 해에 겪은 일 중 하나를 아주 길게 풀어서 이야기해 드릴 수 있어요. 재료값이 두 배로 뛰었던 달 이야기도요.`).join("\n"),
    accessHow: "both", contactPhone: "02-0000-0000 (내선 3번, 점심시간엔 안 받아요)",
    // 🧾🏪긴 상호가 지도 라벨·신뢰 표시 줄에서 어떻게 접히는지.
    ...bizOf(U.stressHost, "0001234560", "남궁오래된골목끝집", "20150101", "pdf", "000000009107"),
    bizCheckStatus: "valid", bizCheckedAt: `${d(-50)}T01:00:00.000Z`, bizApprovedAt: `${d(-50)}T02:00:00.000Z`,
    bizCheckDetail: { valid: "01", bSttCd: "01", bStt: "계속사업자" },
    placeName: "오래된 골목 끝집 부엌 겸 작업실", placeAddress: "서울특별시 마포구 포은로 000-00 파란 대문 집",
    placeLat: 37.5563, placeLng: 126.9050, placeMatchedAt: `${d(-50)}T01:00:00.000Z`,
    repeatWeekly: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, start: "00:00", end: "24:00" })),
    direct: [],
  }, today);
  const longPlan = Array.from({ length: 6 }, () => "그날은 여섯 팀이 각자 테이블 하나씩 맡아서 손으로 만든 물건을 팔아요. 오전 열 시에 들어가서 세팅하고 오후 여섯 시에 정리해요.").join(" ");
  const P = { sp: s, product: "full" as const };
  const bookings = [
    booking({ id: 90101, spaceId: s.id, guestUserId: U.stressGuest, status: "paid", useDate: d(6), startTime: "08:00", endTime: "23:00", plan: longPlan, withChat: true, headcount: 120, guestPhone: "010-9999-8888", guestName: "남궁빛나래가온누리 Maria Fernanda González Rodríguez", guestBrandSlug: "mock-weekend-market", ...P }, today),
    booking({ id: 90102, spaceId: s.id, guestUserId: U.stressGuest, status: "confirmed", useDate: d(9), startTime: "00:00", endTime: "24:00", plan: longPlan, withChat: true, headcount: 99, guestPhone: "010-9999-8888", guestName: "남궁빛나래가온누리 Maria Fernanda González Rodríguez", guestBrandSlug: "mock-weekend-market", hostMessage: longPlan, refundRequestedAt: `${d(-1)}T00:00:00.000Z`, refundRequestNote: longPlan, ...P }, today),
    booking({ id: 90103, spaceId: s.id, guestUserId: U.stressGuest, status: "done", useDate: d(-4), startTime: "08:00", endTime: "22:00", plan: longPlan, withChat: true, headcount: 80, guestPhone: "010-9999-8888", guestName: "남궁빛나래가온누리 Maria Fernanda González Rodríguez", ...P }, today),
    booking({ id: 90104, spaceId: s.id, guestUserId: U.stressGuest, status: "pending", useDate: d(12), startTime: "09:00", endTime: "21:00", plan: longPlan, withChat: true, headcount: 60, guestPhone: "010-9999-8888", guestName: "남궁빛나래가온누리 Maria Fernanda González Rodríguez", ...P }, today),
  ];
  const payments = [
    payment(bookings[0], U.stressHost, { status: "DONE" }),
    payment(bookings[1], U.stressHost, { status: "DONE" }),
    payment(bookings[2], U.stressHost, { status: "DONE", payoutStatus: "WAITING" }),
    payment(bookings[3], U.stressHost, { status: "READY" }),
  ];
  const payoutAccounts: PayoutAccount[] = [{
    userId: U.stressHost, holderType: "corporation", holderName: "주식회사 오래된골목끝집부엌겸작업실협동조합",
    businessNumber: "9876543210", bankCode: "12", accountNumber: "3510123456789012", tossSellerId: "", tossSellerStatus: "",
    updatedAt: `${d(-5)}T00:00:00.000Z`,
  }];
  return { spaces: [s], bookings, payments, profiles, makers, payoutAccounts };
}

/** 🫙최소 — 필수 칸만 채운 사장님과 이름·번호·이메일이 빈 손님. 빈 칸이 어떻게 보이는지. */
function minimalWorld(today: string): MockWorld {
  const d = (n: number) => addDaysIso(today, n);
  const U = MOCK_USER;
  const profiles = [profile(U.minHost, "", "", ""), profile(U.minGuest, "", "", ""), profile(U.admin, "하루 가게 운영", "", "admin@example.com")];
  const s = space({
    id: 9108, slug: "mock-minimal-room", ownerUserId: U.minHost, status: "open",
    name: "작업실", address: "서울 종로구 창신길 00", rules: "깨끗이 써 주세요",
    minHours: 1, direct: [{ date: d(4), start: "13:00", end: "15:00" }],
    // 🛍최소 세계는 대관만 하나(09-18).
    rentSpaceOn: true, rentSpacePrice: 10000, rentSpaceNote: "책상 두 개를 쓸 수 있어요.",
  }, today);
  const P = { sp: s };
  const bookings = [
    // 옛 예약처럼 손님 번호가 비어 있다(신청 때 번호를 받기 전).
    booking({ id: 90201, spaceId: s.id, guestUserId: U.minGuest, status: "paid", useDate: d(4), startTime: "13:00", endTime: "14:00", plan: "사진 찍으려고 해요.", ...P }, today),
    booking({ id: 90202, spaceId: s.id, guestUserId: U.minGuest, status: "confirmed", useDate: d(4), startTime: "14:00", endTime: "15:00", plan: "사진 찍으려고 해요.", ...P }, today),
  ];
  const payments = [payment(bookings[0], U.minHost, { status: "DONE" }), payment(bookings[1], U.minHost, { status: "DONE" })];
  return { spaces: [s], bookings, payments, profiles, makers: [], payoutAccounts: [] };
}

/** 🗺지도·메일 미리보기가 링크를 만들 때 쓰는 id 모음. 위 세계와 같은 번호다. */
export const MOCK_IDS = {
  space: {
    full: "mock-slow-afternoon-2f", pending: "mock-slow-afternoon-showroom", paused: "mock-slow-afternoon-rooftop",
    draft: "mock-slow-afternoon-draft", noSlots: "mock-needle-forest-bench", other: "mock-euljiro-evening",
    stress: "mock-long-kitchen-space", minimal: "mock-minimal-room",
    /** 🧾09-18 검토 대기 · 국세청 조회 전(키 없음) · 네이버 매칭됨 */
    pendingNoKey: "mock-needle-forest-class",
  },
  maker: { host: "mock-slow-afternoon", guest: "mock-flour-diary", stress: "mock-long-kitchen" },
  booking: {
    pending: 90001, pendingPast: 90002, expired: 90003, paid: 90006, confirmed: 90007, confirmedOther: 90008,
    done: 90009, rejected: 90010, refunded: 90011, cancelledFuture: 90012, cancelledPast: 90013,
    refundReq: 90014, paidStarted: 90015,
    stressPaid: 90101, stressConfirmed: 90102, stressDone: 90103, stressPending: 90104,
    minimalPaid: 90201, minimalConfirmed: 90202,
  },
} as const;

/** 📨메일 미리보기 종류. */
/** 메일 종류 → 만드는 법. 지도(`/dev/rent-map`)가 링크로 걸고, `/dev/rent-mail/[kind]`가 종류마다 만든다. */
export const MOCK_MAIL_KINDS: { kind: string; label: string }[] = [
  { kind: "paid-host", label: "결제 완료 → 사장님 (새 요청, 커피챗·손님 소개서 포함)" },
  { kind: "paid-guest", label: "결제 완료 → 손님 (예약 완료, 사장님 연락처)" },
  { kind: "confirmed-guest", label: "수락 → 손님 (예약 확정, 사장님 말씀 포함)" },
  { kind: "confirmed-host", label: "수락 → 사장님 (손님 연락처와 그날 챙길 일)" },
  { kind: "confirmed-host-noaccount", label: "수락 → 사장님 · 정산 계좌가 없을 때" },
  { kind: "confirmed-host-minimal", label: "수락 → 사장님 · 옛 예약(성함·손님 연락처 없음)" },
  { kind: "rejected-guest", label: "거절 → 손님 (전액 환불)" },
  { kind: "cancelled-host", label: "손님 취소 → 사장님" },
  { kind: "cancelled-guest", label: "손님 취소 → 손님 · 일부 환불" },
  { kind: "cancelled-guest-sameday", label: "손님 취소 → 손님 · 당일이라 환불 없음" },
  { kind: "cancelled-guest-full", label: "손님 취소 → 손님 · 전액 돌려받음 (결제 한 시간 안이거나 7일 전까지)" },
  { kind: "admin-refund-guest", label: "관리자 승인 환불 → 손님" },
  { kind: "admin-refund-guest-partial", label: "관리자 승인 환불 → 손님 · 남은 돈이 낸 돈보다 적어 일부만 돌려줌" },
  { kind: "admin-refund-host", label: "관리자 승인 환불 → 사장님" },
  { kind: "published", label: "공간 공개 → 사장님 · 계좌 등록 전" },
  { kind: "published-account", label: "공간 공개 → 사장님 · 계좌 등록 뒤" },
  { kind: "space-review-new", label: "공간 검토 대기 → 운영자 · 새 공간, 국세청 조회 전" },
  { kind: "space-review-mismatch", label: "공간 검토 대기 → 운영자 · 새 공간, 국세청 기록과 다름" },
  { kind: "space-review-changed", label: "공간 검토 대기 → 운영자 · 공개 중이던 공간의 이름·주소가 바뀜" },
  { kind: "remind-guest", label: "이용 전날 → 손님" },
  { kind: "remind-host", label: "이용 전날 → 사장님 · 수락한 예약" },
  { kind: "remind-host-unaccepted", label: "이용 전날 → 사장님 · 아직 수락 전" },
  { kind: "stress-paid-host", label: "긴 글 · 결제 완료 → 사장님" },
];
