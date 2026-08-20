-- CreateEnum
CREATE TYPE "Specialization" AS ENUM ('CEREALIER', 'ELEVEUR', 'ETA');

-- CreateEnum
CREATE TYPE "CropCode" AS ENUM ('WHEAT', 'MAIZE', 'PEA', 'BARLEY', 'RAPE', 'GRASS');

-- CreateEnum
CREATE TYPE "FieldStage" AS ENUM ('EMPTY', 'PREPARED', 'PLANTED', 'GROWING', 'READY', 'SPOILED', 'HARVESTED');

-- CreateEnum
CREATE TYPE "ContractJobType" AS ENUM ('PLOW', 'SOW', 'FERTILIZE', 'HARVEST', 'TRANSPORT');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('OPEN', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('SILO', 'HAY_BARN', 'MACHINE_SHED', 'CATTLE_BARN', 'PIGSTY', 'HENHOUSE', 'SHEEPFOLD', 'WORKSHOP', 'FARMHOUSE', 'PADDOCK', 'PIG_YARD', 'HEN_YARD', 'COLD_ROOM', 'BUNKER_SILO', 'SOLAR_PANELS', 'WIND_TURBINE', 'BEEHIVE', 'DAIRY', 'MILL');

-- CreateEnum
CREATE TYPE "CellKind" AS ENUM ('EMPTY', 'CROP', 'BUILDING', 'VEHICLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "specialization" "Specialization" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "crd" DOUBLE PRECISION NOT NULL DEFAULT 12000,
    "accessCode" TEXT NOT NULL DEFAULT 'ferme',
    "lastSeenAt" TIMESTAMP(3),
    "lastMarketJson" TEXT,
    "appearanceJson" TEXT,
    "statsJson" TEXT NOT NULL DEFAULT '{}',
    "lastParcelId" TEXT,
    "lastCellX" INTEGER,
    "lastCellY" INTEGER,
    "isNpc" BOOLEAN NOT NULL DEFAULT false,
    "consignesJson" TEXT,
    "absenceLogJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuelL" DOUBLE PRECISION NOT NULL DEFAULT 1200,
    "debtCrd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debtAt" TIMESTAMP(3),

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyOrder" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "tons" DOUBLE PRECISION NOT NULL,
    "arrivesAt" TIMESTAMP(3) NOT NULL,
    "autoAt" TIMESTAMP(3) NOT NULL,
    "parcelId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoungBatch" (
    "id" TEXT NOT NULL,
    "herdId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "maturesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoungBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "koppen" TEXT NOT NULL,
    "riskNote" TEXT NOT NULL,
    "mapW" INTEGER NOT NULL DEFAULT 4,
    "mapH" INTEGER NOT NULL DEFAULT 3,
    "continentCode" TEXT NOT NULL DEFAULT 'AUR',
    "continentName" TEXT NOT NULL DEFAULT 'Auralie',
    "city" TEXT NOT NULL DEFAULT '',
    "climateLabel" TEXT NOT NULL DEFAULT '',
    "hemisphere" TEXT NOT NULL DEFAULT 'N',
    "lat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lon" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceMult" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "baseFertility" DOUBLE PRECISION NOT NULL DEFAULT 0.7,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "farmId" TEXT,
    "label" TEXT NOT NULL,
    "mapX" INTEGER NOT NULL,
    "mapY" INTEGER NOT NULL,
    "gridW" INTEGER NOT NULL DEFAULT 12,
    "gridH" INTEGER NOT NULL DEFAULT 12,
    "landPrice" DOUBLE PRECISION NOT NULL,
    "fertility" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "accessIndex" DOUBLE PRECISION NOT NULL DEFAULT 0.5,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelCell" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "kind" "CellKind" NOT NULL DEFAULT 'EMPTY',
    "buildingId" TEXT,
    "machineId" TEXT,
    "crop" "CropCode",
    "fieldStage" "FieldStage" NOT NULL DEFAULT 'EMPTY',
    "plantedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "fertilizedPasses" INTEGER NOT NULL DEFAULT 0,
    "weedPressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weedAt" TIMESTAMP(3),
    "harvestsSincePlow" INTEGER NOT NULL DEFAULT 0,
    "residuePasses" INTEGER NOT NULL DEFAULT 0,
    "hasStubble" BOOLEAN NOT NULL DEFAULT false,
    "directSeeded" BOOLEAN NOT NULL DEFAULT false,
    "lastCrop" "CropCode",
    "cropStreak" INTEGER NOT NULL DEFAULT 0,
    "strawTons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baleCount" INTEGER NOT NULL DEFAULT 0,
    "plantedAsSilage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ParcelCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Herd" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COW',
    "size" INTEGER NOT NULL DEFAULT 0,
    "happiness" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "bornAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastGrazedAt" TIMESTAMP(3),
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMilkedAt" TIMESTAMP(3),
    "grazingUntil" TIMESTAMP(3),
    "lastFedAt" TIMESTAMP(3),
    "feedQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feedStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gestatingSince" TIMESTAMP(3),
    "lastCalvedAt" TIMESTAMP(3),
    "avgAgeMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mortalityDebt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "housing" TEXT NOT NULL DEFAULT 'INSIDE',
    "grassTons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manureTons" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "beddingTons" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Herd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "type" "BuildingType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "originX" INTEGER NOT NULL,
    "originY" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "moisture" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastDecayAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "condition" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "busyUntil" TIMESTAMP(3),
    "greased" BOOLEAN NOT NULL DEFAULT true,
    "grease" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "dirt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "greaseSkipStreak" INTEGER NOT NULL DEFAULT 0,
    "breakdown" TEXT,
    "parkedParcelId" TEXT,
    "storedInBuildingId" TEXT,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "condition" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "grease" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "dirt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdown" TEXT,
    "priceCrd" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "MachineListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldJob" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "cellsJson" TEXT NOT NULL,
    "crop" TEXT,
    "machineId" TEXT NOT NULL,
    "tractorId" TEXT,
    "fuelL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',

    CONSTRAINT "FieldJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stockTons" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuturesContract" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "tons" DOUBLE PRECISION NOT NULL,
    "pricePerTon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "settledAt" TIMESTAMP(3),
    "marketAtDue" DOUBLE PRECISION,

    CONSTRAINT "FuturesContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTick" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "tons" DOUBLE PRECISION NOT NULL,
    "pricePerTon" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "buyerId" TEXT,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "poste" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerFarmId" TEXT NOT NULL,
    "listingId" TEXT,
    "commodity" TEXT NOT NULL,
    "tons" DOUBLE PRECISION NOT NULL,
    "moisture" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "autoFee" DOUBLE PRECISION NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NpcContract" (
    "id" TEXT NOT NULL,
    "jobType" "ContractJobType" NOT NULL,
    "title" TEXT NOT NULL,
    "rewardCrd" DOUBLE PRECISION NOT NULL,
    "regionNote" TEXT NOT NULL,
    "cells" INTEGER NOT NULL DEFAULT 16,
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "NpcContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborOrder" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT,
    "work" TEXT NOT NULL,
    "crop" TEXT,
    "cellsJson" TEXT NOT NULL,
    "remainingJson" TEXT NOT NULL,
    "quoteCrd" DOUBLE PRECISION NOT NULL,
    "extrasCrd" DOUBLE PRECISION NOT NULL,
    "escrowCrd" DOUBLE PRECISION NOT NULL,
    "payoutCrd" DOUBLE PRECISION NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LaborOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "zoneCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "QuestClaim_userId_questId_key" ON "QuestClaim"("userId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_userId_key" ON "Farm"("userId");

-- CreateIndex
CREATE INDEX "SupplyOrder_farmId_arrivesAt_idx" ON "SupplyOrder"("farmId", "arrivesAt");

-- CreateIndex
CREATE INDEX "YoungBatch_herdId_maturesAt_idx" ON "YoungBatch"("herdId", "maturesAt");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_zoneId_mapX_mapY_key" ON "Parcel"("zoneId", "mapX", "mapY");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelCell_machineId_key" ON "ParcelCell"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelCell_parcelId_x_y_key" ON "ParcelCell"("parcelId", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "Herd_buildingId_key" ON "Herd"("buildingId");

-- CreateIndex
CREATE INDEX "MachineListing_status_type_idx" ON "MachineListing"("status", "type");

-- CreateIndex
CREATE INDEX "FieldJob_parcelId_status_idx" ON "FieldJob"("parcelId", "status");

-- CreateIndex
CREATE INDEX "FieldJob_userId_status_idx" ON "FieldJob"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_commodity_key" ON "MarketPrice"("commodity");

-- CreateIndex
CREATE INDEX "FuturesContract_sellerId_status_idx" ON "FuturesContract"("sellerId", "status");

-- CreateIndex
CREATE INDEX "FuturesContract_status_dueAt_idx" ON "FuturesContract"("status", "dueAt");

-- CreateIndex
CREATE INDEX "MarketTick_commodity_at_idx" ON "MarketTick"("commodity", "at");

-- CreateIndex
CREATE INDEX "MarketListing_status_commodity_idx" ON "MarketListing"("status", "commodity");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_at_idx" ON "LedgerEntry"("userId", "at");

-- CreateIndex
CREATE INDEX "Delivery_buyerId_status_idx" ON "Delivery"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Delivery_sellerId_status_idx" ON "Delivery"("sellerId", "status");

-- CreateIndex
CREATE INDEX "Delivery_status_dueAt_idx" ON "Delivery"("status", "dueAt");

-- CreateIndex
CREATE INDEX "LaborOrder_status_createdAt_idx" ON "LaborOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LaborOrder_providerId_status_idx" ON "LaborOrder"("providerId", "status");

-- CreateIndex
CREATE INDEX "LaborOrder_parcelId_status_idx" ON "LaborOrder"("parcelId", "status");

-- AddForeignKey
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyOrder" ADD CONSTRAINT "SupplyOrder_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoungBatch" ADD CONSTRAINT "YoungBatch_herdId_fkey" FOREIGN KEY ("herdId") REFERENCES "Herd"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelCell" ADD CONSTRAINT "ParcelCell_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelCell" ADD CONSTRAINT "ParcelCell_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelCell" ADD CONSTRAINT "ParcelCell_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Herd" ADD CONSTRAINT "Herd_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Herd" ADD CONSTRAINT "Herd_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_parkedParcelId_fkey" FOREIGN KEY ("parkedParcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_storedInBuildingId_fkey" FOREIGN KEY ("storedInBuildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineListing" ADD CONSTRAINT "MachineListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineListing" ADD CONSTRAINT "MachineListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldJob" ADD CONSTRAINT "FieldJob_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuturesContract" ADD CONSTRAINT "FuturesContract_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpcContract" ADD CONSTRAINT "NpcContract_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborOrder" ADD CONSTRAINT "LaborOrder_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborOrder" ADD CONSTRAINT "LaborOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborOrder" ADD CONSTRAINT "LaborOrder_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
