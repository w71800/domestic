"use client";

const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

export function isClientMockAuth(): boolean {
  return process.env.NEXT_PUBLIC_DEV_MOCK_AUTH === "true";
}

export function getPublicLiffId(): string {
  return liffId;
}

let initPromise: Promise<void> | null = null;

export async function initLiff(): Promise<void> {
  if (isClientMockAuth()) {
    return;
  }

  if (!liffId) {
    throw new Error("尚未設定 NEXT_PUBLIC_LIFF_ID");
  }

  if (!initPromise) {
    initPromise = import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId });
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

export async function getLineGroupId(): Promise<string | null> {
  if (isClientMockAuth()) {
    return null;
  }

  const { default: liff } = await import("@line/liff");
  const context = liff.getContext();
  if (context?.type === "group" && context.groupId) {
    return context.groupId;
  }
  return null;
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
