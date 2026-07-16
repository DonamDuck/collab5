// 내 소개서 — 로그인 필수. 목록은 플랜 B(소유권)에서 채움.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { Avatar } from "@/components/Avatar";
import { repo } from "@/lib/repo";
import { ConnectMaker } from "./ConnectMaker";
import { LogoutButton } from "./LogoutButton";
import { ChangePasswordButton } from "./ChangePasswordButton";
import { MakerRow } from "./MakerRow";

export default async function MyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // 프로필·소개서 목록은 서로 독립 조회 — 병렬로 가져와 왕복 1회분 단축
  const [profile, makers] = await Promise.all([
    getProfile(user.id),
    repo.listMakersByOwner(user.id),
  ]);
  const displayName = profile?.brandName || user.email?.split("@")[0] || "내 브랜드";

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <Avatar image={profile?.profileImage || undefined} name={displayName} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-ink">{displayName}</h1>
          <p className="truncate text-sm text-mute">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="mt-9 border-t border-hairline pt-8">
        <h2 className="text-[19px] font-bold text-ink">내 소개서</h2>
        {makers.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
            <p className="text-[15px] text-mute">아직 연결된 소개서가 없어요.</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-on"
              >
                소개서 만들기
              </Link>
              <ConnectMaker />
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {makers.map((m) => (
              <MakerRow
                key={m.slug}
                slug={m.slug}
                name={m.name}
                oneLiner={m.oneLiner}
                collabOpen={m.collabOpen}
                searchVisible={m.searchVisible}
              />
            ))}
            <div className="flex justify-center pt-2">
              <ConnectMaker label="+ 소개서 추가 연결" />
            </div>
          </div>
        )}
      </section>

      {/* 계정 설정 */}
      <section className="mt-10 border-t border-hairline pt-6">
        <ChangePasswordButton email={user.email ?? ""} />
      </section>
    </main>
  );
}
