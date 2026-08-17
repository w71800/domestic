import { HttpError } from "@/lib/http";
import { getSupabase } from "@/lib/supabase";
import {
  BILL_TYPES,
  type BillType,
  type HouseholdAccount,
} from "@/lib/types";

function isBillType(value: unknown): value is BillType {
  return typeof value === "string" && (BILL_TYPES as readonly string[]).includes(value);
}

export function parseAccountValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "戶號格式不正確");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 64) {
    throw new HttpError(400, "戶號請在 64 字以內");
  }

  return trimmed;
}

export function parseAccountInputs(body: unknown): Array<{ type: BillType; value: string | null }> {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "資料格式不正確");
  }

  const input = body as Record<string, unknown>;
  if (!Array.isArray(input.accounts)) {
    throw new HttpError(400, "請提供戶號列表");
  }

  const seen = new Set<BillType>();
  const parsed: Array<{ type: BillType; value: string | null }> = [];

  for (const row of input.accounts) {
    if (!row || typeof row !== "object") {
      throw new HttpError(400, "戶號資料不正確");
    }
    const item = row as Record<string, unknown>;
    if (!isBillType(item.type)) {
      throw new HttpError(400, "繳費類型不正確");
    }
    if (seen.has(item.type)) {
      throw new HttpError(400, "同一類型請只填一筆戶號");
    }
    seen.add(item.type);
    parsed.push({ type: item.type, value: parseAccountValue(item.value) });
  }

  return parsed;
}

export async function listAccounts(householdId: string): Promise<HouseholdAccount[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("household_accounts")
    .select("household_id, type, value, updated_at")
    .eq("household_id", householdId)
    .order("type", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HouseholdAccount[];
}

export async function saveAccounts(
  householdId: string,
  inputs: Array<{ type: BillType; value: string | null }>,
): Promise<HouseholdAccount[]> {
  const supabase = getSupabase();
  const toUpsert = inputs
    .filter((item): item is { type: BillType; value: string } => item.value !== null)
    .map((item) => ({
      household_id: householdId,
      type: item.type,
      value: item.value,
    }));
  const toDelete = inputs.filter((item) => item.value === null).map((item) => item.type);

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("household_accounts")
      .delete()
      .eq("household_id", householdId)
      .in("type", toDelete);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase.from("household_accounts").upsert(toUpsert, {
      onConflict: "household_id,type",
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  return listAccounts(householdId);
}
