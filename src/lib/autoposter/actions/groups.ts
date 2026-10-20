"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validation";
import { UserFacingError } from "@/lib/user-error";
import { projectScope, requireAutoposterActor, requireProject } from "../access";
import { nameSchema } from "../schemas";
import { runAction, type ActionResult } from "./shared";

async function requireGroup(groupId: string) {
  const actor = await requireAutoposterActor();
  const group = await prisma.autoposterReviewGroup.findFirst({ where: { id: idSchema.parse(groupId), project: projectScope(actor) } });
  if (!group) throw new UserFacingError("Grupo de aprovação não encontrado.");
  return group;
}

export async function createReviewGroup(projectId: string, name: string): Promise<ActionResult<{ id: string; token: string }>> {
  return runAction("createReviewGroup", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    const group = await prisma.autoposterReviewGroup.create({
      data: { projectId: project.id, name: nameSchema.parse(name), token: randomUUID() },
      select: { id: true, token: true },
    });
    revalidatePath(`/autoposter/projeto/${project.id}`, "layout");
    return group;
  }, "Grupo criado.");
}

export async function renameReviewGroup(groupId: string, name: string): Promise<ActionResult> {
  return runAction("renameReviewGroup", async () => {
    const group = await requireGroup(groupId);
    await prisma.autoposterReviewGroup.update({ where: { id: group.id }, data: { name: nameSchema.parse(name) } });
    revalidatePath(`/autoposter/projeto/${group.projectId}`, "layout");
    return undefined;
  }, "Grupo renomeado.");
}

/** Excluir o grupo não apaga os posts: eles só saem do grupo. */
export async function deleteReviewGroup(groupId: string): Promise<ActionResult> {
  return runAction("deleteReviewGroup", async () => {
    const group = await requireGroup(groupId);
    await prisma.autoposterReviewGroup.delete({ where: { id: group.id } });
    revalidatePath(`/autoposter/projeto/${group.projectId}`, "layout");
    return undefined;
  }, "Grupo excluído.");
}

/** Gera um link novo (o antigo deixa de funcionar). */
export async function regenerateReviewLink(groupId: string): Promise<ActionResult<{ token: string }>> {
  return runAction("regenerateReviewLink", async () => {
    const group = await requireGroup(groupId);
    const token = randomUUID();
    await prisma.autoposterReviewGroup.update({ where: { id: group.id }, data: { token } });
    revalidatePath(`/autoposter/projeto/${group.projectId}`, "layout");
    return { token };
  }, "Link novo gerado.");
}
