import { verifyLineIdToken } from "@/lib/line";
import { HttpError } from "@/lib/http";
import { getSupabase } from "@/lib/supabase";
import type { Member } from "@/lib/types";

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim() || null;
}

export async function requireMember(request: Request): Promise<Member> {
  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, "請先在 LINE 開啟此應用");
  }

  const identity = await verifyLineIdToken(token);
  const supabase = getSupabase();

  const { data: member, error } = await supabase
    .from("household_members")
    .select("household_id, line_user_id, display_name")
    .eq("line_user_id", identity.sub)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!member) {
    throw new HttpError(403, "尚未加入家戶白名單", {
      lineUserId: identity.sub,
    });
  }

  if (identity.name && identity.name !== member.display_name) {
    await supabase
      .from("household_members")
      .update({ display_name: identity.name })
      .eq("line_user_id", identity.sub)
      .eq("household_id", member.household_id);
  }

  return {
    lineUserId: member.line_user_id,
    householdId: member.household_id,
    displayName: identity.name ?? member.display_name,
  };
}
