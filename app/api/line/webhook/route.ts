import { jsonError, HttpError } from "@/lib/http";
import { verifyLineWebhookSignature, type LineWebhookEvent } from "@/lib/line";
import { handleLineEvents } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!verifyLineWebhookSignature(rawBody, signature)) {
      throw new HttpError(401, "webhook 簽章不正確");
    }

    const payload = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
    await handleLineEvents(payload.events ?? []);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
