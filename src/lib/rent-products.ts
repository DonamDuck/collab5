// 하루 팝업 — 공간 상품 셋의 계산 (2026-09-18 대표)
// 대표: 「대관만, 공간 전체(대관·시설), 커피챗 이렇게 3개 상품을 설정할 수 있게 하고 가격도 각각 설정하게 하고,
//        고객은 신청할 때 이걸 선택할 수 있게 하자.」
//
// ⭐계산을 한 벌로 둔다(09-19부터 길이는 «분»). 신청 폼(하단 금액)·서버(`startBookingAction`, 진짜 금액)·목 데이터가 같은 함수를 부른다.
//   화면과 서버가 따로 곱하면 둘이 어긋나는 날 손님이 본 값과 결제 값이 달라진다.
// 🚨훅도 DB도 안 부른다. 클라이언트·서버 어디서든 불린다.
// 📌해석(09-18): 손님은 공간 상품 둘 중 «하나를 반드시» 고르고, 커피챗은 거기에 더하는 선택이다.
import type { RentProduct, Space, SpaceBooking, SpaceScope } from "./types";

export const RENT_PRODUCTS: readonly RentProduct[] = ["space", "full"];

type ProductFields = Pick<
  Space,
  "rentSpaceOn" | "rentSpacePrice" | "rentSpaceNote" | "rentFullOn" | "rentFullPrice" | "rentFullNote"
>;

export function isRentProduct(v: unknown): v is RentProduct {
  return v === "space" || v === "full";
}

export function productOn(sp: ProductFields, p: RentProduct): boolean {
  return p === "space" ? sp.rentSpaceOn : sp.rentFullOn;
}

/** 켠 상품의 시간당 값. 꺼져 있으면 0. */
export function productPrice(sp: ProductFields, p: RentProduct): number {
  if (!productOn(sp, p)) return 0;
  return p === "space" ? sp.rentSpacePrice : sp.rentFullPrice;
}

export function productNote(sp: ProductFields, p: RentProduct): string {
  return (p === "space" ? sp.rentSpaceNote : sp.rentFullNote).trim();
}

/** 손님이 고를 수 있는 공간 상품 — 켜져 있고 값이 있는 것만, 대관만 → 공간 전체 순서. */
export function sellableProducts(sp: ProductFields): RentProduct[] {
  return RENT_PRODUCTS.filter((p) => productPrice(sp, p) > 0);
}

/** 「N원부터」의 N. 팔 수 있는 상품이 없으면 0. */
export function lowestPrice(sp: ProductFields): number {
  const prices = sellableProducts(sp).map((p) => productPrice(sp, p));
  return prices.length ? Math.min(...prices) : 0;
}

export interface BookingAmount {
  space: number;
  chat: number;
  total: number;
}

/** 💰시간당 값 × 분 ÷ 60 — 공간 값의 «반올림 규칙»은 여기 한 곳이다(대표 09-19: 30분 단위).
 *  · 정수로만 센다(분 × 시간당 값을 먼저 곱하고 60으로 나눈다). 1시간 30분 = 1.5배.
 *  · 원 미만은 버린다(손님 쪽으로). 30분 눈금에선 시간당 값이 홀수일 때만 0.5원이 생긴다 — 15,001원 × 1시간 30분 = 22,501원.
 *  ⚠️화면(신청 폼 금액)·서버(`startBookingAction`의 청구액)·목 데이터가 전부 이 함수를 지난다. */
export function priceForMinutes(pricePerHour: number, minutes: number): number {
  if (!(pricePerHour > 0) || !(minutes > 0)) return 0;
  return Math.floor((Math.round(pricePerHour) * Math.round(minutes)) / 60);
}

/** 금액 = 고른 상품 시간당 값 × 길이(분) (+ 커피챗). 팔지 않는 상품이면 null.
 *  🔁09-19 셋째 인자가 «시간»에서 «분»으로 바뀌었다(30분 단위). 반 시간을 소수 시간으로 곱하지 않는다.
 *  ⚠️커피챗은 사장님이 켰을 때만 더한다 — 화면이 `withChat`을 보내 와도 공간이 안 팔면 0이다. 커피챗 값은 길이와 상관없이 그대로다. */
export function bookingAmount(
  sp: ProductFields & Pick<Space, "coffeeChat" | "coffeeChatPrice">,
  product: RentProduct,
  minutes: number,
  withChat: boolean,
): BookingAmount | null {
  const price = productPrice(sp, product);
  if (price <= 0 || !(minutes > 0)) return null;
  const space = priceForMinutes(price, minutes);
  const chat = withChat && sp.coffeeChat && sp.coffeeChatPrice > 0 ? sp.coffeeChatPrice : 0;
  return { space, chat, total: space + chat };
}

/** ☕무료 커피챗인가(대표 09-19 #93 「무료로 제공할게요」). 저장 칸을 따로 두지 않고 «켜져 있고 값이 0»을 무료로 읽는다(SQL 없이).
 *  ⚠️09-18 밤(H-36) 전엔 값 0원 커피챗이 «잘못 저장된 것»이었다. 그때 남은 행이 있으면 이제 무료로 보인다. */
export function coffeeChatFree(sp: Pick<Space, "coffeeChat" | "coffeeChatPrice">): boolean {
  return sp.coffeeChat && !(sp.coffeeChatPrice > 0);
}

/** ☕이 예약에 커피챗이 들어 있나. 무료 커피챗(09-19)은 값이 0이라 금액으로는 못 가른다 — `withChat`이 정본이고,
 *  칸이 생기기 전 옛 행은 금액(새 칸 `amountChat`·옛 칸 `amountMentor`)으로 본다. 화면·메일·결제 규칙이 전부 이 한 벌을 쓴다. */
export function bookingHasChat(b: Pick<SpaceBooking, "withChat" | "amountChat" | "amountMentor">): boolean {
  return !!b.withChat || b.amountChat > 0 || b.amountMentor > 0;
}

/** 옛 칸 둘의 호환 값(09-18). 옛 칸은 읽는 곳이 많아 아직 남긴다.
 *  `priceHour` = 켜진 상품 값 중 낮은 값(목록 카드 「N원부터」). `scope` = 공간 전체만 켜졌으면 `with_gear`. */
export function compatScopePrice(sp: ProductFields): { scope: SpaceScope; priceHour: number } {
  const onlyFull = sp.rentFullOn && !sp.rentSpaceOn;
  return { scope: onlyFull ? "with_gear" : "space_only", priceHour: lowestPrice(sp) };
}

/** SQL 전 DB(새 칸이 없는 행)를 읽을 때 옛 칸에서 상품을 만든다. SQL의 채우기 규칙과 같다 —
 *  범위가 «공간만»이면 대관만, 그 밖이면 공간 전체. 설명은 비어 있다. */
export function productsFromLegacy(scope: SpaceScope, priceHour: number): ProductFields {
  const full = scope !== "space_only";
  return {
    rentSpaceOn: !full, rentSpacePrice: full ? 0 : priceHour, rentSpaceNote: "",
    rentFullOn: full, rentFullPrice: full ? priceHour : 0, rentFullNote: "",
  };
}
