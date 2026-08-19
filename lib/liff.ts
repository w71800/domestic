"use client";

const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const HOUSEHOLD_STORAGE_KEY = "householdId";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isClientMockAuth(): boolean {
  return process.env.NEXT_PUBLIC_DEV_MOCK_AUTH === "true";
}

export function getPublicLiffId(): string {
  return liffId;
}

let initPromise: Promise<void> | null = null;

function isHouseholdId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function captureHouseholdId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromQuery = new URLSearchParams(window.location.search).get("h")?.trim();
  if (fromQuery && isHouseholdId(fromQuery)) {
    sessionStorage.setItem(HOUSEHOLD_STORAGE_KEY, fromQuery);
    return fromQuery;
  }

  const stored = sessionStorage.getItem(HOUSEHOLD_STORAGE_KEY)?.trim();
  if (stored && isHouseholdId(stored)) {
    return stored;
  }

  return null;
}

export function getHouseholdId(): string | null {
  if (isClientMockAuth()) {
    return null;
  }
  return captureHouseholdId();
}

export async function initLiff(): Promise<void> {
  if (isClientMockAuth()) {
    return;
  }

  if (!liffId) {
    throw new Error("尚未設定 NEXT_PUBLIC_LIFF_ID");
  }

  if (!initPromise) {
    initPromise = import("@line/liff").then(async ({ default: liff }) => {
      captureHouseholdId();
      await liff.init({ liffId });
      captureHouseholdId();
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
      }
    });
  }

  await initPromise;
}

export async function getIdToken(): Promise<string> {
  if (isClientMockAuth()) {
    return "mock";
  }

  const { default: liff } = await import("@line/liff");
  const token = liff.getIDToken();
  if (!token) {
    throw new Error("拿不到 LINE 登入憑證，請確認 LIFF 已勾選 openid");
  }
  return token;
}

export async function scanQrFromCamera(): Promise<string | null> {
  if (isClientMockAuth()) {
    throw new Error("本機假登入無法掃碼，請在 LINE 內開啟，或手動貼上連結");
  }

  const { default: liff } = await import("@line/liff");
  if (typeof liff.scanCodeV2 !== "function") {
    throw new Error("這個環境不支援掃碼，請改為手動貼上連結");
  }

  const result = await liff.scanCodeV2();
  const value = result.value?.trim();
  return value || null;
}
