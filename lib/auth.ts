import { isMockAuthEnabled } from "@/lib/env";
import { LINE_GROUP_ID_HEADER } from "@/lib/group-context";
import { findHouseholdByGroupId, upsertHouseholdMember } from "@/lib/households";
import { HttpError } from "@/lib/http";
import { verifyLineIdToken } from "@/lib/line";
import { getSupabase } from "@/lib/supabase";
import type { Member } from "@/lib/types";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

function parseGroupId(request: Request): string | null {
  const raw = request.headers.get(LINE_GROUP_ID_HEADER)?.trim() ?? "";
  if (!raw) {
    return null;
  }
  if (!/^C[a-zA-Z0-9]{8,64}$/.test(raw)) {
    return null;
  }
  return raw;
}

export async function requireMember(request: Request): Promise<Member> {
  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, "請先在 LINE 開啟此應用");
  }

  const identity = await verifyLineIdToken(token);
  const groupId = parseGroupId(request);

  if (!groupId) {
    if (isMockAuthEnabled()) {
      return requireMockMember(identity.sub, identity.name ?? null);
    }
    throw new HttpError(403, "請從家戶群組開啟狗狗管家", {
      code: "missing_group",
    });
  }

  const household = await findHouseholdByGroupId(groupId);
  if (!household) {
    throw new HttpError(403, "請在這個群打「呼叫狗狗」開通家戶", {
      code: "not_activated",
    });
  }

  await upsertHouseholdMember(household.id, identity.sub, identity.name ?? null);

  return {
    lineUserId: identity.sub,
    householdId: household.id,
    displayName: identity.name ?? null,
  };
}

async function requireMockMember(
  lineUserId: string,
  displayName: string | null,
): Promise<Member> {
  const supabase = getSupabase();
  const { data: member, error } = await supabase
    .from("household_members")
    .select("household_id, line_user_id, display_name")
    .eq("line_user_id", lineUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!member) {
    throw new HttpError(403, "本機假登入帳號尚未加入任何家戶", {
      code: "not_activated",
      lineUserId,
    });
  }

  return {
    lineUserId: member.line_user_id,
    householdId: member.household_id,
    displayName: displayName ?? member.display_name,
  };
}
