"use client";

// 성사된 콜라보 기록 — ⭐북극성을 실제로 세는 입력구. 스펙 = Obsidian [[성사-기록-계측]]
//
// 지금은 사실상 **대표 운영 도구**다(첫 1~10건은 대표가 손으로 부트스트랩한다는 미션 전제).
// 그래도 제품 UI로 만들어 두는 이유: 나중에 채팅에 "콜라보 하기로 했어요" 버튼이 붙으면
// **같은 테이블에 origin만 다르게** 쌓인다 → "제품이 언제부터 스스로 돌기 시작했나"가 한 그래프에 보인다.
import { useState, useTransition } from "react";
import { searchAction, recordCollabAction } from "@/lib/actions";

type MyBrand = { id: number; name: string };
type Hit = { id: number; name: string; oneLiner: string; region?: string };

export function CollabRecorder({ myBrands }: { myBrands: MyBrand[] }) {
  const [open, setOpen] = useState(false);
  const [brandAId, setBrandAId] = useState<number>(myBrands[0]?.id ?? 0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [origin, setOrigin] = useState<"product" | "concierge">("concierge");
  const [title, setTitle] = useState("");
  const [happenedOn, setHappenedOn] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  if (myBrands.length === 0) return null; // 내 소개서가 없으면 A(제안한 쪽)를 고를 수 없다

  const reset = () => {
    setQ(""); setHits([]); setPicked(null); setTitle(""); setHappenedOn("");
    setOrigin("concierge"); setErr(null);
  };

  const search = (text: string) => {
    setQ(text);
    setPicked(null);
    if (text.trim().length < 1) return setHits([]);
    startSearch(async () => {
      const rows = await searchAction(text);
      setHits(
        rows
          .filter((m) => m.id !== brandAId) // 나 자신은 상대 후보에서 뺀다
          .slice(0, 6)
          .map((m) => ({ id: m.id, name: m.name, oneLiner: m.oneLiner, region: m.region }))
      );
    });
  };

  const submit = () => {
    setErr(null);
    if (!picked) return setErr("상대 브랜드를 골라주세요.");
    startSave(async () => {
      const res = await recordCollabAction({
        brandAId, brandBId: picked.id, origin, title, happenedOn: happenedOn || undefined,
      });
      if (res.error) return setErr(res.error);
      reset();
      setOpen(false);
      window.location.reload(); // 목록은 서버 렌더 — 가장 단순하고 확실한 갱신
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-pill border border-border-strong px-3 py-1.5 text-[13px] font-medium text-body"
      >
        + 성사 기록
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-t-xl bg-surface p-5 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">콜라보 성사 기록</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-mute">
                  실제로 하기로 한 콜라보를 남겨두면, 나중에 몇 건이 성사됐는지 셀 수 있어요.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="text-mute">
                ✕
              </button>
            </div>

            {/* ① 내 소개서 — A(먼저 제안한 쪽). 소유 검증의 근거라 반드시 내 것 중에서 고른다 */}
            {myBrands.length > 1 && (
              <label className="mt-5 block">
                <span className="text-sm font-medium text-body">내 소개서</span>
                <select
                  value={brandAId}
                  onChange={(e) => setBrandAId(Number(e.target.value))}
                  className="mt-1.5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink"
                >
                  {myBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}

            {/* ② 상대 브랜드 */}
            <div className="mt-4">
              <span className="text-sm font-medium text-body">함께한 브랜드</span>
              {picked ? (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-sm border border-primary bg-primary-pale px-3 py-2.5">
                  <span className="truncate text-base text-ink">{picked.name}</span>
                  <button type="button" onClick={() => { setPicked(null); setQ(""); }} className="shrink-0 text-[13px] text-mute">
                    바꾸기
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={q}
                    onChange={(e) => search(e.target.value)}
                    placeholder="상호로 검색"
                    className="mt-1.5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                  />
                  {searching && <p className="mt-1.5 text-[13px] text-faint">찾는 중…</p>}
                  {!searching && q.trim() && hits.length === 0 && (
                    <p className="mt-1.5 text-[13px] text-faint">검색 결과가 없어요.</p>
                  )}
                  {hits.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => setPicked(h)}
                            className="w-full rounded-sm border border-hairline px-3 py-2 text-left"
                          >
                            <span className="block truncate text-[15px] text-ink">
                              {h.name}
                              {h.region && <span className="ml-1.5 text-[12px] text-faint">· {h.region}</span>}
                            </span>
                            <span className="block truncate text-[13px] text-mute">{h.oneLiner}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {/* ③ ⭐origin — 이 화면에서 제일 중요한 질문.
                미션의 '지표 순도 규칙': 컨시어지 성사만으로 승리 선언 금지.
                자동 판정하지 않고 사람에게 묻는 이유 = 사실을 아는 건 기록하는 사람뿐이다. */}
            <div className="mt-4">
              <span className="text-sm font-medium text-body">어떻게 시작됐나요?</span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {([
                  { v: "product", label: "collab5 보고 연락", desc: "소개서·검색을 통해" },
                  { v: "concierge", label: "직접 소개", desc: "제가 이어줬어요" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setOrigin(o.v)}
                    className={`rounded-sm border px-3 py-2.5 text-left ${
                      origin === o.v ? "border-primary bg-primary-pale" : "border-hairline"
                    }`}
                  >
                    <span className="block text-[14px] font-medium text-ink">{o.label}</span>
                    <span className="block text-[12px] text-mute">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ④ 내용·날짜 */}
            <label className="mt-4 block">
              <span className="text-sm font-medium text-body">무슨 콜라보인가요?</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 여름 팝업 같이 열기"
                className="mt-1.5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-body">언제 (선택)</span>
              <input
                type="date"
                value={happenedOn}
                onChange={(e) => setHappenedOn(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none focus:border-focus"
              />
              <span className="mt-1 block text-[12px] text-faint">
                아직 하기로만 했다면 비워두세요.
              </span>
            </label>

            {err && <p className="mt-4 rounded-sm bg-danger/10 px-3 py-2 text-[13px] text-danger">{err}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
            >
              {saving ? "기록 중…" : "기록하기"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
