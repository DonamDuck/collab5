// POST /api/collab-report — 콜라보 분석 리포트 오케스트레이션.
// 인증(from은 내 브랜드만) → DNA 병렬 확보(stale만 재생성) → thin 가드 → 캐시 3조건 → 생성·저장.
// 클라이언트가 보낸 텍스트는 프롬프트에 절대 넣지 않는다 — slug만 받고 소개서·DNA는 서버가 DB에서 읽음
// (주입 차단, enrich 관례). 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md
import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getSessionUserId } from "@/lib/profiles";
import { isStaffUser } from "@/lib/staff";
import { generateDna, generateReport, isDnaStale, isThin, REPORT_MODEL } from "@/lib/collab-report";
import { logTotal, type CallMeter } from "@/lib/ai-cost";
import { distinctTypeCount } from "@/lib/dna-pool";
import type { BrandDna, Maker } from "@/lib/types";

// 무거운 AI 호출=라우트(enrich 관례): DNA 최대 2콜 + 리포트 1콜 여유
export const maxDuration = 60;

// 리포트 모델 A/B 화이트리스트 — 클라가 임의 모델명을 넣지 못하게(비용·오작동 차단).
// ⚠️ gemini-2.5-pro는 신규 사용자에게 404("no longer available") — 실측 07-26. 신형 3.x 계열로 대체.
const MODEL_WHITELIST = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-3.1-pro-preview"];

export async function POST(req: Request) {
  // 원가·토큰 실측 누적기 — try 밖에 두어 thin·no_match 등 조기 리턴에서도 합계가 남게 한다.
  const meters: CallMeter[] = [];
  const startedAt = Date.now(); // finally의 벽시계 로그용 — try 안에 두면 스코프 밖
  let costTag = "?";
  try {
    // ① 킬스위치
    if (process.env.REPORT_DISABLED) {
      return NextResponse.json({ error: "disabled" }, { status: 503 });
    }

    let body: { fromSlug?: unknown; toSlug?: unknown; model?: unknown; force?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const fromSlug = String(body.fromSlug ?? "");
    const toSlug = String(body.toSlug ?? "");
    // A/B 실험용(로그인 필수라 외부 남용 불가): 모델은 화이트리스트만, force는 캐시 우회.
    // 일반 UI는 둘 다 안 보내므로 기본 경로 무영향. 모델 확정 후 제거 가능.
    const modelOverride = MODEL_WHITELIST.includes(String(body.model ?? "")) ? String(body.model) : null;
    const force = body.force === true;

    // ② 로그인 필수
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "auth" }, { status: 401 });

    // ③ 브랜드 로드 + 소유·자기자신 검증
    const [from, to] = await Promise.all([
      repo.getMakerBySlug(fromSlug),
      repo.getMakerBySlug(toSlug),
    ]);
    if (!from || !to) return NextResponse.json({ error: "notfound" }, { status: 404 });
    if (from.ownerUserId !== userId) {
      // 🗄 **넘긴 브랜드의 옛 리포트는 읽기만 허용**(대표 확정 08-07, B안).
      //   왜: 아카이브 목록은 "내가 요청한 것" 기준이라 소유권을 넘겨도 카드가 남는데, 열면 여기서 403이 났다
      //   (08-06 아그레아블을 지인 계정으로 이전 → /my 리포트 탭에서 그 카드가 선택 화면으로 떨어짐).
      //   ⭐읽기(저장본)와 만들기(유료 콜)를 가른다 — **새로 만드는 건 여전히 내 브랜드만**.
      //   내가 요청했던 기록이 있을 때만 열어준다(남의 쌍을 훔쳐보는 경로가 되지 않게).
      const mine = await repo.wasCollabReportRequestedBy(from.id, to.id, userId);
      const archived = mine ? await repo.getLatestCollabReport(from.id, to.id) : null;
      if (archived) {
        return NextResponse.json({
          state: "ok",
          report: archived.report,
          cached: true,
          model: archived.model,
          readOnly: true, // 클라: 소유권이 떠나 재생성 불가 — 안내만 띄우고 [다시 분석] 숨김
        });
      }
      return NextResponse.json({ error: "forbidden" }, { status: 403 }); // from은 내 브랜드만
    }
    if (from.id === to.id) return NextResponse.json({ error: "self" }, { status: 400 });
    // 내 브랜드 × 내 브랜드 차단(대표 지시 07-31, 첫 실고객 유입 시점에 원복) —
    // 매칭 정보로선 의미가 없는데 유료 콜(DNA+리포트)은 그대로 나간다. 화면(MakerActionBar)도
    // 같은 규칙으로 버튼을 감추지만, **막는 층은 여기다**(직접 호출로 뚫리면 곧 비용이다).
    // 사내 계정만 예외 — 대표가 규칙 안에서 기능을 확인해야 하므로(`lib/staff.ts`).
    if (to.ownerUserId === userId && !isStaffUser(userId)) {
      return NextResponse.json({ error: "own_brand" }, { status: 403 });
    }

    let dnaCalls = 0;
    costTag = `${from.slug}→${to.slug}`;

    // ④ DNA 확보(양쪽 병렬, stale만 재생성 — 소개서 '내용 지문' 변화 + DNA_REFRESH_BEFORE 기준)
    const ensureDna = async (m: Maker): Promise<BrandDna> => {
      const prev = await repo.getBrandDna(m.id);
      if (prev && !isDnaStale(prev, m)) return prev;
      dnaCalls += 1;
      const dna = await generateDna(m, prev ?? undefined, meters); // 재생성 시 created_at 보존
      await repo.setBrandDna(m.id, dna);
      return dna;
    };
    const [fromDna, toDna] = await Promise.all([ensureDna(from), ensureDna(to)]);

    // ⑤ thin 가드(양쪽 — 둘 다면 from 우선: 자기개선 퍼널이 먼저)
    if (isThin(fromDna)) {
      return NextResponse.json({ state: "thin", side: "from" });
    }
    if (isThin(toDna)) {
      return NextResponse.json({
        state: "thin",
        side: "to",
        distinctTypes: distinctTypeCount(toDna.items),
      });
    }

    // ⑥ 캐시 3조건(스펙 §2-2): 최신 행 존재 + 양쪽 DNA non-stale(④ 후 항상 참)
    //    + 행 created_at이 양쪽 dna.updated_at보다 최신 → 저장본 즉시 반환(Gemini 0콜)
    const latest = force ? null : await repo.getLatestCollabReport(from.id, to.id);
    if (
      latest &&
      Date.parse(latest.createdAt) > Date.parse(fromDna.updated_at) &&
      Date.parse(latest.createdAt) > Date.parse(toDna.updated_at)
    ) {
      return NextResponse.json({
        state: "ok",
        report: latest.report,
        cached: true,
        model: latest.model,
      });
    }

    // 캐시 미스 사유 관측 — "저장본 없음"인지 "DNA가 리포트보다 최신"인지 로그로 즉시 구분.
    console.log(
      `[collab-report] cache-miss ${from.slug}→${to.slug} force=${force} ` +
        `latest=${latest?.createdAt ?? "none"} fromDna=${fromDna.updated_at} toDna=${toDna.updated_at} dnaCalls=${dnaCalls}`
    );

    // ⑦ 리포트 생성 → 접점<2 또는 아이디어 0개면 no_match(정직한 빈손)
    const model = modelOverride || REPORT_MODEL();
    const { report, candidates } = await generateReport(from, fromDna, to, toDna, model, meters);
    // 관측 로그(Vercel stdout) — 후보 전체+점수·선발 결과. 채점 기준 튜닝 근거(스펙 "탈락 후보 축적"의 v1).
    console.log(
      `[collab-report] ${from.slug}→${to.slug} model=${model} dnaCalls=${dnaCalls} ` +
        `candidates=${JSON.stringify(candidates ?? [])} picked=${report?.matchPoints.length ?? 0} ideas=${report?.ideas.length ?? 0}`
    );
    if (!report) return NextResponse.json({ state: "no_match" });

    await repo.insertCollabReport({
      fromBrandId: from.id,
      toBrandId: to.id,
      requestedBy: userId,
      report,
      model,
    });
    return NextResponse.json({
      state: "ok",
      report,
      cached: false,
      model,
      durationMs: Date.now() - startedAt,
      dnaCalls,
    });
  } catch (e) {
    // ⑧ 전체 방어 — best-effort(클라는 재시도 버튼)
    console.error("[collab-report] failed:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  } finally {
    logTotal(costTag, meters, Date.now() - startedAt); // 콜 0건(캐시 히트)이면 아무것도 찍지 않는다
  }
}
