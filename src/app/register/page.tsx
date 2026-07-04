"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMakerAction } from "@/lib/actions";
import type { CollabType } from "@/lib/types";
import { deriveRegion } from "@/lib/region";
import { fileToResizedDataUrl } from "@/lib/image";
import type { ActivityHint, CollabHint, EnrichField } from "@/lib/enrich";
import { EnrichWizard, type WizardFill } from "./EnrichWizard";

// 편집 중 콜라보 이력 — 활동(activities)과 동일한 인라인 카드 패턴.
// photos는 {url,file?}로 다루고 제출 시 string[]로 리사이즈. typeInput은 커스텀 유형 입력(전송 제외).
type HistItem = {
  partner: string;
  types: string[];
  desc: string;
  year: string;
  photos: { url: string; file?: File }[];
  typeInput: string;
};
const emptyHist = (): HistItem => ({
  partner: "",
  types: [],
  desc: "",
  year: "",
  photos: [],
  typeInput: "",
});

const COLLAB_TYPES: CollabType[] = [
  "제품콜라보",
  "팝업",
  "워크숍",
  "공동굿즈",
  "공동콘텐츠",
  "행사참여",
  "공간대여",
];

// 브랜드 표현 어휘 — 4카테고리(감성·가치·스타일·성격). 직접 추가 가능, 최대 10개 선택.
const VIBE_CATEGORIES: { label: string; words: string[] }[] = [
  { label: "브랜드 감성", words: ["따뜻함", "감성", "정성", "손맛", "핸드메이드", "큐레이션"] },
  { label: "브랜드 가치", words: ["지속가능", "친환경", "로컬", "윤리적", "사회적 가치", "공정무역"] },
  { label: "브랜드 스타일", words: ["미니멀", "클래식", "빈티지", "모던", "실험적", "프리미엄"] },
  { label: "브랜드 성격", words: ["위트", "대담함", "유쾌함", "진정성", "감각적", "섬세함"] },
];
const ALL_VIBES = VIBE_CATEGORIES.flatMap((c) => c.words);
const MAX_VIBES = 10;

// 타겟 고객 추천 어휘 — 분위기칩과 동일 패턴. 직접 추가 가능.
const SUGGESTED_AUDIENCE = [
  "20-30대 여성",
  "20-30대 남성",
  "30-40대",
  "로컬 주민",
  "직장인",
  "학생",
  "가족 단위",
  "여행자",
  "감성 소비층",
  "친환경 관심층",
  "반려인",
  "비건",
];

// 콜라보 이력 년도 선택지 — 1991~2030 (최신순 정렬)
const HISTORY_YEARS = Array.from({ length: 2030 - 1991 + 1 }, (_, i) => String(2030 - i));

// 데모 프리필(캔버스가든) — `/register?demo=1`로 열면 텍스트가 채워진 상태로 시작(사진은 직접 첨부).
const DEMO_PREFILL = {
  name: "캔버스가든",
  oneLiner: "쓰던 옷이 새 가방으로, 새로운 시작을 선물해요.",
  description:
    '캔버스가든은 버려지는 천과 구제 의류를 새 생명으로 불어넣는 업사이클링 브랜드예요. "저거 참 예쁜데, 저거 참 비싸네."라는 생각에서 시작해, "저거 참 아까운데."라는 마음으로 쓰레기가 될 소재에 디자인을 입히고 있어요. 당신만의 특별함을 더할 수 있도록 돕는 것이 저희의 가장 큰 기쁨이에요.',
  story:
    "회사를 그만두고 손으로 무언가를 만들기 시작할 때, 가장 눈에 들어온 건 버려지는 천들이었어요. 누군가 오래 입던 옷, 쓸모를 다했다고 여겨진 조각들이요. 그걸 모아 수선하다 보니, 무언가를 새롭게 이야기에 입히는 일이 제일 저다웠습니다. 그렇게 캔버스가든이 시작됐어요.",
  values: ["감성", "사회적 가치", "업사이클링", "지속 가능성", "자기표현"],
  activities: [
    {
      title: "헌옷의 재발견, 조각 프로젝트",
      desc: "5주간 진행되는 헌옷을 활용한 나만의 엽서 만들기, 나만의 가방 만들기 워크숍",
    },
    { title: "온라인 가방 샵", desc: "업사이클링 원단을 활용한 가방 제작" },
  ],
  offersNote:
    "1. 제품으로는 다른 브랜드와 함께 업사이클링 가방·소품을 만드는 콜라보를 할 수 있어요.\n2. 의미로는 플리마켓에 참여하여 캔버스가든의 의미를 함께 전하는 콜라보들을 할 수 있을 것 같아요.",
  offers: ["제품콜라보", "팝업", "워크숍", "공동굿즈"] as CollabType[],
  seeksNote: "지속가능한 가치, 유니크한 매력, 상생과 관련한 초기·중기 브랜드 모두 환영해요!",
  seeks: ["제품콜라보", "워크숍", "공동콘텐츠"] as CollabType[],
  targetAudience: ["20-30대 여성", "30-40대", "독립적·자립적 가치관을 중시하는 여성층"],
  address: "서울특별시 성북구 보문로 56 5층",
  instagram: "@canvasgarden_official",
  homepage: "https://canvasgarden.shop",
  history: { partner: "비오드", types: ["제품콜라보"], year: "2025" },
};

export default function RegisterPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [offers, setOffers] = useState<CollabType[]>([]);
  const [seeks, setSeeks] = useState<CollabType[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [customVibe, setCustomVibe] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState("");
  const [collabHistory, setCollabHistory] = useState<HistItem[]>([emptyHist()]);
  const [collabOpen, setCollabOpen] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [homepage, setHomepage] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  // ── 소개서 개편 신규 필드 ──
  const [story, setStory] = useState("");
  const [activities, setActivities] = useState<
    { title: string; desc: string; photos: { url: string; file?: File }[] }[]
  >([{ title: "", desc: "", photos: [] }]);
  const [offersNote, setOffersNote] = useState("");
  const [seeksNote, setSeeksNote] = useState("");
  const region = deriveRegion(address); // 주소에서 자동 추출 (별도 입력 없음)

  // ── enrich(딸깍 자동완성) 상태 ──
  const [query, setQuery] = useState(""); // 불러오기 검색어(업체명만)
  const [wizardOpen, setWizardOpen] = useState(false); // 딸깍 자동완성 위저드
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set()); // AI가 채운 필드
  const [missing, setMissing] = useState<EnrichField[]>([]); // 못 찾은 필드(직접 입력 노티)
  const [reviewMode, setReviewMode] = useState(false); // 검수 게이트 배너
  // 크롤이 발견한 활동·콜라보 힌트(참고용, 세션 한정 — 저장 안 함)
  const [actHints, setActHints] = useState<ActivityHint[]>([]);
  const [collabHints, setCollabHints] = useState<CollabHint[]>([]);
  const [usedActHints, setUsedActHints] = useState<Set<number>>(new Set());
  const [usedCollabHints, setUsedCollabHints] = useState<Set<number>>(new Set());

  // ── 초안받기 상태 ──
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false); // AI 초안을 한 번이라도 생성했나(버튼 분기 기준)
  const [draftRound, setDraftRound] = useState(0); // 다시 받기마다 다른 각도로 변주
  const [descChoices, setDescChoices] = useState<string[]>([]); // 브랜드 소개 5지선다 후보(각 항목 직접 수정 가능)
  const [descSel, setDescSel] = useState(0); // 선택한 후보 인덱스
  const [descModalOpen, setDescModalOpen] = useState(false); // 5지선다 모달

  // 데모 프리필: `/register?demo=1` 진입 시 캔버스가든 예시로 텍스트를 채워 시작(사진은 직접).
  // URL 파라미터 기반 1회성 초기화 — 지연 초기값을 쓰면 SSR(window 부재)과 하이드레이션 불일치가 나므로 effect로 처리.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") !== "1") return;
    const d = DEMO_PREFILL;
    setName(d.name);
    setOneLiner(d.oneLiner);
    setDescription(d.description);
    setStory(d.story);
    setValues(d.values);
    setActivities(d.activities.map((a) => ({ title: a.title, desc: a.desc, photos: [] })));
    setOffersNote(d.offersNote);
    setOffers(d.offers);
    setSeeksNote(d.seeksNote);
    setSeeks(d.seeks);
    setTargetAudience(d.targetAudience);
    setAddress(d.address);
    setInstagram(d.instagram);
    setHomepage(d.homepage);
    setCollabHistory([
      { partner: d.history.partner, types: d.history.types, desc: "", year: d.history.year, photos: [], typeInput: "" },
    ]);
    setAiFilled(new Set(["name", "oneLiner", "description", "values", "address", "instagram", "homepage"]));
    setDraftGenerated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (
    list: CollabType[],
    setList: (v: CollabType[]) => void,
    t: CollabType
  ) => setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  const toggleVibe = (v: string) =>
    setValues((p) =>
      p.includes(v) ? p.filter((x) => x !== v) : p.length >= MAX_VIBES ? p : [...p, v]
    );

  const addCustomVibe = () => {
    const v = customVibe.trim();
    if (v && !values.includes(v) && values.length < MAX_VIBES) setValues((p) => [...p, v]);
    setCustomVibe("");
  };

  // ── 타겟 고객 (분위기칩과 동일 패턴) ──
  const toggleAudience = (a: string) =>
    setTargetAudience((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const addCustomAudience = () => {
    const a = customAudience.trim();
    if (a && !targetAudience.includes(a)) setTargetAudience((p) => [...p, a]);
    setCustomAudience("");
  };

  // ── 콜라보 이력 (활동과 동일한 인라인 카드 패턴, 최대 3세트) ──
  const addCollab = () =>
    setCollabHistory((p) => (p.length >= 3 ? p : [...p, emptyHist()]));
  const removeCollab = (i: number) =>
    setCollabHistory((p) => p.filter((_, j) => j !== i));
  const setHist = (i: number, patch: Partial<HistItem>) =>
    setCollabHistory((p) => p.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const toggleHistType = (i: number, t: string) =>
    setCollabHistory((p) =>
      p.map((h, j) =>
        j === i
          ? { ...h, types: h.types.includes(t) ? h.types.filter((x) => x !== t) : [...h.types, t] }
          : h
      )
    );
  const addHistCustomType = (i: number) =>
    setCollabHistory((p) =>
      p.map((h, j) => {
        if (j !== i) return h;
        const t = h.typeInput.trim();
        return t && !h.types.includes(t)
          ? { ...h, types: [...h.types, t], typeInput: "" }
          : { ...h, typeInput: "" };
      })
    );
  const addHistPhotos = (i: number, files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ url: URL.createObjectURL(f), file: f }));
    setCollabHistory((p) =>
      p.map((h, j) => (j === i ? { ...h, photos: [...h.photos, ...next].slice(0, 3) } : h))
    );
  };
  const removeHistPhoto = (i: number, k: number) =>
    setCollabHistory((p) =>
      p.map((h, j) => (j === i ? { ...h, photos: h.photos.filter((_, x) => x !== k) } : h))
    );

  // ── 대표 활동 (최대 3세트) ──
  const addActivity = () =>
    setActivities((p) => (p.length >= 3 ? p : [...p, { title: "", desc: "", photos: [] }]));
  const setAct = (i: number, patch: Partial<{ title: string; desc: string }>) =>
    setActivities((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addActPhotos = (i: number, files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ url: URL.createObjectURL(f), file: f }));
    setActivities((p) =>
      p.map((a, j) => (j === i ? { ...a, photos: [...a.photos, ...next].slice(0, 3) } : a))
    );
  };
  const removeActPhoto = (i: number, k: number) =>
    setActivities((p) =>
      p.map((a, j) => (j === i ? { ...a, photos: a.photos.filter((_, x) => x !== k) } : a))
    );
  const removeActivity = (i: number) =>
    setActivities((p) => p.filter((_, j) => j !== i));

  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }));
    setPhotos((p) => [...p, ...next].slice(0, 10));
  };

  // 규칙 기반 소개 초안 폴백 (AI 실패 시 — 입력값 조합)
  const ruleDraft = () => {
    const parts: string[] = [];
    if (oneLiner.trim()) parts.push(oneLiner.trim().replace(/[.\s]*$/, "."));
    if (values.length)
      parts.push(`${values.slice(0, 3).join(", ")} — 우리를 잘 보여주는 말이에요.`);
    if (name.trim()) parts.push(`${name.trim()}의 이야기를 카드에 담았어요.`);
    if (parts.length) setDescription(parts.join(" "));
  };

  // 초안받기: 폼 정보 기준으로 백엔드 AI 크롤링 → 소개 후보 5개 생성 → 5지선다 모달.
  // 첫 클릭='초안 받기', 이후='초안 다시 받기'(round 증가 → 다른 각도의 후보들).
  const draftDescription = async () => {
    if (!name.trim()) {
      ruleDraft();
      setDraftGenerated(true);
      return;
    }
    setDraftBusy(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft",
          name: name.trim(),
          oneLiner,
          values,
          offers,
          targetAudience,
          round: draftRound,
        }),
      });
      const data = await res.json();
      const choices: string[] = Array.isArray(data.descriptions)
        ? data.descriptions.filter((s: unknown): s is string => typeof s === "string" && !!s.trim())
        : [];
      if (choices.length > 1) {
        setDescChoices(choices);
        setDescSel(0);
        setDescModalOpen(true);
      } else if (choices.length === 1) {
        setDescription(choices[0]);
      } else {
        ruleDraft();
      }
    } catch {
      ruleDraft();
    } finally {
      setDraftGenerated(true);
      setDraftRound((r) => r + 1);
      setDraftBusy(false);
    }
  };
  const editDescChoice = (i: number, v: string) =>
    setDescChoices((p) => p.map((x, j) => (j === i ? v : x)));
  const applyDesc = () => {
    const v = (descChoices[descSel] ?? "").trim();
    if (v) setDescription(v);
    setDescModalOpen(false);
  };
  const canDraft = !!(name.trim() || oneLiner.trim() || values.length);

  // ── enrich: 업체명 → 위저드 오픈(불러오기) ──
  const openWizard = () => {
    if (!query.trim()) return;
    setWizardOpen(true);
  };

  // 위저드가 고른 항목만 폼에 반영(검수 게이트). AI는 '초안'만 — 사용자가 확인·수정 후 저장.
  const applyWizard = (fill: WizardFill) => {
    const filled = new Set<string>();
    if (fill.name !== undefined) {
      setName(fill.name);
      filled.add("name");
    }
    if (fill.oneLiner !== undefined) {
      setOneLiner(fill.oneLiner);
      filled.add("oneLiner");
    }
    if (fill.address !== undefined) {
      setAddress(fill.address);
      filled.add("address");
    }
    if (fill.instagram !== undefined) {
      setInstagram(fill.instagram);
      filled.add("instagram");
    }
    if (fill.homepage !== undefined) {
      setHomepage(fill.homepage);
      filled.add("homepage");
    }
    if (fill.values !== undefined) {
      setValues(fill.values);
      filled.add("values");
    }
    if (fill.description !== undefined) {
      setDescription(fill.description);
      filled.add("description");
      setDraftGenerated(true); // 위저드가 이미 소개 초안을 채움 → 버튼은 '다시 받기'로
    }
    if (fill.activityHints?.length) {
      setActHints(fill.activityHints);
      setUsedActHints(new Set());
    }
    if (fill.collabHints?.length) {
      setCollabHints(fill.collabHints);
      setUsedCollabHints(new Set());
    }
    setAiFilled(filled);
    setMissing([]);
    setReviewMode(true);
    setWizardOpen(false);
  };

  // 힌트 '이 내용으로 시작하기' — 빈 카드 우선 채움, 없으면 새 카드(최대 3), 꽉 차면 불가
  const applyActHint = (i: number) => {
    const h = actHints[i];
    if (!h) return;
    setActivities((p) => {
      const empty = p.findIndex((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length);
      if (empty >= 0)
        return p.map((a, j) => (j === empty ? { ...a, title: h.title, desc: h.desc } : a));
      if (p.length < 3) return [...p, { title: h.title, desc: h.desc, photos: [] }];
      return p;
    });
    setUsedActHints((s) => new Set(s).add(i));
  };
  const canApplyActHint =
    activities.some((a) => !a.title.trim() && !a.desc.trim() && !a.photos.length) ||
    activities.length < 3;
  const applyCollabHint = (i: number) => {
    const h = collabHints[i];
    if (!h) return;
    setCollabHistory((p) => {
      const empty = p.findIndex(
        (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
      );
      if (empty >= 0)
        return p.map((c, j) => (j === empty ? { ...c, partner: h.partner, desc: h.desc } : c));
      if (p.length < 3) return [...p, { ...emptyHist(), partner: h.partner, desc: h.desc }];
      return p;
    });
    setUsedCollabHints((s) => new Set(s).add(i));
  };
  const canApplyCollabHint =
    collabHistory.some(
      (c) => !c.partner.trim() && !c.desc.trim() && !c.types.length && !c.photos.length
    ) || collabHistory.length < 3;

  // 라벨 옆 표시: AI가 채운 필드면 ✨배지, 못 찾은 필드면 "직접 입력" 노티
  const hintFor = (key: string, miss?: EnrichField) => {
    if (aiFilled.has(key)) return <AiBadge />;
    if (miss && missing.includes(miss)) return <MissingNote />;
    return undefined;
  };

  const canSubmit = name.trim().length > 0 && !pending;

  // ── 등록 완료 얼럿(소개서 페이지로 이동) ──
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");

  const submit = () => {
    startTransition(async () => {
      // 사진은 리사이즈·압축해 data URL로 저장(카드·프로필 슬라이드용)
      // 브랜드 사진 1000px, 활동·콜라보 사진 800px.
      let photoUrls: string[] = [];
      let activityOut: { title: string; desc: string; photos: string[] }[] = [];
      let historyOut: {
        partner: string;
        types: string[];
        desc: string;
        year?: string;
        photos: string[];
      }[] = [];
      // 내용이 있는 카드만(빈 카드는 제외) — 활동과 동일 규칙
      const filledHist = collabHistory.filter(
        (h) => h.partner.trim() || h.types.length || h.desc.trim() || h.photos.length
      );
      try {
        photoUrls = await Promise.all(photos.map((p) => fileToResizedDataUrl(p.file, 1000)));
        activityOut = await Promise.all(
          activities
            .filter((a) => a.title.trim() || a.desc.trim() || a.photos.length)
            .map(async (a) => ({
              title: a.title.trim(),
              desc: a.desc.trim(),
              photos: await Promise.all(
                a.photos.map((p) =>
                  p.file ? fileToResizedDataUrl(p.file, 800) : Promise.resolve(p.url)
                )
              ),
            }))
        );
        historyOut = await Promise.all(
          filledHist.map(async (h) => ({
            partner: h.partner.trim(),
            types: h.types,
            desc: h.desc.trim(),
            year: h.year || undefined,
            photos: await Promise.all(
              h.photos.map((p) =>
                p.file ? fileToResizedDataUrl(p.file, 800) : Promise.resolve(p.url)
              )
            ),
          }))
        );
      } catch {
        photoUrls = [];
        activityOut = [];
        historyOut = filledHist.map((h) => ({
          partner: h.partner.trim(),
          types: h.types,
          desc: h.desc.trim(),
          year: h.year || undefined,
          photos: [],
        }));
      }
      // 사진 base64는 배열에 문자열로 담으면 React Flight 배열 한도(1e6)에 걸린다.
      // → {u} 객체로 감싸 전송(actions.ts에서 되풂). @see PhotoWire
      const wrap = (arr: string[]) => arr.map((u) => ({ u }));
      const { slug } = await createMakerAction({
        name,
        oneLiner,
        offers,
        seeks,
        values,
        targetAudience,
        collabHistory: historyOut.map((h) => ({ ...h, photos: wrap(h.photos) })),
        story,
        activities: activityOut.map((a) => ({ ...a, photos: wrap(a.photos) })),
        offersNote,
        seeksNote,
        photos: wrap(photoUrls),
        collabOpen,
        instagram,
        homepage,
        address,
        description,
      });
      setCreatedSlug(slug);
      setPortfolioOpen(true); // redirect 대신 소개서 얼럿
    });
  };
  // 소개서 페이지는 서버에서 데이터를 불러오는 동안 잠깐 멈춰 보임 → 버튼 로딩 표시.
  const [goingToPage, setGoingToPage] = useState(false);
  const goToPage = () => {
    setGoingToPage(true);
    router.push(`/m/${createdSlug}`);
  };

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6">
      <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
        브랜드 소개서, 생각보다 금방 완성돼요.
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">
        브랜드 이름 입력하면 AI가 소개서 초안을 준비해드려요. 확인하고 다듬으면 1~3분 안에 완성할 수 있어요.
      </p>

      {/* ✨ 딸깍 자동완성 — 이름만 알려주면 채워드릴게요 */}
      <div className="mt-10 rounded-xl border border-primary bg-primary-pale px-5 py-5">
        <p className="text-base font-bold text-ink">
          ✨ 브랜드 이름을 알려주세요. 나머지는 AI가 준비해드릴게요.
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-mute">
          웹, SNS에서 찾은 정보를 기준으로 소개 초안을 준비해드려요. 찾아온 정보는 언제든 자유롭게 수정할 수 있어요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                openWizard();
              }
            }}
            placeholder="예: 캔버스가든"
            className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          <button
            type="button"
            onClick={openWizard}
            disabled={!query.trim()}
            className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-on disabled:opacity-40"
          >
            ✨ 불러오기
          </button>
        </div>
      </div>

      {/* AI 불러오기(위) ↔ 직접 입력(아래) 구분 소제목 */}
      <div className="mt-10 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="shrink-0 text-sm font-medium text-mute">
          또는 아래에 직접 입력 할 수 있어요.
        </span>
        <div className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-8 space-y-12">
        {/* 검수 게이트 배너 — AI가 채운 직후 */}
        {reviewMode && (
          <div className="rounded-lg border border-primary bg-surface px-4 py-3 shadow-e1">
            <p className="text-[15px] font-medium text-ink">
              ✨ 온라인 정보와 SNS를 참고해서 브랜드를 분석해봤어요.
            </p>
            <p className="mt-0.5 text-sm text-mute">
              맞는지 확인하고 자유롭게 고쳐주세요. 못 찾은 곳은 직접 채우면 돼요.
            </p>
          </div>
        )}

        {/* ── ① 브랜드를 소개해주세요 ── */}
        <GroupHeader n="①" title="브랜드를 소개해주세요." />
        <div className="space-y-8">
          <Field label="상호 *" hint={hintFor("name")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 캔버스가든"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
          <Field label="한 줄 소개" hint={hintFor("oneLiner")}>
            <input
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
              placeholder="예: 패브릭으로 짓는 친환경 가방과 조각 워크숍"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>

          {/* 자세히 소개 — 브랜드를 소개해주세요 (초안 받기 유지) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-base font-medium text-body">
                <span>자세히 소개</span>
                {aiFilled.has("description") && <AiBadge />}
              </label>
              <button
                type="button"
                onClick={draftDescription}
                disabled={!canDraft || draftBusy}
                className="inline-flex h-7 items-center gap-1 rounded-pill border border-primary bg-primary-pale px-2.5 text-sm font-medium text-primary-on disabled:opacity-40"
              >
                {draftBusy
                  ? "쓰는 중…"
                  : draftGenerated
                    ? "✨ 초안 다시 받기"
                    : "✨ 초안 받기"}
              </button>
            </div>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={draftBusy}
                placeholder="버려지는 천에 새 이야기를 입히는 패브릭 브랜드."
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-60"
              />
              {draftBusy && (
                <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-surface/80 backdrop-blur-[1px]">
                  <p className="flex items-center gap-2 text-sm font-medium text-primary-on">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    온라인 정보를 살펴 소개를 쓰고 있어요…
                  </p>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-sm text-mute">
              {draftGenerated
                ? "‘초안 다시 받기’를 누르면 다른 느낌의 소개로 새로 써드려요."
                : "‘초안 받기’를 누르면 입력한 정보로 소개를 대신 써드려요. 그대로 써도, 더 다듬어도 좋아요."}
            </p>
          </div>

          {/* 브랜드 사진 (선택) */}
          <div>
            <label className="mb-1 block text-base font-medium text-body">
              브랜드 사진 (선택)
            </label>
            <p className="mb-2.5 text-[15px] text-mute">
              콜라보 카드에 담을 사진을 올려주세요. 최대 10장
            </p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    aria-label="사진 삭제"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photos.length < 10 && (
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
                  <span className="text-xl leading-none">＋</span>
                  <span className="mt-1 text-[11px]">사진</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onPhotos(e.target.files)}
                  />
                </label>
              )}
            </div>
          </div>

        </div>

        {/* ── ② 왜 이 브랜드를 시작하셨나요 ── */}
        <GroupHeader
          n="②"
          title="왜 이 브랜드를 시작하셨나요?"
          sub="시작하게 된 계기를 편하게 적어주세요."
        />
        <div className="space-y-8">
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            placeholder="예: 좋은 소재가 버려지는 게 늘 아쉬웠어요. 이미 있는 것의 가치를 다시 발견하는 일이 더 의미 있다고 믿어요."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </div>

        {/* ── ③ 우리 브랜드를 표현하는 키워드 ── */}
        <GroupHeader n="③" title="우리 브랜드를 표현하는 키워드를 골라주세요." />
        <div className="space-y-8">
          {/* 분위기칩 — 우리를 표현하는 말 */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-base font-medium text-body">
              <span>브랜드와 어울리는 단어를 선택해주세요.</span>
              {aiFilled.has("values") && <AiBadge />}
              <span className="ml-auto text-xs font-normal text-mute">
                {values.length} / {MAX_VIBES}
              </span>
            </label>
            <p className="mb-4 text-[15px] text-mute">
              직접 추가도 가능해요. 최대 10개
            </p>
            <div className="space-y-4">
              {VIBE_CATEGORIES.map((cat, i) => (
                <div
                  key={cat.label}
                  className={i > 0 ? "border-t border-hairline pt-4" : ""}
                >
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-body">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cat.words.map((v) => {
                      const on = values.includes(v);
                      const full = !on && values.length >= MAX_VIBES;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleVibe(v)}
                          disabled={full}
                          className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
                            on
                              ? "border-primary bg-primary-tint text-primary-on"
                              : "border-hairline bg-surface text-mute"
                          } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          {v}
                          {on ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* 직접 추가한 칩 (추천 목록에 없는 것) */}
            {values.some((v) => !ALL_VIBES.includes(v)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {values
                  .filter((v) => !ALL_VIBES.includes(v))
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVibe(v)}
                      className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
                    >
                      {v} ✕
                    </button>
                  ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={customVibe}
                onChange={(e) => setCustomVibe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustomVibe();
                  }
                }}
                placeholder="직접 더하기 (예: 아날로그)"
                disabled={values.length >= MAX_VIBES}
                className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-40"
              />
              <button
                type="button"
                onClick={addCustomVibe}
                disabled={values.length >= MAX_VIBES}
                className="h-10 rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </div>

        </div>

        {/* ── ④ 주로 어떤 활동을 하나요 ── */}
        <GroupHeader
          n="④"
          title="주로 어떤 활동을 하나요?"
          sub="대표 활동을 최대 3가지 소개해주세요. 사진도 담을 수 있어요."
        />
        {actHints.length > 0 && (
          <div className="-mt-3 mb-6">
            <HintBanner
              items={actHints.map((h) => ({ heading: h.title, desc: h.desc, source: h.source }))}
              used={usedActHints}
              canApply={canApplyActHint}
              onApply={applyActHint}
            />
          </div>
        )}
        <div className="space-y-4">
          {activities.map((act, i) => (
            <div
              key={i}
              className="space-y-3 rounded-md border border-hairline bg-surface p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-body">활동 {i + 1}</span>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => removeActivity(i)}
                    className="text-sm text-faint hover:text-ink"
                  >
                    삭제
                  </button>
                )}
              </div>
              <input
                value={act.title}
                onChange={(e) => setAct(i, { title: e.target.value })}
                placeholder="예: Fabric Bag"
                className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <input
                value={act.desc}
                onChange={(e) => setAct(i, { desc: e.target.value })}
                placeholder="예: 업사이클링 원단을 활용한 가방 제작"
                className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <div className="flex flex-wrap gap-2">
                {act.photos.map((p, k) => (
                  <div
                    key={k}
                    className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeActPhoto(i, k)}
                      aria-label="사진 삭제"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {act.photos.length < 3 && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
                    <span className="text-xl leading-none">＋</span>
                    <span className="mt-1 text-[11px]">사진</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addActPhotos(i, e.target.files)}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
          {activities.length < 3 && (
            <button
              type="button"
              onClick={addActivity}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute"
            >
              ＋ 활동 추가
            </button>
          )}
        </div>

        {/* ── ⑤ 어떤 협업을 할 수 있나요 ── */}
        <GroupHeader
          n="⑤"
          title="어떤 협업을 할 수 있나요?"
          sub="제공할 수 있는 협업을 자유롭게 작성해주세요."
        />
        <div className="space-y-8">
          <textarea
            value={offersNote}
            onChange={(e) => setOffersNote(e.target.value)}
            rows={3}
            placeholder="예: 친환경 가방을 만들어요. 브랜드 제품 콜라보, 굿즈 제작을 기대하고 있어요."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          <Field label="이런 콜라보를 제공할 수 있어요">
            <ChipRow
              options={COLLAB_TYPES}
              selected={offers}
              onToggle={(t) => toggle(offers, setOffers, t)}
            />
          </Field>
        </div>

        {/* ── ⑥ 이런 파트너를 찾고 있어요 ── */}
        <GroupHeader
          n="⑥"
          title="이런 파트너를 찾고 있어요."
          sub="파트너와 꿈꾸는 협업 유형을 알려주세요."
        />
        <div className="space-y-8">
          <textarea
            value={seeksNote}
            onChange={(e) => setSeeksNote(e.target.value)}
            rows={3}
            placeholder="예: 지속가능성을 이야기하는 브랜드, 라이프스타일 브랜드, 카페와 함께하고 싶어요."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          <Field label="이런 콜라보를 찾고 있어요">
            <ChipRow
              options={COLLAB_TYPES}
              selected={seeks}
              onToggle={(t) => toggle(seeks, setSeeks, t)}
            />
          </Field>
        </div>

        {/* ── ⑦ 이런 콜라보 경험이 있어요 ── */}
        <GroupHeader
          n="⑦"
          title="이런 콜라보 경험이 있어요."
          sub="선택 · 최대 3개 · 지난 콜라보를 더하면 “검증된 파트너”라는 신호가 돼요."
        />
        <div className="space-y-8">
          <div>

            {collabHints.length > 0 && (
              <div className="mb-3">
                <HintBanner
                  items={collabHints.map((h) => ({ heading: h.partner, desc: h.desc, source: h.source }))}
                  used={usedCollabHints}
                  canApply={canApplyCollabHint}
                  onApply={applyCollabHint}
                />
              </div>
            )}
            <div className="space-y-4">
              {collabHistory.map((h, i) => (
                <div
                  key={i}
                  className="space-y-5 rounded-md border border-hairline bg-surface p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-body">콜라보 {i + 1}</span>
                    {collabHistory.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCollab(i)}
                        className="text-sm text-faint hover:text-ink"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <input
                    value={h.partner}
                    onChange={(e) => setHist(i, { partner: e.target.value })}
                    placeholder="함께한 곳 (예: 오월의숲)"
                    className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                  />
                  <div>
                    <p className="mb-1.5 text-sm text-mute">어떤 타입의 콜라보였나요?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {COLLAB_TYPES.map((t) => {
                        const on = h.types.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleHistType(i, t)}
                            className={`inline-flex h-7 items-center rounded-pill border px-2.5 text-sm transition-colors ${
                              on
                                ? "border-primary bg-primary-tint text-primary-on"
                                : "border-hairline bg-surface text-mute"
                            }`}
                          >
                            {t}
                            {on ? " ✓" : ""}
                          </button>
                        );
                      })}
                      {h.types
                        .filter((t) => !COLLAB_TYPES.includes(t as CollabType))
                        .map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleHistType(i, t)}
                            className="inline-flex h-7 items-center rounded-pill border border-primary bg-primary-tint px-2.5 text-sm text-primary-on"
                          >
                            {t} ✕
                          </button>
                        ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={h.typeInput}
                        onChange={(e) => setHist(i, { typeInput: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            addHistCustomType(i);
                          }
                        }}
                        placeholder="유형 직접 더하기"
                        className="h-9 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
                      />
                      <button
                        type="button"
                        onClick={() => addHistCustomType(i)}
                        className="h-9 rounded-sm border border-border-strong bg-surface px-3 text-sm font-medium text-ink"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm text-mute">콜라보 내용을 간단히 알려주세요.</p>
                    <textarea
                      value={h.desc}
                      onChange={(e) => setHist(i, { desc: e.target.value })}
                      rows={3}
                      placeholder="예: 업사이클링 파우치를 함께 만들어 팝업에서 선보였어요."
                      className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm text-mute">시기</p>
                    <select
                      value={h.year}
                      onChange={(e) => setHist(i, { year: e.target.value })}
                      className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-focus"
                    >
                      <option value="">시기 (선택)</option>
                      {HISTORY_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm text-mute">사진 (선택 · 최대 3장)</p>
                    <div className="flex flex-wrap gap-2">
                      {h.photos.map((p, k) => (
                        <div
                          key={k}
                          className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeHistPhoto(i, k)}
                            aria-label="사진 삭제"
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {h.photos.length < 3 && (
                        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
                          <span className="text-xl leading-none">＋</span>
                          <span className="mt-1 text-[11px]">사진</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => addHistPhotos(i, e.target.files)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {collabHistory.length < 3 && (
                <button
                  type="button"
                  onClick={addCollab}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute"
                >
                  ＋ 콜라보 경험 추가
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── ⑧ 저희는 주로 이런 고객과 함께하고 있어요 ── */}
        <GroupHeader n="⑧" title="저희는 주로 이런 고객과 함께하고 있어요." />
        <div className="space-y-8">
          {/* 이런 분들과 만나요 (타겟 고객) */}
          <div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_AUDIENCE.map((a) => {
                const on = targetAudience.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAudience(a)}
                    className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary-tint text-primary-on"
                        : "border-hairline bg-surface text-mute"
                    }`}
                  >
                    {a}
                    {on ? " ✓" : ""}
                  </button>
                );
              })}
              {targetAudience
                .filter((a) => !SUGGESTED_AUDIENCE.includes(a))
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAudience(a)}
                    className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
                  >
                    {a} ✕
                  </button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustomAudience();
                  }
                }}
                placeholder="직접 더하기 (예: 신혼부부)"
                className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <button
                type="button"
                onClick={addCustomAudience}
                className="h-10 rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
              >
                추가
              </button>
            </div>
          </div>
        </div>

        {/* ── ⑨ 브랜드 정보를 입력해주세요 ── */}
        <GroupHeader n="⑨" title="브랜드 정보를 입력해주세요." />
        <div className="space-y-8">
          <Field label="주소" hint={hintFor("address", "address")}>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울 성동구 성수동"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {region && (
              <p className="mt-1 text-sm text-mute">
                지역 자동 인식: <span className="text-body">{region}</span>
              </p>
            )}
          </Field>
          <Field label="인스타그램" hint={hintFor("instagram", "instagram")}>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@handle"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
          <Field label="홈페이지" hint={hintFor("homepage", "homepage")}>
            <input
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
              placeholder="https://"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
          </Field>
        </div>

        {/* 콜라보 열림/닫힘 */}
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3">
          <div>
            <p className="text-base font-medium text-ink">콜라보 받는 중</p>
            <p className="text-sm text-mute">
              켜두면 다른 메이커가 먼저 콜라보를 제안할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollabOpen((v) => !v)}
            role="switch"
            aria-checked={collabOpen}
            aria-label="콜라보 받는 중"
            className={`flex h-[26px] w-11 shrink-0 items-center rounded-pill p-[2px] transition-colors ${
              collabOpen ? "bg-primary" : "bg-border-strong"
            }`}
          >
            <span
              className={`h-[22px] w-[22px] rounded-pill bg-white transition-transform ${
                collabOpen ? "translate-x-[18px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
          >
            {pending ? "만드는 중…" : "콜라보 카드 등록하기"}
          </button>
          <p className="text-center text-sm text-mute">
            등록 후에는 언제든 콜라보 카드를 공유할 수 있어요.
          </p>
        </div>
      </div>

      {/* 딸깍 자동완성 위저드 — 가중 키워드 → 백그라운드 크롤 → 한줄/소개 5지선다 */}
      {wizardOpen && (
        <EnrichWizard
          query={query.trim()}
          onClose={() => setWizardOpen(false)}
          onApply={applyWizard}
        />
      )}

      {/* 브랜드 소개 5지선다 — '초안 받기' 결과 */}
      {descModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => setDescModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-lg border border-hairline bg-surface p-5 shadow-e2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDescModalOpen(false)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-lg text-mute hover:bg-surface-soft hover:text-ink"
            >
              ✕
            </button>
            <p className="pr-8 text-base font-bold text-ink">마음에 드는 소개를 골라주세요</p>
            <p className="mt-1 text-sm text-mute">
              ‘수정’으로 다듬으며 비교하고, 마음에 드는 하나를 골라주세요.
            </p>
            <div className="mt-4 max-h-[52vh] overflow-y-auto pr-0.5">
              <DescPicker
                list={descChoices}
                sel={descSel}
                onSelect={setDescSel}
                onEdit={editDescChoice}
              />
            </div>
            <button
              type="button"
              onClick={applyDesc}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-50"
              disabled={!(descChoices[descSel] ?? "").trim()}
            >
              이 소개로 채우기
            </button>
          </div>
        </div>
      )}

      {/* 등록 완료 → 브랜드 소개서 얼럿 (소개서 페이지에서 확인·링크 공유) */}
      {portfolioOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-lg font-bold text-ink">✨ 브랜드 소개서가 완성됐어요!</p>
            <p className="mt-3 text-[15px] leading-relaxed text-body">
              브랜드 소개서 페이지에서 내용을 확인해보세요
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-body">
              이제, 링크를 복사해 협업을 제안해 볼 수 있어요.
            </p>
            <button
              type="button"
              onClick={goToPage}
              disabled={goingToPage}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-80"
            >
              {goingToPage && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-on border-t-transparent" />
              )}
              {goingToPage ? "소개서를 여는 중…" : "소개서 확인하기"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// 브랜드 소개 5지선다 — 각 후보를 그 자리에서 수정 가능(controlled). 다듬으며 비교 → 하나 선택.
function DescPicker({
  list,
  sel,
  onSelect,
  onEdit,
}: {
  list: string[];
  sel: number;
  onSelect: (i: number) => void;
  onEdit: (i: number, v: string) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {list.map((it, i) => {
        const on = sel === i;
        const isEditing = editing === i;
        return (
          <div
            key={i}
            className={`rounded-md border transition-colors ${
              on ? "border-primary bg-primary-pale" : "border-hairline bg-surface"
            }`}
          >
            <div className="flex items-start gap-2.5 px-3 py-3">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label="이 소개 선택"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border text-[10px] font-bold ${
                  on ? "border-primary bg-primary text-primary-on" : "border-border-strong text-transparent"
                }`}
              >
                ✓
              </button>
              {isEditing ? (
                <textarea
                  value={it}
                  onChange={(e) => onEdit(i, e.target.value)}
                  autoFocus
                  rows={5}
                  className="flex-1 rounded-sm border border-hairline bg-surface px-2.5 py-2 text-[15px] leading-relaxed text-ink outline-none focus:border-focus"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`flex-1 text-left text-[15px] leading-relaxed ${on ? "text-ink" : "text-body"}`}
                >
                  {it}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(isEditing ? null : i)}
                className="shrink-0 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline"
              >
                {isEditing ? "완료" : "수정"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 크롤이 발견한 참고 힌트 — 접힌 배너 → 펼침. 창작 아님(웹에서 찾은 내용만).
function HintBanner({
  items,
  used,
  canApply,
  onApply,
}: {
  items: { heading: string; desc: string; source: string }[];
  used: Set<number>;
  canApply: boolean;
  onApply: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="rounded-md border border-hairline bg-primary-pale/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-primary-on"
      >
        <span>✨ 웹에서 참고할 만한 정보를 찾았어요 ({items.length}건)</span>
        <span className="text-mute">{open ? "∧" : "∨"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-hairline px-3 py-3">
          {items.map((it, i) => {
            const isUsed = used.has(i);
            return (
              <div key={i}>
                <span className="inline-flex h-6 items-center rounded-pill bg-surface px-2 text-[12px] text-mute">
                  {it.source}
                </span>
                <p className="mt-1 text-sm font-semibold text-ink">{it.heading}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-body">{it.desc}</p>
                <button
                  type="button"
                  onClick={() => onApply(i)}
                  disabled={isUsed || !canApply}
                  className="mt-1.5 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50"
                >
                  {isUsed ? "✓ 넣었어요" : "이 내용으로 시작하기"}
                </button>
              </div>
            );
          })}
          <p className="text-[12px] text-faint">ⓘ 웹에서 찾은 내용이에요.</p>
        </div>
      )}
    </div>
  );
}

function GroupHeader({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-[23px] flex items-baseline gap-2 border-b border-hairline pb-2">
      <span className="rounded-pill bg-primary-tint px-2 py-0.5 text-sm font-bold text-primary-on">
        {n}
      </span>
      <span className="text-[17px] font-bold text-ink">{title}</span>
      {sub && <span className="text-sm text-mute">{sub}</span>}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-base font-medium text-body">
        <span>{label}</span>
        {hint}
      </label>
      {children}
    </div>
  );
}

// AI가 채운 필드 표시 (✓검증마크 아님 — '초안' 표시)
function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-pill bg-primary-tint px-1.5 py-0.5 text-[10px] font-medium text-primary-on">
      ✨ 미리 채웠어요
    </span>
  );
}

// 못 찾은 검증가능 필드 — 직접 입력 노티
function MissingNote() {
  return <span className="text-[11px] font-normal text-mute">· 직접 입력이 필요해요</span>;
}

function ChipRow({
  options,
  selected,
  onToggle,
}: {
  options: CollabType[];
  selected: CollabType[];
  onToggle: (t: CollabType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
              on
                ? "border-primary bg-primary-tint text-primary-on"
                : "border-hairline bg-surface text-mute"
            }`}
          >
            {t}
            {on ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}
