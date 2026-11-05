// Hanmadi 개인정보 처리방침(/sideproject/hanmadi/privacy) — 앱스토어 등록에 필요한 주소(10-23).
// 맥 앱과 아이폰 앱을 한 장에 쓴다. 앱이 실제로 하는 일만 적는다(맥 공개판·아이폰 1판 기준).
//   · 아이폰 앱은 네트워크를 전혀 안 쓴다. 맥 앱은 업데이트 확인으로 collab5.co.kr의 버전 파일만 받는다.
//   · 맥 앱의 정리 메일·물어보기는 사용자가 자기 열쇠를 넣었을 때만 켜진다(공개판엔 열쇠가 없다).
// ⚠️앱이 새로 무언가를 밖으로 보내게 되면(동기화·AI 정리 등) 이 페이지부터 고친다.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hanmadi 개인정보 처리방침 — collab5",
  description: "Hanmadi는 개인정보를 수집하지 않아요. 남긴 메모, 사진, 녹음은 모두 내 기기 안에만 저장돼요.",
  alternates: { canonical: "/sideproject/hanmadi/privacy", languages: { ko: "/sideproject/hanmadi/privacy", en: "/sideproject/hanmadi/privacy/en" } },
};

const H2 = "mt-9 text-[18px] font-bold leading-snug text-ink";
const P = "mt-2.5 text-[16px] leading-relaxed break-keep text-pretty text-body";
const LI = "text-[16px] leading-relaxed break-keep text-pretty text-body";

export default function HanmadiPrivacyPage() {
  return (
    <main lang="ko" className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/sideproject/hanmadi"
          className="-ml-2 inline-flex h-[44px] items-center gap-1 rounded-md px-2 text-[14px] text-mute hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Hanmadi
        </Link>
        {/* 영어판(10-29, 아이폰 1.1 영어 앱스토어용). 내용은 이 페이지를 옮긴 것이라 여기를 고치면 en/도 같이 고친다 */}
        <Link href="/sideproject/hanmadi/privacy/en" lang="en" className="inline-flex h-[44px] items-center px-2 text-[14px] text-mute hover:text-ink">
          English
        </Link>
      </div>

      <h1 className="mt-4 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">Hanmadi 개인정보 처리방침</h1>
      <p className="mt-3 text-[17px] leading-relaxed break-keep text-pretty text-body">
        Hanmadi는 개인정보를 수집하지 않아요. 남긴 메모, 사진, 녹음은 모두 내 기기 안에만 저장돼요.
      </p>

      <h2 className={H2}>기기 안에만 저장되는 것</h2>
      <p className={P}>
        한마디로 남긴 글, 스크린샷과 사진의 사본, 녹음, 녹음을 받아 적은 글이에요. 저희 서버로 보내지 않고, 앱을 지우면 함께 지워져요.
      </p>

      <h2 className={H2}>앱이 쓰는 권한</h2>
      <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5">
        <li className={LI}>사진: 스크린샷과 사진을 보여 주고, 고른 사진의 사본을 앱 안에 저장해요.</li>
        <li className={LI}>마이크: 말로 한마디를 남길 때 녹음해요.</li>
        <li className={LI}>음성 인식: 녹음한 말을 기기 안에서 글로 옮겨요.</li>
        <li className={LI}>자동화(맥): 애플 메모를 가져오거나, 찍은 화면의 브라우저 주소를 메모에 붙일 때 써요.</li>
      </ul>

      <h2 className={H2}>인터넷 연결</h2>
      <p className={P}>
        아이폰 앱은 인터넷에 접속하지 않아요. 맥 앱은 새 버전이 있는지 보려고 collab5.co.kr에서 작은 버전 파일 하나만 받아 와요.
      </p>

      <h2 className={H2}>수집하거나 나누지 않는 것</h2>
      <p className={P}>가입이 없고 광고와 분석 도구도 넣지 않았어요. 어떤 정보도 다른 회사에 주지 않아요.</p>

      <h2 className={H2}>문의</h2>
      <p className={P}>
        궁금한 점은{" "}
        <Link href="/help" className="font-medium text-ink underline underline-offset-2">
          collab5 고객센터
        </Link>
        로 알려 주세요.
      </p>

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed text-mute">시행일: 2026년 10월 23일</p>
    </main>
  );
}
