// 목 모드의 `repo` (2026-09-18 사이트 화면 지도) · 개발 빌드 전용
//
// ⭐`Repo` 인터페이스를 그대로 구현한다. 인터페이스에 함수가 늘면 tsc가 이 파일에서 멈춘다.
//   그래서 «목 모드에서 새 읽기 함수만 DB로 새어 나가는» 일이 구조적으로 안 난다.
// ⭐읽기는 `SupabaseRepo`와 같은 조건으로 목 세계를 거른다(검색 노출·삭제·최신순·요청자 본인 리포트만).
//   조건이 같아야 빈 목록·숨김·「다시 분석하기」가 실제와 같은 이유로 갈린다.
// 🚨쓰기는 전부 던진다. 서버 액션 첫 줄이 먼저 막으므로(첫 번째 울타리) 여기는 두 번째 울타리다.
//   조용히 성공한 척하지 않는 이유 = 첫 울타리를 빠뜨린 액션이 생기면 화면에 에러로 드러나게.
// 부르는 곳 = `repo.ts`의 `withSiteMock` 하나. 머리말 = `rent-mock.ts`.
import type { Repo } from "./repo";
import type {
  ArticleComment, BrandDna, Collab, CollabCard, CollabReportData, CollabReportListItem, MagazineArticle,
  MagazineListItem, Maker, Reaction, ViewEvent,
} from "./types";
import type { MockCase } from "./rent-mock";
import { MOCK_BLOCKED_MSG } from "./rent-mock";
import { digestHash } from "./collab-report";
import { orderedIdeaTitles } from "./report-cards";
import { isDemoSlug } from "./demo";

const blocked = (what: string): never => {
  throw new Error(`${MOCK_BLOCKED_MSG} (repo.${what})`);
};

const topRegion = (region?: string | null) => (region ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ") || undefined;
const listOf = (a: MagazineArticle): MagazineListItem => {
  const { body: _body, ...rest } = a;
  return rest;
};

export class MockRepo implements Repo {
  constructor(private m: MockCase) {}

  private get w() {
    return this.m.data;
  }
  private active() {
    return this.w.makers.filter((x) => x.status !== "inactive");
  }

  // ── 소개서 ──
  async createMaker(): Promise<Maker> { return blocked("createMaker"); }
  async getMakerBySlug(slug: string) { return this.active().find((x) => x.slug === slug) ?? null; }
  async getMakerById(id: number) { return this.active().find((x) => x.id === id) ?? null; }
  async updateMakerContent(): Promise<Maker | null> { return blocked("updateMakerContent"); }
  async setMakerFlags(): Promise<Maker | null> { return blocked("setMakerFlags"); }
  async setMakerOwner(): Promise<void> { blocked("setMakerOwner"); }
  async setMakerPasswordHash(): Promise<void> { blocked("setMakerPasswordHash"); }
  async setMakerEnrichment(): Promise<void> { blocked("setMakerEnrichment"); }
  async deleteMaker(): Promise<void> { blocked("deleteMaker"); }
  async listMakersByOwner(ownerUserId: number) {
    return this.active().filter((x) => x.ownerUserId === ownerUserId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async searchMakers(q: string) {
    const t = q.trim().toLowerCase();
    return this.active()
      .filter((x) => x.searchVisible)
      .filter((x) => !t || [x.name, x.oneLiner, x.region ?? ""].join(" ").toLowerCase().includes(t))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async listHomeMakers(limit: number) {
    return (await this.searchMakers("")).slice(0, limit);
  }
  async listSitemapBrands() {
    return this.active()
      .filter((x) => !isDemoSlug(x.slug))
      .map((x) => ({ slug: x.slug, updatedAt: x.updatedAt || x.createdAt, name: x.name, oneLiner: x.oneLiner }));
  }

  // ── 매거진 ──
  async listPublishedArticles(limit = 50) {
    return this.w.articles
      .filter((a) => a.status === "published")
      .sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1))
      .slice(0, limit)
      .map(listOf);
  }
  async getPublishedArticle(slug: string) {
    return this.w.articles.find((a) => a.slug === slug && a.status === "published") ?? null;
  }
  async listAllArticles() {
    return [...this.w.articles].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map(listOf);
  }
  async getArticleForEditor(slug: string) { return this.w.articles.find((a) => a.slug === slug) ?? null; }
  async saveArticle(): Promise<MagazineArticle> { return blocked("saveArticle"); }
  async articleSlugExists(slug: string) { return this.w.articles.some((a) => a.slug === slug); }

  // ── 카드·지표 ──
  async createCard(): Promise<CollabCard> { return blocked("createCard"); }
  async getCardBySlug(slug: string) { return this.w.cards.find((c) => c.slug === slug) ?? null; }
  async recordView(): Promise<ViewEvent> { return blocked("recordView"); }
  async countViews() { return 0; }
  async recordReaction(): Promise<Reaction> { return blocked("recordReaction"); }

  // ── 찜 ──
  async isMakerSaved(userId: number, makerId: number) {
    return this.w.saved.some((s) => s.userId === userId && s.makerId === makerId);
  }
  async setMakerSaved(): Promise<void> { blocked("setMakerSaved"); }
  async listSavedMakers(userId: number) {
    return this.w.saved
      .filter((s) => s.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((s) => this.active().find((x) => x.id === s.makerId))
      .filter((x): x is Maker => !!x);
  }

  // ── 매거진 하트·댓글 ──
  async countArticleLikes(articleId: number) { return this.w.likes.filter((l) => l.articleId === articleId).length; }
  async isArticleLiked(userId: number, articleId: number) {
    return this.w.likes.some((l) => l.userId === userId && l.articleId === articleId);
  }
  async setArticleLiked(): Promise<void> { blocked("setArticleLiked"); }
  async listArticleComments(articleId: number): Promise<ArticleComment[]> {
    return this.w.comments.filter((c) => c.articleId === articleId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async addArticleComment(): Promise<void> { blocked("addArticleComment"); }
  async deleteArticleComment(): Promise<void> { blocked("deleteArticleComment"); }
  async lastCommentAt(articleId: number, userId: number) {
    const mine = this.w.comments.filter((c) => c.articleId === articleId && c.userId === userId).map((c) => c.createdAt).sort();
    return mine.at(-1) ?? null;
  }

  async recordCollabRequest(): Promise<void> { blocked("recordCollabRequest"); }

  // ── Brand DNA · 콜라보 리포트 ──
  async getBrandDna(brandId: number): Promise<BrandDna | null> {
    const hit = this.w.dna.find((x) => x.brandId === brandId);
    const brand = this.w.makers.find((x) => x.id === brandId);
    if (!hit || !brand) return null;
    // 지문은 읽을 때 만든다. 소개서 목 데이터를 고쳐도 «신선» 케이스가 신선하게 남는다.
    return { ...hit.dna, input_hash: hit.hash === "match" ? digestHash(brand) : "mock-edited-since" };
  }
  async setBrandDna(): Promise<void> { blocked("setBrandDna"); }
  async getLatestCollabReport(fromBrandId: number, toBrandId: number) {
    const r = this.w.reports
      .filter((x) => x.fromBrandId === fromBrandId && x.toBrandId === toBrandId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    return r ? { report: r.report, model: r.model, createdAt: r.createdAt } : null;
  }
  async listLatestCollabReportsTo(fromBrandIds: number[], toBrandId: number) {
    const out = new Map<number, { report: CollabReportData; model: string; createdAt: string }>();
    for (const id of fromBrandIds) {
      const r = await this.getLatestCollabReport(id, toBrandId);
      if (r) out.set(id, r);
    }
    return out;
  }
  async wasCollabReportRequestedBy(fromBrandId: number, toBrandId: number, userId: number) {
    return this.w.reports.some((x) => x.fromBrandId === fromBrandId && x.toBrandId === toBrandId && x.requestedBy === userId);
  }
  async insertCollabReport(): Promise<void> { blocked("insertCollabReport"); }
  async listCollabReportsByUser(userId: number): Promise<CollabReportListItem[]> {
    const seen = new Set<string>();
    const items: CollabReportListItem[] = [];
    for (const r of [...this.w.reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
      if (r.requestedBy !== userId) continue;
      const key = `${r.fromBrandId}:${r.toBrandId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const from = this.active().find((x) => x.id === r.fromBrandId);
      const to = this.active().find((x) => x.id === r.toBrandId);
      if (!from || !to) continue;
      items.push({
        fromSlug: from.slug, fromName: from.name, toSlug: to.slug, toName: to.name, toRegion: topRegion(to.region),
        matchPoint: r.report.matchPoints?.[0]?.text, ideaTitles: orderedIdeaTitles(r.report), effect: r.report.effects?.[0],
        createdAt: r.createdAt, report: r.report,
      });
    }
    return items;
  }

  // ── 성사된 콜라보 ──
  async recordCollab(): Promise<void> { blocked("recordCollab"); }
  async listCollabsForBrands(brandIds: number[]): Promise<Collab[]> {
    const set = new Set(brandIds);
    return this.w.collabs
      .filter((c) => set.has(c.brandAId) || set.has(c.brandBId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async appendCollabHistory(): Promise<void> { blocked("appendCollabHistory"); }
}
