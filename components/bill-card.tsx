import Link from "next/link";
import { daysUntil, formatAmount, formatDate, formatMonthRange, todayInTaipei } from "@/lib/dates";
import { BILL_TYPE_LABELS, type Bill, type BillType } from "@/lib/types";

const TYPE_CLASS: Record<BillType, string> = {
  water: "bg-sky-100 text-sky-800",
  electricity: "bg-amber-100 text-amber-900",
  gas: "bg-orange-100 text-orange-900",
  management: "bg-teal-100 text-teal-900",
  credit_card: "bg-indigo-100 text-indigo-800",
  rent: "bg-rose-100 text-rose-800",
  phone: "bg-violet-100 text-violet-800",
  other: "bg-stone-200 text-stone-800",
};

function dueLabel(bill: Bill): string {
  if (bill.paid_date) {
    return `已繳 ${formatDate(bill.paid_date)}`;
  }

  const days = daysUntil(bill.due_date, todayInTaipei());
  if (days < 0) {
    return `已過期 ${Math.abs(days)} 天`;
  }
  if (days === 0) {
    return "今天到期";
  }
  return `${days} 天後到期`;
}

export function BillCard({ bill }: { bill: Bill }) {
  const overdue = !bill.paid_date && daysUntil(bill.due_date, todayInTaipei()) < 0;

  return (
    <Link
      href={`/bills/${bill.id}`}
      className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TYPE_CLASS[bill.type]}`}>
          {BILL_TYPE_LABELS[bill.type]}
        </span>
        <span className={`text-xs ${overdue ? "font-medium text-rose-700" : "text-stone-500"}`}>
          {dueLabel(bill)}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
        {formatAmount(bill.amount)}
        <span className="ml-1 text-sm font-medium text-stone-500">元</span>
      </p>
      <p className="mt-2 text-sm text-stone-600">
        期限 {formatDate(bill.due_date)} · 計費 {formatMonthRange(bill.period_start, bill.period_end)}
      </p>
      {bill.payment_url ? (
        <p className="mt-1 text-sm font-medium text-teal-800">含繳費連結</p>
      ) : null}
      {bill.notes ? <p className="mt-1 truncate text-sm text-stone-500">{bill.notes}</p> : null}
    </Link>
  );
}
