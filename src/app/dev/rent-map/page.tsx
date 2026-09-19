import { notFound, redirect } from "next/navigation";

// 🗺하루 팝업 화면 지도 (2026-09-17) → 09-18 사이트 전체 지도(`/dev/map`)의 하루 팝업 묶음으로 옮겼다.
// 이 주소는 대표·디자인팀이 이미 쓰고 있어서 없애지 않고 `/dev/map#rent`로 보낸다. 줄은 `dev/map/rent-rows.ts`에 있다.
// 🚨운영에선 404(미들웨어가 `/dev/*`를 먼저 막는다).
export const dynamic = "force-dynamic";

export default function RentMapPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  redirect("/dev/map#rent");
}
