// 하루 가게 — 공간 상품 셋의 계산 (2026-09-18 대표)
// 대표: 「대관만, 공간 전체(대관·시설), 커피챗 이렇게 3개 상품을 설정할 수 있게 하고 가격도 각각 설정하게 하고,
//        고객은 신청할 때 이걸 선택할 수 있게 하자.」
//
// ⭐계산을 한 벌로 둔다. 신청 폼(하단 금액)·서버(`startBookingAction`, 진짜 금액)·목 데이터가 같은 함수를 부른다.
//   화면과 서버가 따로 곱하면 둘이 어긋나는 날 손님이 본 값과 결제 값이 달라진다.
// 🚨훅도 DB도 안 부른다. 클라이언트·서버 어디서든 불린다.
// 📌해석(09-18): 손님은 공간 상품 둘 중 «하나를 반드시» 고르고, 커피챗은 거기에 더하는 선택이다.
import type { RentProduct, Space, SpaceScope } from "./types";

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

/** 금액 = 고른 상품 시간당 값 × 시간 (+ 커피챗). 팔지 않는 상품이면 null.
 *  ⚠️커피챗은 사장님이 켰을 때만 더한다 — 화면이 `withChat`을 보내 와도 공간이 안 팔면 0이다. */
export function bookingAmount(
  sp: ProductFields & Pick<Space, "coffeeChat" | "coffeeChatPrice">,
  product: RentProduct,
  hours: number,
  withChat: boolean,
): BookingAmount | null {
  const price = productPrice(sp, product);
  if (price <= 0 || !(hours > 0)) return null;
  const space = Math.round(price * hours);
  const chat = withChat && sp.coffeeChat && sp.coffeeChatPrice > 0 ? sp.coffeeChatPrice : 0;
  return { space, chat, total: space + chat };
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
