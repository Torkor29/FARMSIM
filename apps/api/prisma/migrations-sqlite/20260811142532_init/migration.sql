-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "crd" REAL NOT NULL DEFAULT 12000,
    "accessCode" TEXT NOT NULL DEFAULT 'ferme',
    "lastSeenAt" DATETIME,
    "lastMarketJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "koppen" TEXT NOT NULL,
    "riskNote" TEXT NOT NULL,
    "mapW" INTEGER NOT NULL DEFAULT 4,
    "mapH" INTEGER NOT NULL DEFAULT 3
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "farmId" TEXT,
    "label" TEXT NOT NULL,
    "mapX" INTEGER NOT NULL,
    "mapY" INTEGER NOT NULL,
    "gridW" INTEGER NOT NULL DEFAULT 12,
    "gridH" INTEGER NOT NULL DEFAULT 12,
    "landPrice" REAL NOT NULL,
    "fertility" REAL NOT NULL DEFAULT 0.7,
    CONSTRAINT "Parcel_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Parcel_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParcelCell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EMPTY',
    "buildingId" TEXT,
    "machineId" TEXT,
    "crop" TEXT,
    "fieldStage" TEXT NOT NULL DEFAULT 'EMPTY',
    "plantedAt" DATETIME,
    "readyAt" DATETIME,
    "fertilizedPasses" INTEGER NOT NULL DEFAULT 0,
    "weedsControlled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ParcelCell_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ParcelCell_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ParcelCell_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "originX" INTEGER NOT NULL,
    "originY" INTEGER NOT NULL,
    CONSTRAINT "Building_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "moisture" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "InventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "condition" REAL NOT NULL DEFAULT 100,
    "parkedParcelId" TEXT,
    "storedInBuildingId" TEXT,
    CONSTRAINT "Machine_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Machine_parkedParcelId_fkey" FOREIGN KEY ("parkedParcelId") REFERENCES "Parcel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Machine_storedInBuildingId_fkey" FOREIGN KEY ("storedInBuildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commodity" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "stockTons" REAL NOT NULL DEFAULT 1000,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NpcContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rewardCrd" REAL NOT NULL,
    "regionNote" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "providerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "NpcContract_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_userId_key" ON "Farm"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_zoneId_mapX_mapY_key" ON "Parcel"("zoneId", "mapX", "mapY");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelCell_machineId_key" ON "ParcelCell"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelCell_parcelId_x_y_key" ON "ParcelCell"("parcelId", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPrice_commodity_key" ON "MarketPrice"("commodity");
