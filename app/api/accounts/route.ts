import { listAccounts, parseAccountInputs, saveAccounts } from "@/lib/accounts";
import { requireMember } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const accounts = await listAccounts(member.householdId);
    return Response.json({ accounts });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const member = await requireMember(request);
    const inputs = parseAccountInputs(await request.json());
    const accounts = await saveAccounts(member.householdId, inputs);
    return Response.json({ accounts });
  } catch (error) {
    return jsonError(error);
  }
}
