import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpacePublic, listLiveBookingsIn } from "@/lib/spaces";
import { getProfileById, getSessionUserId } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { accessHowLine, COFFEE_CHAT_WHEN_GUEST, CONTACT_RULE_GUEST } from "@/lib/rent-copy";
import { futureSlots } from "@/lib/rent-time";
import { PhotoSlider } from "@/components/PhotoSlider";
import { BookingForm } from "./BookingForm";
import { categoryLabel, Chip, dateLabel, InfoList, InfoRow, primaryBtnCls, scopeLabel, secondaryBtnCls, won } from "../ui";
import { AreaMap } from "./AreaMap";

// 하루 가게 — 공간 한 곳 + 신청 (2026-09-13)
//
// 🔁**09-13엔 주소도 소개서 링크도 가렸다.** 확정 전에 가게가 특정되면 결제 없이 직거래로 샐까 봐였다
//   (대표 09-13: *「사장님과 연결을 미리 해버리면 우리 결제 없이 그들끼리 거래로 해버릴 수도」*).
//   ✅09-16 대표 — 정확한 주소·핀을 연다(이름과 사진이 이미 가게를 특정하고, 전자상거래법 제20조②도
//     호스트 주소·전화를 청약 전에 보이라고 한다. `AreaMap` 머리말).
//   ✅09-17 대표 — 사장님이 「내 소개서 보여주기」를 켠 공간이면 소개서 링크도 연다(`/m/{slug}?back=…`).
//   📌이탈을 막는 건 이제 가리기가 아니라 **결제가 먼저라는 순서**다(`BookingForm` 머리말).
// 🚨그래도 `getSpaceFull`은 부르지 않는다. `getSpacePublic`이 「들어오는 법」(옛 `accessNote`)을 런타임에서 지운다.
//
// 🎨09-13 재작업 — 소개서(`/m`)와 같은 옷. 위에 흰 카드 하나(이름 22 · 한 줄 17 · 동네 15 · 칩),
//   그 아래는 카드 밖 지면에 21px 섹션 제목 + 17px 본문(`MakerArticle`의 Section과 같은 자리).
//   ⛔「공간 정보」 키-값 회색 표를 뺐다 — 표는 행정 서류의 얼굴이고, 그 안의 값(인원·시간)은
//     상단 카드 메타 한 줄로, 값은 「값」 섹션으로 옮기니 표가 할 일이 없었다.
//   ⛔「우리 집 규칙」 민트 상자도 뺐다 — 상자는 고르는 것에만 쓴다(§카드 어휘). 규칙은 읽는 것이라
//     한 줄씩 구분선으로 세우고, 글자색을 ink로 올려 본문(body)보다 한 단 진하게 했다.
export const dynamic = "force-dynamic";

/** 신청 폼이 없는 화면에서 「빌릴 수 있는 날」에 까는 칩 수. 둘씩 세 줄(폰)을 넘기지 않는 값. */
const SLOT_PREVIEW = 6;

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
    // 링크 미리보기 설명은 한 줄 소개 또는 동네까지. 주소는 화면에서 열려 있지만(09-16) 카드엔 길 필요가 없다.
    // ⏱09-16 대표 — 시간 단위 대여. 「하루 빌려보세요」는 사실이 틀린 말이라 링크 카드에도 안 싣는다.
    description: sp.tagline || `${sp.area}에서 필요한 시간만큼 빌릴 수 있는 공간이에요.`,
    alternates: { canonical: `/rent/${sp.slug}` },
  };
}

/** 💸값 한 줄 — 굵은 시간당 값 + 「최소 N시간」·「최대 N명」 태그. 폰 헤더와 데스크톱 요약 카드가 같은 얼굴이다(09-18 대표).
 *  태그는 읽고 지나가는 것이라 설비 칩(`Chip`)보다 한 단 작은 회색 pill로 둔다. 값 옆에 같은 크기 칩이 서면 값이 묻힌다. */
function PriceLine({ priceHour, minHours, capacity }: { priceHour: number; minHours: number; capacity?: number }) {
  const tags = [`최소 ${minHours}시간`, capacity ? `최대 ${capacity}명` : ""].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <p className="text-ink">
        <span className="text-[24px] font-bold leading-none tracking-tight tabular-nums">{won(priceHour)}</span>
        <span className="ml-1 text-[15px] text-mute">/ 시간</span>
      </p>
      <span className="flex gap-1.5">
        {tags.map((t) => (
          <span key={t} className="rounded-pill bg-surface-soft px-2.5 py-1 text-[13px] leading-none text-body">
            {t}
          </span>
        ))}
      </span>
    </div>
  );
}

/** 소개서 본문 섹션과 같은 얼굴 — 상단 구분선 + 21px 제목 + 내용. */
function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-9 scroll-mt-20 border-t border-hairline pt-8">
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

  // 연결된 소개서는 **이름 글자만** 꺼내 온다. 링크는 slug로 건다 — Maker 객체를 통째로 넘길 이유가 없다.
  // 상호(운영하는 브랜드 이름). 사장님 실명(profiles에 따로 없다)은 안 읽는다.
  const operatorName = (await getProfileById(sp.ownerUserId))?.brandName?.trim() ?? "";
  const brandName = sp.brandSlug ? (await repo.getMakerBySlug(sp.brandSlug))?.name ?? "" : "";
  const brandHref = `/m/${encodeURIComponent(sp.brandSlug ?? "")}?back=${encodeURIComponent(`/rent/${sp.slug}`)}`;

  // 신청자가 자기 소개서를 붙일 수 있게 목록을 준다(선택). 없어도 신청은 된다 —
  // 이 기능은 소개서와 독립이라, 소개서를 요구하면 설계 전제가 깨진다(설계 §한 줄).
  const myBrands =
    uid && !isOwner
      ? (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }))
      : [];
  // ☎️09-17 — 신청 폼의 번호 칸을 프로필 번호로 미리 채운다. 로그인한 손님일 때만 읽는다.
  const myPhone = uid && !isOwner ? ((await getProfileById(uid))?.phone?.trim() ?? "") : "";

  // 🔁09-16 하루 단위 → 시간 단위. 날짜는 시간대 목록에서 뽑고, 그 날 이미 팔린 시간도 같이 읽는다.
  // ⏳지난 시간대는 여기서 걸러 낸다. 사장님이 열어 둔 날이 지나가도 목록에는 그대로 남아 있어서,
  //   안 거르면 달력에 지난주가 「빌릴 수 있는 날」로 서 있고 결제까지 통과한다.
  const openSlots = futureSlots(sp.openSlots).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const openDates = Array.from(new Set(openSlots.map((sl) => sl.date))).sort();
  // ⚠️예약을 날짜마다 따로 부르면 열어 둔 날 수만큼 왕복이 는다. 한 번에 읽어 날짜별로 나눈다.
  const liveBookings = openDates.length > 0 ? await listLiveBookingsIn(sp.id, openDates) : [];
  const takenByDate: Record<string, { start: string; end: string }[]> = {};
  for (const b of liveBookings) {
    (takenByDate[b.useDate] ??= []).push({ start: b.startTime, end: b.endTime });
  }
  // 규칙은 한 줄에 하나씩 적게 했다(`/rent/new`). 그 줄을 그대로 살려 한 줄씩 세운다.
  const ruleLines = sp.rules.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  // 신청 폼이 뜨는 조건 — 모바일 하단 고정 바가 본문을 가리지 않게 이때만 바닥 여백을 더 준다.
  const showForm = !isOwner && !!uid && openDates.length > 0;

  // 🧭09-17 디자인팀 — 데스크톱 오른쪽 기둥에 싣는 «가장 가까운 열린 시간».
  const nextSlot = openSlots[0];
  const eyebrow = [categoryLabel(sp.category), sp.area].filter(Boolean).join(" · ");

  return (
    <main
      className={`mx-auto w-full max-w-[720px] px-4 sm:px-6 sm:pt-10 lg:max-w-[1120px] sm:pb-16 ${
        sp.photos.length > 0 ? "pt-0" : "pt-8"
      } ${showForm ? "pb-[120px]" : "pb-12"}`}
    >
      {/* 🎨09-17 디자인팀 재구성 (3팀 요청 · 아워플레이스·에어비앤비 참고)
          ① **사진이 먼저다.** 전엔 제목 카드 → 폭 460 사진이라 1440 화면에서 사진이 왼쪽 구석에 작게 붙고
             오른쪽이 비었다. 공간을 빌리는 사람이 제일 먼저 확인하는 건 «어떻게 생겼나»다.
             폰에선 화면 끝까지 붙여(`-mx-4`) 첫 화면의 절반을 사진이 맡는다.
          ② 제목 카드의 테두리를 걷었다. 사진 바로 아래 테두리 상자가 또 서면 덩어리가 둘로 읽힌다.
          ③ lg부터 **두 기둥**. 왼쪽은 읽는 것, 오른쪽은 «얼마 · 언제 · 누구» 요약이 따라 내려온다.
             ⛔오른쪽에 키위 버튼을 두지 않는다 — 결제 버튼은 하단 고정 바 하나뿐이다(09-14 대표). */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-14">
        <div className="min-w-0">
          {sp.photos.length > 0 && (
            <div className="-mx-4 sm:mx-0">
              <PhotoSlider photos={sp.photos} rounded="rounded-none sm:rounded-lg" />
            </div>
          )}

          {/* 🔻09-14 「← 하루 가게」 삭제 — 대표: *「앱이 아닌 경우 다들 모바일 기기의 뒤로 가기 버튼을
              잘 쓸 거 같은데, 일단 뒤로 가기 버튼은 지워도 될 거 같아」*. */}
          <header className={sp.photos.length > 0 ? "mt-5 sm:mt-7" : ""}>
            {eyebrow && <p className="text-[15px] text-mute">{eyebrow}</p>}
            <h1 className="mt-1.5 text-[24px] font-bold leading-tight tracking-tight break-keep text-ink sm:text-[28px]">
              {sp.name}
            </h1>
            {sp.tagline && (
              <p className="mt-3 text-[17px] leading-relaxed break-keep text-body">{sp.tagline}</p>
            )}
            {/* 💸09-18 대표 — *「금액은 이쁘게 넣어볼 수 있으면 넣는 방향으로」*. 09-14엔 금액 줄을 「비용」 절로 내렸는데,
                그땐 흐린 메타 줄 끝의 글자였다. 이제 제목 아래 굵은 값 + 최소 시간·인원 태그로 세운다(아워플레이스 상세).
                lg에선 오른쪽 요약 카드가 같은 줄을 들어서 여기선 숨긴다. 세부(커피챗 값 등)는 아래 「비용」 절이 맡는다. */}
            <div className="mt-4 lg:hidden">
              <PriceLine priceHour={sp.priceHour} minHours={sp.minHours} capacity={sp.capacity} />
            </div>
            {/* 칩 줄 — 쓰임새 하나 + 설비 몇 개, 전부 같은 pill. 설비 전체는 아래 섹션에서 본다. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>{scopeLabel(sp.scope)}</Chip>
              {sp.facilities.slice(0, 4).map((f) => (
                <Chip key={f}>{f}</Chip>
              ))}
            </div>
            {brandName && sp.brandSlug && (
              // 📎09-17 대표 — 소개서 링크를 연다. `back`을 달아 소개서 화면에서 이 공간으로 돌아올 수 있게 한다.
              <p className="mt-4 text-[15px] text-mute lg:hidden">
                사장님 소개서 ·{" "}
                <Link href={brandHref} className="text-body underline underline-offset-2">
                  {brandName}
                </Link>
              </p>
            )}
            {isOwner && sp.status !== "open" && (
              // ⏸09-17 잠시 쉬기 — 쉬는 공간에 「저희가 확인하고 열어 드릴게요」가 뜨면 검토에 걸린 줄 안다.
              <p className="mt-4 text-[15px] leading-relaxed break-keep text-mute">
                {sp.status === "paused"
                  ? "쉬는 중이라 손님에겐 안 보여요. 내 하루 가게에서 다시 열 수 있어요."
                  : "아직 공개 전이라 사장님에게만 보이는 화면이에요. 저희가 확인하고 열어 드릴게요."}
              </p>
            )}
          </header>

          {sp.body && (
            <Section title="공간 소개">
              <p className="whitespace-pre-line text-[17px] leading-relaxed break-keep text-body">
                {sp.body}
              </p>
            </Section>
          )}


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
              `spaces.lat/lng`에 굳혀 둔다(`lib/geocode.ts`). 좌표가 없으면 주소만 적는다.
              🔁09-16 — 정확한 핀·정확한 주소로(위 `AreaMap` 머리말). */}
          <Section title="위치">
            {sp.lat != null && sp.lng != null ? (
              <AreaMap lat={sp.lat} lng={sp.lng} address={sp.address} />
            ) : (
              <p className="text-[17px] leading-relaxed break-keep text-body">{sp.address}</p>
            )}
            {/* ☎️**신청 «전»에 보여야 하는 값이다** (2026-09-16).
                전자상거래법 제20조②는 중개자가 호스트의 상호·주소·전화번호를 확인해 청약 전에 소비자에게
                제공하라고 한다. 안 하면 제20조의2②로 호스트 과실 손해에 회사가 연대 책임을 진다.
                우리 호스트 약관 제6조도 「신청하기 전에 공간 상세 화면에 표시한다」고 약속했고,
                등록 폼도 사장님께 *「법에 따라 신청 전에 손님께 보여드려요」*라고 적어 두었다.
                🩸그런데 09-16까지 이 화면 어디에도 그 번호가 없었다. 폼은 받고 있었는데 꺼내는 곳이 없었다.
                ⭐**개인 휴대폰은 여전히 확정 뒤에만 열린다**(`ContactBlock`). 여기 나가는 건 가게 번호다. */}
            {/* 🏷상호 — 가입할 때 받는 «브랜드 이름»이다(08-15 「상호」 → 「브랜드 이름」). 09-16 대표: 상호는 보이고
                사장님 실명은 안 보인다. 공간 이름은 사장님이 「을지로 2층 작업실」처럼 바꿀 수 있어서,
                그것만으론 상호가 안 남는다 — 법이 청약 전에 보이라고 한 값이라 따로 한 줄 둔다. */}
            {operatorName && (
              <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
                운영 <span className="text-body">{operatorName}</span>
              </p>
            )}
            {sp.contactPhone.trim() && (
              <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
                가게 전화{" "}
                <a
                  href={`tel:${sp.contactPhone.replace(/[^0-9+]/g, "")}`}
                  className="text-body underline underline-offset-2"
                >
                  {sp.contactPhone}
                </a>
              </p>
            )}
          </Section>

          {/* 🔻09-17 디자인팀 — 신청 폼이 뜨는 화면에선 이 절을 뺀다. 바로 아래 달력이 같은 날을 격자로 보여 주는데,
              여기서 열린 시간 30개를 칩으로 다 깔면 폰에서 한 화면 반이 칩 벽이 됐다(모든 칸이 찬 공간 기준).
              폼이 없는 화면(로그인 전·사장님 본인)에선 가까운 여섯 개만 보이고 나머지는 개수로 말한다. */}
          {!showForm && (
            <Section title="빌릴 수 있는 날">
              {openDates.length === 0 ? (
                <p className="text-[17px] leading-relaxed text-body">
                  지금은 열린 시간이 없어요. 곧 새 날짜가 올라올 거예요.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {openSlots.slice(0, SLOT_PREVIEW).map((sl) => (
                      <Chip key={`${sl.date}-${sl.start}`}>{`${dateLabel(sl.date)} ${sl.start}~${sl.end}`}</Chip>
                    ))}
                  </div>
                  {openSlots.length > SLOT_PREVIEW && (
                    <p className="mt-3 text-[15px] text-mute">그 뒤로도 {openSlots.length - SLOT_PREVIEW}번 더 열려 있어요.</p>
                  )}
                </>
              )}
            </Section>
          )}

          {/* 📚09-14 신설 — 대표: *「이거 체크박스 빼고 여기 정보 영역으로 하고 (선택 사항)으로.
              「사장님께 잠깐 배워 볼 수 있어요」로 정규 타이틀로 섹션으로 다루자」*.
              ⭐설명하는 자리와 고르는 자리를 갈랐다. 고르는 일은 결제 단계의 옵션이 맡는다. */}
          {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
            <Section title="사장님과 커피챗">
              {/* ☕09-16 대표 — 「사장님께 잠깐 배워보기」를 커피챗으로 다시 잡았다. 파는 것은 «현업 이야기»다.
                  🔁09-17 — 「언제」는 `COFFEE_CHAT_WHEN_GUEST` 한 줄만 쓴다(대표: 시간은 사장님이 정한다).
                    전엔 「사장님과 협의한 날짜에」라 메일의 「그날」과 말이 갈렸다.
                  🔻09-17 QA — 주제가 비었을 때 넣던 기본 예시(「재료는 어디서 떼는지…」)를 뺐다. 요가원·공방에도
                    같은 문장이 붙어 업종과 안 맞았고, 공간 셋을 이어 보면 같은 틀로 읽혔다. 비면 짧게 둔다. */}
              <p className="text-[17px] leading-relaxed break-keep text-body">
                {sp.coffeeChatMinutes}분 동안 사장님께 현업 이야기를 들을 수 있어요. {COFFEE_CHAT_WHEN_GUEST}
              </p>
              {/* ☕09-18 대표 코멘트 — 「사장님이 설정한 커피챗에서 제공할 수 있는 내용들이 여기 들어가야」.
                  사장님이 적은 주제를 줄마다 한 점으로 세운다. 한 문단이면 무엇을 들을 수 있는지가 안 세어진다. */}
              {sp.coffeeChatTopics.trim() && (
                <div className="mt-4">
                  <p className="text-[15px] font-medium text-body">이런 이야기를 나눌 수 있어요</p>
                  <ul className="mt-2 space-y-1.5">
                    {sp.coffeeChatTopics
                      .split("\n")
                      .map((l) => l.replace(/^[\s\-•·*]+/, "").trim())
                      .filter(Boolean)
                      .map((l, i) => (
                        <li key={i} className="flex gap-2 text-[16px] leading-relaxed break-keep text-body">
                          <span aria-hidden="true" className="text-mute">·</span>
                          <span className="min-w-0 flex-1">{l}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {/* ✍️「고르시면 돼요」와 「(선택 사항)」이 같은 말 두 번이라 하나로. */}
              <p className="mt-3 text-[15px] text-mute">
                <span className="font-medium text-ink">+{won(sp.coffeeChatPrice)}</span> · 신청할 때 담을 수 있어요
              </p>
            </Section>
          )}

          <Section title="비용">
            <p className="text-[17px] text-ink">
              시간당 {won(sp.priceHour)} · 최소 {sp.minHours}시간부터
            </p>
            {sp.coffeeChat && sp.coffeeChatPrice > 0 && (
              <p className="mt-1.5 text-[16px] text-mute">
                커피챗 {sp.coffeeChatMinutes}분은 {won(sp.coffeeChatPrice)}, 원하시면 같이 담으세요.
              </p>
            )}
          </Section>

          {/* 💸09-15 대표 — *「환불 규정 섹션 하나 만들고 환불 규정 넣자. 일단 제너럴하게 우리가 정한 환불규정으로」*.
              ⭐숫자는 `guestCancelRefundRate`(`lib/rent-payment.ts`)가 실제로 계산하는 값 그대로다.
                🚨문장으로 옮겨 적은 표가 코드와 어긋나면, 손님은 화면을 믿고 우리는 코드대로 돌려준다.
                그러니 여기 값을 고칠 일이 생기면 **그 함수부터 고치고 이 절을 맞춘다.**
              📌공간마다 다르게 두지 않는다. 사장님이 각자 정하면 손님이 매번 다시 읽어야 하고,
                분쟁이 났을 때 기준이 공간 수만큼 생긴다. */}
          {/* 📨09-16 — 비밀번호 같은 건 우리가 안 가진다. 「어떻게 받게 되는지」만 미리 말해 준다. */}
          <Section title="이용 안내">
            {/* 같은 문장이 확정 메일에도 나간다 — 정본은 `lib/rent-copy`다. */}
            <p className="text-[17px] leading-relaxed break-keep text-body">{accessHowLine(sp.accessHow)}</p>
            {/* ✍️09-17 QA — 「저장하지 않아요 / 전해 드립니다」로 한 절 안에서 격이 갈렸고, 앞 문장은 우리 입장이었다.
                손님에게 달라지는 것(누가 알려 주나)을 앞에 둔다. */}
            {/* ⏱09-17 대표 — 확정 뒤 2일 안에 사장님이 연락하는 규칙을 신청 전에 알린다. 문장 정본은 `rent-copy`. */}
            <p className="mt-2 text-[16px] leading-relaxed break-keep text-body">{CONTACT_RULE_GUEST}</p>
            <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
              출입 비밀번호 같은 건 사장님이 직접 알려 드려요. collab5는 따로 갖고 있지 않아요. 연락이 없으면 카카오톡으로
              알려 주세요.
            </p>
          </Section>

          {/* 🔁09-18 대표 코멘트 — 「유의사항 영역은 이용 안내 하단으로 빼자」. 소개·시설·위치로 공간을 먼저 보고,
              빌리기로 마음이 기운 뒤에 지킬 것을 읽는 순서다.
              ⭐⭐「사용 유의 사항」이 이 화면에서 제일 눈에 띄어야 한다(설계 §공간 카드).
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

          <Section title="환불 규정">
            <p className="text-[17px] leading-relaxed break-keep text-body">
              사장님이 거절하시면 <span className="font-medium text-ink">전액</span> 돌려드려요.
            </p>
            <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
              결제하고 <span className="font-medium text-ink">한 시간 안</span>에 취소하시면 남은 날과 상관없이 전액
              돌려드려요.
            </p>
            {/* ✍️09-17 QA — 「남은 기간으로 정해져요」 피동·행정어. 경계가 날짜 기준이라는 것도 같이 말한다(`kstDaysUntil`). */}
            <p className="mt-3 text-[16px] leading-relaxed break-keep text-mute">
              그 뒤엔 이용일까지 며칠 남았는지에 따라 달라져요. 몇 시에 취소하든 달력 날짜로 세요.
            </p>
            <dl className="mt-3 space-y-2 text-[16px]">
              {[
                ["7일 전까지", "전액 (100%)"],
                ["3일 전까지", "70%"],
                ["1일 전까지", "50%"],
                ["당일", "환불 없음"],
              ].map(([when, rate]) => (
                <div key={when} className="flex gap-3 leading-relaxed break-keep">
                  <dt className="w-[104px] shrink-0 text-mute">{when}</dt>
                  <dd className="min-w-0 flex-1 text-body">{rate}</dd>
                </div>
              ))}
            </dl>
            {/* 📜09-17 QA — 「이 규정은 collab5 규정을 따릅니다」는 동어반복이었고 원문으로 가는 길이 없었다.
                하루 가게 조항은 `/terms#rent`에 있다(본 세션이 넣는다). */}
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
              돌려드리는 돈은 결제하신 수단으로 들어가요. 자세한 내용은{" "}
              <Link href="/terms#rent" className="underline underline-offset-2">
                이용약관
              </Link>
              에 있어요.
            </p>
          </Section>

          {/* ── 신청 ── */}
          <Section title="신청하기" id="apply">
            {isOwner ? (
              <p className="text-[17px] leading-relaxed break-keep text-body">
                사장님 공간이라 신청은 못 하세요. 받은 신청은{" "}
                <Link href="/rent/my" className="underline underline-offset-4">
                  내 하루 가게
                </Link>
                에서 보실 수 있어요.
              </p>
            ) : openDates.length === 0 ? (
              // 🔁09-17 QA — 열린 시간이 없는데 비로그인 손님에게 「로그인하고 신청하기」가 섰다. 로그인하고 오면
              //   이 문장을 본다(헛걸음). 열린 시간 검사를 로그인 검사보다 먼저 한다.
              <p className="text-[17px] leading-relaxed break-keep text-body">
                사장님이 새 시간을 열어 두시면 여기서 신청할 수 있어요.
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
            ) : (
              <BookingForm
                spaceId={sp.id}
                spaceSlug={sp.slug}
                spaceName={sp.name}
                openSlots={openSlots}
                takenByDate={takenByDate}
                priceHour={sp.priceHour}
                minHours={sp.minHours}
                coffeeChat={sp.coffeeChat}
                coffeeChatMinutes={sp.coffeeChatMinutes}
                coffeeChatPrice={sp.coffeeChatPrice}
                capacity={sp.capacity}
                useType={sp.useType}
                myBrands={myBrands}
                initialPhone={myPhone}
              />
            )}
          </Section>
        </div>

        {/* ── 데스크톱 오른쪽 기둥 — «얼마 · 언제 · 누구»를 스크롤 내내 들고 간다 ──
            아워플레이스 상세가 같은 자리에 호스트·시간당 값·예약 버튼을 세운다. 우리는 버튼 대신 «신청 절로 가는 길»만 둔다.
            ⛔폰에선 안 그린다 — 폰은 위 메타 한 줄과 하단 고정 바가 같은 일을 한다. */}
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          {/* 메타 줄·소개서 줄은 lg에서 위 헤더에서 숨기고 여기로 모인다. 같은 값이 한 화면에 두 번 서지 않게. */}
          <div className="rounded-lg border border-hairline bg-surface p-6 shadow-e1">
            <PriceLine priceHour={sp.priceHour} minHours={sp.minHours} capacity={sp.capacity} />
            <InfoList className="mt-5 border-t border-hairline pt-5">
              <InfoRow
                label="가까운 날"
                value={
                  nextSlot ? (
                    <>
                      {dateLabel(nextSlot.date)} {nextSlot.start}~{nextSlot.end}
                      {openSlots.length > 1 && (
                        <span className="block text-[15px] text-mute">그 밖에 {openSlots.length - 1}번 더</span>
                      )}
                    </>
                  ) : (
                    <span className="text-mute">아직 없어요</span>
                  )
                }
              />
              {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
                <InfoRow label="커피챗" value={`${sp.coffeeChatMinutes}분 +${won(sp.coffeeChatPrice)}`} />
              )}
              {operatorName && <InfoRow label="운영" value={operatorName} />}
              {brandName && sp.brandSlug && (
                <InfoRow
                  label="소개서"
                  value={
                    <Link href={brandHref} className="underline underline-offset-2">
                      {brandName}
                    </Link>
                  }
                />
              )}
            </InfoList>
            {/* 로그인한 손님은 아래에 붙은 결제 바가 이 카드의 버튼 노릇을 한다. 바가 없는 로그인 전에만 길을 둔다. */}
            {!isOwner && !uid && openDates.length > 0 && (
              <a href="#apply" className={`${secondaryBtnCls} mt-6 w-full`}>
                신청하러 가기
              </a>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
