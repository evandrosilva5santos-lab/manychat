import { NextResponse } from "next/server";
import { parseCallbackRequest } from "@/lib/meta/signed-request";
import { disconnectAccount, findAccountsForCallback } from "@/lib/meta/account-lifecycle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/meta/deauthorize — callback da Meta quando o usuário remove o app. */
export async function POST(request: Request) {
  const parsed = await parseCallbackRequest(request);
  if (!parsed.ok) {
    console.warn(`[meta/deauthorize] pedido recusado: ${parsed.reason}`);
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const accountIds = await findAccountsForCallback(parsed.data);
  if (!accountIds) {
    console.warn("[meta/deauthorize] pedido recusado: too_many_accounts");
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  for (const id of accountIds) {
    await disconnectAccount(id, { reason: "META_DEAUTHORIZE", notifyMeta: false });
  }
  return NextResponse.json({ ok: true });
}
