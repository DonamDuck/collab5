"use client";

// 소개서 페이지 하단 고정 플로팅 액션바 — 방문자 액션 존.
// [🔗 링크복사 + ♡ 찜] = 바 위 유틸 줄(우측 정렬) / 바 안 = [콜라보 시작하기] 액션 전용. 백보드 = 흰 배경 + 상단 좌우 라운드.
// 찜·콜라보 시작 둘 다 로그인 필수 — 비로그인은 로그인 유도 후, 복귀 시 원래 의도를 자동 재개.
import { useState, useTransition, useEffect, useRef } from "react";
import { setMakerSavedAction, recordCollabRequestAction } from "@/lib/actions";
import { resolveCollabChannel } from "@/lib/links";
import { useDismissable } from "@/components/useDismissable";
import { ReportSheet } from "./ReportSheet";
import type { CollabReportData } from "@/lib/types";

// 로그인/가입 전에 눌렀던 의도를 보관하는 키(같은 탭 세션 한정) — 복귀 시 자동 재개.
const PENDING_SAVE_KEY = "collab5:pendingSave";
const PENDING_PROPOSE_KEY = "collab5:pendingPropose";
const PENDING_REPORT_KEY = "collab5:pendingReport";

// 🚧🚧 임시 스위치 (2026-07-29, 대표 콜라보 분석 테스트) 🚧🚧
//   내 소개서 페이지에서도 [콜라보 분석]·[콜라보 시작하기]가 보이게 소유자 모드를 잠시 끈다.
//   ⭐**되돌릴 때는 이 한 줄만 `true`로** — 아래 두 군데(하트 숨김·액션 분기)가 이 값을 본다.
//
//   ⚠️ 지표는 안전하다: 자기 자신에게 제안해도 `recordCollabRequestAction`의 서버 가드(`ownsBrand`)가
//      no-op이라 `collab_requests`엔 안 쌓인다. **UI만 열고 서버 안전망은 그대로 둔 것**이다.
//   ⚠️ 다만 **리포트는 진짜로 생성된다**(유료 콜 + `collab_reports`에 캐시 + `/my` 아카이브에 노출).
//      테스트로 만든 쌍은 나중에 대표가 직접 지우거나 그대로 둘지 판단할 것.
const OWNER_MODE = true; // 정상값. 07-29~31 대표 콜라보 분석 테스트 동안만 false였다(07-31 복귀)

export function MakerActionBar({
  slug,
  makerId,
  makerName,
  initialSaved,
  loggedIn,
  instagram,
  homepage,
  contactEmail,
  senderName,
  viewerBrands = [],
  isOwner = false,
  ownerCanReport = false,
}: {
  slug: string;
  makerId: number;
  makerName: string;
  initialSaved: boolean;
  loggedIn: boolean;
  instagram?: string;
  homepage?: string;
  contactEmail?: string; // 소유자 가입 이메일 — 채널(인스타/홈피) 없을 때 이메일 폴백
  senderName?: string; // 제안자 상호 — 소개서 0개일 때 인사말 폴백
  viewerBrands?: { id: number; slug: string; name: string }[]; // 제안자의 소개서들 — 어떤 걸로 제안할지 칩 선택
  /** 내가 이 소개서의 주인인가 — 주인에겐 '나에게 제안·찜'이 말이 안 되고, 눌리면 북극성 퍼널이 오염된다
   *  (07-29 디자인팀 QA 지적). 서버에도 같은 가드가 있고 여긴 화면 층. */
  isOwner?: boolean;
  /** 내 소개서에서도 [콜라보 분석]을 열어줄 것인가 — **사내 계정 전용 예외**(`lib/staff.ts`).
   *  자기 브랜드끼리의 분석은 결과가 의미 없고 유료 콜만 나가서, 일반 유저에겐 닫아둔다.
   *  isOwner가 false면 애초에 이 분기를 안 타므로 여기선 소유자일 때만 의미가 있다. */
  ownerCanReport?: boolean;
}) {
  // 🚧 위 OWNER_MODE 스위치를 통과시킨 값 — 화면 분기는 전부 이걸 본다(원래는 isOwner 그대로였다)
  const ownerUi = isOwner && OWNER_MODE;
  const [saved, setSaved] = useState(initialSaved);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<"save" | "propose" | "report">("save");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSample, setReportSample] = useState(false); // 소개서 0개 유저 — 샘플 리포트 티저
  const [reportInitialFrom, setReportInitialFrom] = useState<string | null>(null); // /my 아카이브 딥링크(?report=fromSlug) — 선택 스텝 건너뛰고 그 쌍을 바로 연다
  const [message, setMessage] = useState(""); // 추천 메시지(수정 가능)
  // 콜라보 분석에서 올라온 아이디어 — 제안 시트에서 '+'로 초안에 골라 넣는다(대표 07-31).
  // 분석을 안 돌린 사람에겐 아예 안 뜬다(빈 배열). 샘플 리포트는 올라오지 않는다(ReportSheet에서 차단).
  const [reportIdeas, setReportIdeas] = useState<CollabReportData["ideas"]>([]);
  const [addedIdeas, setAddedIdeas] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null); // 복사 완료 토스트(3종 통일)
  const [selectedSlug, setSelectedSlug] = useState(viewerBrands[0]?.slug); // 함께 보낼 내 소개서
  const [pending, start] = useTransition();

  // 오버레이 공통 동작(ESC·딤클릭·스크롤잠금·포커스 트랩·aria-modal) — 시트별로 정책이 다르다.
  //  · 제안 시트 = 딤 클릭 허용(기존 동작). 훅이 "누르기 시작한 지점도 배경이어야 닫힘"으로 판정해,
  //    메시지를 드래그로 선택하다 배경에서 손을 떼면 닫히던 사고는 사라진다(QA 07-29).
  //  · 로그인 유도 얼럿 = 딤 클릭으로 안 닫힘(대표 정책). 단 ESC는 허용 — 키보드·스크린리더
  //    사용자에겐 ESC가 사실상 유일한 탈출구다(대표 확정 07-29).
  const proposeDialog = useDismissable(proposeOpen, { onClose: () => setProposeOpen(false) });
  const loginDialog = useDismissable(loginOpen, { onClose: () => setLoginOpen(false), overlayClose: false });

  // 콜라보 연락 채널(인스타 DM 우선 → 홈페이지/카톡 → 없으면 null)
  const channel = resolveCollabChannel({ instagram, homepage });
  const selectedBrand = viewerBrands.find((b) => b.slug === selectedSlug) ?? viewerBrands[0];

  // 추천 메시지 빌더 — 아이디어를 넣으면 **템플릿 구조 자체**가 바뀐다(대표 07-31).
  //  · 아이디어 0건: 인사 → 관심 유도 인사말 → 소개 링크. **이 형태는 고정**(대표 지시 — 아이디어
  //    없는 버전은 건드리지 않는다), 최초 오픈·소개서 변경 때 여기로 초기화된다.
  //  · 아이디어 1건+: 인사 바로 뒤에 소개 링크가 "우선,"으로 앞당겨지고, 관심 유도 인사말은
  //    아이디어 목록 뒤로 밀려 마무리 멘트("혹, 저희와의 콜라보에…")로 바뀐다.
  //    소개 링크를 먼저 보여줘야 상대가 "누가 왜 이런 아이디어를 냈는지" 순서대로 읽는다.
  const buildMessage = (added: number[]) => {
    const hello = selectedBrand ? `안녕하세요, ${selectedBrand.name}입니다.` : senderName ? `안녕하세요, ${senderName}입니다.` : "안녕하세요!";
    const intro = `${hello}\ncollab5에서 소개서를 보고 함께 재미있는 콜라보를 만들어볼 수 있을 것 같아 먼저 연락드렸어요.`;
    const url = selectedBrand && typeof window !== "undefined" ? `${window.location.origin}/m/${selectedBrand.slug}` : "";

    if (added.length === 0) {
      let msg = `${intro}\n관심 있으시다면 편하실 때 답장 주시면 감사하겠습니다. 😊`;
      if (selectedBrand && url) msg += `\n\n저희 소개도 함께 보내드려요.\n${url}`;
      return msg;
    }

    let msg = intro;
    if (selectedBrand && url) msg += `\n\n우선, 저희 소개를 함께 보내드려요.\n${url}`;
    const ideaLines = added
      .map((i) => reportIdeas[i])
      .filter((idea): idea is CollabReportData["ideas"][number] => !!idea)
      .map((idea, i) => `${i + 1}.${idea.title} — ${idea.desc}`)
      .join("\n\n");
    msg += `\n\n아래는 콜라보를 함께 한다면 제안드려보고 싶은 콜라보 아이디어예요.\n${ideaLines}`;
    msg += `\n\n혹, 저희와의 콜라보에 관심 있으시다면 편하실 때 답장 주시면 감사하겠습니다. 😊`;
    return msg;
  };

  // 시트 열릴 때 / 소개서 바꿀 때 기본형(아이디어 0건)으로 다시 채운다.
  useEffect(() => {
    if (!proposeOpen) return;
    setMessage(buildMessage([]));
    setAddedIdeas([]); // 초안이 새로 채워지면 '추가됨' 표시도 원위치 — 안 그러면 넣지도 않았는데 넣은 걸로 보인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposeOpen, senderName, selectedBrand?.slug, selectedBrand?.name]);

  /** 콜라보 아이디어 1건을 추가 — 초안 전체를 아이디어 있는 템플릿으로 다시 짠다(부분 삽입이 아니다). */
  const addIdeaToMessage = (i: number) => {
    if (addedIdeas.includes(i) || !reportIdeas[i]) return;
    const next = [...addedIdeas, i];
    setAddedIdeas(next);
    setMessage(buildMessage(next));
    flash("✓ 초안에 넣었어요.");
  };

  // 로그인/가입으로 떠나기 직전, 무슨 의도였는지(찜/제안/분석) 이 업체 기준으로 남긴다.
  const markPending = () => {
    try {
      const key =
        loginReason === "propose" ? PENDING_PROPOSE_KEY : loginReason === "report" ? PENDING_REPORT_KEY : PENDING_SAVE_KEY;
      sessionStorage.setItem(key, String(makerId));
    } catch {
      /* 프라이빗 모드 등 — 실패해도 무해 */
    }
  };

  // 복귀 시 보류해둔 찜 의도가 이 업체면 자동 저장(하트 채움).
  useEffect(() => {
    if (!loggedIn || saved) return;
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem(PENDING_SAVE_KEY);
    } catch {
      return;
    }
    if (pendingId !== String(makerId)) return;
    try {
      sessionStorage.removeItem(PENDING_SAVE_KEY);
    } catch {
      /* noop */
    }
    setSaved(true); // 낙관적 — 고객은 이미 눌렀으니 즉시 채움
    setMakerSavedAction(makerId, true).then((r) => {
      if (r.error) setSaved(false);
    });
  }, [loggedIn, saved, makerId]);

  // 복귀 시 보류해둔 시트 의도(분석/제안)가 이 업체면 자동 오픈 — 하나의 effect로 순서 보장.
  // 우선순위 report > propose: 둘 다 이 업체면 report만 열고, propose 키도 함께 소비(리포트 CTA가 제안으로 이어짐).
  useEffect(() => {
    if (!loggedIn) return;
    let pendingReport: string | null = null;
    let pendingPropose: string | null = null;
    try {
      pendingReport = sessionStorage.getItem(PENDING_REPORT_KEY);
      pendingPropose = sessionStorage.getItem(PENDING_PROPOSE_KEY);
    } catch {
      return;
    }
    const wantReport = pendingReport === String(makerId);
    const wantPropose = pendingPropose === String(makerId);
    if (!wantReport && !wantPropose) return;
    try {
      if (wantReport) sessionStorage.removeItem(PENDING_REPORT_KEY);
      if (wantPropose) sessionStorage.removeItem(PENDING_PROPOSE_KEY);
    } catch {
      /* noop */
    }
    if (wantReport) {
      setReportSample(viewerBrands.length === 0); // 로그인했지만 소개서 0개 → 샘플 티저
      setReportOpen(true);
    } else {
      setProposeOpen(true);
    }
  }, [loggedIn, makerId, viewerBrands.length]);

  // /my 리포트 아카이브 딥링크 — ?report={fromSlug}면 그 쌍의 시트를 바로 연다(캐시면 즉시·0콜).
  // window.location으로 1회만 읽고 URL에서 지운다(useSearchParams+Suspense 불필요, 새로고침 재발동 방지).
  // 비로그인이거나 fromSlug가 내 소개서가 아니면 조용히 무시(링크 공유·소개서 연결 해제 케이스).
  useEffect(() => {
    if (!loggedIn) return;
    let fromSlug: string | null = null;
    try {
      const url = new URL(window.location.href);
      fromSlug = url.searchParams.get("report");
      if (!fromSlug) return;
      url.searchParams.delete("report");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      return;
    }
    if (!viewerBrands.some((b) => b.slug === fromSlug)) return;
    setReportInitialFrom(fromSlug);
    setReportSample(false);
    setReportOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // 찜 토글 — 비로그인은 로그인 유도, 로그인은 낙관적 저장(실패 시 롤백).
  const toggleHeart = () => {
    if (!loggedIn) {
      setLoginReason("save");
      setLoginOpen(true);
      return;
    }
    const next = !saved;
    setSaved(next);
    start(async () => {
      const r = await setMakerSavedAction(makerId, next);
      if (r.error) {
        setSaved(!next); // 롤백
        alert(r.error);
      }
    });
  };

  // 콜라보 시작하기 — 비로그인은 로그인 유도, 로그인은 제안 시트.
  const handlePropose = () => {
    if (!loggedIn) {
      setLoginReason("propose");
      setLoginOpen(true);
      return;
    }
    setProposeOpen(true);
  };

  // 콜라보 분석 — 비로그인=로그인 유도 / 소개서 0개=샘플 티저 / 그 외=정상 분석 시트.
  const handleReport = () => {
    if (!loggedIn) {
      setLoginReason("report");
      setLoginOpen(true);
      return;
    }
    setReportSample(viewerBrands.length === 0);
    setReportOpen(true);
  };

  // 텍스트 복사 — clipboard API 우선, 실패 시 레거시 execCommand. (제스처 내 동기 실행 가능)
  const copyText = (text: string) => {
    const legacy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    };
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(legacy);
      else legacy();
    } catch {
      legacy();
    }
  };

  // 복사 완료 토스트 3종 통일 — 어디서 복사하든 이 헬퍼로.
  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2000);
  };

  // ⭐북극성 계측 = "연락 시도" 1건. **시트를 여는 게 아니라 실제로 연락 수단을 손에 쥔 순간**을 센다
  //   (대표 확정 2026-07-29). 그래서 DM 열기·메시지 복사·이메일 복사 셋 다 여기로 들어온다.
  //   ⚠️ 시트 한 번 열림당 1건만 — 복사하고 나서 DM 열기까지 누르면 한 사람이 2건으로 부풀기 때문.
  const recordedRef = useRef(false);
  const recordOnce = (ch: string) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    recordCollabRequestAction(makerId, ch, selectedBrand?.id).catch(() => {});
  };
  useEffect(() => {
    if (proposeOpen) recordedRef.current = false; // 시트를 새로 열면 다시 셀 수 있게
  }, [proposeOpen]);

  // Primary — 메시지 복사 + 상대 채널 오픈(제스처 내 즉시, 팝업 차단 회피) + 계측(best-effort).
  // ⚠️ **시트를 닫지 않는다**(07-31 대표 QA). 전엔 여기서 setProposeOpen(false)를 불러서, 인스타를
  //    갔다가 브라우저로 돌아오면 초안도 아이디어 선택도 전부 사라져 있었다. 실제 사용은 한 번에
  //    안 끝난다 — 붙여넣다 실패하거나, 앱에서 상대를 못 찾거나, 문구를 다시 보고 싶어서 돌아온다.
  //    닫는 건 사용자가 X를 누를 때뿐. (탭 전환이라 페이지는 살아 있어 state가 그대로 남는다.)
  const proposeAndSend = () => {
    if (!channel) return;
    copyText(message);
    flash("✓ 메시지를 복사했어요.");
    window.open(channel.url, "_blank", "noopener,noreferrer");
    recordOnce(channel.channel);
  };

  // Secondary — 메시지만 복사(시트 유지 + 토스트).
  // 여기도 계측한다 — 복사만 하고 인스타 앱에서 직접 보내는 사람이 실제로 많은데, 전엔 통째로 안 세어졌다.
  const copyMessageOnly = () => {
    copyText(message);
    flash("✓ 메시지를 복사했어요.");
    recordOnce(channel?.channel ?? "copy");
  };

  // 이메일 폴백 Primary — 이메일 주소 복사(채널 오픈 없음, 시트 유지 + 토스트) + 계측.
  const copyEmailOnly = () => {
    if (!contactEmail) return;
    copyText(contactEmail);
    flash("✓ 이메일 주소를 복사했어요.");
    recordOnce("email");
  };

  const isInstagram = channel?.channel === "instagram";
  // 좌우 2버튼이 되면서 라벨을 짧게 잘랐다(대표 07-31). "메시지 복사하고 …"는 두 버튼 폭에 안 들어간다.
  // ⚠️ 동작은 그대로 **복사 + 채널 열기**다 — 눌러도 클립보드가 비어 있으면 붙여넣을 게 없다.
  //    그래서 누르는 즉시 "✓ 메시지를 복사했어요" 토스트가 떠서 복사됐음을 알려준다.
  const proposePrimaryLabel = !channel
    ? "이메일 주소 복사"
    : isInstagram
      ? "인스타 DM 보내기"
      : "채널 열고 보내기";

  // 소개서 링크 복사 — copyText + flash로 정리(pill 라벨은 정적 고정).
  const copy = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    copyText(url);
    flash("✓ 소개서 링크를 복사했어요.");
  };

  const loginTitle =
    loginReason === "report"
      ? "콜라보 분석을 보려면 로그인이 필요해요"
      : loginReason === "propose"
        ? "콜라보를 시작하려면 로그인이 필요해요"
        : "찜하려면 로그인이 필요해요";
  const loginSub =
    loginReason === "report"
      ? "로그인하면 두 브랜드의 콜라보 가능성을 AI가 분석해드려요."
      : loginReason === "propose"
        ? "로그인하면 마음에 드는 브랜드와 콜라보를 시작할 수 있어요."
        : "마음에 드는 브랜드를 저장해두고 언제든 다시 만나보세요.";

  // 함께 보낼 내 소개서 — 0개=섹션 없음 / 1개=명시 / 2개+=브랜드명 칩 선택
  const brandPicker =
    viewerBrands.length === 0 ? null : (
      <div className="mt-4 rounded-md border border-hairline bg-surface-soft p-3">
        <p className="text-[13px] font-medium text-body">
          함께 보낼 내 소개서{viewerBrands.length > 1 ? " (하나만 골라요)" : ""}
        </p>
        {viewerBrands.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {viewerBrands.map((b) => {
              const on = b.slug === selectedBrand?.slug;
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => setSelectedSlug(b.slug)}
                  className={`h-8 rounded-pill px-3 text-[13px] font-medium transition-colors ${
                    on ? "bg-primary text-primary-on" : "border border-border-strong bg-surface text-body"
                  }`}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[15px] font-medium text-ink">🏷 {selectedBrand?.name}</p>
        )}
        {selectedBrand && (
          <p className="mt-2 text-[12px] text-faint break-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/m/{selectedBrand.slug}
          </p>
        )}
      </div>
    );

  // 콜라보 아이디어 넣기 — 분석을 본 사람에게만 뜬다(대표 07-31: "리포트를 DM에 담을 방법이 없다").
  // ⚠️ 전체 리포트를 통째로 붙이지 않는다. DM에 리포트를 쏟으면 읽히지 않고, 남의 브랜드 분석을
  //    상대에게 그대로 전달하는 모양새가 된다. **아이디어만, 고른 것만** 초안에 들어간다.
  const ideaPicker =
    reportIdeas.length === 0 ? null : (
      <div className="mt-3 rounded-md border border-hairline bg-surface-soft p-3">
        <p className="text-[13px] font-medium text-body">
          메시지 초안에 콜라보 아이디어 추가하기! <span className="text-faint">(고른 것만 들어가요)</span>
        </p>
        <div className="mt-2 space-y-1.5">
          {reportIdeas.map((idea, i) => {
            const on = addedIdeas.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => addIdeaToMessage(i)}
                disabled={on}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                  on
                    ? "border-hairline bg-surface-soft text-faint"
                    : "border-border-strong bg-surface text-ink hover:bg-primary-pale"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-[13px] font-bold ${
                    on ? "bg-hairline text-faint" : "bg-primary text-primary-on"
                  }`}
                >
                  {on ? "✓" : "+"}
                </span>
                {/* 제목만 — `idea.method`(제품 스팟 소개·협동 워크숍 …) 칩은 뺐다(대표 지시 07-31).
                    칩이 폭을 먹어 **정작 고르는 기준인 제목이 6~8자에서 잘렸다**("드립커피와 조각 …").
                    분류는 지금 고르는 판단에 쓰이지 않는다 — 초안에 들어가는 건 제목이다. */}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{idea.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

  // 제안 시트 ↔ 분석 시트 왕복 — 뒤로 가기(대표 07-31: "왔다갔다 할 수 있게").
  // 가는 길(분석→제안)은 ReportSheet의 onPropose CTA가 이미 담당하니, 여긴 오는 길만 있으면 된다.
  // 예전엔 본문 안 텍스트 링크("제안 전에 분석을 볼까요?")였는데, 제목 옆 화살표로 격을 낮추고
  // 상시 노출한다 — 분석은 어느 진입 경로에서든 늘 의미 있는 액션이라 조건부로 숨길 이유가 없다.
  const backToReport = () => {
    setProposeOpen(false);
    handleReport();
  };

  return (
    <>
      {/* 하단 고정 플로팅 — 640px 중앙, 모바일·데스크탑 공통. 좌우 마진 없이 화면 끝까지(바텀시트) */}
      <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
        <div className="relative mx-auto w-full max-w-[640px]">
          {/* 유틸 줄 — 바 위 우측. [🔗 링크 복사][♡ 찜] */}
          <div className="absolute -top-[52px] right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={copy}
              aria-label="링크 복사"
              className="flex h-10 items-center gap-1.5 rounded-pill bg-primary px-4 text-sm font-medium text-primary-on shadow-e2 transition-colors"
            >
              🔗 링크 복사
            </button>

            {/* 찜 하트 — 빈 → 채워진 빨강 토글. 내 소개서면 숨김(내가 나를 찜하는 건 신호가 아니다) */}
            {!ownerUi && (
            <button
              type="button"
              onClick={toggleHeart}
              disabled={pending}
              role="switch"
              aria-checked={saved}
              aria-label={saved ? "찜 해제" : "찜하기"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border border-hairline bg-surface shadow-e2 transition-colors ${
                saved ? "text-red-500" : "text-faint hover:text-body"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill={saved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 20.5l-7.19-7.12a4.6 4.6 0 0 1 6.5-6.5l.69.68.69-.68a4.6 4.6 0 1 1 6.5 6.5L12 20.5z"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            )}
          </div>

          {/* 백보드 바 — 흰 배경 + 상단 좌우 라운드. 콜라보 액션 전용 */}
          <div className="flex items-center gap-2.5 rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-e2">
            {ownerUi ? (
              /* 내 소개서 모드 — '제안'은 자기 자신에게 보내는 거라 말이 안 된다(북극성 퍼널 오염).
                 **분석도 기본은 닫는다**(대표 지시 07-31, 첫 실고객 유입 시점에 원복):
                 내 브랜드 × 내 브랜드 조합은 매칭 정보로서 의미가 없는데 유료 콜은 그대로 나간다.
                 단 대표는 그 규칙 안에서 기능을 확인해야 하므로 **사내 계정에만** 분석을 남긴다
                 (`ownerCanReport` ← `lib/staff.ts`). 서버(`/api/collab-report`)에도 같은 가드가 있다. */
              <>
                {ownerCanReport && (
                  <button
                    type="button"
                    onClick={handleReport}
                    className="flex h-12 flex-[0.8] items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink transition-colors"
                  >
                    콜라보 분석
                  </button>
                )}
                <a
                  href={`/register?edit=${slug}`}
                  className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on transition-colors"
                >
                  소개서 수정하기
                </a>
              </>
            ) : (
              <>
                {/* 콜라보 분석 — 고스트(왼쪽) */}
                <button
                  type="button"
                  onClick={handleReport}
                  className="flex h-12 flex-[0.8] items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink transition-colors"
                >
                  콜라보 분석
                </button>
                {/* 콜라보 시작하기 — primary */}
                <button
                  type="button"
                  onClick={handlePropose}
                  className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on transition-colors"
                >
                  콜라보 시작하기
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 콜라보 제안 시트 — 앱 내 채팅 준비 전까지 인스타 등으로 핸드오프 */}
      {proposeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 print:hidden" {...proposeDialog.overlayProps}>
          {/* ⚠️ max-h(dvh)+스크롤 — 없으면 내용이 뷰포트보다 길 때 시트가 위로 넘쳐 제목과 닫기 X가
              화면 밖으로 밀리는데, 배경 스크롤은 잠겨 있어 도달할 방법이 없다(QA 07-29). */}
          {/* 고정 푸터 구조(07-31 대표 요청) — 예전엔 패널 자체가 스크롤 컨테이너라 버튼이 본문 맨 아래
              따라다녔다. 초안에 아이디어를 넣으면 본문이 길어져 버튼이 더 멀어진다 → **본문만 스크롤,
              버튼은 하단 고정**. 리포트 시트가 이미 쓰는 패턴(고정 바 + 스크롤 영역)을 그대로 맞춘다. */}
          <div
            {...proposeDialog.panelProps}
            className="relative flex max-h-[85dvh] w-full max-w-[640px] flex-col rounded-t-2xl border border-b-0 border-hairline bg-surface shadow-e2"
          >
            {/* 고정 내비 바 — [← 뒤로] … [닫기 X]. 07-31 대표 QA: 뒤로가기가 제목 옆에 붙어 있으니
                제목이 화살표만큼 들여쓰여 어색했다(제목 = 시트의 첫 문장인데 왼쪽 정렬이 깨짐).
                둘 다 '창 조작'이라 성격이 같으니 한 줄에 모으고, 제목은 그 아래에서 온전히 시작한다.
                리포트 시트의 고정 바와 같은 구조 — 두 시트를 오갈 때 조작부 위치가 안 흔들린다. */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-3 py-2.5">
              <button
                type="button"
                onClick={backToReport}
                aria-label="뒤로: 콜라보 분석 보기"
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 4l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setProposeOpen(false)}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4 pb-4">
              <p className="text-xl font-bold break-keep text-ink">{makerName}님과 콜라보 시작하기</p>
              {channel ? (
                <>
                  <p className="mt-2 text-[15px] leading-relaxed text-mute">
                    아직 앱 내 채팅은 준비 중이에요.
                    <br />
                    그전까지는 아래 메시지를 복사해 {isInstagram ? "인스타그램으로" : "아래 채널로"} 연락해보세요.
                  </p>
                  <label className="mt-3 block text-[13px] font-medium text-body">메시지 초안 (자유롭게 수정해보세요)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={7}
                    className="mt-1.5 w-full resize-none rounded-md border border-border-strong bg-surface-soft p-3 text-[14px] leading-relaxed text-ink focus:border-primary focus:outline-none"
                  />
                  {ideaPicker}
                  {brandPicker}
                </>
              ) : contactEmail ? (
                <>
                  <p className="mt-2 text-[15px] leading-relaxed text-mute">
                    아직 앱 내 채팅은 준비 중이에요.
                    <br />
                    그전까지는 아래 이메일로 연락해보세요.
                  </p>
                  <p className="mt-3 text-[14px] text-body break-all select-all">{contactEmail}</p>
                  <label className="mt-3 block text-[13px] font-medium text-body">메시지 초안 (자유롭게 수정해보세요)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={7}
                    className="mt-1.5 w-full resize-none rounded-md border border-border-strong bg-surface-soft p-3 text-[14px] leading-relaxed text-ink focus:border-primary focus:outline-none"
                  />
                  {ideaPicker}
                  {brandPicker}
                </>
              ) : (
                <p className="mt-2 text-[15px] leading-relaxed text-mute">
                  아직 {makerName}님의 연락처가 준비되지 않았어요.
                  <br />
                  조금만 기다려 주세요.
                </p>
              )}
            </div>

            {/* 고정 액션 바 — 좌:복사(고스트) / 우:보내기(primary). 연락 수단이 아예 없으면 안 그린다. */}
            {(channel || contactEmail) && (
              <div className="shrink-0 border-t border-hairline bg-surface px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyMessageOnly}
                    className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-strong bg-surface text-[15px] font-medium text-ink"
                  >
                    메시지 초안 복사
                  </button>
                  <button
                    type="button"
                    onClick={channel ? proposeAndSend : copyEmailOnly}
                    className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-[15px] font-medium text-primary-on"
                  >
                    {proposePrimaryLabel}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 콜라보 분석 리포트 시트 — CTA는 리포트 닫고 제안 시트로 */}
      <ReportSheet
        onReportLoaded={(r) => setReportIdeas(r.ideas)}
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportInitialFrom(null); // 딥링크 소비 후엔 일반 동선으로 복귀(다음 오픈은 선택 스텝부터)
        }}
        initialFromSlug={reportInitialFrom}
        fromBrands={viewerBrands}
        toSlug={slug}
        toName={makerName}
        sampleMode={reportSample}
        onPropose={() => {
          setReportOpen(false);
          setProposeOpen(true);
        }}
      />

      {/* 복사 완료 토스트 (3종 통일 — 링크/메시지/이메일 주소) */}
      {toast && (
        // pointer-events-none: 토스트가 링크복사·찜 버튼, 제안 시트 CTA와 겹치는 자리에 떠서
        //   2초 동안 그 아래 버튼의 탭을 가로챘다(QA 07-29). 위치도 하단 UI 스택 위로 올린다.
        // role=status: 스크린리더가 복사 완료를 읽도록(design.md 계약).
        // ⚠️ 오프셋을 proposeOpen으로 분기(07-31 대표 QA: "공중에 붕 떴다"). 예전엔 9.5rem 고정값이었는데,
        //    그건 제안 시트가 버튼 2개를 세로로 쌓던 옛 레이아웃(07-30 이전) 높이에 맞춘 값이었다.
        //    지금은 ①제안 시트=좌우 2버튼 한 줄(고정 푸터) — 실측 갭 16px
        //    ②시트 닫힌 기본 화면 — 걸림돌은 메인 바가 아니라 **그 위에 얹힌 유틸 줄**
        //    (🔗링크복사·♡찜, `-top-[52px]`로 바 위에 떠 있다. 실측 utilTop=130px) — 실측 갭 15px.
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 rounded-pill bg-ink px-4 py-2.5 text-[13px] font-medium text-surface shadow-e2 print:hidden ${
            proposeOpen
              ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(8.5rem+env(safe-area-inset-bottom))]"
          }`}
        >
          {toast}
        </div>
      )}

      {/* 비로그인 → 로그인 유도 얼럿 (찜/제안 공용) */}
      {loginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...loginDialog.overlayProps}>
          <div
            {...loginDialog.panelProps}
            className="relative w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2"
          >
            {/* 우측 상단 닫기 */}
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>

            <p className="px-6 text-xl font-bold leading-snug text-balance break-keep text-ink">{loginTitle}</p>
            <p className="mt-2 text-base leading-relaxed text-balance break-keep text-mute">{loginSub}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setLoginOpen(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
              >
                취소
              </button>
              <a
                href={`/login?redirect=${encodeURIComponent(`/m/${slug}`)}`}
                onClick={markPending}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-on"
              >
                로그인
              </a>
            </div>
            <p className="mt-4 text-[13px] text-mute">
              아직 회원이 아니신가요?{" "}
              <a href="/signup" onClick={markPending} className="font-medium text-ink underline underline-offset-2">
                회원가입
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
