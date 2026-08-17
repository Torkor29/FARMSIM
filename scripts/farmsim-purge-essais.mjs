/**
 * Rend au monde les parcelles retenues par les comptes d'essai.
 *
 * `POST /auth/demo` fabrique une identité jetable **et lui attribue une
 * parcelle**, définitivement. Rien ne la reprend jamais, alors que le bouton
 * qui déclenche tout cela promet « une ferme effacée quand vous partez ». Le
 * monde compte un nombre fixe de parcelles : chaque essai en retire une pour
 * toujours, et quand il n'en reste plus, un nouveau joueur ne peut plus
 * s'installer du tout.
 *
 * Mesuré sur une copie : soixante comptes créés en 2,4 secondes par une boucle
 * de trois lignes, sans authentification.
 *
 * Ce script nettoie l'existant. Il ne referme pas la porte — cela se fait dans
 * l'API, et c'est un travail distinct.
 *
 * **Il ne supprime rien par défaut.** Sans `--vraiment`, il se contente de
 * dire ce qu'il ferait. C'est le bon réglage pour un outil qu'on lance sur les
 * données de production.
 *
 *   node scripts/farmsim-purge-essais.mjs                    # ce qui serait fait
 *   node scripts/farmsim-purge-essais.mjs --vraiment         # le fait
 *   node scripts/farmsim-purge-essais.mjs --jours=3          # épargne les récents
 */
import { DatabaseSync } from "node:sqlite";

/**
 * Reconnaît un compte d'essai à son adresse.
 *
 * `/auth/demo` écrit `essai-<uuid>@essai.invalid` — un domaine réservé par la
 * norme, qui ne peut appartenir à personne. Aucun compte réel ne peut donc
 * ressembler à ceci, même par accident.
 */
export const MOTIF_ESSAI = "essai-%@essai.invalid";

/**
 * L'ordre de suppression, imposé par les clés étrangères de la base.
 *
 * `Farm → User` et `Machine → Farm` sont en RESTRICT : on ne peut pas
 * supprimer un compte tant que sa ferme existe, ni sa ferme tant qu'il lui
 * reste une machine. `Parcel → Farm` est en SET NULL : la parcelle se libère
 * d'elle-même à la suppression de la ferme — mais elle **garde ses cases**,
 * avec les cultures et les bâtiments du joueur d'essai. Sans remise à zéro,
 * le prochain arrivant hériterait d'un champ à moitié semé.
 */
export function purger(chemin, { vraiment = false, jours = 0 } = {}) {
  const db = new DatabaseSync(chemin);
  try {
    db.exec("PRAGMA foreign_keys = ON");

    const seuil = jours > 0 ? Date.now() - jours * 86_400_000 : null;
    // `lastSeenAt` est stocké en millisecondes par Prisma sur SQLite.
    const filtre = seuil
      ? `email LIKE ? AND (lastSeenAt IS NULL OR lastSeenAt < ${seuil})`
      : "email LIKE ?";

    const comptes = db.prepare(`SELECT id, displayName FROM "User" WHERE ${filtre}`).all(MOTIF_ESSAI);
    if (!comptes.length) return { comptes: 0, parcelles: 0, vraiment };

    const ids = comptes.map((c) => c.id);
    const trous = ids.map(() => "?").join(",");
    const parcelles = db
      .prepare(
        `SELECT p.id FROM "Parcel" p
         JOIN "Farm" f ON f.id = p.farmId
         WHERE f.userId IN (${trous})`,
      )
      .all(...ids)
      .map((p) => p.id);

    if (!vraiment) return { comptes: comptes.length, parcelles: parcelles.length, vraiment };

    const trousP = parcelles.map(() => "?").join(",");
    db.exec("BEGIN");
    try {
      if (parcelles.length) {
        // Les bâtiments d'abord : leur suppression détache les cases et
        // emporte les troupeaux qu'ils abritent.
        db.prepare(`DELETE FROM "Building" WHERE parcelId IN (${trousP})`).run(...parcelles);
        // Puis la remise à zéro des cases, pour rendre une terre nue.
        db.prepare(
          `UPDATE "ParcelCell"
             SET kind = 'EMPTY', crop = NULL, fieldStage = 'EMPTY', plantedAt = NULL,
                 readyAt = NULL, fertilizedPasses = 0, weedsControlled = 0,
                 harvestsSincePlow = 0, residuePasses = 0, hasStubble = 0,
                 directSeeded = 0, lastCrop = NULL, cropStreak = 0,
                 strawTons = 0, baleCount = 0, buildingId = NULL, machineId = NULL
           WHERE parcelId IN (${trousP})`,
        ).run(...parcelles);
      }
      // Machines et stocks sont en RESTRICT : ils bloqueraient la ferme.
      db.prepare(
        `DELETE FROM "Machine" WHERE farmId IN (SELECT id FROM "Farm" WHERE userId IN (${trous}))`,
      ).run(...ids);
      db.prepare(
        `DELETE FROM "InventoryItem" WHERE farmId IN (SELECT id FROM "Farm" WHERE userId IN (${trous}))`,
      ).run(...ids);
      // La ferme : c'est elle qui rend les parcelles, par SET NULL.
      db.prepare(`DELETE FROM "Farm" WHERE userId IN (${trous})`).run(...ids);
      // Le compte enfin ; sessions, quêtes et contrats suivent en cascade.
      db.prepare(`DELETE FROM "User" WHERE id IN (${trous})`).run(...ids);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }

    return { comptes: comptes.length, parcelles: parcelles.length, vraiment };
  } finally {
    db.close();
  }
}

/** Combien de terre reste-t-il à distribuer ? */
export function libres(chemin) {
  const db = new DatabaseSync(chemin, { readOnly: true });
  try {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "Parcel" WHERE farmId IS NULL`).get().n;
    const total = db.prepare(`SELECT COUNT(*) AS n FROM "Parcel"`).get().n;
    return { libres: Number(n), total: Number(total) };
  } finally {
    db.close();
  }
}

const estAppeléDirectement = process.argv[1]?.endsWith("farmsim-purge-essais.mjs");
if (estAppeléDirectement) {
  const chemin = process.env.FARMSIM_DB ?? "/data/farmsim.db";
  const vraiment = process.argv.includes("--vraiment");
  const arg = process.argv.find((a) => a.startsWith("--jours="));
  const jours = arg ? Number(arg.slice(8)) : 0;

  const avant = libres(chemin);
  const r = purger(chemin, { vraiment, jours });
  const après = libres(chemin);

  console.log(`Comptes d'essai        : ${r.comptes}`);
  console.log(`Parcelles qu'ils tiennent : ${r.parcelles}`);
  console.log(`Terre libre            : ${avant.libres} / ${avant.total}`);
  if (vraiment) {
    console.log(`Terre libre après      : ${après.libres} / ${après.total}`);
    console.log("Fait.");
  } else {
    console.log(`Terre libre après      : ${avant.libres + r.parcelles} / ${avant.total} (estimation)`);
    console.log("");
    console.log("Rien n'a été supprimé. Relancez avec --vraiment pour le faire.");
  }
}
