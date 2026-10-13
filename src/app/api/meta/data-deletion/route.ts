import { createHash, randomBytes } from "crypto";
import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/meta/oauth";
import { parseCallbackRequest } from "@/lib/meta/signed-request";
import { findAccountsForCallback, runDeletion } from "@/lib/meta/account-lifecycle";
import { isUniqueViolation } from "@/lib/queue/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** POST /api/meta/data-deletion — callback de exclusão de dados da Meta. */
export async function POST(request: Request) {
  const parsed = await parseCallbackRequest(request);
  if (!parsed.ok) {
    console.warn(`[meta/data-deletion] pedido recusado: ${parsed.reason}`);
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { raw, data } = parsed;
  const respond = (code: string) =>
    NextResponse.json({
      url: `${getAppBaseUrl(request)}/exclusao-de-dados?codigo=${code}`,
      confirmation_code: code,
    });

  const requestKey = sha256(raw);
  const existing = await prisma.dataDeletionRequest.findUnique({ where: { requestKey }, select: { code: true } });
  if (existing) return respond(existing.code);

  const accountIds = await findAccountsForCallback(data);
  if (!accountIds) {
    console.warn("[meta/data-deletion] pedido recusado: too_many_accounts");
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const code = randomBytes(16).toString("base64url");
  let created: { id: string };
  try {
    created = await prisma.dataDeletionRequest.create({
      data: {
        code,
        requestKey,
        source: "META_CALLBACK",
        provider: data.provider,
        metaUserIdHash: sha256(data.userId),
        scope: data.provider === "INSTAGRAM_LOGIN" ? "BUSINESS" : "PERSON",
        accountIds,
        ...(accountIds.length === 0 ? { status: "COMPLETED" as const, accountsAffected: 0, completedAt: new Date() } : {}),
      },
      select: { id: true },
    });
  } catch (error) {
    // Duas entregas iguais ao mesmo tempo: a segunda devolve o código da primeira.
    if (isUniqueViolation(error)) {
      const winner = await prisma.dataDeletionRequest.findUnique({ where: { requestKey }, select: { code: true } });
      if (winner) return respond(winner.code);
    }
    throw error;
  }

  if (accountIds.length > 0) {
    after(async () => {
      try {
        await runDeletion(created.id);
      } catch {
        console.error(`[meta/data-deletion] execução falhou pedido=${created.id}`);
      }
    });
  }
  return respond(code);
}
