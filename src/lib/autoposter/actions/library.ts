"use server";

// Biblioteca do projeto: grupos de hashtags, assinaturas e categorias.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { idSchema } from "@/lib/validation";
import { UserFacingError } from "@/lib/user-error";
import { requireProject } from "../access";
import { colorSchema, hashtagsSchema, nameSchema } from "../schemas";
import { runAction, type ActionResult } from "./shared";

const contentSchema = z.string().trim().min(1, "Escreva o conteúdo.").max(2000);

function refresh(projectId: string) {
  revalidatePath(`/autoposter/projeto/${projectId}`, "layout");
}

export async function saveHashtagGroup(projectId: string, id: string | null, name: string, hashtags: string): Promise<ActionResult> {
  return runAction("saveHashtagGroup", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    const data = { name: nameSchema.parse(name), hashtags: hashtagsSchema.parse(hashtags) };
    if (id) {
      const updated = await prisma.autoposterHashtagGroup.updateMany({ where: { id: idSchema.parse(id), projectId: project.id }, data });
      if (updated.count === 0) throw new UserFacingError("Grupo de hashtags não encontrado.");
    } else {
      await prisma.autoposterHashtagGroup.create({ data: { projectId: project.id, ...data } });
    }
    refresh(project.id);
    return undefined;
  }, "Grupo de hashtags salvo.");
}

export async function saveSignature(projectId: string, id: string | null, name: string, content: string): Promise<ActionResult> {
  return runAction("saveSignature", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    const data = { name: nameSchema.parse(name), content: contentSchema.parse(content) };
    if (id) {
      const updated = await prisma.autoposterSignature.updateMany({ where: { id: idSchema.parse(id), projectId: project.id }, data });
      if (updated.count === 0) throw new UserFacingError("Assinatura não encontrada.");
    } else {
      await prisma.autoposterSignature.create({ data: { projectId: project.id, ...data } });
    }
    refresh(project.id);
    return undefined;
  }, "Assinatura salva.");
}

export async function saveCategory(projectId: string, id: string | null, name: string, color: string): Promise<ActionResult> {
  return runAction("saveCategory", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    const data = { name: nameSchema.parse(name), color: colorSchema.parse(color) };
    if (id) {
      const updated = await prisma.autoposterCategory.updateMany({ where: { id: idSchema.parse(id), projectId: project.id }, data });
      if (updated.count === 0) throw new UserFacingError("Categoria não encontrada.");
    } else {
      await prisma.autoposterCategory.create({ data: { projectId: project.id, ...data } });
    }
    refresh(project.id);
    return undefined;
  }, "Categoria salva.");
}

export async function deleteLibraryItem(projectId: string, kind: "hashtag" | "signature" | "category", id: string): Promise<ActionResult> {
  return runAction("deleteLibraryItem", async () => {
    const { project } = await requireProject(idSchema.parse(projectId));
    const where = { id: idSchema.parse(id), projectId: project.id };
    const which = z.enum(["hashtag", "signature", "category"]).parse(kind);
    if (which === "hashtag") await prisma.autoposterHashtagGroup.deleteMany({ where });
    if (which === "signature") await prisma.autoposterSignature.deleteMany({ where });
    if (which === "category") await prisma.autoposterCategory.deleteMany({ where });
    refresh(project.id);
    return undefined;
  }, "Item excluído.");
}
