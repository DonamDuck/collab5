"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { uploadPhoto } from "@/lib/upload";
import { updateProfileImageAction } from "@/lib/actions";

// /my 프로필 사진 — 사진/변경 클릭 시 파일 선택 → Storage 업로드 → 프로필 갱신.
export function ProfileAvatarEditor({ image, name }: { image?: string; name: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  const pick = () => inputRef.current?.click();

  const onFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const url = await uploadPhoto(f, 400);
      const r = await updateProfileImageAction(url);
      if (r.error) {
        alert(r.error);
        return;
      }
      start(() => router.refresh());
    } catch {
      alert("이미지 업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label="프로필 사진 변경"
        className="relative rounded-full disabled:opacity-60"
      >
        <Avatar image={image || undefined} name={name} size={56} />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/30">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        className="text-xs font-medium text-mute hover:text-ink disabled:opacity-60"
      >
        {busy ? "올리는 중…" : "변경"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files)}
      />
    </div>
  );
}
