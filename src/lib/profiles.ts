import "server-only"; // 🔒클라이언트 컴포넌트가 import하면 빌드가 멈춘다. 서비스 롤 키로 DB를 읽는 파일이다(09-18 밤 QA SEC-09).
// 계정 프로필 — 서버 전용(service_role). RLS 잠금이라 anon으로 접근 불가.
// DB 테이블 = public.users (07-25 profiles→users 개명). auth.users(인증)와는 다른 테이블.
// profiles.user_id = 정수 PK(1,2,3), profiles.uuid = auth.users(id) 링크.
// 앱은 세션의 auth UUID(authUuid)로 조회한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser } from "./supabase/server";
import { getRentMock, rentMockOn, throwIfMock } from "./rent-mock";

export interface Profile {
  id: number; // 정수 user_id (1,2,3)
  uuid: string; // auth.users(id)
  brandName: string;
  phone: string;
  email: string; // 가입 이메일 ('' = 없음)
  profileImage: string; // 리사이즈 base64 data URL ('' = 없음)
}

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** 가입 시 프로필 생성/갱신 — uuid 기준 upsert (user_id 정수는 DB 자동).
 *  ⭐생성된 정수 user_id를 돌려준다(가입 알림 메일에 담는 용도). 반환값은 무시해도 된다 —
 *    로컬 mock이거나 DB가 안 돌려주면 null이고, 그 경우에도 저장 자체는 정상이다. */
export async function upsertProfile(p: {
  uuid: string;
  brandName: string;
  phone: string;
  email: string;
  profileImage: string;
}): Promise<number | null> {
  await throwIfMock("upsertProfile"); // 🧪09-18 목 데이터 보기 중엔 쓰지 않는다(두 번째 울타리 — 첫 울타리는 가입 액션)
  const client = db();
  if (!client) return null; // 로컬 mock — DB 없음
  const { data, error } = await client
    .from("users")
    .upsert(
      {
        uuid: p.uuid,
        brand_name: p.brandName,
        phone: p.phone,
        email: p.email,
        profile_image: p.profileImage,
      },
      { onConflict: "uuid" }
    )
    .select("user_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.user_id ?? null;
}

export interface DuplicateFlags {
  email: boolean;
  phone: boolean;
  brandName: boolean;
}

/** 가입 중복검사 — 비어있지 않은 필드만 profiles에서 조회. excludeUuid는 본인 제외(수정 대비). */
export async function findDuplicates(p: {
  email?: string;
  phone?: string;
  brandName?: string;
  excludeUuid?: string;
}): Promise<DuplicateFlags> {
  const flags: DuplicateFlags = { email: false, phone: false, brandName: false };
  // 🧪09-18 목 모드 — 가입 화면의 중복 경고를 목 세계 사람들로 띄운다. 느린오후 이메일을 치면 경고가 뜬다.
  const m = await getRentMock();
  if (m) {
    const others = m.data.profiles.filter((x) => x.uuid !== p.excludeUuid);
    const e = p.email?.trim().toLowerCase();
    const ph = p.phone?.trim();
    const b = p.brandName?.trim();
    return {
      email: !!e && others.some((x) => x.email.toLowerCase() === e),
      phone: !!ph && others.some((x) => x.phone === ph),
      brandName: !!b && others.some((x) => x.brandName === b),
    };
  }
  const client = db();
  if (!client) return flags; // 로컬 mock — 중복 없음 취급

  const exists = async (column: string, value: string, ci = false): Promise<boolean> => {
    let q = client
      .from("users")
      .select("user_id", { count: "exact", head: true });
    q = ci ? q.ilike(column, value) : q.eq(column, value);
    if (p.excludeUuid) q = q.neq("uuid", p.excludeUuid);
    const { count } = await q;
    return (count ?? 0) > 0;
  };

  const email = p.email?.trim();
  const phone = p.phone?.trim();
  const brandName = p.brandName?.trim();

  const [e, ph, b] = await Promise.all([
    email ? exists("email", email, true) : Promise.resolve(false),
    phone ? exists("phone", phone) : Promise.resolve(false),
    brandName ? exists("brand_name", brandName) : Promise.resolve(false),
  ]);
  flags.email = e;
  flags.phone = ph;
  flags.brandName = b;
  return flags;
}

/** 프로필 사진만 갱신 — /my 프로필 사진 변경용(brandName·phone 등 미변경). */
export async function updateProfileImage(uuid: string, imageUrl: string): Promise<void> {
  await throwIfMock("updateProfileImage");
  const client = db();
  if (!client) return; // 로컬 mock
  const { error } = await client.from("users").update({ profile_image: imageUrl }).eq("uuid", uuid);
  if (error) throw new Error(error.message);
}

/** 정수 user_id로 프로필 조회 — 소개서 소유자 표시(로고 등)용.
 *  세션 → 프로필은 `getProfile(authUuid)`, 소유자 id → 프로필은 이 함수. */
export async function getProfileById(userId: number): Promise<Profile | null> {
  // 🧪목 데이터(개발 빌드 전용). 09-17엔 9000번대만 가로챘는데, 09-18 사이트 지도부터는 목 모드면 전부 목 세계를 본다
  //   (목 모드에서 DB를 한 번도 안 부르게).
  const m = await getRentMock();
  if (m) return m.data.profiles.find((p) => p.id === userId) ?? null;
  const client = db();
  if (!client) return null;
  const { data } = await client
    .from("users")
    .select("user_id, uuid, brand_name, phone, email, profile_image")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.user_id,
    uuid: data.uuid,
    brandName: data.brand_name,
    phone: data.phone ?? "",
    email: data.email ?? "",
    profileImage: data.profile_image ?? "",
  };
}

/** ⭐ 세션 → 정수 user_id 중앙 리졸버. 소유권·찜·제안 판정은 전부 이걸 거친다(07-25 uuid→user_id 전환).
 *  profiles 행이 없으면 null(= 소유권 없음)로 안전하게 떨어진다. */
export async function getSessionUserId(): Promise<number | null> {
  // 🧪09-17 하루 팝업 목 데이터(개발 빌드 전용). ⚠️사이트 전체에 먹는다 — 목 쿠키가 있는 동안엔 어느 화면이든
  //   케이스의 가상 사용자로 보인다. 그래서 루트 레이아웃이 모든 화면 위에 「목 데이터 보는 중」 띠를 붙인다.
  const m = await getRentMock();
  if (m) return m.viewer.userId;
  const user = await getSessionUser();
  if (!user) return null;
  return (await getProfile(user.id))?.id ?? null;
}

export async function getProfile(authUuid: string): Promise<Profile | null> {
  // 🧪09-18 목 모드 — 세션(`getSessionUser`)이 `mock-uuid-<번호>`를 돌려주므로 같은 모양으로 찾는다.
  const m = await getRentMock();
  if (m) return m.data.profiles.find((p) => p.uuid === authUuid) ?? null;
  const client = db();
  if (!client) return null;
  const { data } = await client
    .from("users")
    .select("user_id, uuid, brand_name, phone, email, profile_image")
    .eq("uuid", authUuid)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.user_id,
    uuid: data.uuid,
    brandName: data.brand_name,
    phone: data.phone ?? "",
    email: data.email ?? "",
    profileImage: data.profile_image ?? "",
  };
}

/** ☎️하루 팝업 신청 때 받은 손님 번호를 프로필에 «비어 있을 때만» 적는다 (대표 09-17).
 *  사장님이 예약을 받은 뒤 보는 손님 연락처가 프로필 전화라(`ContactBlock`), 소셜 가입처럼 번호 없이 들어온
 *  손님은 사장님 화면에 번호가 비어 있었다. 신청 폼이 번호를 필수로 받고 여기서 채운다.
 *  ⚠️이미 번호가 있으면 덮지 않는다. 가입 때 적은 번호를 신청 한 번으로 바꾸면 계정 정보가 모르는 사이에 바뀐다.
 *  ⚠️다른 계정이 쓰는 번호면 적지 않는다. 가입 화면이 번호 중복을 막고 있어서(`findDuplicates`) 같은 규칙을 지킨다.
 *  돌려주는 값 — 실제로 적었으면 true. 실패해도 던지지 않는다(신청을 막을 일이 아니다). */
export async function savePhoneIfEmpty(userId: number, phone: string): Promise<boolean> {
  if (await rentMockOn()) return false;
  const client = db();
  const value = phone.trim();
  if (!client || !value) return false;
  try {
    const p = await getProfileById(userId);
    if (!p || p.phone.trim()) return false;
    const dup = await findDuplicates({ phone: value, excludeUuid: p.uuid });
    if (dup.phone) return false;
    const { error } = await client.from("users").update({ phone: value }).eq("user_id", userId);
    if (error) {
      console.error(`[profiles] 번호 저장 실패 user=${userId}: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[profiles] 번호 저장 실패 user=${userId}: ${String(e)}`);
    return false;
  }
}
