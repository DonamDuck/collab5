// 계정 프로필 — 서버 전용(service_role). RLS 잠금이라 anon으로 접근 불가.
// profiles.user_id = 정수 PK(1,2,3), profiles.uuid = auth.users(id) 링크.
// 앱은 세션의 auth UUID(authUuid)로 조회한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Profile {
  id: number; // 정수 user_id (1,2,3)
  uuid: string; // auth.users(id)
  brandName: string;
  phone: string;
  profileImage: string; // 리사이즈 base64 data URL ('' = 없음)
}

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** 가입 시 프로필 생성/갱신 — uuid 기준 upsert (user_id 정수는 DB 자동) */
export async function upsertProfile(p: {
  uuid: string;
  brandName: string;
  phone: string;
  profileImage: string;
}): Promise<void> {
  const client = db();
  if (!client) return; // 로컬 mock — DB 없음
  const { error } = await client.from("profiles").upsert(
    {
      uuid: p.uuid,
      brand_name: p.brandName,
      phone: p.phone,
      profile_image: p.profileImage,
    },
    { onConflict: "uuid" }
  );
  if (error) throw new Error(error.message);
}

export async function getProfile(authUuid: string): Promise<Profile | null> {
  const client = db();
  if (!client) return null;
  const { data } = await client
    .from("profiles")
    .select("user_id, uuid, brand_name, phone, profile_image")
    .eq("uuid", authUuid)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.user_id,
    uuid: data.uuid,
    brandName: data.brand_name,
    phone: data.phone ?? "",
    profileImage: data.profile_image ?? "",
  };
}
