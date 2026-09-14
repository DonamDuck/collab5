import { NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import path from "node:path";

// 🔁 로컬 새로고침 신호 (2026-09-14)
//
// 대표: *「8초마다 하니깐 어려운게... 내가 input 입력중에 그냥 인풋이 꺼져.
//        그냥 너가 로컬 반영할때 너의 push로 새로고침을 하면 좋을거 같아」*
//
// 🩸**앞선 방식(5초마다 서버 부팅시각 대조)은 대표 입력을 날렸다.** 내가 막아 둔 건 코멘트 입력창뿐이라
//   등록 폼처럼 «화면 자신의 입력»은 무방비였다. 시계가 정하면 언제 터질지 아무도 모른다.
// ⭐그래서 **시각이 아니라 «내가 미는 순간»이 방아쇠다.** 내가 일을 다 끝내고 `touch .dev-reload`를 하면
//   그때만 나간다. 그 순간은 대표가 «기다리는» 시점이지 타이핑하는 시점이 아니다.
//
// 🚨브라우저가 폴링하지 않는다. 이 스트림이 열려 있고 서버가 밀어 준다(SSE).
//   서버 쪽 1초 검사는 브라우저에 안 보이고 비용도 없다.
const DEV = process.env.NODE_ENV === "development";
const FLAG = path.join(process.cwd(), ".dev-reload");

export const dynamic = "force-dynamic";

export async function GET() {
  if (!DEV) return new NextResponse(null, { status: 404 });

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      // ⚠️`null`로 시작해 **첫 검사는 기준만 잡고 안 쏜다.** 0으로 두면 파일이 이미 있을 때
      //   스트림이 열리자마자 새로고침이 나가서, 새로고침이 새로고침을 부르는 고리가 생긴다.
      let last: string | null = null;
      const tick = async () => {
        const st = await stat(FLAG).catch(() => null);
        const cur = st ? String(st.mtimeMs) : "0";
        if (last !== null && cur !== last) controller.enqueue(enc.encode("data: reload\n\n"));
        last = cur;
      };
      void tick();
      timer = setInterval(() => void tick(), 1000);
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
