"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCardAction } from "@/lib/actions";
import { PhotoSlider } from "@/components/PhotoSlider";

export default function CardCreator({
  makerId,
  fromSlug,
  fromName,
  photos = [],
}: {
  makerId: string;
  fromSlug: string;
  fromName: string;
  photos?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toName, setToName] = useState("");
  const [why, setWhy] = useState("");
  const [picture, setPicture] = useState("");
  const [expectedEffect, setExpectedEffect] = useState("");

  const canSubmit = toName.trim() && why.trim() && !pending;

  const submit = () => {
    startTransition(async () => {
      const { slug } = await createCardAction({
        fromMakerId: makerId,
        fromSlug,
        toName,
        why,
        picture,
        expectedEffect,
      });
      router.push(`/c/${slug}?new=1`);
    });
  };

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">콜라보 카드 만들기</h1>
      <p className="mt-1 text-base text-body">
        <span className="font-medium text-ink">{fromName}</span> 이름으로 보내는 제안이에요.
        편하게 적어도 괜찮아요.
      </p>

      {/* 내 브랜드 사진 — 카드에 함께 담겨요 */}
      {photos.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-mute">카드에 담길 브랜드 사진</p>
          <div className="max-w-[460px]">
            <PhotoSlider photos={photos} />
          </div>
        </div>
      )}

      <div className="mt-7 space-y-6">
        <Field label="누구에게 보내나요? *">
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="예: 연남동 빈티지샵 '오월의숲'"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="왜 당신과 하고 싶나요? *">
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={3}
            placeholder="잘 맞겠다 싶은 지점, 평소 좋았던 점을 담아요."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="어떤 그림을 그리고 있나요?">
          <textarea
            value={picture}
            onChange={(e) => setPicture(e.target.value)}
            rows={2}
            placeholder="예: 한 달간 우리 워크숍을 그 공간에서 열기"
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="함께하면 뭐가 좋을까요?">
          <textarea
            value={expectedEffect}
            onChange={(e) => setExpectedEffect(e.target.value)}
            rows={2}
            placeholder="예: 서로의 단골을 자연스럽게 소개"
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
        >
          {pending ? "만드는 중…" : "카드 만들고 공유 링크 받기"}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-body">{label}</label>
      {children}
    </div>
  );
}
