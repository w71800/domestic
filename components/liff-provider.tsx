"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api";
import { getIdToken, initLiff, isClientMockAuth } from "@/lib/liff";

type LiffStatus = "loading" | "ready" | "error";

type LiffContextValue = {
  status: LiffStatus;
  errorMessage: string | null;
  unauthorizedUserId: string | null;
  getToken: () => Promise<string>;
  run: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
};

const LiffContext = createContext<LiffContextValue | null>(null);

export function LiffProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LiffStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorizedUserId, setUnauthorizedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    initLiff()
      .then(() => {
        if (!cancelled) {
          setStatus("ready");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "無法初始化 LINE");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const getToken = useCallback(() => getIdToken(), []);

  const run = useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      try {
        const token = await getToken();
        return await fn(token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          setUnauthorizedUserId(error.lineUserId ?? null);
          setErrorMessage(error.message);
        }
        throw error;
      }
    },
    [getToken],
  );

  const value = useMemo(
    () => ({ status, errorMessage, unauthorizedUserId, getToken, run }),
    [status, errorMessage, unauthorizedUserId, getToken, run],
  );

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>;
}

export function useLiff(): LiffContextValue {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error("useLiff 必須在 LiffProvider 內使用");
  }
  return context;
}

export function LiffGate({ children }: { children: ReactNode }) {
  const { status, errorMessage, unauthorizedUserId } = useLiff();

  if (status === "loading") {
    return <CenteredMessage title="載入中" body="正在連接 LINE…" />;
  }

  if (unauthorizedUserId) {
    return (
      <CenteredMessage
        title="尚未加入家戶"
        body="把下面的 LINE userId 加進 household_members 後再重新開啟。"
      >
        <code className="mt-4 block break-all rounded-xl bg-stone-200 px-3 py-2 text-sm">
          {unauthorizedUserId}
        </code>
      </CenteredMessage>
    );
  }

  if (status === "error") {
    return (
      <CenteredMessage title="無法開啟" body={errorMessage ?? "請稍後再試"} />
    );
  }

  return (
    <>
      {isClientMockAuth() ? (
        <p className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900">
          本機假登入模式，未走 LINE LIFF
        </p>
      ) : null}
      {children}
    </>
  );
}

function CenteredMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
        {children}
      </div>
    </div>
  );
}
