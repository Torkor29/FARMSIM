-- AlterTable
ALTER TABLE "Herd" ADD COLUMN "gestatingSince" DATETIME;
ALTER TABLE "Herd" ADD COLUMN "lastCalvedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "quality" INTEGER NOT NULL DEFAULT 3,
    "moisture" REAL NOT NULL DEFAULT 0,
    "lastDecayAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("farmId", "id", "itemCode", "moisture", "qty", "quality") SELECT "farmId", "id", "itemCode", "moisture", "qty", "quality" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
