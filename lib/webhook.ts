import { getSupabase } from "@/lib/supabase";
import type { LineWebhookEvent } from "@/lib/line";
import { replyText } from "@/lib/line";

export async function handleLineEvents(events: LineWebhookEvent[]): Promise<void> {
  for (const event of events) {
    try {
      if (event.type === "follow" && event.source?.userId) {
        await recordFollow(event.source.userId);
        continue;
      }

      if (event.type === "join" && event.source?.groupId) {
        await bindGroupId(event.source.groupId);
        if (event.replyToken) {
          await replyText(
            event.replyToken,
            "已加入家戶繳費提醒。請用官方帳號圖文選單開啟列表或新增；到期提醒會打到這個群組。",
          );
        }
        continue;
      }

      if (event.source?.type === "group" && event.source.groupId) {
        await bindGroupId(event.source.groupId);
      }
    } catch (error) {
      console.error("處理 LINE webhook 事件失敗", event.type, error);
    }
  }
}

async function recordFollow(lineUserId: string): Promise<void> {
  const { error } = await getSupabase().from("line_follows").upsert({
    line_user_id: lineUserId,
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function bindGroupId(groupId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: household, error } = await supabase
    .from("households")
    .select("id, line_group_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!household) {
    return;
  }
  if (household.line_group_id && household.line_group_id !== groupId) {
    console.warn("家戶已綁定其他群組，略過", household.line_group_id, groupId);
    return;
  }
  if (household.line_group_id === groupId) {
    return;
  }

  const { error: updateError } = await supabase
    .from("households")
    .update({ line_group_id: groupId })
    .eq("id", household.id)
    .is("line_group_id", null);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
