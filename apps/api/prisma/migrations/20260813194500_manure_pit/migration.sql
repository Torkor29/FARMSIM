-- SQLite : fosse à fumier sur le troupeau (tonnes au bâtiment, pas au silo).
ALTER TABLE "Herd" ADD COLUMN "manureTons" REAL NOT NULL DEFAULT 0;
