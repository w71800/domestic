"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, listAccountsRequest, saveAccountsRequest } from "@/lib/api";
import { ACCOUNT_LABELS, BILL_TYPE_LABELS, BILL_TYPES, type BillType } from "@/lib/types";
import { AppShell, PrimaryButton, PrimaryLink } from "@/components/app-shell";
import { LiffGate, useLiff } from "@/components/liff-provider";

type AccountFormValues = Record<BillType, string>;

function emptyValues(): AccountFormValues {
  return {
    water: "",
    electricity: "",
    gas: "",
    management: "",
    other: "",
  };
}

function AccountsForm() {
  const { run } = useLiff();
  const [values, setValues] = useState<AccountFormValues>(emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    run((token) => listAccountsRequest(token))
      .then((result) => {
        if (cancelled) {
          return;
        }
        const next = emptyValues();
        for (const account of result.accounts) {
          next[account.type] = account.value;
        }
        setValues(next);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled && !(err instanceof ApiError && err.status === 403)) {
          setError(err instanceof Error ? err.message : "載入失敗");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [run]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const result = await run((token) =>
        saveAccountsRequest(
          token,
          BILL_TYPES.map((type) => ({ type, value: values[type] })),
        ),
      );
      const next = emptyValues();
      for (const account of result.accounts) {
        next[account.type] = account.value;
      }
      setValues(next);
      setSaved(true);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 403)) {
        setError(err instanceof Error ? err.message : "儲存失敗");
      }
    } finally {
      setPending(false);
    }
  }

  if (error && !loaded) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!loaded) {
    return <p className="text-sm text-stone-500">載入家戶資料中…</p>;
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="min-w-0 space-y-4">
      <p className="text-sm leading-6 text-stone-600">
        這些號碼每期共用。繳費時到帳單頁即可複製，不必每月重填。
      </p>

      {BILL_TYPES.map((type) => (
        <label key={type} className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">
            {ACCOUNT_LABELS[type]}
            <span className="ml-1 font-normal text-stone-500">（{BILL_TYPE_LABELS[type]}）</span>
          </span>
          <input
            inputMode="text"
            autoComplete="off"
            className="box-border w-full min-w-0 max-w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-base"
            value={values[type]}
            onChange={(event) => setValues({ ...values, [type]: event.target.value })}
          />
        </label>
      ))}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {saved ? <p className="text-sm text-teal-800">已儲存</p> : null}

      <div className="pt-2">
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "儲存中…" : "儲存戶號"}
        </PrimaryButton>
      </div>
    </form>
  );
}

export default function AccountsPage() {
  return (
    <LiffGate>
      <AppShell title="家戶資料" action={<PrimaryLink href="/">列表</PrimaryLink>}>
        <AccountsForm />
      </AppShell>
    </LiffGate>
  );
}
