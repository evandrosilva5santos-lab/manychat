-- Revisão do cliente separada em arte e legenda; o cliente pode reescrever a legenda.
ALTER TABLE "autoposter_reviews" ADD COLUMN "mediaDecision" TEXT;
ALTER TABLE "autoposter_reviews" ADD COLUMN "captionDecision" TEXT;
ALTER TABLE "autoposter_reviews" ADD COLUMN "captionComment" TEXT;
ALTER TABLE "autoposter_reviews" ADD COLUMN "editedCaption" TEXT;
