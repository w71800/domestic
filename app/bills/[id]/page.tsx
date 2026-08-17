"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError, getBillRequest, updateBillRequest } from "@/lib/api";
import type { Bill } from "@/lib/types";
import { BillForm, toBillPayload } from "@/components/bill-form";
import { AppShell, PrimaryLink } from "@/components/app-shell";
import { LiffGate, useLiff } from "@/components/liff-provider";

function EditBillForm({ id }: { id: string }) {
  const router = useRouter();
  const { run } = useLiff();
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    run((token) => getBillRequest(token, id))
      .then((result) => {
        if (!cancelled) {
          setBill(result);
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
  }, [id, run]);

  if (error && !bill) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!bill) {
    return <p className="text-sm text-stone-500">載入帳單中…</p>;
  }

  return (
    <BillForm
      bill={bill}
      submitLabel="儲存"
      error={error}
      pending={pending}
      onSubmit={async (values) => {
        setPending(true);
        setError(null);
        try {
          const updated = await run((token) =>
            updateBillRequest(token, id, toBillPayload(values, true)),
          );
          setBill(updated);
          router.push("/");
          router.refresh();
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 403)) {
            setError(err instanceof Error ? err.message : "儲存失敗");
          }
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

export default function EditBillPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  if (!id) {
    return (
      <LiffGate>
        <AppShell title="編輯繳費單" action={<PrimaryLink href="/">列表</PrimaryLink>}>
          <p className="text-sm text-rose-700">找不到這筆繳費單</p>
        </AppShell>
      </LiffGate>
    );
  }

  return (
    <LiffGate>
      <AppShell title="編輯繳費單" action={<PrimaryLink href="/">列表</PrimaryLink>}>
        <EditBillForm id={id} />
      </AppShell>
    </LiffGate>
  );
}
