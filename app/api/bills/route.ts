import { requireMember } from "@/lib/auth";
import { createBill, listBills, parseBillInput } from "@/lib/bills";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const bills = await listBills(member.householdId);
    return Response.json(bills);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    const input = parseBillInput(await request.json(), { allowPaidDate: false });
    const bill = await createBill(member.householdId, member.lineUserId, input);
    return Response.json(bill, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
