import { requireMember } from "@/lib/auth";
import { getBill, parseBillInput, updateBill } from "@/lib/bills";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const member = await requireMember(request);
    const { id } = await context.params;
    const bill = await getBill(member.householdId, id);
    return Response.json(bill);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const member = await requireMember(request);
    const { id } = await context.params;
    const input = parseBillInput(await request.json(), { allowPaidDate: true });
    const bill = await updateBill(member.householdId, id, member.lineUserId, input);
    return Response.json(bill);
  } catch (error) {
    return jsonError(error);
  }
}
