export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parsePaymentUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 2000) {
    throw new Error("繳費連結過長");
  }
  if (!isHttpUrl(trimmed)) {
    throw new Error("繳費連結需為 http 或 https 網址");
  }
  return trimmed;
}
