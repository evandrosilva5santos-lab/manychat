"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validation";
import { UserFacingError } from "@/lib/user-error";
import { requireAccessibleAccounts, requireAutoposterActor, requireProject, workspaceForProject } from "../access";
import { projectInputSchema, publishRulesSchema, type ProjectInput } from "../schemas";
import { createSignedUpload } from "../storage";
import { runAction, type ActionResult } from "./shared";

export async function createProject(input: ProjectInput): Promise<ActionResult<{ id: string }>> {
  return runAction("createProject", async () => {
    const actor = await requireAutoposterActor();
    const data = projectInputSchema.parse(input);
    const accounts = await requireAccessibleAccounts(actor, data.accountIds);
    const workspaceId = await workspaceForProject(actor, accounts.map((account) => account.workspaceId));
    const project = await prisma.autoposterProject.create({
      data: {
        workspaceId,
        name: data.name,
        timezone: data.timezone,
        dateFormat: data.dateFormat,
        accounts: { create: accounts.map((account) => ({ accountId: account.id })) },
      },
      select: { id: true },
    });
    revalidatePath("/autoposter");
    return project;
  });
}

export async function updateProject(projectId: string, input: ProjectInput): Promise<ActionResult> {
  return runAction("updateProject", async () => {
    const { actor, project } = await requireProject(idSchema.parse(projectId));
    const data = projectInputSchema.parse(input);
    const accounts = await requireAccessibleAccounts(actor, data.accountIds);
    if (accounts.some((account) => account.workspaceId !== project.workspaceId)) {
      throw new UserFacingError("Escolha contas do mesmo workspace do projeto.");
    }
    await prisma.$transaction([
      prisma.autoposterProject.update({
        where: { id: project.id },
        data: { name: data.name, timezone: data.timezone, dateFormat: data.dateFormat },
      }),
      prisma.autoposterProjectAccount.deleteMany({ where: { projectId: project.id, accountId: { notIn: data.accountIds } } }),
      ...data.accountIds.map((accountId) =>
        prisma.autoposterProjectAccount.upsert({
          where: { projectId_accountId: { projectId: project.id, accountId } },
          create: { projectId: project.id, accountId },
          update: {},
        }),
      ),
    ]);
    revalidatePath(`/autoposter/projeto/${project.id}`, "layout");
    revalidatePath("/autoposter");
    return undefined;
  }, "Projeto atualizado.");
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  return runAction("deleteProject", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    await prisma.autoposterProject.delete({ where: { id: project.id } });
    revalidatePath("/autoposter");
    return undefined;
  });
}

export async function updatePublishRules(projectId: string, input: z.infer<typeof publishRulesSchema>): Promise<ActionResult> {
  return runAction("updatePublishRules", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    await prisma.autoposterProject.update({ where: { id: project.id }, data: publishRulesSchema.parse(input) });
    revalidatePath(`/autoposter/projeto/${project.id}`, "layout");
    return undefined;
  }, "Preferências salvas.");
}

/** Liga (gera link novo se não houver) ou desliga o calendário público. */
export async function setCalendarShare(projectId: string, enabled: boolean): Promise<ActionResult<{ token: string | null }>> {
  return runAction("setCalendarShare", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    const token = enabled ? project.calendarShareToken ?? randomUUID() : null;
    await prisma.autoposterProject.update({ where: { id: project.id }, data: { calendarShareToken: token } });
    return { token };
  });
}

export async function createMediaUpload(
  projectId: string,
  contentType: string,
  size: number,
): Promise<ActionResult<{ uploadUrl: string; publicUrl: string }>> {
  return runAction("createMediaUpload", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    return createSignedUpload(`${project.workspaceId}/${project.id}`, String(contentType), Number(size));
  });
}
