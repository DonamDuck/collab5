// 사이트 전체 화면 지도용 목 데이터 (2026-09-18 대표: 「map으로 만들면 디자인팀 검수 같은 것도 하기 편하고 나도 그냥 들어가서 막 볼 수 있기도 하고」)
//
// ⭐하루 가게 세계(`rent-mock-data.ts`) 위에 «소개서·찜·리포트·성사 기록·매거진·요약 리포트» 층을 얹는다.
//   사람도 같다. 하루 가게에서 공간을 빌려주는 느린오후 사장님(9001)이 여기선 소개서 셋을 가진 브랜드 회원이고,
//   손님 밀가루 일기(9002)는 느린오후를 찜하고 리포트를 받아 본 회원이다.
// ⭐여기 적는 건 DB 행이 아니라 읽기 함수가 내놓는 타입(`Maker`·`MagazineArticle`…) 그대로다. `site-mock-repo.ts`가
//   이걸 `Repo` 모양으로 돌려준다. 타입에 칸이 늘면 `satisfies`가 여기서 멈춘다.
// ⛔실제 파트너·브랜드 이름은 한 글자도 안 쓴다(이름마다 볼트 grep 0건 확인). 사진은 `public/`에 실제 파트너 캡처뿐이라
//   하루 가게와 같이 색면 SVG(`photo()`)를 쓴다. 파일을 더하지 않아 운영 배포물에 안 실린다.
// ⏱날짜는 오늘(KST) 기준 상대값. 「새로 온 브랜드」(30일)·리포트 신선도처럼 시간에 달린 갈래가 매일 같게 나온다.
// 🚨서버 전용. `rent-mock.ts`만 부른다.
import type {
  ArticleComment, BrandDna, Collab, CollabCard, CollabReportData, MagazineArticle, MagazineDoc, MagazineNode, Maker,
} from "./types";
import type { Brief } from "./briefs";
import type { Profile } from "./profiles";
import { buildWorld, maker, MOCK_USER, photo, type MockCaseDef, type MockWorld } from "./rent-mock-data";
import { addDaysIso, todayKst } from "./rent-time";

export interface MockDna {
  brandId: number;
  dna: Omit<BrandDna, "input_hash">;
  /** match = 지금 소개서와 지문이 같다(신선) · edited = 리포트 뒤에 소개서를 고쳤다(「다시 분석하기」가 뜬다) */
  hash: "match" | "edited";
}

export interface MockReport {
  fromBrandId: number;
  toBrandId: number;
  requestedBy: number;
  report: CollabReportData;
  model: string;
  createdAt: string;
}

export interface SiteLayer {
  articles: MagazineArticle[];
  comments: ArticleComment[];
  likes: { userId: number; articleId: number }[];
  saved: { userId: number; makerId: number; createdAt: string }[];
  cards: CollabCard[];
  dna: MockDna[];
  reports: MockReport[];
  collabs: Collab[];
  briefs: Brief[];
}

export type SiteWorld = MockWorld & SiteLayer;

const siteCache = new Map<string, SiteWorld>();

/** 케이스의 세계 = 하루 가게 세계 + 사이트 층. 같은 날 같은 세계는 한 번만 만든다. */
export function buildSiteWorld(kind: MockCaseDef["world"], today = todayKst()): SiteWorld {
  const key = `${kind}:${today}`;
  const hit = siteCache.get(key);
  if (hit) return hit;
  const base = buildWorld(kind, today);
  const w =
    kind === "empty" ? { ...base, ...emptyLayer() }
      : kind === "stress" ? stressLayer(base, today)
        : kind === "minimal" ? minimalLayer(base, today)
          : fullLayer(base, today);
  siteCache.set(key, w);
  return w;
}

function emptyLayer(): SiteLayer {
  return { articles: [], comments: [], likes: [], saved: [], cards: [], dna: [], reports: [], collabs: [], briefs: [] };
}

const at = (today: string, n: number, hm = "10:00") => `${addDaysIso(today, n)}T${hm}:00.000+09:00`;

/** 로고 자리 — 동그라미 안 글자 하나. 프로필 사진(`profileImage`)으로 쓴다. */
function logo(letter: string, hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">` +
    `<rect width="400" height="400" fill="hsl(${hue},35%,88%)"/>` +
    `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="190" fill="hsl(${hue},40%,32%)">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ─── 매거진 본문 조각 ───

const txt = (text: string, marks?: MagazineNode["marks"]): MagazineNode => ({ type: "text", text, ...(marks ? { marks } : {}) });
const para = (...content: MagazineNode[]): MagazineNode => ({ type: "paragraph", content });
const h3 = (text: string): MagazineNode => ({ type: "heading", attrs: { level: 3 }, content: [txt(text)] });
const li = (text: string): MagazineNode => ({ type: "listItem", content: [para(txt(text))] });

// ─── 🗂풀 세계 ───

function fullLayer(base: MockWorld, today: string): SiteWorld {
  const U = MOCK_USER;
  const d = (n: number, hm?: string) => at(today, n, hm);

  const profiles: Profile[] = base.profiles.map((p) =>
    p.id === U.host ? { ...p, profileImage: logo("느", 28) }
      : p.id === U.guest ? { ...p, profileImage: logo("밀", 38) }
        : p,
  );
  profiles.push({ id: U.newbie, uuid: `mock-uuid-${U.newbie}`, brandName: "", phone: "", email: "new.member@example.com", profileImage: "" });

  // 🟢느린오후 로스터리 — 소개서 폼의 모든 칸을 채웠다.
  const slowPhotos = [
    photo("1층 로스터리", 28), photo("로스팅 기계", 18, 900, 1200), photo("창가 자리", 45),
    photo("원두 봉투", 34), photo("2층 클래스", 24, 1080, 1350), photo("골목 입구", 200),
  ];
  const slow = maker({
    id: 9901, slug: "mock-slow-afternoon", name: "느린오후 로스터리", ownerUserId: U.host,
    oneLiner: "동네 사람들이 오후를 천천히 보내는 작은 로스터리예요.",
    region: "서울 성동구 성수동",
    offers: ["팝업", "워크숍", "공동굿즈", "공간대여"], seeks: ["공동콘텐츠"],
    targetAudience: ["성수동 직장인", "주말 산책하는 동네 주민", "카페 창업을 준비하는 분"],
    description:
      "성수동 골목 2층 건물에서 원두를 볶고 커피를 내려요. 1층은 로스터리 겸 카페, 2층은 클래스와 모임에 쓰는 방이에요.\n\n" +
      "평일 오후엔 동네 분들이 책을 읽다 가시고, 주말엔 여섯 명 남짓 모여 핸드드립을 배워요. 원두는 매주 화요일에 볶아서 일주일 안에 다 팔아요.",
    story:
      "회사 다니며 주말마다 집에서 원두를 볶았어요. 친구들에게 나눠 주던 봉투가 한 달에 오십 개가 넘었을 때 가게를 열기로 했어요.\n\n" +
      "쉬는 월요일마다 비어 있는 2층이 아까워서, 요즘은 다른 작은 브랜드에 하루씩 빌려드리고 있어요.",
    activities: [
      { title: "월간 핸드드립 클래스", desc: "한 달에 한 번, 여섯 분과 원두 세 가지를 내려 봐요. 끝나면 각자 고른 원두를 한 봉씩 가져가세요.", photos: [photo("드립 클래스", 32), photo("클래스 테이블", 36, 1080, 1350)], link: "https://example.com/class" },
      { title: "동네 책 교환 선반", desc: "다 읽은 책을 두고 가시면 다른 분이 가져가요. 지금 선반에 이백 권쯤 있어요.", photos: [photo("책 선반", 50)] },
      { title: "화요일 로스팅 공개", desc: "매주 화요일 오전엔 로스팅하는 모습을 창밖에서 보실 수 있어요.", photos: [] },
    ],
    collabHistory: [
      { partner: "밀가루 일기", types: ["팝업"], desc: "주말 이틀 동안 2층에서 사워도우와 커피를 같이 냈어요. 빵 스무 개가 오후 두 시에 다 나갔어요.", year: "2026", photos: [photo("빵 팝업", 12), photo("팝업 손님", 16, 900, 1200)], link: "https://example.com/popup" },
      { partner: "바늘숲 공방", types: ["공동굿즈"], desc: "원두 자루 천으로 파우치 여든 개를 만들었어요.", year: "2025", photos: [photo("자루 파우치", 330)] },
      { partner: "동네 필름 모임", types: ["행사참여"], desc: "골목 사진전에 2층 벽을 내드렸어요.", year: "2024", photos: [] },
    ],
    offersDescription: "2층 방(열네 명)을 하루 빌려드릴 수 있고, 원두를 소량으로 따로 볶아 드릴 수 있어요.",
    seeksDescription:
      "커피와 같이 즐길 수 있는 걸 만드는 분을 찾고 있어요. 빵이나 디저트, 잔을 빚는 도예 공방이면 좋겠어요.\n평일 저녁 두 시간짜리 작은 클래스를 같이 열어 보고 싶어요.",
    photos: slowPhotos,
    photoSources: { [slowPhotos[1]]: "사진 느린오후 단골 손님", [slowPhotos[4]]: "사진 밀가루 일기" },
    showcases: [
      { type: "metrics", photos: [], links: [], items: [{ label: "한 달 로스팅", value: "120kg" }, { label: "클래스 수강생", value: "340명" }, { label: "문 연 지", value: "4년" }] },
      { type: "reviews", photos: [], links: [], items: [{ quote: "오후 네 시에 창가에 앉으면 시간이 천천히 가요.", source: "동네 손님" }, { quote: "클래스 끝나고 산 원두를 매주 다시 사러 와요." }] },
      { type: "team", photos: [photo("사장님 둘", 22)], links: [], intro: "로스팅은 김느린, 클래스는 박오후가 맡아요. 둘 다 회사를 그만두고 이 골목에 왔어요." },
      { type: "press", photos: [], links: [], items: [{ title: "성수동 골목의 작은 로스터리들", year: "2025", desc: "동네 잡지에 두 쪽 실렸어요.", link: "https://example.com/press", photos: [photo("잡지 지면", 44, 900, 1200)] }] },
      { type: "space", photos: [photo("2층 전경", 30)], links: [], desc: "2층은 긴 원목 테이블 하나와 의자 열두 개가 있는 방이에요.", features: ["남향 창 두 면", "빔프로젝터", "에스프레소 머신"] },
      { type: "custom", photos: [], links: [{ label: "원두 정기 배송", url: "https://example.com/subscribe" }], title: "원두 정기 배송", body: "한 달에 두 번, 그 주에 볶은 원두를 집으로 보내 드려요." },
    ],
    enrichment: {
      createdAt: d(-60), tier: "rich", seed: { region: "서울 성동구", businessType: "카페" },
      chips: [{ text: "직접 로스팅", section: "특장점", factual: true, starred: true, confirmed: true }],
      ownerNote: "매주 화요일에 볶은 원두만 팔아요.",
    },
    introFileUrl: "https://example.com/slow-afternoon-intro.pdf",
    keywords: ["직접 로스팅", "동네 카페", "핸드드립 클래스", "책 교환", "성수동 골목"],
    industryCode: "I21201", hasSpace: true,
    trust: {
      homepage: "https://example.com", instagram: "https://www.instagram.com/example",
      address: "서울 성동구 연무장길 00", mapUrl: "https://map.naver.com/p/search/example", lat: 37.5436, lng: 127.0559,
    },
    createdAt: d(-120), updatedAt: d(-2),
  });

  const flour = maker({
    ...base.makers.find((m) => m.id === 9902)!,
    offers: ["팝업", "제품콜라보"], seeks: ["공간대여"],
    seeksDescription: "주말에 하루 빵을 팔 수 있는 가게를 찾고 있어요.",
    trust: { instagram: "https://www.instagram.com/example" },
    createdAt: d(-12), updatedAt: d(-12),
  });

  const makers: Maker[] = [
    slow,
    flour,
    maker({
      id: 9903, slug: "mock-needle-forest", name: "바늘숲 공방", ownerUserId: U.host2,
      oneLiner: "헌 옷감으로 작은 물건을 짓는 을지로 재봉 공방이에요.", region: "서울 중구 을지로",
      offers: ["워크숍", "공동굿즈"], keywords: ["업사이클", "재봉 클래스"],
      description: "재봉틀 네 대가 있는 공방이에요. 버려지는 천으로 파우치와 앞치마를 만들어요.",
      photos: [photo("재봉틀", 330), photo("천 조각", 300, 1080, 1350), photo("앞치마", 310)],
      collabPaused: true, createdAt: d(-200),
    }),
    maker({
      id: 9904, slug: "mock-low-desk", name: "낮은책상 책방", ownerUserId: U.guest2,
      oneLiner: "사진 없이 글로만 소개하는 작은 독립 책방이에요.", region: "서울 마포구 망원동",
      offers: ["행사참여", "공동콘텐츠"], keywords: ["독립출판", "북토크"],
      description: "앉은뱅이 책상 네 개를 놓고 책을 파는 방이에요. 한 달에 한 번 작가를 모셔 이야기를 들어요.",
      story: "출판사에서 십 년 일하다가, 팔리지 않아도 좋은 책을 두는 곳을 열었어요.",
      createdAt: d(-8),
    }),
    maker({
      id: 9907, slug: "mock-slow-afternoon-beans", name: "느린오후 원두 구독", ownerUserId: U.host,
      oneLiner: "느린오후가 따로 운영하는 원두 정기 배송이에요. 콜라보 찾기에는 숨겨 두었어요.", region: "서울 성동구",
      searchVisible: false, createdAt: d(-40),
    }),
    maker({
      id: 9908, slug: "mock-green-watering-can", name: "초록 물뿌리개", ownerUserId: undefined,
      editPasswordHash: "mock-hash-not-a-real-password",
      oneLiner: "계정 없이 만들어 비밀번호로만 고칠 수 있는 식물 가게 소개서예요.", region: "서울 용산구",
      offers: ["팝업", "공동굿즈"], photos: [photo("화분 선반", 110), photo("물뿌리개", 95, 900, 1200)],
      createdAt: d(-5),
    }),
    maker({
      id: 9909, slug: "mock-one-roll-film", name: "필름 한 롤 사진관", ownerUserId: undefined,
      oneLiner: "필름 한 롤로 가족사진을 찍어 드리는 동네 사진관이에요.", region: "서울 종로구 서촌",
      offers: ["공동콘텐츠", "팝업"], keywords: ["필름 사진", "가족사진"],
      description: "서촌 골목의 작은 스튜디오예요. 서른여섯 장만 찍고, 인화는 일주일 뒤에 드려요.",
      photos: [photo("스튜디오", 210), photo("필름 카메라", 220, 900, 1200)], createdAt: d(-3),
    }),
    maker({
      id: 9910, slug: "mock-three-pm-pottery", name: "오후 세 시 도자기", ownerUserId: undefined,
      oneLiner: "평일 오후 세 시에만 여는 도자기 물레 교실이에요.", region: "경기 파주시",
      offers: ["워크숍", "제품콜라보"], photos: [photo("물레", 20), photo("유약 선반", 15, 1080, 1350)], createdAt: d(-90),
    }),
    maker({
      id: 9911, slug: "mock-wave-records", name: "파도 소리 음반가게", ownerUserId: undefined,
      oneLiner: "바닷가 마을에서 중고 음반을 파는 가게예요.", region: "강원 강릉시",
      offers: ["행사참여", "팝업"], photos: [photo("음반 상자", 190)], createdAt: d(-150),
    }),
    // /preview 데모 두 장 — 실제 데모 주소(`lib/demo.ts`)를 그대로 쓰되 내용은 가상 브랜드다.
    { ...slow, id: 9920, slug: "m-demo-photo", ownerUserId: U.host2, searchVisible: false },
    { ...makers9904Text(), id: 9921, slug: "m-demo-none", searchVisible: false },
  ];

  function makers9904Text(): Maker {
    return maker({
      id: 9921, slug: "m-demo-none", name: "낮은책상 책방", ownerUserId: undefined,
      oneLiner: "사진 없이 글로만 채운 소개서 예시예요.", region: "서울 마포구",
      offers: ["행사참여", "공동콘텐츠"], seeks: [],
      description: "앉은뱅이 책상 네 개를 놓고 책을 파는 방이에요. 한 달에 한 번 작가를 모셔 이야기를 들어요.",
      story: "출판사에서 십 년 일하다가, 팔리지 않아도 좋은 책을 두는 곳을 열었어요.",
      activities: [{ title: "월간 북토크", desc: "작가 한 분과 열 명이 둘러앉아요.", photos: [] }],
      seeksDescription: "책 옆에 둘 차나 과자를 만드는 분을 찾아요.",
      keywords: ["독립출판", "북토크"],
    });
  }

  const report = (idea: string, partner: string): CollabReportData => ({
    matchPoints: [
      { text: `둘 다 동네 손님이 오래 머무는 자리를 만들어 왔어요.` },
      { text: `${partner}의 손님층과 느린오후의 클래스 수강생이 많이 겹쳐요.` },
      { text: "주말 오후 시간대를 함께 쓸 수 있어요." },
    ],
    ideas: [
      { title: idea, desc: "한 달에 한 번, 두 브랜드가 한 공간에서 두 시간짜리 자리를 열어요.", method: "협동 워크숍", gainA: "클래스에 새 손님이 들어와요.", gainB: "매장 밖에서 단골을 만날 수 있어요." },
      { title: "서로의 단골에게 보내는 초대장", desc: "각자 단골 스무 명에게 상대 가게 할인 쿠폰을 한 장씩 건네요.", method: "상호 고객 혜택 교환", gainA: "", gainB: "" },
    ],
    steps: ["날짜 하나를 먼저 정해요", "인원을 여덟 명으로 작게 잡아요", "끝나고 사진을 서로 올려요"],
    effects: ["두 가게 단골이 서로 섞여요", "평일 오후 빈 시간이 채워져요"],
  });

  const dna = (summary: string, n: number): Omit<BrandDna, "input_hash"> => ({
    summary,
    items: [
      { type: "philosophy", value: "커뮤니티", evidence: "동네 분들이 책을 읽다 가시고", source: ["description"] },
      { type: "mood", value: "편안함", evidence: "오후를 천천히 보내는", source: ["one_liner"] },
      { type: "experience", value: "클래스", evidence: "핸드드립을 배워요", source: ["description"] },
      { type: "space", value: "카페", evidence: "로스터리 겸 카페", source: ["description"] },
      { type: "locality", value: "골목 상권", evidence: "성수동 골목", source: ["description"] },
    ],
    signature: [{ text: "쉬는 날 비는 2층을 다른 작은 브랜드에 내주는 로스터리", evidence: "비어 있는 2층이 아까워서", source: ["story"] }],
    input_fields: ["one_liner", "description", "story"],
    created_at: d(-60 - n), updated_at: d(-20 - n),
  });

  return {
    ...base,
    profiles,
    makers,
    articles: fullArticles(today),
    comments: [
      { id: 1, articleId: 9501, userId: U.guest, authorName: "밀가루 일기", authorSlug: "mock-flour-diary", authorImage: logo("밀", 38), body: "그날 빵 굽느라 새벽 네 시에 일어났어요. 다시 읽으니 또 하고 싶네요.", createdAt: d(-6, "21:10") },
      { id: 2, articleId: 9501, userId: U.host, authorName: "느린오후", authorSlug: "mock-slow-afternoon", authorImage: logo("느", 28), body: "다음 달에도 2층 비워 둘게요.", createdAt: d(-6, "22:40") },
      { id: 3, articleId: 9501, userId: U.newbie, authorName: "새 회원", body: "소개서가 없는 회원이 남긴 댓글이에요. 이름에 링크가 안 걸려요.", createdAt: d(-2, "09:05") },
      { id: 4, articleId: 9501, userId: U.guest2, authorName: "낮은책상", authorSlug: "mock-low-desk", body: "저희 책방에서도 이런 자리를 열어 보고 싶어요!", createdAt: d(0, "08:30") },
    ],
    likes: [{ userId: U.host, articleId: 9501 }, { userId: U.guest, articleId: 9501 }],
    saved: [
      { userId: U.host, makerId: 9909, createdAt: d(-1) },
      { userId: U.host, makerId: 9903, createdAt: d(-4) },
      { userId: U.host, makerId: 9910, createdAt: d(-9) },
      { userId: U.guest, makerId: 9901, createdAt: d(-3) },
    ],
    cards: [{
      id: 9601, slug: "mock-slow-afternoon-card", fromBrandId: 9901, createdAt: d(-7),
      proposal: {
        toName: "필름 한 롤 사진관",
        why: "두 가게 모두 서두르지 않는 시간을 팔고 있다고 느꼈어요.",
        picture: "느린오후 2층에서 하루 동안 필름 가족사진을 찍고, 기다리는 동안 커피를 내려 드려요.",
        expectedEffect: "서촌과 성수 단골이 서로의 동네를 한 번씩 찾아가요.",
      },
    }],
    dna: [
      { brandId: 9901, dna: dna("동네 사람의 오후를 붙잡아 두는 로스터리", 0), hash: "match" },
      { brandId: 9902, dna: dna("가게를 열기 전 하루씩 연습하는 홈베이커리", 2), hash: "match" },
      { brandId: 9907, dna: dna("원두 정기 배송", 1), hash: "edited" },
    ],
    reports: [
      // 밀가루 일기 → 느린오후 : 신선한 저장본. 밀가루 일기로 느린오후 소개서를 열면 로딩 없이 바로 뜬다.
      { fromBrandId: 9902, toBrandId: 9901, requestedBy: U.guest, report: report("토요일 아침 빵과 커피 한 상", "밀가루 일기"), model: "mock", createdAt: d(-5) },
      // 느린오후 → 필름 한 롤 : 신선
      { fromBrandId: 9901, toBrandId: 9909, requestedBy: U.host, report: report("필름 가족사진 찍는 날", "필름 한 롤 사진관"), model: "mock", createdAt: d(-6) },
      // 원두 구독 → 오후 세 시 도자기 : 리포트 뒤에 소개서를 고침 → /my에서 「다시 분석하기」
      { fromBrandId: 9907, toBrandId: 9910, requestedBy: U.host, report: report("원두와 잔을 한 상자에", "오후 세 시 도자기"), model: "mock", createdAt: d(-15) },
    ],
    collabs: [
      { id: 9701, brandAId: 9901, brandAName: "느린오후 로스터리", brandASlug: "mock-slow-afternoon", brandBId: 9902, brandBName: "밀가루 일기", brandBSlug: "mock-flour-diary", status: "done", origin: "product", title: "주말 이틀 빵과 커피 팝업", year: "2026", description: "2층에서 사워도우와 커피를 같이 냈어요.", photos: [photo("빵 팝업", 12)], link: "", createdAt: d(-10) },
      { id: 9702, brandAId: 9901, brandAName: "느린오후 로스터리", brandASlug: "mock-slow-afternoon", brandBId: 9909, brandBName: "필름 한 롤 사진관", brandBSlug: "mock-one-roll-film", status: "agreed", origin: "concierge", title: "필름 가족사진 찍는 날", year: "2026", description: "", photos: [], link: "", createdAt: d(-2) },
    ],
    briefs: [
      { slug: "mock-slow-afternoon", brandName: "느린오후 로스터리", publishedAt: addDaysIso(today, -14), notionUrl: "", markdown: BRIEF_SLOW, ownerUserId: U.host },
      { slug: "mock-flour-diary", brandName: "밀가루 일기", publishedAt: addDaysIso(today, -9), notionUrl: "", markdown: BRIEF_FLOUR, ownerUserId: null },
    ],
  };
}

function fullArticles(today: string): MagazineArticle[] {
  const d = (n: number, hm?: string) => at(today, n, hm);
  const cover = photo("2층 창가 팝업", 26);
  const body: MagazineDoc = {
    type: "doc",
    content: [
      para(txt("토요일 아침 여덟 시, 성수동 골목 2층 계단에 빵 상자 네 개가 올라갔어요. "), txt("밀가루 일기", [{ type: "bold" }]), txt("가 처음으로 집 밖에서 빵을 판 날이에요.")),
      para(txt("둘이 만난 건 "), txt("collab5 콜라보 찾기", [{ type: "link", attrs: { href: "/search" } }]), txt("였어요. 느린오후 사장님이 쉬는 월요일의 2층을 어떻게 쓸지 고민하던 참이었어요.")),
      h3("빵이 먼저 떨어졌어요"),
      para(txt("오후 두 시에 사워도우 스무 개가 다 나갔어요. 남은 시간은 커피만 팔았는데, 손님들이 "), txt("다음엔 언제 오냐", [{ type: "italic" }]), txt("고 계속 물었어요.")),
      { type: "blockquote", content: [para(txt("빵이 식기 전에 커피를 내리는 게 제일 바빴어요. 둘이 박자를 맞추는 데 반나절 걸렸어요."))] },
      { type: "image", attrs: { src: photo("오븐에서 막 나온 빵", 12, 1080, 1350), alt: "사워도우", caption: "오전 열한 시, 두 번째 판이 나왔어요.", width: 480 } },
      { type: "pullQuote", content: [para(txt("작게 한 번 해 보니, 다음 약속이 쉬워졌어요."))] },
      h3("준비한 것"),
      { type: "bulletList", content: [li("빵 상자 네 개와 가격표"), li("커피 두 종류만 메뉴판에"), li("2층 창문 두 개 활짝")] },
      h3("다음에 바꿀 것"),
      { type: "orderedList", content: [li("빵을 두 번에 나눠 가져오기"), li("줄 서는 자리를 계단 밖으로")] },
      { type: "horizontalRule" },
      para(txt("두 가게는 다음 달 둘째 주 토요일에 한 번 더 만나요."), { type: "hardBreak" }, txt("그땐 도자기 잔도 같이 올 예정이에요.", [{ type: "strike" }])),
    ],
  };
  return [
    {
      id: 9501, slug: "mock-bread-and-coffee", status: "published",
      title: "빵이 식기 전에 커피를 내리던 토요일", subtitle: "현장 기록 · 성수동",
      editorName: "하루", location: "서울 성동구 성수동", coverImage: cover,
      summary: "홈베이커리 밀가루 일기가 느린오후 로스터리 2층에서 처음으로 빵을 판 이틀을 따라갔어요.",
      factBox: [
        { label: "함께한 곳", value: "느린오후 로스터리 × 밀가루 일기" },
        { label: "언제", value: "토요일·일요일 이틀" },
        { label: "누가", value: "사장님 셋, 손님 백여 명" },
        { label: "무엇을", value: "사워도우와 핸드드립 팝업" },
      ],
      brandLinks: [
        { slug: "mock-slow-afternoon", name: "느린오후 로스터리", tagline: "동네 사람들이 오후를 천천히 보내는 작은 로스터리예요." },
        { slug: "mock-flour-diary", name: "밀가루 일기", tagline: "매일 구운 빵을 기록하는 홈베이커리예요." },
      ],
      body, publishedAt: d(-7), createdAt: d(-9), updatedAt: d(-7),
    },
    {
      id: 9502, slug: "mock-needle-apron", status: "published",
      title: "원두 자루가 앞치마가 되기까지", subtitle: "",
      editorName: "하루", location: "", coverImage: "",
      summary: "", factBox: [], brandLinks: [],
      body: { type: "doc", content: [para(txt("커버 사진·요약·정보 카드·브랜드 링크가 모두 빈 글이에요. 본문 한 문단만 있어요."))] },
      publishedAt: d(-40), createdAt: d(-41), updatedAt: d(-40),
    },
    {
      id: 9503, slug: "mock-draft-pottery", status: "draft",
      title: "(초안) 오후 세 시 도자기 교실", subtitle: "쓰는 중",
      editorName: "하루", location: "경기 파주시", coverImage: photo("물레", 20),
      summary: "편집자만 볼 수 있는 초안이에요.", factBox: [{ label: "함께한 곳", value: "아직 정하는 중" }], brandLinks: [],
      body: { type: "doc", content: [para(txt("초안 본문이에요."))] },
      createdAt: d(-1), updatedAt: d(0),
    },
  ] satisfies MagazineArticle[];
}

// ─── 📏긴 글 세계 ───

function stressLayer(base: MockWorld, today: string): SiteWorld {
  const U = MOCK_USER;
  const d = (n: number, hm?: string) => at(today, n, hm);
  const long = (s: string, n: number) => Array.from({ length: n }, () => s).join(" ");
  const para1 = "아침엔 동네 어르신들이 두유를 드시러 오시고, 점심엔 근처 인쇄소 사장님들이 도시락을 데우러 오세요. 오후 세 시부터 여섯 시까지는 손님이 거의 없어요.";
  const makers = base.makers.map((m) =>
    m.id !== 9905 ? m : maker({
      ...m,
      region: "서울 마포구 망원동 포은로 골목 끝 파란 대문 집",
      offers: ["제품콜라보", "팝업", "워크숍", "공동굿즈", "공동콘텐츠", "행사참여", "공간대여"],
      targetAudience: Array.from({ length: 8 }, (_, i) => `아주 길게 적은 만나고 싶은 사람 ${i + 1}번, 동네에서 오래 장사한 분`),
      description: long(para1, 5),
      story: long(para1, 4),
      seeksDescription: long("오후 세 시부터 여섯 시까지 부엌을 같이 쓸 분을 찾아요.", 6),
      offersDescription: long("업소용 오븐과 반죽기를 같이 쓰실 수 있어요.", 6),
      activities: Array.from({ length: 5 }, (_, i) => ({ title: `활동 ${i + 1} · 이름이 아주 긴 동네 부엌 정기 모임과 그 뒤풀이`, desc: long(para1, 2), photos: Array.from({ length: 5 }, (_, k) => photo(`활동 ${i + 1}-${k + 1}`, (i * 40 + k * 15) % 360, k % 2 ? 900 : 1200, k % 2 ? 1400 : 800)) })),
      collabHistory: Array.from({ length: 12 }, (_, i) => ({ partner: `함께한 곳 ${i + 1} · 이름이 긴 가상 브랜드`, types: ["팝업", "워크숍", "공동굿즈"], desc: long("같이 한 일을 길게 적었어요.", 4), year: String(2026 - (i % 4)), photos: i < 3 ? [photo(`콜라보 ${i + 1}`, i * 60)] : [] })),
      photos: Array.from({ length: 10 }, (_, i) => photo(`사진 ${i + 1}`, (i * 31) % 360, i % 3 ? 1200 : 900, i % 3 ? 800 : 1600)),
      keywords: Array.from({ length: 12 }, (_, i) => `아주 긴 키워드 칩 ${i + 1}`),
      showcases: [
        { type: "metrics", photos: [], links: [], items: Array.from({ length: 6 }, (_, i) => ({ label: `긴 지표 이름 ${i + 1}번`, value: `${(i + 1) * 12345}명` })) },
        { type: "reviews", photos: [], links: [], items: Array.from({ length: 6 }, (_, i) => ({ quote: long("정말 긴 후기예요.", 8), source: `손님 ${i + 1}` })) },
      ],
      trust: { homepage: "https://a-very-long-subdomain.for-layout-testing.example.com/path/to/page", instagram: "https://www.instagram.com/a.very.long.instagram.handle.for.layout", address: "서울 마포구 포은로 000-00, 골목 끝 파란 대문 집 1층과 2층 다락, 뒷마당 포함" },
      createdAt: d(-2),
    }),
  );
  const title = "오래된 골목 끝집 부엌에서 여섯 친구가 매주 토요일마다 장터를 연 지 일 년이 지나고 알게 된 것들";
  return {
    ...base,
    makers,
    articles: [{
      id: 9511, slug: "mock-long-market", status: "published",
      title, subtitle: "아주 긴 부제목 · 골목 끝집 부엌 × 주말 장터 친구들 · 일 년 기록",
      editorName: "이름이 아주 긴 객원 에디터와 사진가 두 사람", location: "서울 마포구 망원동 포은로 골목 끝 파란 대문 집",
      coverImage: photo("세로 커버", 280, 900, 1600),
      summary: long("여섯 친구가 일 년 동안 매주 장터를 열었어요.", 6),
      factBox: Array.from({ length: 9 }, (_, i) => ({ label: `긴 항목 이름 ${i + 1}`, value: long("값도 길게 적었어요.", 3) })),
      brandLinks: [
        { slug: "mock-long-kitchen", name: base.makers.find((m) => m.id === 9905)?.name ?? "", tagline: long("한 줄 소개가 아주 길어요.", 4) },
        { slug: "mock-weekend-market", name: base.makers.find((m) => m.id === 9906)?.name ?? "", tagline: "손님 쪽 긴 이름 소개서예요." },
        { slug: "mock-no-such-brand", name: "지워진 소개서를 가리키는 링크", tagline: "소개서가 사라져도 카드는 남아요." },
      ],
      body: {
        type: "doc",
        content: [
          ...Array.from({ length: 8 }, () => para(txt(long(para1, 3)))),
          { type: "image", attrs: { src: photo("세로 사진", 150, 900, 1600), caption: long("사진 설명이 아주 길어요.", 5) } },
          { type: "bulletList", content: Array.from({ length: 10 }, (_, i) => li(`${i + 1}. ${long("긴 목록 한 줄이에요.", 4)}`)) },
        ],
      },
      publishedAt: d(-1), createdAt: d(-3), updatedAt: d(-1),
    }],
    comments: Array.from({ length: 13 }, (_, i) => ({
      id: 100 + i, articleId: 9511, userId: i % 2 ? U.stressGuest : U.stressHost,
      authorName: i % 2 ? (base.profiles.find((p) => p.id === U.stressGuest)?.brandName ?? "") : (base.profiles.find((p) => p.id === U.stressHost)?.brandName ?? ""),
      authorSlug: i % 3 === 0 ? undefined : i % 2 ? "mock-weekend-market" : "mock-long-kitchen",
      body: long("댓글이 아주 길어요. 줄바꿈 없이 이어져요.", 1 + (i % 6) * 3),
      createdAt: d(-1 + Math.floor(i / 5), `${String(8 + i).padStart(2, "0")}:00`),
    })),
    likes: [],
    saved: [{ userId: U.stressHost, makerId: 9906, createdAt: d(-1) }],
    cards: [{
      id: 9611, slug: "mock-long-kitchen-card", fromBrandId: 9905, createdAt: d(-1),
      proposal: { toName: long("받는 곳 이름이 아주 길어요", 3), why: long(para1, 2), picture: long(para1, 2), expectedEffect: long(para1, 2) },
    }],
    dna: [],
    reports: [],
    collabs: [],
    briefs: [{ slug: "mock-long-kitchen", brandName: base.makers.find((m) => m.id === 9905)?.name ?? "", publishedAt: addDaysIso(today, -1), notionUrl: "", markdown: long(BRIEF_SLOW, 3), ownerUserId: U.stressHost }],
  };
}

// ─── 🫙최소 세계 ───

function minimalLayer(base: MockWorld, today: string): SiteWorld {
  const U = MOCK_USER;
  const d = (n: number) => at(today, n);
  return {
    ...base,
    makers: [
      ...base.makers,
      maker({ id: 9912, slug: "mock-minimal-brand", name: "작업실", oneLiner: "", ownerUserId: U.minHost, offers: [], seeks: [], createdAt: d(-1) }),
    ],
    articles: [{
      id: 9521, slug: "mock-minimal-article", status: "published", title: "제목만 있는 글", subtitle: "", editorName: "", location: "",
      coverImage: "", summary: "", factBox: [], brandLinks: [], body: { type: "doc", content: [] },
      publishedAt: d(-1), createdAt: d(-1), updatedAt: d(-1),
    }],
    comments: [], likes: [], saved: [], dna: [], reports: [], collabs: [], briefs: [],
    cards: [{ id: 9621, slug: "mock-minimal-card", fromBrandId: 9912, createdAt: d(-1), proposal: { toName: "", why: "", picture: "", expectedEffect: "" } }],
  };
}

// ─── 요약 리포트 본문 (가상) ───

const BRIEF_SLOW = `느린오후 사장님의 소개서를 정리하며 모아 본 요약 리포트예요. 목 데이터라 숫자는 전부 지어낸 거예요.

| 항목 | 내용 |
|---|---|
| **어떤 사람** | **동네의 오후를 붙잡아 두는 분** |
| **글을 남기신 기간** | 4년 |
| **하는 일** | 로스팅 · 클래스 · 공간 빌려주기 |

---

## 4년 치 글을 숫자로 옮겨 보면

| | 무엇 | 숫자 |
|---|---|---:|
| 1 | 직접 올리신 글 | **212편** |
| 2 | 「동네」가 나온 글 | **64편** |
| 3 | 클래스 공지 | **38번** |

---

## 관찰 하나 · 요즘 글엔 2층 이야기가 많아요

2023년엔 원두 이야기가 대부분이었어요. 올해는 열 편 중 네 편이 2층에 누가 다녀갔는지예요.
`;

const BRIEF_FLOUR = `밀가루 일기 님의 요약 리포트예요. 주인이 아직 연결되지 않아서 링크를 아는 사람이 볼 수 있어요.

## 관찰 하나 · 빵 사진보다 반죽 사진이 많아요

올리신 사진 여든 장 중 쉰 장이 굽기 전 반죽이에요.
`;

/** 📨사이트 메일 미리보기 종류 — `/dev/rent-mail/[kind]`가 하루 가게 메일과 같은 틀로 띄운다. */
export const SITE_MAIL_KINDS: { kind: string; label: string }[] = [
  { kind: "signup-email", label: "새 가입 알림 → 대표 슬랙 · 이메일 가입" },
  { kind: "signup-kakao-noname", label: "새 가입 알림 → 대표 슬랙 · 카카오 로그인, 브랜드명 비움" },
  { kind: "signup-google-long", label: "새 가입 알림 → 대표 슬랙 · 구글 로그인, 긴 브랜드명·이메일" },
];
