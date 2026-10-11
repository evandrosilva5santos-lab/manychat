-- Item 5: status do token por conta (ACTIVE/EXPIRING/EXPIRED/REVOKED).
-- NÃO aplicar sem confirmação do dono: o Supabase é o único banco (dev+prod).
-- Coordenação onda C: o item 4 pode acrescentar WebhookEvent nesta mesma janela.
CREATE TYPE "TokenStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED', 'REVOKED');
ALTER TABLE "InstagramAccount" ADD COLUMN "tokenStatus" "TokenStatus" NOT NULL DEFAULT 'ACTIVE';
