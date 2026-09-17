import { getSpaceFull } from "@/lib/spaces";
import { isRentAdmin } from "@/lib/rent-actions";
import { signCertDownload } from "@/lib/host-docs";
import { rentMockOn } from "@/lib/rent-mock";

// 🧾사업자등록증 보기 (2026-09-18) · 관리자만
//
// 검토 화면의 [등록증 보기]가 새 탭으로 여기 온다. 관리자 확인 → 60초짜리 서명 URL로 넘긴다.
// ⭐버튼에서 서버 액션을 부르고 `window.open`하지 않은 이유 — 기다린 뒤 여는 새 창은 브라우저가 팝업으로 막는다.
//   링크(`target=_blank`)로 먼저 탭을 열고 여기서 넘기면 안 막힌다.
// 🔒관리자가 아니면 404(없는 척). 서명 URL은 응답 헤더에만 실리고 60초 뒤 죽는다. 캐시하지 않는다.
// 🧪목 모드면 저장소를 안 부르고 안내 문구만(목 데이터의 등록증은 가짜 경로다).
export const dynamic = "force-dynamic";

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isRentAdmin())) return text("Not Found", 404);
  const { slug } = await params;
  if (await rentMockOn()) {
    return text("목 데이터 보기 중이에요. 목 공간의 등록증은 가짜 경로라 실제 파일이 없어요. 운영에선 여기서 사장님이 올린 사업자등록증이 열려요.");
  }
  const sp = await getSpaceFull(slug);
  if (!sp || !sp.bizCertPath) return text("이 공간엔 올린 사업자등록증이 없어요.", 404);
  const url = await signCertDownload(sp.bizCertPath);
  if (!url) return text("등록증을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.", 503);
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
