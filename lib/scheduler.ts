import { sendDueReminders } from "@/lib/reminders";

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const NINE_AM = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

let started = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function shouldStartInternalCron(): boolean {
  if (process.env.DISABLE_INTERNAL_CRON === "true") {
    return false;
  }
  if (process.env.NODE_ENV !== "production") {
    return process.env.ENABLE_INTERNAL_CRON === "true";
  }
  return true;
}

function taipeiWallClock(now = Date.now()) {
  const shifted = new Date(now + TAIPEI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
  };
}

function nextNineAmTaipei(now = Date.now()): number {
  const { year, month, day, hour } = taipeiWallClock(now);
  let target = Date.UTC(year, month, day, NINE_AM, 0, 0, 0) - TAIPEI_OFFSET_MS;
  if (hour >= NINE_AM) {
    target += DAY_MS;
  }
  return target;
}

function isAtOrAfterNineTaipei(now = Date.now()): boolean {
  return taipeiWallClock(now).hour >= NINE_AM;
}

async function tick(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    const result = await sendDueReminders();
    console.info("[reminders]", result);
  } catch (error) {
    console.error("[reminders] 執行失敗", error);
  } finally {
    running = false;
  }
}

function scheduleNext(): void {
  if (timer) {
    clearTimeout(timer);
  }
  const delay = Math.max(nextNineAmTaipei() - Date.now(), 1_000);
  console.info(
    `[reminders] 下次執行約 ${Math.round(delay / 60_000)} 分鐘後（台北 09:00）`,
  );
  timer = setTimeout(() => {
    void tick().finally(() => scheduleNext());
  }, delay);
  timer.unref?.();
}

export function startReminderScheduler(): void {
  if (started) {
    return;
  }
  if (!shouldStartInternalCron()) {
    console.info("[reminders] 內部排程未啟用");
    return;
  }

  started = true;
  if (isAtOrAfterNineTaipei()) {
    void tick();
  }
  scheduleNext();
}
