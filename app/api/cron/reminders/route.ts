import { getCronSecret } from "@/lib/env";
import { jsonError, HttpError } from "@/lib/http";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function authorizeCron(request: Request): void {
  const expected = `Bearer ${getCronSecret()}`;
  const actual = request.headers.get("authorization");
  if (actual !== expected) {
    throw new HttpError(401, "未授權的排程呼叫");
  }
}

async function run(request: Request) {
  try {
    authorizeCron(request);
    const result = await sendDueReminders();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
