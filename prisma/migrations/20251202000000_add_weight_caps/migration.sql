-- Add new cap fields to weight_settings
ALTER TABLE "weight_settings"
  ADD COLUMN "carryOverMaxBonus" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN "loyaltyMaxBonus" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  ADD COLUMN "supportMaxBonus" DOUBLE PRECISION NOT NULL DEFAULT 10.0;

