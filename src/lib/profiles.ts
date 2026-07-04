// 계정 프로필 — 서버 전용(service_role). RLS 잠금이라 anon으로 접근 불가.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Profile {
  userId: string;
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

export async function upsertProfile(p: Profile): Promise<void> {
  const client = db();
  if (!client) return; // 로컬 mock — DB 없음
  const { error } = await client.from("profiles").upsert({
    user_id: p.userId,
    brand_name: p.brandName,
    phone: p.phone,
    profile_image: p.profileImage,
  });
  if (error) throw new Error(error.message);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = db();
  if (!client) return null;
  const { data } = await client
    .from("profiles")
    .select("user_id, brand_name, phone, profile_image")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id,
    brandName: data.brand_name,
    phone: data.phone ?? "",
    profileImage: data.profile_image ?? "",
  };
}
