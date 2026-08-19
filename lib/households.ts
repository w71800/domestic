import { getGroupSummary } from "@/lib/line";
import { getSupabase } from "@/lib/supabase";

const FALLBACK_HOUSEHOLD_NAME = "未命名家戶";

export type HouseholdRow = {
  id: string;
  name: string;
  line_group_id: string | null;
  last_line_group_id: string | null;
  unbound_at: string | null;
};

function asHousehold(row: HouseholdRow): HouseholdRow {
  return row;
}

export async function findHouseholdByGroupId(groupId: string): Promise<HouseholdRow | null> {
  const supabase = getSupabase();

  const { data: current, error: currentError } = await supabase
    .from("households")
    .select("id, name, line_group_id, last_line_group_id, unbound_at")
    .eq("line_group_id", groupId)
    .maybeSingle();

  if (currentError) {
    throw new Error(currentError.message);
  }
  if (current) {
    return asHousehold(current as HouseholdRow);
  }

  const { data: previous, error: previousError } = await supabase
    .from("households")
    .select("id, name, line_group_id, last_line_group_id, unbound_at")
    .eq("last_line_group_id", groupId)
    .is("line_group_id", null)
    .maybeSingle();

  if (previousError) {
    throw new Error(previousError.message);
  }

  return previous ? asHousehold(previous as HouseholdRow) : null;
}

export async function upsertHouseholdMember(
  householdId: string,
  lineUserId: string,
  displayName: string | null,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = displayName
    ? await supabase.from("household_members").upsert(
        {
          household_id: householdId,
          line_user_id: lineUserId,
          display_name: displayName,
        },
        { onConflict: "household_id,line_user_id" },
      )
    : await supabase.from("household_members").upsert(
        {
          household_id: householdId,
          line_user_id: lineUserId,
        },
        { onConflict: "household_id,line_user_id", ignoreDuplicates: true },
      );

  if (error) {
    throw new Error(error.message);
  }
}

export async function activateGroup(
  groupId: string,
  lineUserId: string | null,
): Promise<HouseholdRow> {
  const existing = await findHouseholdByGroupId(groupId);
  if (existing) {
    const household = existing.line_group_id
      ? existing
      : await rebindGroup(existing.id, groupId);
    if (lineUserId) {
      await upsertHouseholdMember(household.id, lineUserId, null);
    }
    return household;
  }

  const unbound = await listUnboundHouseholds();
  if (unbound.length === 1) {
    const bound = await tryBindUnboundHousehold(unbound[0].id, groupId);
    if (bound) {
      if (lineUserId) {
        await upsertHouseholdMember(bound.id, lineUserId, null);
      }
      return bound;
    }

    const raced = await findHouseholdByGroupId(groupId);
    if (raced) {
      if (lineUserId) {
        await upsertHouseholdMember(raced.id, lineUserId, null);
      }
      return raced;
    }
  }

  return createHouseholdForGroup(groupId, lineUserId);
}

export async function unbindGroup(groupId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("households")
    .update({
      last_line_group_id: groupId,
      line_group_id: null,
      unbound_at: new Date().toISOString(),
    })
    .eq("line_group_id", groupId);

  if (error) {
    throw new Error(error.message);
  }
}

async function listUnboundHouseholds(): Promise<HouseholdRow[]> {
  const { data, error } = await getSupabase()
    .from("households")
    .select("id, name, line_group_id, last_line_group_id, unbound_at")
    .is("line_group_id", null)
    .is("last_line_group_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HouseholdRow[];
}

async function tryBindUnboundHousehold(householdId: string, groupId: string): Promise<HouseholdRow | null> {
  const { data, error } = await getSupabase()
    .from("households")
    .update({
      line_group_id: groupId,
      last_line_group_id: groupId,
      unbound_at: null,
    })
    .eq("id", householdId)
    .is("line_group_id", null)
    .select("id, name, line_group_id, last_line_group_id, unbound_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return null;
    }
    throw new Error(error.message);
  }

  return data ? asHousehold(data as HouseholdRow) : null;
}

async function rebindGroup(householdId: string, groupId: string): Promise<HouseholdRow> {
  const { data, error } = await getSupabase()
    .from("households")
    .update({
      line_group_id: groupId,
      last_line_group_id: groupId,
      unbound_at: null,
    })
    .eq("id", householdId)
    .select("id, name, line_group_id, last_line_group_id, unbound_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asHousehold(data as HouseholdRow);
}

async function createHouseholdForGroup(
  groupId: string,
  lineUserId: string | null,
): Promise<HouseholdRow> {
  const summary = await getGroupSummary(groupId);
  const name = summary?.groupName?.trim() || FALLBACK_HOUSEHOLD_NAME;

  const { data, error } = await getSupabase()
    .from("households")
    .insert({
      name,
      line_group_id: groupId,
      last_line_group_id: groupId,
    })
    .select("id, name, line_group_id, last_line_group_id, unbound_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await findHouseholdByGroupId(groupId);
      if (existing) {
        if (lineUserId) {
          await upsertHouseholdMember(existing.id, lineUserId, null);
        }
        return existing;
      }
    }
    throw new Error(error.message);
  }

  const household = asHousehold(data as HouseholdRow);
  if (lineUserId) {
    await upsertHouseholdMember(household.id, lineUserId, null);
  }
  return household;
}
