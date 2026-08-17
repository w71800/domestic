function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少環境變數 ${name}`);
  }
  return value;
}

export function isMockAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.DEV_MOCK_LINE_USER_ID)
  );
}

export function getMockLineUserId(): string {
  return required("DEV_MOCK_LINE_USER_ID");
}

export function getLineChannelId(): string {
  return required("LINE_CHANNEL_ID");
}

export function getLineChannelSecret(): string {
  return required("LINE_CHANNEL_SECRET");
}

export function getLineChannelAccessToken(): string {
  return required("LINE_CHANNEL_ACCESS_TOKEN");
}

export function getLiffId(): string {
  return required("NEXT_PUBLIC_LIFF_ID");
}

export function getSupabaseUrl(): string {
  return required("SUPABASE_URL");
}

export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function getCronSecret(): string {
  return required("CRON_SECRET");
}

export function liffUrl(path = "/"): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    return path;
  }
  const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `https://liff.line.me/${liffId}${suffix}`;
}
