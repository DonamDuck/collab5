import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileById, getSessionUserId } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { FEE_RATE, getSpaceFull } from "@/lib/spaces";
import { bizMissingLine, bizOnFile } from "@/lib/bizcheck";
import { needsFix } from "@/lib/rent-review";
import { SpaceForm } from "../../new/SpaceForm";

// 하루 가게 — 공간 고치기 (2026-09-14)
//
// 🚨`getSpaceFull`을 부른다 — 주소·「들어오는 법」이 폼에 실려야 하니까. 그래서 **주인 확인이 먼저**다.
//   주인이 아니면 그 공간의 공개 화면으로 돌려보낸다. 404가 아닌 이유 — 공간은 실재하고 그 사람도
//   볼 수 있는 화면이 있다. 없는 척하면 오히려 「주소를 잘못 쳤나」로 헤맨다.
//   저장은 새로 올리기와 같은 `saveSpaceAction`이고, 서버가 소유자를 «다시» 읽어 확인한다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공간 고치기 — 하루 가게",
  robots: { index: false },
};

export default async function EditSpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const uid = await getSessionUserId();
  // ⚠️복귀 키는 `redirect`다 — 로그인 화면이 읽는 이름이 그것이라 `next`로 적으면 홈으로 떨어진다.
  if (!uid) redirect(`/login?redirect=${encodeURIComponent(`/rent/${slug}/edit`)}`);

  const sp = await getSpaceFull(slug);
  if (!sp || sp.ownerUserId !== uid) redirect(`/rent/${slug}`);

  const myBrands = (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }));
  // 📮09-18 밤 QA(H-11) — 이메일이 없는 계정은 요청 알림을 못 받는다. 고치기 화면에서도 같은 한 줄을 띄운다.
  const me = await getProfileById(uid);
  // 🚪09-19 오후 대표 — 사업자등록번호가 빈 공간은 공개 중이어도 손님 앞에 안 선다(`spaceListed`).
  //   그땐 「공간은 그대로 보여요」가 거짓이라, 머리 한 줄을 할 일로 바꾸고 사업자 칸으로 가는 길을 붙인다.
  const missingBiz = sp.status !== "draft" && !bizOnFile(sp);

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent/my?tab=host" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 내 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
          공간 고치기
        </h1>
        {/* 🔁09-16 문안 교체 — 그 전엔 *「고친 내용은 한 번 더 읽어보고 다시 공개해 드려요.
            그동안 공간은 잠시 안 보여요」*였는데, 같은 날 **고쳐도 공개가 유지되게** 바뀌었다
            (`saveSpaceAction`: 이름·주소가 바뀔 때만 검토로 내려간다).
            🩸그래서 이 줄은 사장님께 «일어나지 않을 일»을 예고하고 있었다. 값 하나 고치려다
            목록에서 사라진다고 읽히면 아예 안 고친다. */}
        {/* 🔁09-17 QA — 검토 대기 공간에도 「공간은 그대로 보여요」라고 했다. 아직 아무에게도 안 보이는데.
            상태로 가른다. 이름·주소를 바꾸면 검토로 간다는 말은 버튼 아래 한 곳에만 둔다(위아래 같은 말이 두 번이었다). */}
        {/* 🔁09-19 저녁 대표 — 보완 요청을 받은 공간은 사유 박스가 맨 위에 선다(관리자가 적은 글 그대로). 고쳐 저장하면 다시 검토로 간다. */}
        {needsFix(sp) && (
          <div className="mt-4 rounded-md bg-lemon-pale px-4 py-3 text-[16px] leading-relaxed break-keep">
            <p className="font-medium text-lemon-on">한 번 더 확인해 주세요</p>
            <p className="mt-1 whitespace-pre-line text-body">{sp.reviewNote}</p>
            <p className="mt-2 text-[15px] text-mute">
              고치신 뒤 맨 아래 「고쳐서 다시 보내기」를 눌러 주시면 이어서 볼게요. 그동안 공간은 목록에 보이지 않아요.
            </p>
          </div>
        )}
        {needsFix(sp) ? null : missingBiz ? (
          <p className="mt-3 rounded-md bg-lemon-pale px-4 py-3 text-[16px] leading-relaxed break-keep text-lemon-on">
            {bizMissingLine(sp.status)}{" "}
            {/* 같은 화면 아래 「사업자 정보」 절(`f-biz`)로. 누를 자리를 44px로(내 하루 가게 줄과 같은 모양). */}
            <a href="#f-biz" className="-my-[13px] inline-block py-[13px] underline underline-offset-2">
              고치러 가기
            </a>
          </p>
        ) : (
          <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
            {sp.status === "open"
              ? "고치시는 동안에도 공간은 그대로 보여요."
              : sp.status === "pending"
                ? "아직 저희가 읽어 보는 중인 공간이에요. 고치셔도 검토는 이어서 해요."
                : "고친 내용은 저장해 두고, 공간을 다시 열 때 그대로 보여요."}
          </p>
        )}
      </header>

      <SpaceForm myBrands={myBrands} feeRate={FEE_RATE} initial={sp} noEmail={!me?.email?.trim()} />
    </main>
  );
}
