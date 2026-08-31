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
import { orderIdeaCards, type IdeaCard } from "@/lib/report-cards";
import { track } from "@/lib/track";

// 로그인/가입 전에 눌렀던 의도를 보관하는 키(같은 탭 세션 한정) — 복귀 시 자동 재개.
const PENDING_SAVE_KEY = "collab5:pendingSave";
const PENDING_PROPOSE_KEY = "collab5:pendingPropose";
const PENDING_REPORT_KEY = "collab5:pendingReport";

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
  collabPaused = false,
  ownerCanReport = false,
  cachedReports,
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
  /** 이 소개서가 [콜라보 요청 잠시 안받기] 중인가(08-12 대표 지시 — 계단뿌셔클럽 사장님 피드백).
   *  ⚠️**막는 곳이 버튼 하나가 아니다.** 제안 시트로 들어오는 길이 넷이다 —
   *    버튼 · 로그인 복귀(sessionStorage) · `?report&propose=1` 딥링크 · 리포트 시트 CTA.
   *    그래서 화면 분기만 하지 않고 `openPropose()` 한 군데에서 잠근다. */
  collabPaused?: boolean;
  /** 내 소개서에서도 [콜라보 분석]을 열어줄 것인가 — **사내 계정 전용 예외**(`lib/staff.ts`).
   *  자기 브랜드끼리의 분석은 결과가 의미 없고 유료 콜만 나가서, 일반 유저에겐 닫아둔다.
   *  isOwner가 false면 애초에 이 분기를 안 타므로 여기선 소유자일 때만 의미가 있다. */
  ownerCanReport?: boolean;
  /** 서버(`page.tsx`)가 미리 훑어 둔 "DNA 안 바뀐" 쌍들 — fromSlug별 리포트 맵.
   *  ReportSheet로 그대로 전달만 한다(08-09) — /my와 같은 "로딩 화면 없이 바로 열기" 경험. */
  cachedReports?: Record<string, CollabReportData>;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<"save" | "propose" | "report">("save");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSample, setReportSample] = useState(false); // 소개서 0개 유저 — 샘플 리포트 티저
  const [reportInitialFrom, setReportInitialFrom] = useState<string | null>(null); // /my 아카이브 딥링크(?report=fromSlug) — 선택 스텝 건너뛰고 그 쌍을 바로 연다
  const [restoreReport, setRestoreReport] = useState(false); // 제안 시트 [← 뒤로] — 방금 본 리포트를 그대로 되살린다(아래 backToReport 주석)
  // /my 시트의 제안 CTA에서 `&propose=1`로 넘어왔나 — 리포트가 뜨는 즉시 제안 시트로 넘긴다(1회성).
  // ⚠️ state가 아니라 ref다: 이 값이 바뀌었다고 리렌더가 필요하진 않고, 오히려 state면 리포트 로드 →
  //    리렌더 → 이펙트 재실행 순서에 얽힌다. 소비 즉시 false로 내려 중복 발동을 막는다.
  const autoProposeRef = useRef(false);
  const [message, setMessage] = useState(""); // 추천 메시지(수정 가능)
  // 콜라보 분석에서 올라온 아이디어 — 제안 시트에서 '+'로 초안에 골라 넣는다(대표 07-31).
  // 분석을 안 돌린 사람에겐 아예 안 뜬다(빈 배열). 샘플 리포트는 올라오지 않는다(ReportSheet에서 차단).
  // 🚨**`report.ideas`가 아니라 `orderIdeaCards(report)`다**(08-08 대표 QA로 잡음).
  //   ideas만 읽으면 **기발 아이디어(`novelIdeas`)가 통째로 빠진다** — 리포트엔 5장이 뜨는데
  //   DM 시트엔 3장만 나오던 원인이다. 순서도 어긋났다(배열 규칙의 정본은 `orderIdeaCards` —
  //   교차 배열이든 뭐든 그쪽이 바뀌면 여기도 자동으로 따라간다. 규칙을 여기 베껴 적지 말 것).
  //   ⭐`report-cards.ts`는 "화면과 목록이 같은 순서를 봐야 한다"고 08-07에 뽑아낸 파일인데,
  //     그때 소비자를 둘(시트·/my)만 세고 **여기 세 번째를 놓쳤다.**
  const [reportIdeas, setReportIdeas] = useState<IdeaCard[]>([]);
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
    // 첫 줄 — ⚠️**우리 쪽 물건을 언급하지 않는다**(대표 확정 08-02).
    //  구 문구: "collab5에서 소개서를 보고 …". 두 가지가 깨진다 —
    //   ① 받는 사람은 collab5를 모른다. 낯선 플랫폼 이름으로 시작하는 콜드 DM은 신뢰를 **깎는다**.
    //   ② 더 큰 문제: 상대가 **우리 회원이 아니면 그 사람에겐 소개서가 없다.** 컨시어지로 만든
    //      소개서는 본인도 모르는 상태라 "소개서를 보고"는 "내 소개서? 내가 언제?"가 된다.
    //  → 대신 **상대 이름을 부른다.** B안("인스타그램 보다가")보다 28자 길지만 이름이 들어가는 쪽이
    //     "누구한테나 뿌린 템플릿"과 "우리를 보고 쓴 글"을 가른다(대표 C안 선택).
    // ⚠️인스타 채널이 없으면 "인스타그램을 보다가"는 **거짓**이 된다 → 그 절을 통째로 뺀다.
    //   없는 근거를 지어내느니 이유를 말 안 하는 쪽이 낫다.
    // 🔜 **되돌릴 예정**: 등록 업체를 전부 실제 사장님께 위임하고 나면 구 문구로 복귀한다.
    //   그 시점엔 상대에게 진짜 소개서가 있으므로 `collab5` 언급이 흠이 아니라 **마케팅 문구**가 된다.
    //   (대표 지시 08-02 · 백로그 = [[콜라보-제안-찜-플로우]])
    const sawOn =
      channel?.channel === "instagram"
        ? `${makerName}님 인스타그램을 보다가, `
        : "";
    const intro = `${hello}\n${sawOn}저희와 함께 하면 재미있는 걸 만들 수 있겠다 싶어 먼저 연락드렸어요.`;
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
      .filter((idea): idea is IdeaCard => !!idea)
      // ⚠️ 번호 뒤 **공백 필수**(08-02). `1.드립커피`처럼 붙여 쓰면 사람이 쓴 글로 안 보인다 —
      //    DM에서 이런 사소한 흠 하나가 통째로 "기계가 뿌린 것"으로 읽히게 만든다.
      .map((idea, i) => `${i + 1}. ${idea.title} — ${idea.desc}`)
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
      openPropose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, makerId, viewerBrands.length]);

  // /my 리포트 아카이브 딥링크 — ?report={fromSlug}면 그 쌍의 시트를 바로 연다(캐시면 즉시·0콜).
  // window.location으로 1회만 읽고 URL에서 지운다(useSearchParams+Suspense 불필요, 새로고침 재발동 방지).
  // 비로그인이거나 fromSlug가 내 소개서가 아니면 조용히 무시(링크 공유·소개서 연결 해제 케이스).
  //
  // 🆕 `&propose=1`(08-02) — /my 시트의 제안 CTA에서 넘어온 경우. 리포트는 이미 /my에서 읽었으므로
  //    **화면에 세우지 않고** 로드되자마자 제안 시트로 넘긴다(아래 onReportLoaded).
  //    리포트를 거쳐 가는 이유: 제안 시트의 아이디어 피커가 `report.ideas`를 받아야 채워지는데,
  //    그 재료는 리포트 응답에만 있다. 곧장 제안만 열면 피커가 빈 채로 뜬다.
  useEffect(() => {
    if (!loggedIn) return;
    let fromSlug: string | null = null;
    try {
      const url = new URL(window.location.href);
      fromSlug = url.searchParams.get("report");
      if (!fromSlug) return;
      if (url.searchParams.get("propose") === "1") autoProposeRef.current = true;
      url.searchParams.delete("report");
      url.searchParams.delete("propose");
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

  /** 제안 시트를 여는 **유일한 문**. 쉬는 중이면 어느 경로로 와도 열리지 않는다.
   *  (버튼은 애초에 잠겨 있지만, 로그인 복귀·딥링크는 버튼을 안 거치고 들어온다.) */
  const openPropose = () => {
    if (collabPaused) return;
    setProposeOpen(true);
  };

  // 콜라보 시작하기 — 비로그인은 로그인 유도, 로그인은 제안 시트.
  const handlePropose = () => {
    if (!loggedIn) {
      track("propose_login_needed");
      setLoginReason("propose");
      setLoginOpen(true);
      return;
    }
    openPropose();
  };

  // 콜라보 분석 — 비로그인=로그인 유도 / 소개서 0개=샘플 티저 / 그 외=정상 분석 시트.
  // `restore` = 제안 시트 [← 뒤로]로 돌아오는 길. 방금 본 리포트를 **그대로 되살린다**(아래 주석 참조).
  const handleReport = (restore = false) => {
    if (!loggedIn) {
      // 로그인 벽에서 되돌아간 사람 = "쓰려 했는데 못 쓴 사람". 이 숫자가 없으면 벽의 비용을 못 잰다.
      track("report_login_needed");
      setLoginReason("report");
      setLoginOpen(true);
      return;
    }
    // 🆕**누른 순간**을 센다(08-07 대표 지시). 전엔 `report_view`(=리포트가 뜬 뒤)가 첫 이벤트라
    //   선택 화면에서 닫거나 30초를 못 기다리고 이탈한 사람이 **통째로 안 보였다** — 로그상 아무 일도
    //   없는 것처럼 보인다. 이제 report_open → report_view → report_cta_propose 로 완주율이 나온다.
    //   ⚠️`restore`(제안 시트 [← 뒤로])는 빼야 한다 — 한 번의 시도가 두 번으로 부풀어 완주율이 거짓말한다.
    if (!restore) track("report_open", { has_brand: viewerBrands.length > 0 });
    setRestoreReport(restore);
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
  //  🆕`action`(08-07) — DB엔 채널만 남아서 **"복사만 했는지 인스타로 넘어갔는지"를 못 갈랐다.**
  //     GA 쪽에만 붙인다(DB 스키마는 그대로). 값 = open(채널 열기)·copy(메시지만)·email(주소만).
  //  ⚠️GA도 DB와 **같은 1회 규칙**을 탄다 — 여기 안에 두는 이유가 그것이다. 밖에 두면 복사→이동을
  //     연달아 누른 한 사람이 GA에선 2건, DB에선 1건이 되어 두 숫자를 나란히 못 놓는다.
  const recordOnce = (ch: string, action: "open" | "copy" | "email") => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    track("propose_send", { channel: ch, action, ideas: addedIdeas.length });
    recordCollabRequestAction(makerId, ch, selectedBrand?.id).catch(() => {});
  };
  useEffect(() => {
    if (!proposeOpen) return;
    recordedRef.current = false; // 시트를 새로 열면 다시 셀 수 있게
    // 🆕시트가 열린 것 자체를 센다 — 진입 경로가 넷(액션바·리포트 CTA·로그인 복귀·/my 딥링크)이라
    //   각 호출부에 흩뿌리면 반드시 하나를 빠뜨린다. 열림 상태 한 곳에서 잡으면 전부 정확히 1건.
    //   짝 = `propose_send`. 둘의 비율이 **DM 시트를 열고 실제로 보낸 비율**이다.
    track("propose_open");
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
    recordOnce(channel.channel, "open");
  };

  // Secondary — 메시지만 복사(시트 유지 + 토스트).
  // 여기도 계측한다 — 복사만 하고 인스타 앱에서 직접 보내는 사람이 실제로 많은데, 전엔 통째로 안 세어졌다.
  const copyMessageOnly = () => {
    copyText(message);
    flash("✓ 메시지를 복사했어요.");
    recordOnce(channel?.channel ?? "copy", "copy");
  };

  // 이메일 폴백 Primary — 이메일 주소 복사(채널 오픈 없음, 시트 유지 + 토스트) + 계측.
  const copyEmailOnly = () => {
    if (!contactEmail) return;
    copyText(contactEmail);
    flash("✓ 이메일 주소를 복사했어요.");
    recordOnce("email", "email");
  };

  const isInstagram = channel?.channel === "instagram";
  // 좌우 2버튼이 되면서 라벨을 짧게 잘랐다(대표 07-31). "메시지 복사하고 …"는 두 버튼 폭에 안 들어간다.
  // ⚠️ 동작은 그대로 **복사 + 채널 열기**다 — 눌러도 클립보드가 비어 있으면 붙여넣을 게 없다.
  //    그래서 누르는 즉시 "✓ 메시지를 복사했어요" 토스트가 떠서 복사됐음을 알려준다.
  const proposePrimaryLabel = !channel
    ? "이메일 주소 복사"
    : isInstagram
      ? "인스타 DM으로 이동"
      : "채널 열고 보내기";

  // 소개서 링크 복사 — copyText + flash로 정리(pill 라벨은 정적 고정).
  const copy = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    copyText(url);
    flash("✓ 소개서 링크를 복사했어요.");
  };

  const loginTitle =
    loginReason === "report"
      ? "콜라보 추천을 받으려면 로그인이 필요해요"
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
  // 제안 시트 [← 뒤로] = **방금 보던 리포트로.** 소개서 고르는 첫 화면이 아니다(08-08 대표 QA).
  // 🪤버그였던 이유: ReportSheet는 열릴 때마다 "소개서 2개 이상이면 select"로 초기화하는데,
  //   뒤로가기도 그냥 '다시 열기'라 **손에 쥔 결과를 버리고** 선택 화면으로 떨어졌다.
  //   대표 계정은 소개서가 10개가 넘어 늘 걸린다. `restore`로 그 초기화만 건너뛴다
  //   (다시 고르고 싶으면 리포트 안의 「다른 소개서로 분석」이 그대로 있다).
  const backToReport = () => {
    setProposeOpen(false);
    handleReport(true);
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
              className="flex h-10 items-center gap-1.5 rounded-pill bg-primary px-4 text-[14px] font-medium text-primary-on shadow-e2 transition-colors"
            >
              🔗 링크 복사
            </button>

            {/* 찜 하트 — 빈 → 채워진 빨강 토글. 내 소개서면 숨김(내가 나를 찜하는 건 신호가 아니다) */}
            {!isOwner && (
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
          {/* 하단 여백은 `max()`다(08-09). `calc(0.75rem + env())`로 더하면 홈 인디케이터가 있는
              기기에서 12+34=46px이 되어 대표 실기기에서 "여백이 넓다"로 잡혔다(데스크톱 개발자도구는
              env()를 0으로 주기 때문에 12px로 멀쩡해 보인다 — 기기 차이의 정체가 이것). max()면
              인디케이터가 있는 기기는 정확히 안전영역(34px)만, 없는 기기는 12px를 쓴다. */}
          <div className="rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 shadow-e2">
            {/* 소요시간 사전 고지(08-09 대표 지시) — 분석은 실제로 30초쯤 걸리는데, 누르기 전엔 그걸
                알 방법이 없어 "멈췄나?" 싶은 대기가 된다. 라벨 안에 "(약 30초)"로 넣어봤더니 왼쪽
                고스트 버튼 실폭(375px에서 ~148px)보다 라벨이 길어 눌려 보였고, 버튼을 2단으로 바꾸면
                이번엔 오른쪽 primary와 이름 줄 높이가 어긋났다. → **버튼은 그대로 두고 바 위 한 줄**.
                라벨은 '무엇을 하는가', 헬퍼는 '얼마가 드는가'로 역할을 나눈다. */}
            {/* 헬퍼는 아래 버튼 행과 **같은 flex 비율**을 써서 분석 버튼 위 정중앙에 앉는다(대표 08-09).
                바 기준 좌측 정렬이면 어느 버튼 얘긴지가 위치로 안 드러난다. */}
            {(isOwner ? ownerCanReport : true) && (
              <div className="mb-2 flex items-center gap-2.5">
                <p className="flex-[0.8] text-center text-[12px] leading-none text-faint">
                  🕐 약 30초면 완료돼요
                </p>
                <span className="flex-1" aria-hidden="true" />
              </div>
            )}
            <div className="flex items-center gap-2.5">
            {isOwner ? (
              /* 내 소개서 모드 — '제안'은 자기 자신에게 보내는 거라 말이 안 된다(북극성 퍼널 오염).
                 **분석도 기본은 닫는다**(대표 지시 07-31, 첫 실고객 유입 시점에 원복):
                 내 브랜드 × 내 브랜드 조합은 매칭 정보로서 의미가 없는데 유료 콜은 그대로 나간다.
                 단 대표는 그 규칙 안에서 기능을 확인해야 하므로 **사내 계정에만** 분석을 남긴다
                 (`ownerCanReport` ← `lib/staff.ts`). 서버(`/api/collab-report`)에도 같은 가드가 있다. */
              <>
                {ownerCanReport && (
                  <button
                    type="button"
                    // ⚠️`onClick={handleReport}` 금지 — 클릭 이벤트가 `restore` 인자로 들어가
                    //    **버튼을 누를 때마다 '되살리기'가 켜진다**(MouseEvent는 truthy). 감싸서 넘긴다.
                    onClick={() => handleReport()}
                    className="flex h-12 flex-[0.8] items-center justify-center rounded-md border border-border-strong bg-surface text-[16px] font-medium text-ink transition-colors"
                  >
                    콜라보 추천받기
                  </button>
                )}
                <a
                  href={`/register?edit=${slug}`}
                  className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-[16px] font-medium text-primary-on transition-colors"
                >
                  소개서 수정하기
                </a>
              </>
            ) : (
              <>
                {/* 콜라보 분석 — 고스트(왼쪽) */}
                <button
                  type="button"
                  // ⚠️감싸서 넘긴다 — 위 버튼 주석 참조(이벤트가 `restore`로 새어 들어간다)
                  onClick={() => handleReport()}
                  className="flex h-12 flex-[0.8] items-center justify-center rounded-md border border-border-strong bg-surface text-[16px] font-medium text-ink transition-colors"
                >
                  콜라보 추천받기
                </button>
                {/* 콜라보 제안 시작하기 — primary. 쉬는 중이면 잠근다(08-12 대표 확정).
                    ⚠️버튼을 **감추지 않고 잠근다** — 없어지면 "제안하는 법이 없는 서비스"로 읽히지만,
                      잠겨 있으면 "이 브랜드가 지금 쉬는 중"으로 읽힌다. 상태는 사람이 아니라 브랜드의 것. */}
                {collabPaused ? (
                  <div
                    className="flex h-12 flex-1 items-center justify-center rounded-md border border-hairline bg-surface-soft px-2 text-center text-[15px] font-medium leading-tight text-faint"
                    role="status"
                  >
                    잠시 콜라보를 쉬고 있어요
                  </div>
                ) : (
                <button
                  type="button"
                  onClick={handlePropose}
                  className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-[16px] font-medium text-primary-on transition-colors"
                >
                  콜라보 제안 시작하기
                </button>
                )}
              </>
            )}
            </div>
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
                aria-label="뒤로: 콜라보 추천 보기"
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
              <p className="text-[20px] font-bold break-keep text-ink">{makerName}님과 콜라보 시작하기</p>
              {channel ? (
                <>
                  <p className="mt-2 text-[15px] leading-relaxed text-mute">
                    앱 내 채팅 기능은 준비 중이에요.
                    <br />
                    그전까지는 아래 메시지를 복사해 {isInstagram ? "인스타그램으로" : "아래 채널로"} 편하게 연락해보세요.
                  </p>
                  <label className="mt-3 block text-[13px] font-medium text-body">메세지 초안 (자유롭게 수정해보세요)</label>
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
                    앱 내 채팅 기능은 준비 중이에요.
                    <br />
                    그전까지는 아래 이메일로 편하게 연락해보세요.
                  </p>
                  <p className="mt-3 text-[14px] text-body break-all select-all">{contactEmail}</p>
                  <label className="mt-3 block text-[13px] font-medium text-body">메세지 초안 (자유롭게 수정해보세요)</label>
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
              <div className="shrink-0 border-t border-hairline bg-surface px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyMessageOnly}
                    className="flex h-12 flex-1 items-center justify-center rounded-md border border-border-strong bg-surface text-[15px] font-medium text-ink"
                  >
                    메세지 복사
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
        onReportLoaded={(r) => {
          setReportIdeas(orderIdeaCards(r)); // ⚠️r.ideas가 아니다 — 기발 아이디어까지, 리포트와 같은 순서로
          // /my에서 "콜라보 과정 시작하기"로 넘어온 경우 — 리포트는 이미 읽었으니 세우지 않고 넘긴다.
          if (autoProposeRef.current) {
            autoProposeRef.current = false; // 1회성 — 뒤로가기·재오픈 때 다시 튀지 않게
            setReportOpen(false);
            openPropose();
          }
        }}
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportInitialFrom(null); // 딥링크 소비 후엔 일반 동선으로 복귀(다음 오픈은 선택 스텝부터)
          setRestoreReport(false); // 시트를 아예 닫았으면 다음 오픈은 처음부터 — 되살리기는 [← 뒤로] 전용
        }}
        initialFromSlug={reportInitialFrom}
        restoreOnOpen={restoreReport}
        fromBrands={viewerBrands}
        cachedReports={cachedReports}
        toSlug={slug}
        toName={makerName}
        sampleMode={reportSample}
        collabPaused={collabPaused}
        onPropose={() => {
          setReportOpen(false);
          openPropose();
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
        //    (🔗링크복사·♡찜, `-top-[52px]`로 바 위에 떠 있다) — 실측 갭 15px.
        // ⚠️ 08-09 재측정: 메인 바에 소요시간 헬퍼 한 줄이 생겨 바가 20px 높아졌고, 그만큼 유틸 줄도
        //    올라가 8.5rem이던 ②가 **유틸 줄을 3px 덮었다**(간격 17px → -3px). 갭은 오프셋에 그대로
        //    비례한다(gap = offset − 148px @375×812)므로 163px = 갭 15px로 되돌린다.
        //    ⭐**바 높이가 바뀌면 이 값도 다시 재야 한다** — 두 값은 독립이 아니다.
        // 안전영역 항이 `max()`인 이유는 각 바의 하단 패딩과 같아야 하기 때문이다(08-09 일괄 전환).
        //    인디케이터 없는 기기에선 ①4.75+1 = 5.75rem으로 종전과 동일하다.
        <div
          role="status"
          aria-live="polite"
          className={`pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 rounded-pill bg-ink px-4 py-2.5 text-[13px] font-medium text-surface shadow-e2 print:hidden ${
            proposeOpen
              ? "bottom-[calc(4.75rem+max(1rem,env(safe-area-inset-bottom)))]"
              : "bottom-[calc(150px+max(0.75rem,env(safe-area-inset-bottom)))]"
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

            <p className="px-6 text-[20px] font-bold leading-snug text-balance break-keep text-ink">{loginTitle}</p>
            <p className="mt-2 text-[16px] leading-relaxed text-balance break-keep text-mute">{loginSub}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setLoginOpen(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
              >
                취소
              </button>
              <a
                href={`/login?redirect=${encodeURIComponent(`/m/${slug}`)}`}
                onClick={markPending}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-[14px] font-medium text-primary-on"
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
