import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpacePublic, listLiveBookingsIn } from "@/lib/spaces";
import { getProfileById, getSessionUserId } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { accessHowLine } from "@/lib/rent-copy";
import { futureSlots } from "@/lib/rent-time";
import { PhotoSlider } from "@/components/PhotoSlider";
import { BookingForm } from "./BookingForm";
import { categoryLabel, Chip, dateLabel, primaryBtnCls, scopeLabel, won } from "../ui";
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
    // ⏱09-16 대표 — 시간 단위 대여. 「하루 빌려보세요」는 사실이 틀린 말이라 링크 카드에도 안 싣는다.
    description: sp.tagline || `${sp.area}에서 필요한 시간만큼 빌릴 수 있는 공간이에요.`,
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
  // 상호(운영하는 브랜드 이름). 사장님 실명(profiles에 따로 없다)은 안 읽는다.
  const operatorName = (await getProfileById(sp.ownerUserId))?.brandName?.trim() ?? "";
  const brandName = sp.brandSlug ? (await repo.getMakerBySlug(sp.brandSlug))?.name ?? "" : "";

  // 신청자가 자기 소개서를 붙일 수 있게 목록을 준다(선택). 없어도 신청은 된다 —
  // 이 기능은 소개서와 독립이라, 소개서를 요구하면 설계 전제가 깨진다(설계 §한 줄).
  const myBrands =
    uid && !isOwner
      ? (await repo.listMakersByOwner(uid)).map((m) => ({ slug: m.slug, name: m.name }))
      : [];

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
  // 상단 카드 메타 — 동네 · 인원 · 시간. 표에 있던 값이 여기로 왔다.
  const meta = [categoryLabel(sp.category), sp.capacity ? `최대 ${sp.capacity}명` : "", `시간당 ${won(sp.priceHour)}`]
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
          <Chip>{scopeLabel(sp.scope)}</Chip>
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

      <Section title="빌릴 수 있는 날">
        {openDates.length === 0 ? (
          <p className="text-[17px] leading-relaxed text-body">
            지금은 열린 시간이 없어요. 곧 새 날짜가 올라올 거예요.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {openSlots.map((sl) => (
              <Chip key={`${sl.date}-${sl.start}`}>{`${dateLabel(sl.date)} ${sl.start}~${sl.end}`}</Chip>
            ))}
          </div>
        )}
      </Section>

      {/* 📚09-14 신설 — 대표: *「이거 체크박스 빼고 여기 정보 영역으로 하고 (선택 사항)으로.
          「사장님께 잠깐 배워 볼 수 있어요」로 정규 타이틀로 섹션으로 다루자」*.
          ⭐설명하는 자리와 고르는 자리를 갈랐다. 고르는 일은 결제 단계의 옵션이 맡는다. */}
      {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
        <Section title="사장님과 커피챗">
          {/* ☕09-16 대표 — 「사장님께 잠깐 배워보기」를 커피챗으로 다시 잡았다.
              ⭐파는 것은 비법이 아니라 «현업 이야기»다. 사장님이 직접 적은 주제가 있으면 그걸 보여 주고,
                없으면 무엇을 물을 수 있는지 우리가 예를 든다 — 손님이 무엇을 사는지 알아야 고른다. */}
          <p className="text-[17px] leading-relaxed break-keep text-body">
            사장님과 협의한 날짜에 {sp.coffeeChatMinutes}분 동안 현업 이야기를 들을 수 있어요.
          </p>
          {sp.coffeeChatTopics.trim() ? (
            <p className="mt-2 whitespace-pre-line text-[16px] leading-relaxed break-keep text-mute">
              {sp.coffeeChatTopics}
            </p>
          ) : (
            <p className="mt-2 text-[16px] leading-relaxed break-keep text-mute">
              손님은 언제 오는지, 재료는 어디서 떼는지, 처음에 무엇을 크게 틀렸는지 같은 것들이요.
            </p>
          )}
          <p className="mt-3 text-[15px] text-mute">
            <span className="font-medium text-ink">+{won(sp.coffeeChatPrice)}</span> · 신청하실 때 고르시면 돼요
            <span className="ml-1 text-faint">(선택 사항)</span>
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
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
          출입 비밀번호처럼 민감한 내용은 collab5에 저장하지 않아요. 사장님이 직접 전해 드립니다.
        </p>
      </Section>

      <Section title="환불 규정">
        <p className="text-[17px] leading-relaxed break-keep text-body">
          사장님이 거절하시면 <span className="font-medium text-ink">전액</span> 돌려드려요.
        </p>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
          신청하고 <span className="font-medium text-ink">한 시간 안</span>에 취소하시면 남은 날과 상관없이 전액
          돌려드려요.
        </p>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-mute">
          그 뒤에 취소하실 때는 쓰기로 한 날까지 남은 기간으로 정해져요.
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
        <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
          돌려드리는 돈은 결제하신 수단으로 그대로 들어가요. 이 규정은 collab5 규정을 따릅니다.
        </p>
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
            사장님이 새 시간을 열어 두시면 여기서 신청하실 수 있어요.
          </p>
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
          />
        )}
      </Section>
    </main>
  );
}
