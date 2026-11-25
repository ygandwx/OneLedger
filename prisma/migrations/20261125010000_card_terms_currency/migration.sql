-- Existing limits and fees were entered in the tool's currency.
ALTER TABLE "Card" ADD COLUMN "termsCurrency" TEXT
    CHECK ("termsCurrency" IS NULL OR "termsCurrency" IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY'));

UPDATE "Card" SET "termsCurrency" = "currency"
WHERE "creditLimit" IS NOT NULL OR "annualFee" IS NOT NULL;
