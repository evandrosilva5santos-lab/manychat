"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setActiveAccount } from "@/lib/tenancy";

export async function switchActiveInstagramAccount(accountId: string) {
  await setActiveAccount(accountId);
  revalidatePath("/", "layout");
}

export async function leaveWorkspaceImpersonation() {
  const { cookies } = await import("next/headers");
  const { IMPERSONATION_COOKIE, requireSuperAdmin } = await import("@/lib/tenancy");
  await requireSuperAdmin();
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/admin");
}
