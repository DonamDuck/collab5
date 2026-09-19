// 🧪하루 팝업 목 데이터 띠를 붙일지 정하는 서버 조각 (2026-09-17) · 개발 빌드 전용
// 루트 레이아웃이 `NODE_ENV === "development"`일 때만 이 조각을 그린다. 쿠키가 없으면 아무것도 안 그린다.
import { getRentMock } from "@/lib/rent-mock";
import { RentMockBar } from "./RentMockBar";

export async function RentMockBarSlot() {
  const mock = await getRentMock();
  if (!mock) return null;
  return <RentMockBar label={mock.label} />;
}
