// POST /api/collab-report — 콜라보 분석 리포트 오케스트레이션.
// 인증(from은 내 브랜드만) → DNA 병렬 확보(stale만 재생성) → thin 가드 → 캐시 3조건 → 생성·저장.
// 클라이언트가 보낸 텍스트는 프롬프트에 절대 넣지 않는다 — slug만 받고 소개서·DNA는 서버가 DB에서 읽음
// (주입 차단, enrich 관례). 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md
import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { getSessionUserId } from "@/lib/profiles";
import { generateDna, generateReport, isDnaStale, isThin } from "@/lib/collab-report";
import { distinctTypeCount } from "@/lib/dna-pool";
import type { BrandDna, Maker } from "@/lib/types";

// 무거운 AI 호출=라우트(enrich 관례): DNA 최대 2콜 + 리포트 1콜 여유
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // ① 킬스위치
    if (process.env.REPORT_DISABLED) {
      return NextResponse.json({ error: "disabled" }, { status: 503 });
    }

    let body: { fromSlug?: unknown; toSlug?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const fromSlug = String(body.fromSlug ?? "");
    const toSlug = String(body.toSlug ?? "");

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
      return NextResponse.json({ error: "forbidden" }, { status: 403 }); // from은 내 브랜드만
    }
    if (from.id === to.id) return NextResponse.json({ error: "self" }, { status: 400 });

    const startedAt = Date.now();
    let dnaCalls = 0;

    // ④ DNA 확보(양쪽 병렬, stale만 재생성 — DNA_STALE_SLACK_MS·DNA_REFRESH_BEFORE 반영)
    const ensureDna = async (m: Maker): Promise<BrandDna> => {
      const prev = await repo.getBrandDna(m.id);
      if (prev && !isDnaStale(prev, m.updatedAt)) return prev;
      dnaCalls += 1;
      const dna = await generateDna(m, prev ?? undefined); // 재생성 시 created_at 보존
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
    const latest = await repo.getLatestCollabReport(from.id, to.id);
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

    // ⑦ 리포트 생성 → 접점<2 또는 아이디어 0개면 no_match(정직한 빈손)
    const model = process.env.REPORT_MODEL || "gemini-2.5-flash";
    const { report, candidates } = await generateReport(from, fromDna, to, toDna);
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
  }
}
