export const BILL_TYPES = [
  "water",
  "electricity",
  "gas",
  "management",
  "credit_card",
  "rent",
  "phone",
  "other",
] as const;

export type BillType = (typeof BILL_TYPES)[number];

export const ACCOUNT_TYPES = [
  "water",
  "electricity",
  "gas",
  "management",
  "other",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  water: "水費",
  electricity: "電費",
  gas: "瓦斯",
  management: "管理費",
  credit_card: "信用卡",
  rent: "房租",
  phone: "電話費",
  other: "其他",
};

export const ACCOUNT_LABELS: Record<AccountType, string> = {
  water: "水號",
  electricity: "電號",
  gas: "瓦斯戶號",
  management: "管理費戶號",
  other: "戶號",
};

export function isAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value);
}

export const REMINDER_KINDS = ["d7", "d3", "d0"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export type Bill = {
  id: string;
  household_id: string;
  type: BillType;
  amount: number;
  due_date: string;
  paid_date: string | null;
  period_start: string;
  period_end: string;
  notes: string | null;
  payment_url: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillInput = {
  type: BillType;
  amount: number;
  due_date: string;
  paid_date: string | null;
  period_start: string;
  period_end: string;
  notes: string | null;
  payment_url: string | null;
};

export type Member = {
  lineUserId: string;
  householdId: string;
  displayName: string | null;
};

export type BillListResponse = {
  unpaid: Bill[];
  paid: Bill[];
};

export type HouseholdAccount = {
  household_id: string;
  type: BillType;
  value: string;
  updated_at: string;
};

export type AccountListResponse = {
  accounts: HouseholdAccount[];
};
