import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { ACCOUNT_LABELS, isAccountType, type Bill, type HouseholdAccount } from "@/lib/types";

export function BillPayPanel({
  bill,
  account,
}: {
  bill: Bill;
  account: HouseholdAccount | null;
}) {
  const accountLabel = isAccountType(bill.type) ? ACCOUNT_LABELS[bill.type] : null;
  if (!accountLabel && !bill.payment_url) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
      {accountLabel ? (
        account ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-700">{accountLabel}</p>
              <p className="mt-1 break-all font-mono text-lg tracking-wide text-stone-900">
                {account.value}
              </p>
            </div>
            <CopyButton value={account.value} />
          </div>
        ) : (
          <p className="text-sm leading-6 text-stone-600">
            尚未設定{accountLabel}。
            <Link href="/accounts" className="ml-1 font-medium text-teal-800">
              去家戶資料填寫
            </Link>
          </p>
        )
      ) : null}

      {bill.payment_url ? (
        <a
          href={bill.payment_url}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex w-full items-center justify-center rounded-full bg-teal-800 px-4 py-3 text-sm font-medium text-white ${accountLabel ? "mt-3" : ""}`}
        >
          去繳費
        </a>
      ) : null}
    </div>
  );
}
