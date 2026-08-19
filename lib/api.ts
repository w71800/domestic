import { LINE_GROUP_ID_HEADER } from "@/lib/group-context";
import { getLineGroupId, isClientMockAuth } from "@/lib/liff";
import type { AccountListResponse, Bill, BillListResponse } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public lineUserId?: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!isClientMockAuth()) {
    const groupId = await getLineGroupId();
    if (groupId) {
      headers.set(LINE_GROUP_ID_HEADER, groupId);
    }
  }

  const response = await fetch(path, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    lineUserId?: string;
  };

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error ?? "請求失敗",
      data.code,
      data.lineUserId,
    );
  }

  return data as T;
}

export function listBillsRequest(token: string) {
  return apiFetch<BillListResponse>("/api/bills", token);
}

export function getBillRequest(token: string, id: string) {
  return apiFetch<Bill>(`/api/bills/${id}`, token);
}

export function createBillRequest(token: string, body: unknown) {
  return apiFetch<Bill>("/api/bills", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateBillRequest(token: string, id: string, body: unknown) {
  return apiFetch<Bill>(`/api/bills/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listAccountsRequest(token: string) {
  return apiFetch<AccountListResponse>("/api/accounts", token);
}

export function saveAccountsRequest(
  token: string,
  accounts: Array<{ type: string; value: string }>,
) {
  return apiFetch<AccountListResponse>("/api/accounts", token, {
    method: "PUT",
    body: JSON.stringify({ accounts }),
  });
}
