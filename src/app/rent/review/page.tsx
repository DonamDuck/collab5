import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listSpacesForReview } from "@/lib/spaces";
import { getProfileById, type Profile } from "@/lib/profiles";
import { isRentAdmin } from "@/lib/rent-actions";
import { BIZ_CHECK_LABEL, bizOnFile, formatBizNumber, fromOpenDate, isTestBizNumber, spaceListed, testBizAllowed } from "@/lib/bizcheck";
import { REVIEW_SQL_LINE, resubmitted, reviewSignals, type ReviewSignal } from "@/lib/rent-review";
import { holderDiffersFromOwner, listPayoutAccounts, toMasked, type PayoutAccount } from "@/lib/payout-accounts";
import { HOLDER_TYPE_LABEL } from "@/lib/banks";
import type { BizCheckStatus, Space } from "@/lib/types";
import { InfoList, InfoRow, SpaceBadge } from "../ui";
import { ReviewActions } from "./ReviewActions";

// 하루 가게 — 공간 검토 (2026-09-18) · 관리자만
//
// 🧾대표 09-17 — 「개인까지 받으면 너무 무방비 범죄가 일어날 것 같다」. 공간 등록 = 사업자등록증 + 국세청 자동 조회 + «관리자 검토 뒤 공개».
// 🩸그 전엔 공개 손잡이가 `/rent/my`의 [공개하기] 하나뿐이었고, 그 화면은 «내» 공간만 그린다(`listSpacesByOwner`).
//   관리자가 남이 올린 공간을 열 화면이 없었다. 여기가 그 자리다.
// 세 무리
//   ① 검토 대기 — 공개할지, 보완을 요청할지 정한다(09-19 저녁 [보완 요청])
//   ② 이미 열려 있는데 등록증 승인이 없는 곳 — 사장님이 사업자 정보를 바꾼 곳. 공개는 그대로, 확인 표시만 정한다
//   ③ 보완을 기다리는 곳 — 사유를 보내 둔 곳. 사장님이 고쳐 보내면 ①로 돌아온다
// 🔎09-19 저녁 대표 — 「주소 비교는 어드민에서 확인」. 줄마다 「이 부분을 확인해 보세요」(자동 신호)와 「주소 대조」(바뀐 주소 · 네이버 · 등록증)를 둔다.
// 🔒등록증 원본은 이 화면에 안 싣는다. [등록증 보기]가 `/rent/review/cert/[slug]`로 가서 그때 60초짜리 서명 URL을 받는다.
export const dynamic = "force-dynamic";

/** 🔒탭 제목도 관리자에게만(09-18 밤 QA SC-26). 화면은 없는 척(404)하는데 고정 `metadata`라 탭에 「공간 검토」가 남아
 *  이 주소가 무엇을 하는 곳인지 알려 주고 있었다. 아니면 제목을 안 줘서 사이트 기본 제목이 선다. 판정은 `isRentAdmin` 한 벌. */
export async function generateMetadata(): Promise<Metadata> {
  if (!(await isRentAdmin())) return { robots: { index: false } };
  return { title: "공간 검토 — 하루 가게", robots: { index: false } };
}

const h2Cls = "text-[21px] font-bold leading-snug tracking-tight text-ink";

/** 국세청 상태 칩 — 일치는 민트, 다름·휴업·폐업은 빨강, 아직 모름은 레몬. 글자 칩 하나(배지 줄을 만들지 않는다). */
const CHECK_TONE: Record<BizCheckStatus, string> = {
  valid: "text-mint-on",
  mismatch: "text-danger",
  closed: "text-danger",
  none: "text-lemon-on",
  error: "text-lemon-on",
};

/** 칩 옆 한 줄 — 왜 그 상태인지. 코드를 사람 말로. */
function checkReason(sp: Space): string {
  const d = sp.bizCheckDetail;
  if (sp.bizCheckStatus === "valid") {
    // 🧪개발 서버의 테스트 번호 — 국세청에 묻지 않았다는 걸 그대로 말한다.
    if (d?.reason === "local-test") return isTestBizNumber(sp.bizNumber) && !testBizAllowed() ? "로컬 테스트 번호예요. 운영에선 빈 번호로 봐요." : "로컬 테스트 번호라 국세청에 묻지 않았어요.";
    return [d?.bStt, d?.taxType].filter(Boolean).join(" · ");
  }
  if (sp.bizCheckStatus === "mismatch") return "번호·대표자 이름·개업일 중 하나가 국세청 기록과 달라요.";
  if (sp.bizCheckStatus === "closed") return `${d?.bStt || "휴업·폐업"}${d?.endDt ? ` · 폐업일 ${fromOpenDate(d.endDt)}` : ""}`;
  if (sp.bizCheckStatus === "error") {
    return d?.reason === "network" ? "국세청에 연결되지 않았어요. 등록증을 보고 판단해 주세요." : "국세청이 답을 주지 않았어요. 등록증을 보고 판단해 주세요.";
  }
  if (!sp.bizNumber) return "사업자 정보가 비어 있어요.";
  return d?.reason === "no-key" ? "국세청 키를 넣기 전에 올린 공간이에요. 등록증을 보고 판단해 주세요." : "아직 조회하지 않았어요.";
}

/** 공개(또는 표시)를 막는 이유. 없으면 빈 문자열. 판정은 `publishSpaceAction`과 같다 — 버튼을 숨기는 건 헛걸음을 줄이려는 것이고 관문은 서버다. */
function blockReason(sp: Space): string {
  // 🧪`bizOnFile` — 운영에선 로컬 테스트 번호도 빈 번호로 본다(`publishSpaceAction`과 같은 판정).
  if (!sp.bizCertPath || !bizOnFile(sp) || !sp.bizOwnerName || !sp.bizOpenDate) {
    return "사업자등록증이나 사업자 정보가 비어 있어요. 사장님께 채워 달라고 연락해 주세요.";
  }
  if (sp.bizCheckStatus === "mismatch") return "국세청 기록과 달라 열 수 없어요. 사장님이 고치시면 다시 조회돼요.";
  if (sp.bizCheckStatus === "closed") return "휴업이나 폐업으로 나오는 사업자라 열 수 없어요.";
  return "";
}

const contactLine = (p: Profile | null) =>
  [p?.brandName?.trim(), p?.phone?.trim(), p?.email?.trim()].filter(Boolean).join(" · ") || "연락처가 없어요";

/** 🏦정산 계좌 칸(대표 09-19). 🔒계좌번호 원문은 싣지 않는다 — 은행과 끝 네 자리만(`toMasked`).
 *  예금주가 사업자 대표자와 다르면 한 줄로 알린다. 개인 명의 계좌도 받기로 해서 막지는 않는다(`holderDiffersFromOwner`). */
function AccountValue({ account, ownerName }: { account: PayoutAccount | null; ownerName: string }) {
  if (!account) return <span className="text-faint">아직 등록 전이에요</span>;
  const m = toMasked(account);
  const differs = holderDiffersFromOwner(account, ownerName);
  return (
    <>
      <span className="block">
        {m.bankName} <span className="tabular-nums">끝자리 {m.accountMasked.slice(-4)}</span>
        <span className="text-mute"> · {HOLDER_TYPE_LABEL[m.holderType]}</span>
      </span>
      {differs ? (
        <span className="mt-0.5 block text-[15px] font-medium text-lemon-on">
          계좌 예금주가 대표자와 달라요 <span className="whitespace-nowrap">(예금주 {m.holderName})</span>
        </span>
      ) : (
        <span className="mt-0.5 block text-[15px] text-mute">
          예금주 {m.holderName}
          {differs === null && m.holderType === "corporation" ? " · 법인 계좌라 대표자와 견주지 않았어요" : ""}
        </span>
      )}
    </>
  );
}

/** 🔎「이 부분을 확인해 보세요」 — 자동으로 읽을 수 있는 신호를 한 덩어리로(대표 09-19 저녁: 「사람이 하되 너랑 같이 할 거야」).
 *  판정은 사람이 한다. 여기는 «어디를 볼지»만 모은다(`reviewSignals`). 걸리는 게 없으면 그렇다고 한 줄.
 *  보완해서 다시 보낸 공간이면 지난 요청을 맨 위에 둔다 — 관리자가 제일 먼저 확인할 것이 그 답이다. */
function SignalBox({ signals, againNote }: { signals: ReviewSignal[]; againNote: string }) {
  return (
    <div className="mt-4 rounded-lg border border-hairline bg-surface-soft px-4 py-3">
      <p className="text-[15px] font-medium text-mute">이 부분을 확인해 보세요</p>
      <ul className="mt-2 space-y-1.5">
        {againNote && (
          <li className="text-[15px] leading-relaxed break-keep text-ink">
            <span className="font-medium">보완해서 다시 보냈어요.</span>{" "}
            <span className="whitespace-pre-line text-body">지난 요청: {againNote}</span>
          </li>
        )}
        {signals.map((sg) => (
          <li key={sg.text} className={`flex gap-2 text-[15px] leading-relaxed break-keep ${sg.tone === "warn" ? "text-danger" : "text-lemon-on"}`}>
            <span aria-hidden="true">·</span>
            <span className="min-w-0 flex-1">{sg.text}</span>
          </li>
        ))}
        {!againNote && signals.length === 0 && (
          <li className="text-[15px] leading-relaxed break-keep text-mint-on">자동으로 걸리는 건 없어요. 등록증만 한 번 봐 주세요.</li>
        )}
      </ul>
    </div>
  );
}

/** 🏠주소 대조 한 칸(대표 09-19 저녁) — 「주소 바뀜: 이전 → 새」 · 네이버 결과 · 등록증 보기를 한 자리에.
 *  🔻「주소가 바뀌면 등록증을 새로 받는다」(09-19 오후)를 뺀 대신, 등록증의 사업장 주소와 공간 주소를 여기서 사람 눈으로 견준다. */
function AddressCompare({ sp }: { sp: Space }) {
  const prev = sp.reviewPrevAddress?.trim() ?? "";
  return (
    <>
      {prev ? (
        <span className="block">
          <span className="font-medium text-lemon-on">주소 바뀜</span>
          <span className="block text-mute line-through decoration-faint">{prev}</span>
          <span className="block">→ {sp.address || "비어 있어요"}</span>
        </span>
      ) : (
        <span className="block">{sp.address || <span className="text-faint">주소가 비어 있어요</span>}</span>
      )}
      <span className="mt-1 block text-[15px] text-mute">
        네이버 ·{" "}
        {sp.placeMatchedAt && sp.placeName ? `${sp.placeName} · ${sp.placeAddress}` : "같은 가게를 못 찾았어요"}
      </span>
      <span className="mt-1 block text-[15px]">
        {sp.bizCertPath ? (
          // 🔒새 탭에서 서버가 관리자 확인 뒤 60초짜리 서명 URL로 넘겨 준다. 이 화면 HTML엔 경로도 URL도 안 실린다.
          <a
            href={`/rent/review/cert/${encodeURIComponent(sp.slug)}`}
            target="_blank"
            rel="noreferrer"
            className="-my-[13px] inline-block py-[13px] text-body underline underline-offset-2"
          >
            등록증 보기
          </a>
        ) : (
          <span className="text-faint">등록증을 안 올렸어요</span>
        )}
        <span className="text-mute"> · 등록증의 사업장 주소와 견줘 보세요</span>
      </span>
    </>
  );
}

function ReviewItem({ sp, owner, approveOnly, account }: {
  sp: Space; owner: Profile | null; approveOnly: boolean; account: PayoutAccount | null;
}) {
  const blocked = blockReason(sp);
  const holderDiffers = account ? holderDiffersFromOwner(account, sp.bizOwnerName) : null;
  const signals = reviewSignals(sp, holderDiffers);
  const prevName = sp.reviewPrevName?.trim() ?? "";
  return (
    <li className="border-b border-hairline py-6 first:pt-2 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={`/rent/${sp.slug}`} target="_blank" className="text-[17px] font-medium break-keep text-ink underline-offset-4 hover:underline">
            {sp.name}
          </Link>
          {prevName && (
            <p className="mt-1 text-[15px] leading-relaxed break-keep text-lemon-on">
              이름 바뀜 · <span className="text-mute line-through decoration-faint">{prevName}</span> → {sp.name}
            </p>
          )}
        </div>
        <SpaceBadge status={sp.status} />
      </div>

      <SignalBox signals={signals} againNote={resubmitted(sp) ? sp.reviewNote ?? "" : ""} />

      <InfoList className="mt-4">
        <InfoRow label="주소 대조" value={<AddressCompare sp={sp} />} />
        <InfoRow label="사장님" value={<span className="break-all">{contactLine(owner)}</span>} />
        <InfoRow
          label="사업자번호"
          value={sp.bizNumber ? <span className="tabular-nums">{formatBizNumber(sp.bizNumber)}</span> : <span className="text-faint">없어요</span>}
        />
        <InfoRow label="대표자" value={sp.bizOwnerName || <span className="text-faint">없어요</span>} />
        <InfoRow
          label="개업일"
          value={sp.bizOpenDate ? <span className="tabular-nums">{fromOpenDate(sp.bizOpenDate)}</span> : <span className="text-faint">없어요</span>}
        />
        <InfoRow
          label="국세청"
          value={
            <>
              <span className={`font-medium ${CHECK_TONE[sp.bizCheckStatus]}`}>{BIZ_CHECK_LABEL[sp.bizCheckStatus]}</span>
              {checkReason(sp) && <span className="block text-[15px] text-mute">{checkReason(sp)}</span>}
            </>
          }
        />
        <InfoRow label="정산 계좌" value={<AccountValue account={account} ownerName={sp.bizOwnerName} />} />
      </InfoList>

      <ReviewActions
        slug={sp.slug}
        spaceName={sp.name}
        publishLabel={approveOnly ? "확인 표시 붙이기" : "공개하기"}
        blocked={blocked}
        fixReady={!!sp.reviewReady}
        fixLockedLine={REVIEW_SQL_LINE}
        listed={spaceListed(sp)}
      />
    </li>
  );
}

/** 🔁보완을 기다리는 공간 한 줄 — 무엇을 부탁했는지와 언제 부탁했는지. 손잡이는 없다(사장님이 고쳐 보내면 검토 대기로 돌아온다). */
function WaitingFixItem({ sp, owner }: { sp: Space; owner: Profile | null }) {
  return (
    <li className="border-b border-hairline py-5 first:pt-2 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/rent/${sp.slug}`} target="_blank" className="min-w-0 text-[17px] font-medium break-keep text-ink underline-offset-4 hover:underline">
          {sp.name}
        </Link>
        <span className="shrink-0 text-[15px] text-lemon-on">보완 기다리는 중</span>
      </div>
      <InfoList className="mt-3">
        <InfoRow label="부탁한 날" value={<span className="tabular-nums">{kstDateTime(sp.reviewRejectedAt)}</span>} />
        <InfoRow label="부탁한 내용" value={<span className="whitespace-pre-line">{sp.reviewNote || "적지 않았어요"}</span>} />
        <InfoRow label="사장님" value={<span className="break-all">{contactLine(owner)}</span>} />
      </InfoList>
    </li>
  );
}

/** `2026-09-19T11:00:00Z` → 「9월 19일 20:00」(KST). */
function kstDateTime(iso?: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "모름";
  const k = new Date(t + 9 * 3_600_000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function RentReviewPage() {
  // 🔒없는 척한다(정산 화면과 같은 규율). 판정은 `isRentAdmin` 한 벌.
  if (!(await isRentAdmin())) notFound();

  const { pending, approveOnly, waitingFix } = await listSpacesForReview();
  const ownerIds = Array.from(new Set([...pending, ...approveOnly, ...waitingFix].map((sp) => sp.ownerUserId)));
  const [owners, accounts] = await Promise.all([
    Promise.all(ownerIds.map(async (id) => [id, await getProfileById(id)] as [number, Profile | null])).then((xs) => new Map(xs)),
    // 🏦09-19 — 예금주와 대표자를 견주려고 계좌를 같이 읽는다. 🔒원문이 오지만 화면엔 끝 네 자리만 싣는다(`AccountValue`).
    listPayoutAccounts(ownerIds),
  ]);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent/my?tab=host" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 내 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">공간 검토</h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          사업자등록증과 국세청 조회 결과를 보고 공개를 정해요. 맞지 않는 부분이 있으면 사장님께 보완을 요청해요.
        </p>
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-faint">
          「사업자 확인된 가게」 표시는 국세청 기록과 맞는 공간에만 붙어요. 조회 전이거나 실패한 공간은 등록증을 보고 열 수 있지만 표시는 안 붙어요.
        </p>
      </header>

      <section className="mt-10">
        <h2 className={h2Cls}>검토 대기 · {pending.length}</h2>
        {pending.length === 0 ? (
          <p className="mt-5 text-[15px] leading-relaxed break-keep text-faint">지금 검토할 공간이 없어요.</p>
        ) : (
          <ul className="mt-3">
            {pending.map((sp) => (
              <ReviewItem key={sp.id} sp={sp} owner={owners.get(sp.ownerUserId) ?? null} approveOnly={false} account={accounts.get(sp.ownerUserId) ?? null} />
            ))}
          </ul>
        )}
      </section>

      {approveOnly.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className={h2Cls}>열려 있는 공간 · 확인 표시 전 · {approveOnly.length}</h2>
          <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
            사장님이 사업자 정보를 새로 채우거나 바꾼 공간이에요. 공개는 그대로 두고 확인 표시만 정해요.
          </p>
          <ul className="mt-3">
            {approveOnly.map((sp) => (
              <ReviewItem key={sp.id} sp={sp} owner={owners.get(sp.ownerUserId) ?? null} approveOnly account={accounts.get(sp.ownerUserId) ?? null} />
            ))}
          </ul>
        </section>
      )}

      {/* 🔁09-19 저녁 — 보완을 요청해 둔 공간. 사장님이 고쳐 보내면 위 「검토 대기」로 돌아온다(대표 알림도 다시 간다). */}
      {waitingFix.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className={h2Cls}>보완을 기다리는 공간 · {waitingFix.length}</h2>
          <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
            사장님께 사유를 보내 둔 곳이에요. 목록엔 안 보이고, 고쳐서 다시 보내시면 검토 대기로 올라와요.
          </p>
          <ul className="mt-3">
            {waitingFix.map((sp) => (
              <WaitingFixItem key={sp.id} sp={sp} owner={owners.get(sp.ownerUserId) ?? null} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
