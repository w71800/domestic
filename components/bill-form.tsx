"use client";

import { useState, type FormEvent } from "react";
import { dateToMonth, monthToDate, todayInTaipei } from "@/lib/dates";
import { scanQrFromCamera } from "@/lib/liff";
import { BILL_TYPE_LABELS, BILL_TYPES, type Bill, type BillType } from "@/lib/types";
import { isHttpUrl } from "@/lib/urls";
import { PrimaryButton, SecondaryButton } from "@/components/app-shell";

export type BillFormValues = {
  type: BillType;
  amount: string;
  due_date: string;
  period_start: string;
  period_end: string;
  notes: string;
  paid_date: string;
  payment_url: string;
};

function fromBill(bill?: Bill): BillFormValues {
  const thisMonth = dateToMonth(todayInTaipei());
  return {
    type: bill?.type ?? "electricity",
    amount: bill ? String(bill.amount) : "",
    due_date: bill?.due_date ?? "",
    period_start: bill ? dateToMonth(bill.period_start) : thisMonth,
    period_end: bill ? dateToMonth(bill.period_end) : thisMonth,
    notes: bill?.notes ?? "",
    paid_date: bill?.paid_date ?? "",
    payment_url: bill?.payment_url ?? "",
  };
}

export function toBillPayload(values: BillFormValues, includePaidDate: boolean) {
  return {
    type: values.type,
    amount: Number(values.amount),
    due_date: values.due_date,
    period_start: monthToDate(values.period_start),
    period_end: monthToDate(values.period_end),
    notes: values.notes.trim() || null,
    payment_url: values.payment_url.trim() || null,
    ...(includePaidDate ? { paid_date: values.paid_date || null } : {}),
  };
}

export function BillForm({
  bill,
  submitLabel,
  error,
  pending,
  onSubmit,
}: {
  bill?: Bill;
  submitLabel: string;
  error: string | null;
  pending: boolean;
  onSubmit: (values: BillFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<BillFormValues>(() => fromBill(bill));
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  async function markPaidToday() {
    const next = { ...values, paid_date: todayInTaipei() };
    setValues(next);
    await onSubmit(next);
  }

  async function scanPaymentQr() {
    setScanError(null);
    setScanning(true);
    try {
      const value = await scanQrFromCamera();
      if (!value) {
        return;
      }
      if (!isHttpUrl(value)) {
        setScanError("掃到的不是網址。請改掃繳費頁的 QR，或手動貼上連結。");
        return;
      }
      setValues((current) => ({ ...current, payment_url: value }));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "掃碼失敗");
    } finally {
      setScanning(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">類型</span>
        <select
          className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
          value={values.type}
          onChange={(event) =>
            setValues({ ...values, type: event.target.value as BillType })
          }
        >
          {BILL_TYPES.map((type) => (
            <option key={type} value={type}>
              {BILL_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">金額</span>
        <input
          required
          inputMode="numeric"
          className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
          value={values.amount}
          onChange={(event) => setValues({ ...values, amount: event.target.value })}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">繳費期限</span>
        <input
          required
          type="date"
          className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
          value={values.due_date}
          onChange={(event) => setValues({ ...values, due_date: event.target.value })}
        />
      </label>

      <div className="grid min-w-0 grid-cols-1 gap-4">
        <label className="block min-w-0">
          <span className="mb-1 block text-sm font-medium text-stone-700">計費起</span>
          <input
            required
            type="month"
            className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
            value={values.period_start}
            onChange={(event) =>
              setValues({ ...values, period_start: event.target.value })
            }
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-sm font-medium text-stone-700">計費迄</span>
          <input
            required
            type="month"
            className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
            value={values.period_end}
            onChange={(event) =>
              setValues({ ...values, period_end: event.target.value })
            }
          />
        </label>
      </div>

      {bill ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">繳費日期</span>
          <input
            type="date"
            className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
            value={values.paid_date}
            onChange={(event) => setValues({ ...values, paid_date: event.target.value })}
          />
        </label>
      ) : null}

      <div className="min-w-0">
        <label className="block min-w-0">
          <span className="mb-1 block text-sm font-medium text-stone-700">繳費連結</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
            value={values.payment_url}
            onChange={(event) => setValues({ ...values, payment_url: event.target.value })}
          />
        </label>
        <div className="mt-2">
          <SecondaryButton disabled={pending || scanning} onClick={() => void scanPaymentQr()}>
            {scanning ? "開啟相機…" : "相機掃 QR"}
          </SecondaryButton>
        </div>
        {scanError ? <p className="mt-2 text-sm text-rose-700">{scanError}</p> : null}
        <p className="mt-2 text-xs leading-5 text-stone-500">
          在 LINE 內開啟、LIFF 設為 Full 並開啟 Scan QR 才能掃碼。台灣帳單若是轉帳碼而非網址，請改手貼繳費頁連結。
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-stone-700">備註</span>
        <textarea
          rows={3}
          className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
          value={values.notes}
          onChange={(event) => setValues({ ...values, notes: event.target.value })}
        />
      </label>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="space-y-2 pt-2">
        {bill ? (
          <SecondaryButton disabled={pending} onClick={() => void markPaidToday()}>
            標記今天已繳
          </SecondaryButton>
        ) : null}
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "儲存中…" : submitLabel}
        </PrimaryButton>
      </div>
    </form>
  );
}
