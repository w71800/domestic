"use client";

import { useEffect, useState } from "react";
import { ApiError, listBillsRequest } from "@/lib/api";
import type { BillListResponse } from "@/lib/types";
import { AppShell, PrimaryLink } from "@/components/app-shell";
import { BillCard } from "@/components/bill-card";
import { LiffGate, useLiff } from "@/components/liff-provider";

function BillList() {
  const { run } = useLiff();
  const [data, setData] = useState<BillListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    run((token) => listBillsRequest(token))
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
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

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-stone-500">載入帳單中…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-stone-500">未繳</h2>
        {data.unpaid.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-stone-500 shadow-sm">
            目前沒有未繳帳單
          </p>
        ) : (
          data.unpaid.map((bill) => <BillCard key={bill.id} bill={bill} />)
        )}
      </section>

      {data.paid.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-stone-500">近期已繳</h2>
          {data.paid.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <LiffGate>
      <AppShell title="繳費單" action={<PrimaryLink href="/new">新增</PrimaryLink>}>
        <BillList />
      </AppShell>
    </LiffGate>
  );
}
