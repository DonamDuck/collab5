import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUserId, getProfileById } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { FEE_RATE, listSpacesByOwner } from "@/lib/spaces";
import { SpaceForm } from "./SpaceForm";
import { redirect } from "next/navigation";
import { primaryBtnCls } from "../ui";
import { OG_IMAGE } from "@/lib/site";

// 하루 팝업 — 공간 올리기 (2026-09-13)
//
// ⭐**이 화면이 이 기능의 병목이다.** 조사에서 등록 23곳 중 쉬는 날을 적어 둔 곳이 0곳이었고,
//   돌아오는 사람도 게스트가 아니라 매달 비는 날을 올리러 오는 호스트다(설계 §조사 ②④).
//   그래서 칸을 늘리기보다 **막는 자리**(음식·전대 동의·규칙·비는 날)를 분명히 하는 데 힘을 썼다.
//
// 🎨09-13 재작업 — 한 열 560px, 제목 28 · 한 줄 17, 섹션은 register 규칙(21px 제목 → 첫 입력 23px, 섹션 사이 12).
export const dynamic = "force-dynamic";

const TITLE = "공간 올리기 — 하루 팝업";
const DESCRIPTION = "공간이 비는 시간만 골라 빌려주세요. 규칙은 사장님이 정하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/rent/new" },
  // 🔗링크 미리보기(09-18 밤 QA SC-06) — 사장님께 「여기서 올리시면 돼요」로 보내는 링크라 홈 카드가 뜨면 안 된다.
  //   `openGraph`는 루트 것을 통째로 갈아 끼우므로 사이트 이름·언어·썸네일도 같이 적는다(`/rent` 목록과 같은 이유).
  openGraph: {
    type: "website",
    siteName: "collab5",
    locale: "ko_KR",
    url: "/rent/new",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
};

export default async function NewSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  // 🔀09-17 QA — `/rent/new?slug=…`로 오면 slug를 무시하고 빈 새 폼이 떴다. 고치려던 사장님이
  //   모르고 올리면 «두 번째 공간»이 생긴다. 고치기 화면으로 보낸다(주인 확인은 그쪽이 한다).
  const { slug } = await searchParams;
  if (slug?.trim()) redirect(`/rent/${encodeURIComponent(slug.trim())}/edit`);

  const uid = await getSessionUserId();

  if (!uid) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-4 pb-14 pt-6 sm:px-6">
        <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
          {/* 🔁09-19 대표 코멘트 #65 — 「공간이 노는 날, 빌려주세요」에서 한 번 더(맞춤법: 「빌려 줄」→「빌려줄」, 끝 마침표는 제목이라 뺐다). */}
          공간이 쉬는 날, 필요한 분에게 빌려줄 수 있어요
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          비어 있는 공간, 필요한 분에게 빌려주고 부가 수익도 만들어보세요. 먼저 로그인해 주세요.
        </p>
        {/* ⚠️복귀 키는 `redirect`다 — 로그인 화면이 읽는 이름이 그것이라 `next`로 적으면 홈으로 떨어진다. */}
        <Link href={`/login?redirect=${encodeURIComponent("/rent/new")}`} className={`${primaryBtnCls} mt-8 h-[48px]`}>
          로그인하고 올리기
        </Link>
      </main>
    );
  }

  // 소개서가 있으면 붙일 수 있게(선택). 없어도 올릴 수 있다 —
  // 이 기능은 소개서와 독립이고, 소개서를 요구하면 공급이 등록 업체 열두 곳으로 줄어든다(설계 §대상).
  const myBrands = (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }));

  // 🆕09-16 대표 — **빈 칸에서 시작하지 않게 한다.** 가입할 때 적은 브랜드명으로 공간 이름을,
  //   프로필 전화번호로 매장 전화를 미리 채우고, 소개서가 있으면 첫 번째를 기본으로 연결한다.
  //   ⭐셋 다 폼에서 고칠 수 있다 — 채워 두는 것과 정해 버리는 것은 다르다.
  const me = await getProfileById(uid);
  // 🏠09-18 밤 QA(H-16) — 이미 올린 공간이 있으면 폼 머리에서 알려 준다(모르고 같은 가게를 또 올리는 일을 막는다).
  //   📮H-11 — 이메일이 없는 계정은 요청 알림을 못 받는다. 저장은 막지 않고 한 줄로 알린다.
  const mySpaceCount = (await listSpacesByOwner(uid)).length;

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-4 pb-16 sm:px-6 sm:pt-6">
      <header>
        <Link href="/rent" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 하루 팝업
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
          {/* 🔁09-19 대표 코멘트 #65 — 「공간이 노는 날, 빌려주세요」에서 한 번 더(맞춤법: 「빌려 줄」→「빌려줄」, 끝 마침표는 제목이라 뺐다). */}
          공간이 쉬는 날, 필요한 분에게 빌려줄 수 있어요
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          {/* 🔁09-19 대표 코멘트 #66 */}
          비어 있는 공간, 필요한 분에게 빌려주고 부가 수익도 만들어보세요.
        </p>
      </header>

      {/* 🔻09-19 대표 코멘트 #67·#111 — 「요청이 들어오면 이렇게 해요」는 폼 맨 아래(등록 버튼 바로 위)로 옮겼다.
          제목은 「등록 전 확인해 주세요」, 수수료 한 줄이 붙었다. 그리는 곳은 `SpaceForm`(새로 올리기일 때만). */}
      {/* 수수료율을 서버에서 내려보낸다 — 클라가 숫자를 따로 들고 있으면 요율이 바뀌는 날
          화면만 옛 값을 말한다(그리고 그 어긋남은 아무 에러도 안 낸다). */}
      <SpaceForm
        myBrands={myBrands}
        feeRate={FEE_RATE}
        defaultName={me?.brandName ?? ""}
        defaultPhone={me?.phone ?? ""}
        defaultBrandSlug={myBrands[0]?.slug ?? ""}
        // 💾임시 저장 키에 쓴다(09-17). 계정마다 초안이 따로 남는다.
        userId={uid}
        noEmail={!me?.email?.trim()}
        mySpaceCount={mySpaceCount}
      />
    </main>
  );
}
