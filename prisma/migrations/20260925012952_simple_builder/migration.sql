-- Receita do builder simples
ALTER TABLE "Flow" ADD COLUMN "recipe" JSONB;

-- Resposta pública: de 1 texto para até 5 variações (copia o valor antigo)
ALTER TABLE "Trigger" ADD COLUMN "publicReplies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Trigger" SET "publicReplies" = ARRAY["publicReply"] WHERE "publicReply" IS NOT NULL AND "publicReply" <> '';
ALTER TABLE "Trigger" DROP COLUMN "publicReply";
