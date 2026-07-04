// 내 소개서 — 로그인 필수. 목록은 플랜 B(소유권)에서 채움.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { Avatar } from "@/components/Avatar";

export default async function MyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  const displayName = profile?.brandName || user.email?.split("@")[0] || "내 브랜드";

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <Avatar image={profile?.profileImage || undefined} name={displayName} size={56} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{displayName}</h1>
          <p className="text-sm text-mute">{user.email}</p>
        </div>
      </div>

      <section className="mt-9 border-t border-hairline pt-8">
        <h2 className="text-[19px] font-bold text-ink">내 소개서</h2>
        <div className="mt-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
          <p className="text-[15px] text-mute">아직 계정에 연결된 소개서가 없어요.</p>
          <a
            href="/register"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-on"
          >
            소개서 만들기
          </a>
        </div>
      </section>
    </main>
  );
}
