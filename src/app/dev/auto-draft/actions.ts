"use server";

// 자동 초안 → 로컬 «초안 소개서» 만들기 (2026-10-04, 로컬 전용)
//
// 대표 10-04: *「json sql 이런 거 말고, 로컬에 ui로 페이지 만들어 주면 좋겠다」*.
// ⭐아티팩트 검토 화면을 따로 만들지 않고 **진짜 소개서로** 만든다 — 새 흐름에서 고객이 받는 게 바로 그 화면이고,
//   삭제·순서 바꾸기·문구 수정은 이미 수정 화면에 있다. 같은 기능을 두 번 만들 이유가 없다.
// 🔒로컬 전용: 개발 서버 + InMemoryRepo(설정 없음)일 때만 돈다. 운영 DB에는 쓰지 않는다.
//   InMemoryRepo는 서버를 다시 켜면 비워지므로, 이 버튼은 몇 번을 눌러도 같은 결과(다시 만들기)가 나게 짰다.
// 🔑수정 비번 = LOCAL_DRAFT_PASSWORD. 로컬 가짜 로그인은 «보기 전용»이라 소유자로 수정할 수 없어서 비번으로 연다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AutoDraftRequest } from "@/lib/autoDraft";
import { deliverDraft } from "@/lib/autoDraftDeliver";
import { buildLocalDraft } from "@/lib/autoDraftLocal";
import { pushDraftToProd } from "@/lib/autoDraftPush";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");

export async function loadDraftAction(formData: FormData) {
  const slug = await buildLocalDraft(String(formData.get("id") ?? ""));
  redirect(`/m/${slug}`);
}

/** [지금 보내기] — 아침 9시 자동 발송을 기다리지 않고 대표가 바로 넘긴다 → done + 고객 안내 메일 (10-05). */
export async function approveAction(formData: FormData) {
  if (process.env.NODE_ENV !== "development") throw new Error("로컬 개발 서버에서만 쓸 수 있어요.");
  const id = String(formData.get("id") ?? "").replace(/[^0-9a-z-]/gi, "");
  const req = JSON.parse(await readFile(path.join(QUEUE_DIR, `${id}.json`), "utf8")) as AutoDraftRequest;
  if (req.status !== "review") throw new Error("발송 대기 중인 신청이 아니에요.");
  const h = await headers();
  await deliverDraft(id, { origin: `http://${h.get("host") ?? "localhost:3001"}`, approved: true });
  redirect("/dev/auto-draft");
}

/** [운영에 올리고 안내 보내기] — 운영 신청의 초안을 운영에 «비공개 초안»으로 올리고 고객에게 안내 메일(10-08, 2단계).
 *  🔑운영 DB에 쓰는 버튼이다. 대표가 누르는 것 자체가 그 건의 「고고」다 — 예약 작업은 이걸 부르지 않는다. */
export async function pushProdAction(formData: FormData) {
  if (process.env.NODE_ENV !== "development") throw new Error("로컬 개발 서버에서만 쓸 수 있어요.");
  await pushDraftToProd(String(formData.get("id") ?? ""));
  redirect("/dev/auto-draft");
}
