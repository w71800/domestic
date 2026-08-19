import { activateGroup, unbindGroup } from "@/lib/households";
import type { LineWebhookEvent } from "@/lib/line";
import { replyBillsMenu, replyText } from "@/lib/line";
import { getSupabase } from "@/lib/supabase";

const WEBHOOK_PING_KEYWORD = "ping";
const CALL_COMMANDS = new Set(["呼叫狗狗", "呼叫狗狗管家"]);

const JOIN_WELCOME =
  "在這個群打「呼叫狗狗」就可以開通家戶。之後要記帳單或看列表，也是打這句，汪汪 🐾";
const FOLLOW_GUIDE =
  "記帳單請把我拉進家裡的群組，在群裡打「呼叫狗狗」。這裡是客服用的，汪汪 🐾";
const DM_GUIDE = "請到家戶群組打「呼叫狗狗」。這裡是客服用的，汪汪 🐾";

export async function handleLineEvents(events: LineWebhookEvent[]): Promise<void> {
  for (const event of events) {
    try {
      if (event.type === "follow") {
        if (event.source?.userId) {
          await recordFollow(event.source.userId);
        }
        if (event.replyToken) {
          await replyText(event.replyToken, FOLLOW_GUIDE);
        }
        continue;
      }

      if (event.type === "join" && event.source?.groupId) {
        if (event.replyToken) {
          await replyText(event.replyToken, JOIN_WELCOME);
        }
        continue;
      }

      if (event.type === "leave" && event.source?.groupId) {
        await unbindGroup(event.source.groupId);
        continue;
      }

      if (isCallCommand(event)) {
        if (event.source?.type === "group" && event.source.groupId) {
          const household = await activateGroup(
            event.source.groupId,
            event.source.userId ?? null,
          );
          if (event.replyToken) {
            await replyBillsMenu(event.replyToken, household.id);
          }
          continue;
        }
        if (event.replyToken) {
          await replyText(event.replyToken, DM_GUIDE);
        }
        continue;
      }

      if (isWebhookPing(event) && event.replyToken) {
        await replyText(event.replyToken, "pong 汪汪，webhook 有接到 🐾");
      }
    } catch (error) {
      console.error("處理 LINE webhook 事件失敗", event.type, error);
    }
  }
}

function isWebhookPing(event: LineWebhookEvent): boolean {
  return (
    event.type === "message" &&
    event.message?.type === "text" &&
    event.message.text?.trim().toLowerCase() === WEBHOOK_PING_KEYWORD
  );
}

function isCallCommand(event: LineWebhookEvent): boolean {
  if (event.type !== "message" || event.message?.type !== "text") {
    return false;
  }
  return CALL_COMMANDS.has(normalizeCommandText(event));
}

function normalizeCommandText(event: LineWebhookEvent): string {
  let text = event.message?.text ?? "";
  const mentionees = [...(event.message?.mention?.mentionees ?? [])].sort(
    (a, b) => (b.index ?? 0) - (a.index ?? 0),
  );

  for (const mention of mentionees) {
    if (typeof mention.index !== "number" || typeof mention.length !== "number") {
      continue;
    }
    text = `${text.slice(0, mention.index)}${text.slice(mention.index + mention.length)}`;
  }

  return text
    .replace(/^@\S+\s+/u, "")
    .replace(/\u3000/g, " ")
    .trim();
}

async function recordFollow(lineUserId: string): Promise<void> {
  const { error } = await getSupabase().from("line_follows").upsert({
    line_user_id: lineUserId,
  });
  if (error) {
    throw new Error(error.message);
  }
}
