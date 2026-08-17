import { addDays, todayInTaipei } from "@/lib/dates";
import { pushFlexToGroup, reminderKindForDueDate } from "@/lib/line";
import { getSupabase } from "@/lib/supabase";
import type { Bill, ReminderKind } from "@/lib/types";

type ReminderResult = {
  sent: number;
  skippedNoGroup: number;
  skippedAlreadySent: number;
  errors: string[];
};

export async function sendDueReminders(): Promise<ReminderResult> {
  const supabase = getSupabase();
  const today = todayInTaipei();
  const dueDates = [today, addDays(today, 3), addDays(today, 7)];

  const { data: bills, error: billsError } = await supabase
    .from("bills")
    .select("*")
    .is("paid_date", null)
    .in("due_date", dueDates);

  if (billsError) {
    throw new Error(billsError.message);
  }

  const candidates = (bills ?? []) as Bill[];
  const result: ReminderResult = {
    sent: 0,
    skippedNoGroup: 0,
    skippedAlreadySent: 0,
    errors: [],
  };

  if (candidates.length === 0) {
    return result;
  }

  const billIds = candidates.map((bill) => bill.id);
  const { data: logs, error: logsError } = await supabase
    .from("reminder_logs")
    .select("bill_id, kind")
    .in("bill_id", billIds);

  if (logsError) {
    throw new Error(logsError.message);
  }

  const sentKeys = new Set(
    (logs ?? []).map((log) => `${log.bill_id}:${log.kind as ReminderKind}`),
  );

  const pending = candidates.filter((bill) => {
    const kind = reminderKindForDueDate(bill.due_date, today);
    if (!kind) {
      return false;
    }
    if (sentKeys.has(`${bill.id}:${kind}`)) {
      result.skippedAlreadySent += 1;
      return false;
    }
    return true;
  });

  const householdIds = [...new Set(pending.map((bill) => bill.household_id))];
  const { data: households, error: householdError } = await supabase
    .from("households")
    .select("id, line_group_id")
    .in("id", householdIds);

  if (householdError) {
    throw new Error(householdError.message);
  }

  const groupByHousehold = new Map(
    (households ?? []).map((row) => [row.id as string, row.line_group_id as string | null]),
  );

  const grouped = new Map<string, Bill[]>();
  for (const bill of pending) {
    const groupId = groupByHousehold.get(bill.household_id);
    if (!groupId) {
      result.skippedNoGroup += 1;
      result.errors.push(`家戶 ${bill.household_id} 尚未綁定群組，略過帳單 ${bill.id}`);
      continue;
    }
    const list = grouped.get(groupId) ?? [];
    list.push(bill);
    grouped.set(groupId, list);
  }

  for (const [groupId, groupBills] of grouped) {
    try {
      await pushFlexToGroup(groupId, groupBills);
      const rows = groupBills
        .map((bill) => {
          const kind = reminderKindForDueDate(bill.due_date, today);
          return kind ? { bill_id: bill.id, kind } : null;
        })
        .filter((row): row is { bill_id: string; kind: ReminderKind } => row !== null);

      const { error: insertError } = await supabase
        .from("reminder_logs")
        .upsert(rows, { onConflict: "bill_id,kind", ignoreDuplicates: true });

      if (insertError) {
        result.errors.push(`已推播但寫入紀錄失敗：${insertError.message}`);
      }

      result.sent += groupBills.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知錯誤";
      result.errors.push(`推播群組 ${groupId} 失敗：${message}`);
    }
  }

  return result;
}
