import { isIsoDate } from "@/lib/dates";
import { HttpError } from "@/lib/http";
import { getSupabase } from "@/lib/supabase";
import {
  BILL_TYPES,
  type Bill,
  type BillInput,
  type BillListResponse,
  type BillType,
} from "@/lib/types";

const PAID_LOOKBACK_DAYS = 90;

function isBillType(value: unknown): value is BillType {
  return typeof value === "string" && (BILL_TYPES as readonly string[]).includes(value);
}

export function parseBillInput(body: unknown, { allowPaidDate }: { allowPaidDate: boolean }): BillInput {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "資料格式不正確");
  }

  const input = body as Record<string, unknown>;

  if (!isBillType(input.type)) {
    throw new HttpError(400, "請選擇繳費類型");
  }

  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, "金額需為大於 0 的整數");
  }

  if (typeof input.due_date !== "string" || !isIsoDate(input.due_date)) {
    throw new HttpError(400, "請填繳費期限");
  }
  if (typeof input.period_start !== "string" || !isIsoDate(input.period_start)) {
    throw new HttpError(400, "請填計費起始月份");
  }
  if (typeof input.period_end !== "string" || !isIsoDate(input.period_end)) {
    throw new HttpError(400, "請填計費結束月份");
  }
  if (input.period_end < input.period_start) {
    throw new HttpError(400, "計費結束月份不能早於起始月份");
  }

  let paidDate: string | null = null;
  if (allowPaidDate) {
    if (input.paid_date === null || input.paid_date === "") {
      paidDate = null;
    } else if (typeof input.paid_date === "string" && isIsoDate(input.paid_date)) {
      paidDate = input.paid_date;
    } else if (input.paid_date !== undefined) {
      throw new HttpError(400, "繳費日期格式不正確");
    }
  }

  const notes =
    typeof input.notes === "string" ? input.notes.trim().slice(0, 500) || null : null;

  return {
    type: input.type,
    amount,
    due_date: input.due_date,
    paid_date: paidDate,
    period_start: input.period_start,
    period_end: input.period_end,
    notes,
  };
}

export async function listBills(householdId: string): Promise<BillListResponse> {
  const supabase = getSupabase();
  const paidSince = new Date(Date.now() - PAID_LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: unpaid, error: unpaidError } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", householdId)
    .is("paid_date", null)
    .order("due_date", { ascending: true });

  if (unpaidError) {
    throw new Error(unpaidError.message);
  }

  const { data: paid, error: paidError } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", householdId)
    .not("paid_date", "is", null)
    .gte("paid_date", paidSince)
    .order("paid_date", { ascending: false });

  if (paidError) {
    throw new Error(paidError.message);
  }

  return {
    unpaid: (unpaid ?? []) as Bill[],
    paid: (paid ?? []) as Bill[],
  };
}

export async function getBill(householdId: string, id: string): Promise<Bill> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new HttpError(404, "找不到這筆繳費單");
  }

  return data as Bill;
}

export async function createBill(
  householdId: string,
  lineUserId: string,
  input: BillInput,
): Promise<Bill> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bills")
    .insert({
      household_id: householdId,
      ...input,
      paid_date: null,
      updated_by: lineUserId,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Bill;
}

export async function updateBill(
  householdId: string,
  id: string,
  lineUserId: string,
  input: BillInput,
): Promise<Bill> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bills")
    .update({
      ...input,
      updated_by: lineUserId,
    })
    .eq("household_id", householdId)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new HttpError(404, "找不到這筆繳費單");
  }

  return data as Bill;
}
