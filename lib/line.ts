import { createHmac, timingSafeEqual } from "node:crypto";
import { addDays, formatAmount, formatDate, formatMonthRange, todayInTaipei } from "@/lib/dates";
import {
  getLineChannelAccessToken,
  getLineChannelId,
  getLineChannelSecret,
  isMockAuthEnabled,
  getMockLineUserId,
  liffUrl,
} from "@/lib/env";
import { HttpError } from "@/lib/http";
import { BILL_TYPE_LABELS, type Bill, type ReminderKind } from "@/lib/types";
import { isHttpUrl } from "@/lib/urls";

type LineIdTokenPayload = {
  sub: string;
  name?: string;
};

export type LineEventSource = {
  type?: string;
  userId?: string;
  groupId?: string;
  roomId?: string;
};

export type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  source?: LineEventSource;
  message?: {
    type?: string;
    text?: string;
    mention?: {
      mentionees?: Array<{
        index?: number;
        length?: number;
        userId?: string;
        type?: string;
      }>;
    };
  };
};

type FlexBubble = {
  type: "bubble";
  body: Record<string, unknown>;
  footer: Record<string, unknown>;
};

export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
  if (isMockAuthEnabled() && idToken === "mock") {
    return { sub: getMockLineUserId(), name: "本機開發" };
  }

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: getLineChannelId(),
  });

  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as LineIdTokenPayload & {
    error_description?: string;
  };

  if (!response.ok || !payload.sub) {
    throw new HttpError(401, payload.error_description ?? "LINE 登入已過期，請重新開啟");
  }

  return payload;
}

export function verifyLineWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const digest = createHmac("sha256", getLineChannelSecret()).update(rawBody).digest("base64");
  const expected = Buffer.from(digest);
  const actual = Buffer.from(signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function getGroupSummary(
  groupId: string,
): Promise<{ groupName: string } | null> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${encodeURIComponent(groupId)}/summary`,
      {
        headers: {
          Authorization: `Bearer ${getLineChannelAccessToken()}`,
        },
      },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { groupName?: string };
    const groupName = payload.groupName?.trim();
    return groupName ? { groupName } : null;
  } catch {
    return null;
  }
}

async function lineFetch(path: string, body: unknown): Promise<void> {
  const response = await fetch(`https://api.line.me${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getLineChannelAccessToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE API ${path} 失敗：${response.status} ${text}`);
  }
}

export async function replyText(replyToken: string, text: string): Promise<void> {
  await lineFetch("/v2/bot/message/reply", {
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export async function replyBillsMenu(replyToken: string, householdId: string): Promise<void> {
  await lineFetch("/v2/bot/message/reply", {
    replyToken,
    messages: [
      {
        type: "flex",
        altText: "帳單：查看列表或新增",
        contents: toBillsMenuBubble(householdId),
      },
    ],
  });
}

export async function pushFlexToGroup(groupId: string, bills: Bill[]): Promise<void> {
  if (bills.length === 0) {
    return;
  }

  const bubbles = bills.slice(0, 12).map(toReminderBubble);
  const contents =
    bubbles.length === 1
      ? bubbles[0]
      : { type: "carousel", contents: bubbles };

  const first = bills[0];
  const altText = `${BILL_TYPE_LABELS[first.type]} ${formatAmount(first.amount)} 元即將到期`;

  await lineFetch("/v2/bot/message/push", {
    to: groupId,
    messages: [
      {
        type: "flex",
        altText: bills.length > 1 ? `有 ${bills.length} 筆繳費單即將到期` : altText,
        contents,
      },
    ],
  });
}

function reminderHeadline(bill: Bill): string {
  const today = todayInTaipei();
  if (bill.due_date === today) {
    return "今天到期";
  }
  if (bill.due_date === addDays(today, 3)) {
    return "3 天後到期";
  }
  if (bill.due_date === addDays(today, 7)) {
    return "7 天後到期";
  }
  return "繳費提醒";
}

function toBillsMenuBubble(householdId: string): FlexBubble {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "帳單",
          weight: "bold",
          size: "xl",
        },
        {
          type: "text",
          text: "要查看列表，還是新增一筆？",
          size: "sm",
          color: "#666666",
          wrap: true,
          margin: "md",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#0f766e",
          action: {
            type: "uri",
            label: "查看帳單列表",
            uri: liffUrl("/", householdId),
          },
        },
        {
          type: "button",
          style: "secondary",
          action: {
            type: "uri",
            label: "新增帳單",
            uri: liffUrl("/new", householdId),
          },
        },
      ],
    },
  };
}

function toReminderBubble(bill: Bill): FlexBubble {
  const footerButtons: Record<string, unknown>[] = [];

  if (bill.payment_url && isHttpUrl(bill.payment_url)) {
    footerButtons.push({
      type: "button",
      style: "primary",
      color: "#0f766e",
      action: {
        type: "uri",
        label: "去繳費",
        uri: bill.payment_url,
      },
    });
  }

  footerButtons.push(
    {
      type: "button",
      style: bill.payment_url ? "secondary" : "primary",
      color: bill.payment_url ? undefined : "#0f766e",
      action: {
        type: "uri",
        label: "查看這筆",
        uri: liffUrl(`/bills/${bill.id}`, bill.household_id),
      },
    },
    {
      type: "button",
      style: "secondary",
      action: {
        type: "uri",
        label: "列表",
        uri: liffUrl("/", bill.household_id),
      },
    },
  );

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: reminderHeadline(bill),
          size: "sm",
          color: "#888888",
        },
        {
          type: "text",
          text: BILL_TYPE_LABELS[bill.type],
          weight: "bold",
          size: "xl",
          margin: "md",
        },
        {
          type: "text",
          text: `${formatAmount(bill.amount)} 元`,
          size: "lg",
          margin: "sm",
        },
        {
          type: "text",
          text: `期限 ${formatDate(bill.due_date)} · 計費 ${formatMonthRange(bill.period_start, bill.period_end)}`,
          size: "sm",
          color: "#666666",
          wrap: true,
          margin: "md",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerButtons,
    },
  };
}

export function reminderKindForDueDate(dueDate: string, today = todayInTaipei()): ReminderKind | null {
  if (dueDate === today) {
    return "d0";
  }
  if (dueDate === addDays(today, 3)) {
    return "d3";
  }
  if (dueDate === addDays(today, 7)) {
    return "d7";
  }
  return null;
}
