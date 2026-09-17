import type { NextRequest } from "next/server";
import { mockSwitch } from "@/lib/mock-switch";

// 🧪하루 가게 목 데이터 켜고 끄기 (2026-09-17) · 개발 빌드 전용
//
// 09-18부터 사이트 전체 스위치(`/dev/mock`)와 같은 함수를 쓴다. 이 주소는 대표·디자인팀이 이미 쓰는 링크라 남겨 둔다.
// 끄면 사이트 지도의 하루 가게 묶음으로 돌아간다. 운영에선 404.
export async function GET(req: NextRequest) {
  return mockSwitch(req, "/dev/map#rent");
}
