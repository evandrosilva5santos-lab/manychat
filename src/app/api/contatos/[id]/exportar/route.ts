import { NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { getCurrentAccount } from "@/lib/account";
import { exportContactData } from "@/lib/lgpd/contact-data";
import { idSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/contatos/[id]/exportar — baixa em JSON tudo o que o instachat guarda
 * sobre um contato do perfil ativo (LGPD: acesso e portabilidade).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    throw error;
  }

  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: "Contato inválido." }, { status: 400 });

  try {
    const account = await getCurrentAccount();
    if (!account) return NextResponse.json({ error: "Nenhum perfil ativo." }, { status: 409 });
    const data = await exportContactData(account.id, parsed.data);
    if (!data) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });

    const safeName = parsed.data.replace(/[^A-Za-z0-9_-]/g, "_");
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="contato-${safeName}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[titular] Falha ao exportar contato:", error instanceof Error ? error.name : "erro");
    return NextResponse.json({ error: "Não foi possível exportar agora." }, { status: 500 });
  }
}
