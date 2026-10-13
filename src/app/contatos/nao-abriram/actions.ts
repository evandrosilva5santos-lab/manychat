"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getCurrentAccount } from "@/lib/account";
import { markLiked } from "@/lib/funnel/not-opened";
import { invalidIdMessage } from "@/lib/validation";
import { actionErrorMessage } from "@/lib/user-error";

/** "Já curti": tira o contato da lista aplicando a etiqueta "Curtida feita". */
export async function markLikedAction(contactId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAuth();
  const invalid = invalidIdMessage(contactId);
  if (invalid) return { ok: false, error: invalid };
  try {
    const account = await getCurrentAccount();
    if (!account) return { ok: false, error: "Nenhum perfil ativo." };
    if (!(await markLiked(account.id, contactId))) return { ok: false, error: "Contato não encontrado neste perfil." };
    revalidatePath("/contatos/nao-abriram");
    revalidatePath("/contatos");
    return { ok: true };
  } catch (err) {
    console.error("[nao-abriram] Falha ao marcar curtida:", err instanceof Error ? err.name : "erro");
    return { ok: false, error: actionErrorMessage(err, "Não foi possível marcar agora. Tente de novo.") };
  }
}
