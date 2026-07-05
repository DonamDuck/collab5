// 내 소개서 — 로그인 필수. 목록은 플랜 B(소유권)에서 채움.
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { Avatar } from "@/components/Avatar";
import { repo } from "@/lib/repo";
import { ConnectMaker } from "./ConnectMaker";

export default async function MyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  const makers = await repo.listMakersByOwner(user.id);
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
        {makers.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
            <p className="text-[15px] text-mute">아직 연결된 소개서가 없어요.</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <a
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-on"
              >
                소개서 만들기
              </a>
              <ConnectMaker />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {makers.map((m) => (
              <div
                key={m.slug}
                className="flex items-center justify-between rounded-md border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">{m.name}</p>
                  {m.oneLiner && <p className="truncate text-sm text-mute">{m.oneLiner}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={`/m/${m.slug}`} className="rounded-md px-3 py-1.5 text-sm text-mute hover:text-ink">
                    보기
                  </a>
                  <a
                    href={`/register?edit=${m.slug}`}
                    className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink"
                  >
                    수정
                  </a>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <ConnectMaker />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
