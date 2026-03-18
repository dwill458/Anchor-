-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "authProvider" TEXT NOT NULL,
    "authUid" TEXT NOT NULL,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'free',
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "totalAnchorsCreated" INTEGER NOT NULL DEFAULT 0,
    "totalActivations" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anchors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intentionText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "distilledLetters" TEXT[],
    "baseSigilSvg" TEXT,
    "generationMethod" TEXT NOT NULL DEFAULT 'automated',
    "enhancementStatus" TEXT NOT NULL DEFAULT 'pending',
    "selectedSymbols" JSONB,
    "aiStyle" TEXT,
    "enhancedImageUrl" TEXT,
    "variationUrls" JSONB,
    "mantraText" TEXT,
    "mantraPronunciation" TEXT,
    "mantraAudioUrl" TEXT,
    "isCharged" BOOLEAN NOT NULL DEFAULT false,
    "chargedAt" TIMESTAMP(3),
    "chargeMethod" TEXT,
    "activationCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivatedAt" TIMESTAMP(3),
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "anchorId" TEXT NOT NULL,
    "activationType" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "anchorId" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "ambientSound" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "chargedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "burned_anchors" (
    "id" TEXT NOT NULL,
    "originalAnchorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intentionText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "distilledLetters" TEXT[],
    "baseSigilSvg" TEXT,
    "enhancedImageUrl" TEXT,
    "activationCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "burnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "burned_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "printfulOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "productType" TEXT NOT NULL,
    "productVariant" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "anchorImageUrl" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shippingName" TEXT,
    "shippingAddress" JSONB,
    "trackingNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyReminderTime" TEXT NOT NULL DEFAULT '08:00',
    "streakProtection" BOOLEAN NOT NULL DEFAULT true,
    "defaultChargeDuration" INTEGER NOT NULL DEFAULT 300,
    "hapticIntensity" INTEGER NOT NULL DEFAULT 3,
    "vaultViewType" TEXT NOT NULL DEFAULT 'grid',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_authUid_key" ON "users"("authUid");

-- CreateIndex
CREATE INDEX "anchors_userId_idx" ON "anchors"("userId");

-- CreateIndex
CREATE INDEX "anchors_category_idx" ON "anchors"("category");

-- CreateIndex
CREATE INDEX "anchors_isShared_idx" ON "anchors"("isShared");

-- CreateIndex
CREATE INDEX "activations_userId_anchorId_idx" ON "activations"("userId", "anchorId");

-- CreateIndex
CREATE INDEX "activations_activatedAt_idx" ON "activations"("activatedAt");

-- CreateIndex
CREATE INDEX "charges_userId_anchorId_idx" ON "charges"("userId", "anchorId");

-- CreateIndex
CREATE UNIQUE INDEX "burned_anchors_originalAnchorId_key" ON "burned_anchors"("originalAnchorId");

-- CreateIndex
CREATE INDEX "burned_anchors_userId_idx" ON "burned_anchors"("userId");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "sync_queue_userId_status_idx" ON "sync_queue"("userId", "status");

-- AddForeignKey
ALTER TABLE "anchors" ADD CONSTRAINT "anchors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activations" ADD CONSTRAINT "activations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activations" ADD CONSTRAINT "activations_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
