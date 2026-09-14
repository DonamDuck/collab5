import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpacePublic } from "@/lib/spaces";
import { getSessionUserId } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { PhotoSlider } from "@/components/PhotoSlider";
import { BookingForm } from "./BookingForm";
import { Chip, dateLabel, primaryBtnCls, usageLabel, won } from "../ui";
import { AreaMap } from "./AreaMap";

// 하루 가게 — 공간 한 곳 + 신청 (2026-09-13)
//
// 🚨🚨**이 파일은 `getSpaceFull`을 부르지 않는다.** 부르면 주소가 서버 렌더 HTML에 실려 나가고,
//   확정 전에 가게가 특정되면 플랫폼을 건너뛴 직거래가 일어난다(설계 §이탈 — 대표 09-13:
//   *「사장님과 연결을 미리 해버리면 우리 결제 없이 그들끼리 거래로 해버릴 수도」*).
//   `getSpacePublic`은 타입만 좁히는 게 아니라 **런타임 객체에서 주소·좌표를 실제로 지운다.**
//   같은 이유로 연결된 소개서도 **이름만** 보여주고 `/m/{slug}` 링크는 걸지 않는다 —
//   소개서에는 인스타·연락처가 적혀 있어서 링크 하나로 구멍이 그대로 다시 뚫린다.
//
// 🎨09-13 재작업 — 소개서(`/m`)와 같은 옷. 위에 흰 카드 하나(이름 22 · 한 줄 17 · 동네 15 · 칩),
//   그 아래는 카드 밖 지면에 21px 섹션 제목 + 17px 본문(`MakerArticle`의 Section과 같은 자리).
//   ⛔「공간 정보」 키-값 회색 표를 뺐다 — 표는 행정 서류의 얼굴이고, 그 안의 값(인원·시간)은
//     상단 카드 메타 한 줄로, 값은 「값」 섹션으로 옮기니 표가 할 일이 없었다.
//   ⛔「우리 집 규칙」 민트 상자도 뺐다 — 상자는 고르는 것에만 쓴다(§카드 어휘). 규칙은 읽는 것이라
//     한 줄씩 구분선으로 세우고, 글자색을 ink로 올려 본문(body)보다 한 단 진하게 했다.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await getSpacePublic(slug);
  if (!sp) return { title: "공간을 찾을 수 없어요 — collab5" };
  return {
    title: `${sp.name} — 하루 가게`,
    // ⚠️설명에도 동네까지만 적는다. 링크 미리보기 카드는 로그인도 결제도 없이 퍼진다 —
    //   화면에서 가린 주소를 og 설명으로 흘리면 가린 의미가 없다.
    description: sp.tagline || `${sp.area}의 공간을 하루 빌려보세요.`,
    alternates: { canonical: `/rent/${sp.slug}` },
  };
}

/** 소개서 본문 섹션과 같은 얼굴 — 상단 구분선 + 21px 제목 + 내용. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-hairline pt-8">
      <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sp = await getSpacePublic(slug);
  if (!sp) notFound();

  const uid = await getSessionUserId();
  const isOwner = !!uid && uid === sp.ownerUserId;
  // 검토 중·쉬는 중인 공간은 주인에게만 보인다. 남에게 404인 이유 —
  // 「있지만 못 본다」와 「없다」를 구분해 주면, 주소를 훑어 아직 안 열린 공간 목록을 만들 수 있다.
  if (sp.status !== "open" && !isOwner) notFound();

  // 연결된 소개서는 **이름 글자만** 꺼내 온다. Maker 객체를 클라이언트로 넘기면 연락처가 같이 건너간다.
  const brandName = sp.brandSlug ? (await repo.getMakerBySlug(sp.brandSlug))?.name ?? "" : "";

  // 신청자가 자기 소개서를 붙일 수 있게 목록을 준다(선택). 없어도 신청은 된다 —
  // 이 기능은 소개서와 독립이라, 소개서를 요구하면 설계 전제가 깨진다(설계 §한 줄).
  const myBrands =
    uid && !isOwner
      ? (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }))
      : [];

  const openDates = [...sp.openDates].sort();
  // 규칙은 한 줄에 하나씩 적게 했다(`/rent/new`). 그 줄을 그대로 살려 한 줄씩 세운다.
  const ruleLines = sp.rules.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  // 상단 카드 메타 — 동네 · 인원 · 시간. 표에 있던 값이 여기로 왔다.
  const meta = [sp.area || "동네 미정", sp.capacity ? `최대 ${sp.capacity}명` : "", sp.hours]
    .filter(Boolean)
    .join(" · ");
  // 신청 폼이 뜨는 조건 — 모바일 하단 고정 바가 본문을 가리지 않게 이때만 바닥 여백을 더 준다.
  const showForm = !isOwner && !!uid && openDates.length > 0;

  return (
    <main
      className={`mx-auto w-full max-w-[720px] px-4 pt-8 sm:px-6 sm:pt-12 sm:pb-16 ${
        showForm ? "pb-[120px]" : "pb-12"
      }`}
    >
      {/* 🔻09-14 「← 하루 가게」 삭제 — 대표: *「앱이 아닌 경우 다들 모바일 기기의 뒤로 가기 버튼을
          잘 쓸 거 같은데, 일단 뒤로 가기 버튼은 지워도 될 거 같아」*.
          ⭐브라우저가 이미 하는 일을 화면이 또 하지 않는다. 상단 메뉴바로도 목록에 닿는다. */}
      {/* ── 상단 카드 — 소개서 `BrandSummaryCard`와 같은 자리·같은 사다리 ── */}
      <header className="mt-3 rounded-lg border border-hairline bg-surface p-5">
        <h1 className="text-[22px] font-bold leading-tight tracking-tight break-keep text-ink">
          {sp.name}
        </h1>
        {sp.tagline && (
          <p className="mt-3 text-[17px] leading-relaxed break-keep text-body">{sp.tagline}</p>
        )}
        {/* 🚨동네까지만. 상세 주소는 예약이 확정된 뒤 `/rent/my`에서 열린다. */}
        <p className="mt-1.5 text-[15px] text-mute">{meta}</p>
        {/* 🔁09-14 여기 있던 금액 줄을 **아래 「비용」 절로 내렸다**(대표: *「이거 금액 별도 하단으로
            금액을 빼자」*, 아워플레이스 참고). 카드는 «무엇인지»를 말하고 값은 «비용» 절이 맡는다. */}
        {/* 칩 줄 — 쓰임새 하나 + 설비 몇 개, 전부 같은 pill. 설비 전체는 아래 섹션에서 본다. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>{usageLabel(sp.useType)}</Chip>
          {sp.facilities.slice(0, 4).map((f) => (
            <Chip key={f}>{f}</Chip>
          ))}
        </div>
        {brandName && (
          // ⛔링크 금지(위 파일 머리말). 「이 사장님이 누구인지」의 신뢰만 주고 연락처는 안 준다.
          <p className="mt-4 text-[15px] text-faint">소개서를 가진 브랜드예요 · {brandName}</p>
        )}
        {isOwner && sp.status !== "open" && (
          // 노란 안내 상자 대신 한 줄. 주인만 보는 말이라 조용해도 된다.
          <p className="mt-4 text-[15px] leading-relaxed break-keep text-mute">
            아직 공개 전이라 사장님에게만 보이는 화면이에요. 저희가 확인하고 열어 드릴게요.
          </p>
        )}
      </header>

      {sp.photos.length > 0 && (
        <div className="mt-7 max-w-[460px]">
          <PhotoSlider photos={sp.photos} />
        </div>
      )}

      {sp.body && (
        <Section title="공간 소개">
          <p className="whitespace-pre-line text-[17px] leading-relaxed break-keep text-body">
            {sp.body}
          </p>
        </Section>
      )}

      {/* ⭐⭐「사용 유의 사항」이 이 화면에서 제일 눈에 띄어야 한다(설계 §공간 카드).
          열쇠를 넘기는 두려움이 실제로 풀리는 자리다. 면색 대신 **한 줄씩 세운 구분선**과 ink 글자로
          무게를 준다 — 줄로 세우면 세 줄이 세 가지 약속으로 읽히고, 문단이면 한 덩어리로 넘어간다. */}
      <Section title="사용 유의 사항">
        {/* 🔁09-14 구분선 → **번호**(대표: *「여기 라인을 빼주고, 불렛이나 1, 2, 3 식으로 하는 거 어떨까.
            규칙이니 마크다운 형태로 보여도 이쁠 거 같음」*).
            ⭐선은 「여기까지가 한 덩어리」만 말하고, 번호는 **몇 개인지와 몇 번째인지**를 같이 말한다.
              약속은 세어지는 편이 낫다 — 「셋 중 둘째」가 「가운데 줄」보다 분명하다. */}
        <ol className="space-y-2.5">
          {ruleLines.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[17px] leading-relaxed break-keep text-ink">
              {/* 번호는 본문보다 한 단 물러난 색·크기 — 세는 표지지 내용이 아니다.
                  `tabular-nums`로 폭을 고정해 두 자리가 와도 글줄 시작점이 안 흔들린다. */}
              <span className="shrink-0 pt-[3px] text-[15px] font-medium tabular-nums text-mute">{i + 1}.</span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* 🔁09-14 「이런 것들이 있어요」 → **「공간·시설 안내」**(대표 지시).
          ⭐그리고 **태그와 줄글을 같이 싣는다** — 대표: *「여기는 태그도 좋은데, 줄글도 쓸 수 있는
            구조로 짜야 할 거 같아」*. 태그는 훑어서 고르는 것이고, 줄글은 「HDMI 케이블은 없어요」처럼
            태그로 못 담는 단서다. 둘 중 하나만 있어도 그 절은 뜬다. */}
      {(sp.facilities.length > 0 || sp.facilitiesNote) && (
        <Section title="공간·시설 안내">
          {sp.facilities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sp.facilities.map((f) => (
                <Chip key={f}>{f}</Chip>
              ))}
            </div>
          )}
          {sp.facilitiesNote && (
            <p className={`whitespace-pre-line text-[17px] leading-relaxed break-keep text-body ${sp.facilities.length > 0 ? "mt-4" : ""}`}>
              {sp.facilitiesNote}
            </p>
          )}
        </Section>
      )}

      {/* 📍09-14 신설 — 대표 지시(아워플레이스 참고). 좌표는 사장님이 주소를 넣을 때 한 번 재서
          `spaces.lat/lng`에 굳혀 둔다(`lib/geocode.ts`). 좌표가 없으면 이 절은 통째로 안 뜬다. */}
      {sp.areaLat != null && sp.areaLng != null && (
        <Section title="위치">
          <AreaMap lat={sp.areaLat} lng={sp.areaLng} area={sp.area} />
        </Section>
      )}

      <Section title="빌릴 수 있는 날">
        {openDates.length === 0 ? (
          <p className="text-[17px] leading-relaxed text-body">
            지금은 비는 날이 없어요. 곧 새 날짜가 올라올 거예요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {openDates.map((d) => (
              <Chip key={d}>{dateLabel(d)}</Chip>
            ))}
          </div>
        )}
      </Section>

      {/* 📚09-14 신설 — 대표: *「이거 체크박스 빼고 여기 정보 영역으로 하고 (선택 사항)으로.
          「사장님께 잠깐 배워 볼 수 있어요」로 정규 타이틀로 섹션으로 다루자」*.
          ⭐설명하는 자리와 고르는 자리를 갈랐다. 고르는 일은 결제 단계의 옵션이 맡는다. */}
      {sp.mentorMinutes > 0 && (
        <Section title="사장님께 잠깐 배워 볼 수 있어요">
          <p className="text-[17px] leading-relaxed break-keep text-body">
            문 열기 전 {sp.mentorMinutes}분 동안 이 일을 어떻게 하는지 들을 수 있어요. 손님은 언제 오는지,
            재료는 어디서 떼는지 같은 것들이요.
          </p>
          <p className="mt-3 text-[15px] text-mute">
            <span className="font-medium text-ink">+{won(sp.mentorPrice)}</span> · 신청하실 때 고르시면 돼요
            <span className="ml-1 text-faint">(선택 사항)</span>
          </p>
        </Section>
      )}

      <Section title="비용">
        <p className="text-[17px] text-ink">하루 {won(sp.priceDay)}</p>
        {sp.mentorMinutes > 0 && (
          <p className="mt-1.5 text-[16px] text-mute">
            사장님이 {sp.mentorMinutes}분 알려주는 시간은 {won(sp.mentorPrice)}, 원하시면 같이 담으세요.
          </p>
        )}
      </Section>

      {/* ── 신청 ── */}
      <Section title="신청하기">
        {isOwner ? (
          <p className="text-[17px] leading-relaxed break-keep text-body">
            사장님 공간이라 신청은 못 하세요. 받은 신청은{" "}
            <Link href="/rent/my" className="underline underline-offset-4">
              내 하루 가게
            </Link>
            에서 보실 수 있어요.
          </p>
        ) : !uid ? (
          <div>
            <p className="text-[17px] leading-relaxed break-keep text-body">
              신청하시려면 먼저 로그인해 주세요.
            </p>
            {/* ⚠️복귀 파라미터 이름은 `redirect`다 — 로그인 화면이 읽는 키가 그것이고,
                `next`로 적으면 로그인 뒤 홈으로 떨어진다(화면은 멀쩡해서 아무도 못 알아챈다). */}
            <Link
              href={`/login?redirect=${encodeURIComponent(`/rent/${sp.slug}`)}`}
              className={`${primaryBtnCls} mt-5 h-[48px]`}
            >
              로그인하고 신청하기
            </Link>
          </div>
        ) : openDates.length === 0 ? (
          <p className="text-[17px] leading-relaxed break-keep text-body">
            지금은 비는 날이 없어요. 사장님이 새 날짜를 올리면 신청하실 수 있어요.
          </p>
        ) : (
          <BookingForm
            spaceId={sp.id}
            spaceSlug={sp.slug}
            spaceName={sp.name}
            openDates={openDates}
            priceDay={sp.priceDay}
            mentorMinutes={sp.mentorMinutes}
            mentorPrice={sp.mentorPrice}
            capacity={sp.capacity}
            hours={sp.hours}
            useType={sp.useType}
            myBrands={myBrands}
          />
        )}
      </Section>
    </main>
  );
}
