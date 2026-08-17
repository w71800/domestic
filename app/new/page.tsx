"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createBillRequest } from "@/lib/api";
import { BillForm, toBillPayload } from "@/components/bill-form";
import { AppShell, PrimaryLink } from "@/components/app-shell";
import { LiffGate, useLiff } from "@/components/liff-provider";

function NewBillForm() {
  const router = useRouter();
  const { run } = useLiff();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <BillForm
      submitLabel="新增繳費單"
      error={error}
      pending={pending}
      onSubmit={async (values) => {
        setPending(true);
        setError(null);
        try {
          await run((token) => createBillRequest(token, toBillPayload(values, false)));
          router.push("/");
          router.refresh();
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 403)) {
            setError(err instanceof Error ? err.message : "新增失敗");
          }
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

export default function NewBillPage() {
  return (
    <LiffGate>
      <AppShell title="新增繳費單" action={<PrimaryLink href="/">列表</PrimaryLink>}>
        <NewBillForm />
      </AppShell>
    </LiffGate>
  );
}
