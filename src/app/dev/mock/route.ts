import type { NextRequest } from "next/server";
import { mockSwitch } from "@/lib/mock-switch";

// 🧪목 데이터 스위치 (2026-09-18) · 개발 빌드 전용. 사이트 화면 지도(`/dev/map`)의 모든 링크가 여기를 거친다.
// 하는 일은 `lib/mock-switch.ts`에 있다. 운영에선 404(미들웨어가 먼저 막는다).
export async function GET(req: NextRequest) {
  return mockSwitch(req, "/dev/map");
}
