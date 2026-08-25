/**
 * Met à l'abri les codes d'accès restés en clair.
 *
 * Le code d'accès est passé au hachage bcrypt, et un compte encore en clair
 * bascule tout seul à sa première connexion réussie. Reste le cas que ce
 * rattrapage n'atteint jamais : **celui qui ne se reconnecte pas**. Son code
 * dort en clair dans la base, indéfiniment — et c'est précisément la ligne que
 * quelqu'un a fini par lire.
 *
 * Ce script balaie ce qui reste. Il ne perd rien : hacher un code **connu**
 * conserve la capacité de le vérifier, donc aucun joueur n'est invalidé. Il
 * pourra se connecter avec le même code qu'avant, simplement vérifié contre
 * son empreinte.
 *
 * On le lance une fois après le déploiement, sur la machine du jeu :
 *
 *     docker compose exec farmsim node /app/scripts/farmsim-hacher-codes.mjs
 *     docker compose exec farmsim node /app/scripts/farmsim-hacher-codes.mjs --vraiment
 *
 * **Il ne modifie rien par défaut.** Sans `--vraiment`, il dit ce qu'il
 * ferait — c'est le bon réglage pour un outil qu'on lance sur les données de
 * production, et c'est la convention des autres scripts de ce dossier.
 *
 * Il est **rejouable sans risque** : une empreinte est reconnue comme telle et
 * laissée en place. Le relancer ne re-hache pas ce qui l'est déjà, et ne
 * verrouille donc personne dehors.
 */
import { createRequire } from "node:module";

import { codeCorrespond, doitEtreMigre, hacherCode } from "../apps/api/dist/access-code.js";

/**
 * Le client Prisma, résolu **depuis `apps/api`**.
 *
 * Node résout un nom de paquet à partir du fichier qui l'importe, pas du
 * dossier courant : un `import "@prisma/client"` écrit ici chercherait dans
 * `scripts/node_modules` puis à la racine, où pnpm ne l'installe pas — il
 * appartient à `apps/api`. `createRequire` ancré sur son `package.json` résout
 * comme le ferait le serveur lui-même, aussi bien depuis le dépôt que depuis
 * l'image.
 *
 * Il n'est chargé que par la ligne de commande : `hacherCodesEnClair()` reçoit
 * son client en paramètre et n'a donc besoin de rien.
 */
function clientPrisma() {
  const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
  return require("@prisma/client").PrismaClient;
}

/**
 * Migre les codes en clair d'une base.
 *
 * Le contrôle après coup n'est pas de la coquetterie : on **relit** l'empreinte
 * écrite et on vérifie qu'elle reconnaît toujours le code d'origine. Une
 * migration de secrets qui se tromperait mettrait des joueurs dehors sans
 * aucun moyen de revenir en arrière — l'ancien code, lui, aurait disparu.
 */
export async function hacherCodesEnClair(prisma, { vraiment = false } = {}) {
  const comptes = await prisma.user.findMany({
    select: { id: true, email: true, accessCode: true },
  });

  const aMigrer = comptes.filter((c) => doitEtreMigre(c.accessCode));
  const dejaFaits = comptes.filter((c) => !doitEtreMigre(c.accessCode)).length;

  if (!vraiment) return { total: comptes.length, dejaFaits, migres: 0, aMigrer: aMigrer.length };

  let migres = 0;
  for (const compte of aMigrer) {
    const clair = compte.accessCode;
    const empreinte = await hacherCode(clair);
    // On ne remplace que si la ligne est **encore** en clair : une connexion
    // survenue entre la lecture et l'écriture l'a peut-être déjà migrée, et
    // l'écraser reviendrait à hacher une empreinte.
    const touche = await prisma.user.updateMany({
      where: { id: compte.id, accessCode: clair },
      data: { accessCode: empreinte },
    });
    if (touche.count === 0) continue;

    const relu = await prisma.user.findUnique({
      where: { id: compte.id },
      select: { accessCode: true },
    });
    if (!relu || !(await codeCorrespond(relu.accessCode, clair))) {
      // On remet le clair plutôt que de laisser un compte inaccessible : la
      // fuite de données est un problème, un joueur enfermé dehors en est un
      // autre, et celui-ci ne se répare pas.
      await prisma.user.update({ where: { id: compte.id }, data: { accessCode: clair } });
      throw new Error(
        `l'empreinte écrite pour ${compte.email} ne reconnaît pas son code — ` +
          "code d'origine rétabli, rien d'autre n'a été modifié",
      );
    }
    migres += 1;
  }

  return { total: comptes.length, dejaFaits, migres, aMigrer: aMigrer.length };
}

const appeleDirectement = process.argv[1]?.endsWith("farmsim-hacher-codes.mjs");
if (appeleDirectement) {
  const vraiment = process.argv.includes("--vraiment");
  const prisma = new (clientPrisma())();
  try {
    const bilan = await hacherCodesEnClair(prisma, { vraiment });
    if (vraiment) {
      console.log(
        `${bilan.migres} code(s) mis à l'abri sur ${bilan.total} compte(s) — ` +
          `${bilan.dejaFaits} l'étaient déjà.`,
      );
    } else {
      console.log(
        `${bilan.aMigrer} code(s) encore en clair sur ${bilan.total} compte(s) — ` +
          `${bilan.dejaFaits} déjà hachés.\n` +
          "Rien n'a été modifié. Relancez avec --vraiment pour les hacher.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
