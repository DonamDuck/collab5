"use client";

// 탭 전환을 클라이언트에서 즉시 처리 — 두 데모 모두 서버에서 미리 가져와 놓고
// 탭 클릭 시 서버 왕복(재조회) 없이 화면만 토글.
// URL 동기화는 history.replaceState 직접 호출(= router.replace 대신) — Next 라우터를 거치면
// 화면엔 안 보여도 RSC payload를 백그라운드로 재요청해 네트워크가 낭비됨. 이미 다 로드된 상태라 불필요.
import { useState } from "react";
import { MakerArticle } from "../m/[slug]/MakerArticle";
import type { Maker } from "@/lib/types";

type Tab = "photo" | "none";

export function PreviewTabs({
  initialTab,
  photoMaker,
  photoLogo,
  noneMaker,
  noneLogo,
}: {
  initialTab: Tab;
  photoMaker: Maker | null;
  photoLogo?: string;
  noneMaker: Maker | null;
  noneLogo?: string;
}) {
  const [active, setActive] = useState<Tab>(initialTab);

  const go = (tab: Tab) => {
    setActive(tab);
    window.history.replaceState(null, "", `/preview?tab=${tab}`);
  };

  return (
    <div>
      <div className="flex gap-7 border-b border-hairline">
        <TabButton active={active === "photo"} onClick={() => go("photo")}>
          사진이 담긴 소개서
        </TabButton>
        <TabButton active={active === "none"} onClick={() => go("none")}>
          사진 없이 작성한 소개서 (기본)
        </TabButton>
      </div>
      <div className="mt-6">
        <Panel visible={active === "photo"} maker={photoMaker} logoUrl={photoLogo} />
        <Panel visible={active === "none"} maker={noneMaker} logoUrl={noneLogo} />
      </div>
    </div>
  );
}

function Panel({ visible, maker, logoUrl }: { visible: boolean; maker: Maker | null; logoUrl?: string }) {
  return (
    <div hidden={!visible}>
      {maker ? (
        <MakerArticle maker={maker} isOwner={false} logoUrl={logoUrl} readOnly />
      ) : (
        <p className="rounded-md border border-hairline bg-surface-soft p-6 text-base text-mute">
          미리보기를 준비하고 있어요. 잠시 후 다시 봐주세요.
        </p>
      )}
    </div>
  );
}

// 언더라인 탭 — 선택 시 하단 라이닝(primary) + 볼드, 컨테이너 하단 베이스라인과 -mb-px로 겹침.
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex h-11 items-center border-b-2 text-[15px] transition-colors ${
        active ? "border-primary font-bold text-ink" : "border-transparent font-medium text-mute hover:text-body"
      }`}
    >
      {children}
    </button>
  );
}
