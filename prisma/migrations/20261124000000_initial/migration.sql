-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT NOT NULL,
    "lastTotpStep" INTEGER NOT NULL DEFAULT -1,
    CHECK (id = 1)
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "until" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CHECK (type IN ('个人','公司')),
    CHECK (currency IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY'))
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "entityId" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "registrationNumber" TEXT NOT NULL DEFAULT '',
    "incorporationDate" TEXT,
    "registeredAddress" TEXT NOT NULL DEFAULT '',
    "officeAddress" TEXT NOT NULL DEFAULT '',
    "fiscalYearEnd" TEXT,
    "directors" TEXT NOT NULL DEFAULT '',
    "shareholders" TEXT NOT NULL DEFAULT '',
    "secretaryCompany" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CompanyProfile_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL DEFAULT '',
    "last4" TEXT,
    "currency" TEXT NOT NULL,
    "expiresOn" TEXT,
    "status" TEXT NOT NULL DEFAULT '正常',
    "replacementId" TEXT,
    "creditLimit" BIGINT,
    "statementDay" INTEGER,
    "paymentDay" INTEGER,
    "annualFee" BIGINT,
    "annualFeeDate" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Card_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Card_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CHECK (last4 IS NULL OR last4 GLOB '[0-9][0-9][0-9][0-9]'),
    CHECK (replacementId IS NULL OR replacementId <> id),
    CHECK (statementDay IS NULL OR statementDay BETWEEN 1 AND 31),
    CHECK (paymentDay IS NULL OR paymentDay BETWEEN 1 AND 31),
    CHECK (currency IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY')),
    CHECK (creditLimit IS NULL OR creditLimit >= 0),
    CHECK (annualFee IS NULL OR annualFee >= 0),
    CHECK (status IN ('正常','冻结','挂失','停用','已注销','已过期'))
);

-- CreateTable
CREATE TABLE "CardStatusLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CardStatusLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Website" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '正常',
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Account_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Account_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Binding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    CONSTRAINT "Binding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Binding_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (endDate IS NULL OR endDate >= startDate)
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "websiteId" TEXT,
    "accountId" TEXT,
    "cardId" TEXT,
    "payerId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalAmount" BIGINT NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "bookedAmount" BIGINT NOT NULL,
    "bookedCurrency" TEXT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "orderNumber" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "refundOfId" TEXT,
    "recurringId" TEXT,
    "occurrenceDate" TEXT,
    "invoiceStatus" TEXT NOT NULL DEFAULT '未取得',
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "rateOverride" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT "Expense_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (originalCurrency IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY')),
    CHECK (bookedCurrency IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY')),
    CHECK (status IN ('待确认','已入账','已退款','未扣款'))
);

-- CreateTable
CREATE TABLE "RecurringItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "websiteId" TEXT,
    "accountId" TEXT,
    "cardId" TEXT,
    "amount" BIGINT,
    "currency" TEXT,
    "frequency" TEXT NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "anchorDay" INTEGER NOT NULL,
    "nextDue" TEXT NOT NULL,
    "reminderDays" TEXT NOT NULL DEFAULT '7,1',
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT '有效',
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "RecurringItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringItem_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (currency IS NULL OR currency IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY')),
    CHECK (intervalMonths >= 1),
    CHECK (anchorDay BETWEEN 1 AND 31)
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expiresOn" TEXT,
    "expenseId" TEXT,
    "recurringId" TEXT,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StoredFile_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoredFile_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK (size BETWEEN 0 AND 26214400)
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    CHECK (base IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY')),
    CHECK (quote IN ('CNY','USD','GBP','EUR','HKD','SGD','JPY')),
    CHECK (base <> quote),
    CHECK (source IN ('自动','手动'))
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" DATETIME,
    "read" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "CardStatusLog_cardId_changedAt_idx" ON "CardStatusLog"("cardId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_websiteId_entityId_identifier_key" ON "Account"("websiteId", "entityId", "identifier");

-- CreateIndex
CREATE INDEX "Binding_cardId_endDate_idx" ON "Binding"("cardId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Expense_date_deleted_status_idx" ON "Expense"("date", "deleted", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_recurringId_occurrenceDate_key" ON "Expense"("recurringId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "RecurringItem_status_nextDue_idx" ON "RecurringItem"("status", "nextDue");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_path_key" ON "StoredFile"("path");

-- CreateIndex
CREATE INDEX "ExchangeRate_base_quote_date_idx" ON "ExchangeRate"("base", "quote", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_base_quote_key" ON "ExchangeRate"("date", "base", "quote");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_itemType_itemId_dueDate_daysBefore_channel_key" ON "Notification"("itemType", "itemId", "dueDate", "daysBefore", "channel");

-- An account has one default payment method at a time.
CREATE UNIQUE INDEX "Binding_current_account" ON "Binding"("accountId") WHERE "endDate" IS NULL;

INSERT INTO "Category" ("id", "name") VALUES
  ('cat-cloud', '云服务器'), ('cat-domain', '域名'), ('cat-software', '软件订阅'),
  ('cat-ads', '广告'), ('cat-fees', '手续费'), ('cat-compliance', '公司注册与合规'),
  ('cat-other', '其他');
