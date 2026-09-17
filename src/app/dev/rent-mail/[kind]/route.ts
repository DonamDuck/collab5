import { NextResponse, type NextRequest } from "next/server";
import { buildPreviewMail } from "@/lib/dev-mail-preview";

// 📨메일 미리보기 옛 주소 (2026-09-17) · 개발 빌드 전용
// 🔁09-18 대표 코멘트 — 「내부 들어가서 상세 컨텐츠는 코멘트를 못 남기는 게 아쉬워」. 이 주소는 HTML만 돌려줘서
//   사이트 레이아웃(코멘트 위젯)이 안 붙었다. 이제 화면은 `/dev/mail/[kind]` 페이지가 그리고, 여기는 그리로 보낸다.
//   `?raw=1`(메일 본문만)은 그대로 여기서 준다 — 메일 클라이언트에 붙여 볼 때 쓴다.
const DEV = process.env.NODE_ENV === "development";

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const { kind } = await params;
  if (req.nextUrl.searchParams.get("raw") !== "1") {
    return NextResponse.redirect(new URL(`/dev/mail/${encodeURIComponent(kind)}`, req.url));
  }
  const mail = buildPreviewMail(kind);
  if (!mail) return new NextResponse(`모르는 메일이에요: ${kind}`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new NextResponse(mail.html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
