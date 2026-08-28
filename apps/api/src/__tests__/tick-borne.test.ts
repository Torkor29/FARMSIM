/**
 * Le tick ne charge pas le monde entier.
 *
 * ## Ce qui s'est passé
 *
 * Deux étapes du tour de simulation lisaient **toutes les cases de toutes les
 * parcelles**, toutes les vingt secondes. Mesuré sur un monde neuf et sans un
 * seul joueur :
 *
 * | Étape                    | Cases chargées | Durée   | Tas alloué |
 * |--------------------------|---------------:|--------:|-----------:|
 * | `publishFromConsignes`   |         44 208 |  1,4 s  |     147 Mo |
 * | `tickNpcFarms`           |         34 992 |  0,9 s  |     118 Mo |
 *
 * Soit 265 Mo alloués et 2,3 secondes de travail par tour, contre un plafond
 * de tas de 320 Mo (`NODE_OPTIONS` dans `docker-compose.yml`). V8 passait sa
 * vie en ramasse-miettes complet ; la boucle d'événements se bloquait —
 * `/api/health`, qui n'écrit que `{"ok":true}`, a été mesuré **à 24 secondes**
 * en production — le contrôle de santé du conteneur expirait, le veilleur
 * relançait, et le jeu repartait pour soixante-dix secondes de 502 sur tout.
 *
 * Relevé en production le 28 août au matin, sur 92 sondes espacées de cinq
 * secondes : **39 % du temps injoignable**, par cycles d'environ 70 secondes de
 * panne toutes les huit à dix minutes. Vu du joueur, cela donnait « énormément
 * d'erreurs serveur » — et des illustrations manquantes, parce qu'une image
 * qui échoue ne se redemande jamais. Une seule panne, deux symptômes.
 *
 * `tickNpcFarms` avait en prime ce détail : il chargeait trente-cinq mille
 * cases pour n'en semer que dix-huit par parcelle, et écrivait une par une.
 *
 * ## Ce que ce fichier garde
 *
 * Le tri se fait là où sont les données. Ces assertions lisent la source parce
 * que c'est la forme de la requête qui compte, et qu'aucune mesure de durée ne
 * serait stable en intégration continue. Elles sont volontairement étroites :
 * elles ne visent que les deux fonctions du tour, pas les routes qui chargent
 * légitimement les cases d'**une** parcelle.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "main.ts"),
  "utf8",
);

/**
 * Le corps d'une fonction nommée, **commentaires retirés**.
 *
 * Sans ce nettoyage, ces tests se liraient eux-mêmes : le commentaire qui
 * explique pourquoi `cells: true` a disparu contient les mots `cells: true`,
 * et l'assertion tombait dessus. On ne juge que du code.
 */
function corpsDe(nom: string): string {
  const debut = SOURCE.indexOf(`async function ${nom}(`);
  assert.notEqual(debut, -1, `${nom} est introuvable dans main.ts`);
  const fin = SOURCE.indexOf("\n}\n", debut);
  assert.notEqual(fin, -1, `la fin de ${nom} est introuvable`);
  return SOURCE.slice(debut, fin)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("le tour de simulation reste borné", () => {
  it("ne charge pas toutes les cases pour publier les consignes", () => {
    const corps = corpsDe("publishFromConsignes");
    // La requête de tête ne ramène plus les cases ; elles se lisent parcelle
    // par parcelle, et seulement pour celles qu'on atteint vraiment.
    const tete = corps.slice(0, corps.indexOf("for (const user of users)"));
    assert.ok(
      !tete.includes("cells: true"),
      "publishFromConsignes recharge toutes les cases de tous les comptes",
    );
    assert.ok(
      !corps.includes("parcel.cells"),
      "la boucle doit lire les cases de la parcelle courante, pas celles de la requête de tête",
    );
    assert.ok(
      corps.includes('prisma.parcelCell.findMany({ where: { parcelId: parcel.id } })'),
      "les cases doivent se lire parcelle par parcelle",
    );
  });

  it("ne charge pas toutes les cases pour semer dix-huit cases", () => {
    const corps = corpsDe("tickNpcFarms");
    assert.ok(
      !corps.includes("cells: true"),
      "tickNpcFarms recharge toutes les cases de toutes les fermes PNJ",
    );
    // Le tri est poussé dans la base, et la moisson de candidates est bornée.
    assert.ok(corps.includes("take: NPC_SOW_PER_TICK"), "la lecture doit être bornée par `take`");
    assert.ok(corps.includes('kind: "EMPTY"'), "le filtre doit être en SQL, pas en JavaScript");
  });

  it("sème toute une parcelle en une écriture, pas dix-huit", () => {
    const corps = corpsDe("tickNpcFarms");
    assert.ok(
      corps.includes("prisma.parcelCell.updateMany"),
      "les dix-huit cases reçoivent les mêmes valeurs : une seule écriture suffit",
    );
    assert.ok(
      !corps.includes("prisma.parcelCell.update({"),
      "une écriture par case, c'est jusqu'à quatre mille allers-retours par tour",
    );
  });

  it("écarte la parcelle hors saison avant de lire la moindre case", () => {
    /*
     * L'ordre compte : le test de saison passait **après** le chargement des
     * cases, si bien qu'un hiver entier se payait le prix fort pour ne rien
     * semer. Il passe maintenant devant.
     */
    const corps = corpsDe("tickNpcFarms");
    const saison = corps.indexOf("canSowInSeason");
    const lecture = corps.indexOf("prisma.parcelCell.findMany");
    assert.ok(saison !== -1 && lecture !== -1, "les deux repères doivent exister");
    assert.ok(
      saison < lecture,
      "le test de saison doit précéder la lecture des cases",
    );
  });
});
