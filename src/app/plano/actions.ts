"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe-billing";
import { getCurrentWorkspace } from "@/lib/tenancy";
import { actionErrorMessage, UserFacingError } from "@/lib/user-error";

export type BillingActionState = { ok: false; message: string } | null;

/** Endereço de volta do Stripe. Sem APP_URL não há para onde voltar: recusa em vez de adivinhar. */
function billingBaseUrl(): string {
  const url = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (!url?.startsWith("http")) throw new UserFacingError("A cobrança ainda não está configurada (falta APP_URL). Fale com o suporte.");
  return url;
}

function failure(error: unknown): BillingActionState {
  if (!(error instanceof UserFacingError)) console.error("[plano] cobrança falhou", error instanceof Error ? error.name : "erro desconhecido");
  return { ok: false, message: actionErrorMessage(error, "Não foi possível abrir a cobrança agora. Tente de novo em instantes.") };
}

export async function startCheckout(_previous: BillingActionState, formData: FormData): Promise<BillingActionState> {
  let url: string;
  try {
    const { workspace } = await getCurrentWorkspace();
    const cycle = formData.get("cycle") === "YEARLY" ? "YEARLY" : "MONTHLY";
    url = await createCheckoutSession(workspace.id, String(formData.get("planId") ?? ""), billingBaseUrl(), cycle);
  } catch (error) {
    return failure(error);
  }
  redirect(url);
}

export async function openBillingPortal(): Promise<BillingActionState> {
  let url: string;
  try {
    const { workspace } = await getCurrentWorkspace();
    url = await createPortalSession(workspace.id, billingBaseUrl());
  } catch (error) {
    return failure(error);
  }
  redirect(url);
}
