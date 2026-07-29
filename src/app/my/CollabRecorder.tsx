"use client";

// 성사된 콜라보 기록 — ⭐북극성을 실제로 세는 입력구. 스펙 = Obsidian [[성사-기록-계측]]
//
// ⭐폼이 소개서 "함께한 콜라보" 카드와 **같은 모양**이다(대표 지시 07-29):
//   제목 · 연도 · 설명 · 사진 · 링크. 같은 모양이어야 성사 기록이 그대로 소개서 이력으로 흘러간다(F5 → F6).
//   여기에 소개서엔 없는 항목이 딱 하나 붙는다 — **origin**(제품 경유/직접 소개).
//   그건 내부 지표라 **공개 소개서로는 절대 안 나간다**(actions에서 이력으로 옮길 때 제외).
//
// 지금은 사실상 대표 운영 도구지만, 채팅에 "콜라보 하기로 했어요"가 붙으면
// **같은 테이블에 origin만 다르게** 쌓인다 → "제품이 언제부터 스스로 돌기 시작했나"가 한 목록에 보인다.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { searchAction, recordCollabAction } from "@/lib/actions";
import { uploadPhoto } from "@/lib/upload";
import { useDismissable } from "@/components/useDismissable";
import { PhotoGrid } from "../register/PhotoGrid";

type MyBrand = { id: number; name: string };
type Hit = { id: number; name: string; oneLiner: string; region?: string };
type Ph = { url: string; uploading?: boolean };

const YEARS = Array.from({ length: 2030 - 1991 + 1 }, (_, i) => String(2030 - i));
const PHOTO_MAX = 5;

export function CollabRecorder({ myBrands }: { myBrands: MyBrand[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 작성 중인 폼(8칸)이라 딤 클릭으로 닫지 않는다 — 배경을 실수로 터치하면 쓰던 내용이
  // 확인 없이 통째로 사라졌다(대표 정책 + QA 07-29). 닫기는 ESC 또는 X 버튼으로.
  // 훅이 배경 스크롤 잠금도 함께 건다(전엔 없어서 뒤 페이지가 같이 스크롤됐다).
  const dialog = useDismissable(open, { onClose: () => setOpen(false), overlayClose: false });
  const [brandAId, setBrandAId] = useState<number>(myBrands[0]?.id ?? 0);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [origin, setOrigin] = useState<"product" | "concierge">("concierge");
  const [title, setTitle] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState("");
  const [desc, setDesc] = useState("");
  const [photos, setPhotos] = useState<Ph[]>([]);
  const [link, setLink] = useState("");
  const [alsoAdd, setAlsoAdd] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false); // 완료 안내 — 전엔 새로고침만 되고 아무 말이 없었다
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();


  const reset = () => {
    setQ(""); setHits([]); setPicked(null); setTitle(""); setYear(""); setDesc("");
    setPhotos([]); setLink(""); setOrigin("concierge"); setAlsoAdd(true); setErr(null);
  };

  // 브랜드 검색 — 타이핑마다 서버로 나가던 것을 디바운스 + 응답 경쟁 차단으로 정리(QA #20).
  //   ⚠️ '캔버스가든'을 치면 조회가 6~7번 나갔고, 더 나쁜 건 **먼저 보낸 짧은 질의의 응답이
  //      늦게 도착하면 그 결과가 최신 목록을 덮었다**(경쟁 상태). 한 글자 질의는 결과가 많아
  //      느리기 쉬워서 실제로 잘 일어난다.
  //   → `seq`로 "내가 마지막으로 쏜 요청"만 반영한다. 최소 2자(1자는 후보가 너무 넓다).
  const seq = useRef(0);
  const search = (text: string) => {
    setQ(text);
    setPicked(null);
  };
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchAction(q);
        if (mine !== seq.current) return; // 더 최근 질의가 이미 나갔다 — 이 응답은 버린다
        setHits(
          rows
            .filter((m) => m.id !== brandAId) // 나 자신은 상대 후보에서 뺀다
            .slice(0, 6)
            .map((m) => ({ id: m.id, name: m.name, oneLiner: m.oneLiner, region: m.region }))
        );
      });
    }, 280);
    return () => clearTimeout(t);
  }, [q, brandAId]);

  // ⚠️ 조기 반환은 **훅을 전부 부른 뒤**에 — 위에 두면 myBrands가 비었을 때 훅 개수가 달라져
  //    Rules of Hooks를 어긴다(디바운스 useEffect를 추가하며 드러남).
  if (myBrands.length === 0) return null; // 내 소개서가 없으면 A(제안한 쪽)를 고를 수 없다

  // 사진 업로드 — register와 같은 규율: 선택 즉시 업로드, 실패하면 지우고 한 번만 알린다.
  // uploadPhoto에 단계별 타임아웃이 있어 무한 스피너로 갇히지 않는다(07-29 수정).
  const addPhotos = (files: FileList | null) => {
    let alerted = false;
    Array.from(files ?? [])
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, Math.max(0, PHOTO_MAX - photos.length))
      .forEach((f) => {
        const preview = URL.createObjectURL(f);
        setPhotos((p) => [...p, { url: preview, uploading: true }]);
        uploadPhoto(f, 800)
          .then((url) => setPhotos((p) => p.map((x) => (x.url === preview ? { url } : x))))
          .catch((e: unknown) => {
            setPhotos((p) => p.filter((x) => x.url !== preview));
            console.warn("[collab-photo]", (e as Error)?.message, f.name);
            if (alerted) return;
            alerted = true;
            alert("사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
          });
      });
  };

  const uploading = photos.some((p) => p.uploading);

  const submit = () => {
    setErr(null);
    if (!picked) return setErr("함께한 브랜드를 골라주세요.");
    // ⚠️ 제목은 서버도 막지만 **여기서 먼저 잡는다** — 서버까지 갔다 오면 왕복 뒤에 실패하고,
    //    그 에러는 폼 맨 아래에 뜨는데 정작 비어 있는 칸은 스크롤 한참 위에 있다(QA #18).
    if (!title.trim()) {
      setErr("콜라보 제목을 적어주세요.");
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 320);
      return;
    }
    startSave(async () => {
      const res = await recordCollabAction({
        brandAId,
        brandBId: picked.id,
        origin,
        title,
        year,
        description: desc,
        photos: photos.filter((p) => !p.uploading).map((p) => ({ u: p.url })),
        link,
        alsoAddToProfile: alsoAdd,
      });
      if (res.error) return setErr(res.error);
      reset();
      setOpen(false);
      // ⚠️ `window.location.reload()`였다 — 흰 화면이 깜빡이고 **완료 안내가 없어서**
      //    목록을 눈으로 뒤져야 했다(못 찾으면 같은 걸 또 기록한다). `router.refresh()`는
      //    서버 컴포넌트만 다시 받아 화면이 유지된다(MakerRow와 같은 패턴).
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    });
  };

  const field = "mt-1.5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // ⭐북극성 탭의 **유일한 행동 버튼**인데 높이가 31px이라 44px 규칙에 한참 못 미쳤다(QA #21).
        //    ConnectMaker와 같은 시그니처로 맞춰 손가락으로 누를 수 있게 한다.
        className="inline-flex h-11 shrink-0 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
      >
        + 성사 기록
      </button>

      {/* 완료 안내 — 전엔 새로고침만 되고 아무 말이 없어서 **목록을 눈으로 뒤져야** 했다.
          못 찾으면 같은 콜라보를 또 기록하게 된다(북극성 숫자가 부풀어 오른다). */}
      {saved && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <p
            role="status"
            aria-live="polite"
            className="rounded-pill bg-ink px-4 py-2.5 text-sm font-medium text-on-dark shadow-e2"
          >
            성사 기록을 남겼어요.
          </p>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" {...dialog.overlayProps}>
          {/* max-h는 dvh — iOS Safari의 vh는 'URL바 숨은 큰 뷰포트' 기준이라 URL바가 떠 있으면 상단이 밀린다. */}
          <div
            {...dialog.panelProps}
            className="max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-t-xl bg-surface p-5 sm:rounded-xl"
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
                <select value={brandAId} onChange={(e) => setBrandAId(Number(e.target.value))} className={field}>
                  {myBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}

            {/* ② 함께한 브랜드 = 이력 카드의 '함께한 곳' */}
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
                  <input value={q} onChange={(e) => search(e.target.value)} placeholder="상호로 검색" className={field} />
                  {searching && <p className="mt-1.5 text-[13px] text-faint">찾는 중…</p>}
                  {/* ⚠️ "검색 결과가 없어요"만으론 **왜 없는지**를 모른다 — collab5에 소개서가 있는
                      브랜드만 고를 수 있다는 게 이 화면의 규칙인데 어디에도 안 적혀 있었다(QA #33). */}
                  {!searching && q.trim().length >= 2 && hits.length === 0 && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                      collab5에 소개서가 있는 브랜드만 고를 수 있어요. 아직 없다면 상대에게{" "}
                      <Link href="/register" className="font-medium text-primary-on underline underline-offset-2">
                        소개서 만들기
                      </Link>
                      를 권해보세요.
                    </p>
                  )}
                  {hits.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button type="button" onClick={() => setPicked(h)} className="w-full rounded-sm border border-hairline px-3 py-2 text-left">
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

            {/* ③ ⭐origin — 이 화면에서 제일 중요한 질문이자 **소개서엔 안 나가는 유일한 항목**.
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
                    className={`rounded-sm border px-3 py-2.5 text-left ${origin === o.v ? "border-primary bg-primary-pale" : "border-hairline"}`}
                  >
                    <span className="block text-[14px] font-medium text-ink">{o.label}</span>
                    <span className="block text-[12px] text-mute">{o.desc}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-faint">이 항목만 소개서에는 안 나가요 (내부 지표).</p>
            </div>

            {/* ④~⑦ 여기부터는 소개서 "함께한 콜라보" 카드와 같은 필드 */}
            <label className="mt-4 block">
              <span className="text-sm font-medium text-body">콜라보 제목</span>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 여름 팝업 같이 열기"
                aria-invalid={!!err && !title.trim() ? true : undefined}
                className={`${field} ${!!err && !title.trim() ? "border-danger" : ""}`}
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-body">연도 (선택)</span>
              <select value={year} onChange={(e) => setYear(e.target.value)} className={field}>
                <option value="">아직 안 정했어요</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-body">콜라보 설명 (선택)</span>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="어떤 콜라보였는지 편하게 적어주세요."
                className="m-0 mt-1.5 w-full resize-none rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
              />
            </label>

            <div className="mt-4">
              <span className="text-sm font-medium text-body">사진 (선택)</span>
              <div className="mt-1.5">
                <PhotoGrid
                  items={photos}
                  max={PHOTO_MAX}
                  onAdd={addPhotos}
                  onRemove={(i) => setPhotos((p) => p.filter((_, k) => k !== i))}
                  onReorder={(from, to) =>
                    setPhotos((p) => {
                      const n = [...p];
                      const [m] = n.splice(from, 1);
                      n.splice(to, 0, m);
                      return n;
                    })
                  }
                />
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-body">링크 (선택)</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={field} />
            </label>

            {/* ⑧ 소개서로 흘려보내기 — 기본 켬. 공개 콘텐츠라 끌 수 있게 둔다. */}
            <label className="mt-5 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={alsoAdd}
                onChange={(e) => setAlsoAdd(e.target.checked)}
                // accent-ink — 브라우저 기본 체크박스는 파란색이라 07-29 '포커스=잉크' 결정과 어긋난다
                className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
              />
              <span className="text-[13px] leading-relaxed text-body">
                소개서 <span className="font-medium">함께한 콜라보</span>에도 추가할게요
                <span className="block text-[12px] text-faint">공개되는 내용이에요. 끄면 성사 기록만 남아요.</span>
              </span>
            </label>

            {/* role=alert — 지금까진 에러가 라이브 리전이 아니라 스크린리더가 아무 안내도 못 들었다(QA #16·#18) */}
            {err && (
              <p role="alert" className="mt-4 rounded-sm bg-danger/10 px-3 py-2 text-[13px] text-danger">
                {err}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={saving || uploading}
              className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
            >
              {uploading ? "사진 올리는 중…" : saving ? "기록 중…" : "기록하기"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
