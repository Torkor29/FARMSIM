/**
 * Le négociant livre, il ne remplit pas le silo — et l'écran doit le dire.
 *
 * ## Trois symptômes, un seul défaut
 *
 * Signalé en jouant le 31 août : « quand j'essaye d'acheter de la paille je
 * clique mais on dirait que j'ai rien pour autant », « ça va se stocker
 * où ? », et « quand je clique sur nourrir mon élevage du coup je peux pas ».
 *
 * Les trois disent la même chose. `POST /market/buy` ne met rien au stock :
 * il crée une commande qui voyage, se pose en **caisse dans la cour**, et
 * n'entre au silo qu'une fois rentrée — à la main, ou d'elle-même trois
 * minutes plus tard. Le commentaire du client affirmait pourtant « la
 * marchandise est au silo », et le message annonçait « 5 t de paille · −360 € »
 * comme si elle l'était.
 *
 * D'où le troisième symptôme, qui était le plus sûr : l'enchaînement achat →
 * distribution servait un stock qui n'existait pas encore, et échouait sans
 * que rien ne l'explique.
 *
 * Ces assertions lisent la source : ce qui compte est ce que l'écran promet.
 */

import fs from "node:fs";

const APP = fs.readFileSync("src/App.tsx", "utf8");

/** `buyInput` seul — le reste du fichier parle d'autres achats. */
const ACHAT = (() => {
  const debut = APP.indexOf("async function buyInput(");
  expect(debut).toBeGreaterThan(-1);
  return APP.slice(debut, APP.indexOf("\n  }", APP.indexOf("finally", debut)));
})();

const APP_ENTIER = APP;

describe("l'achat au négociant", () => {
  it("annonce un colis à venir, jamais une marchandise rentrée", () => {
    expect(ACHAT).toMatch(/livré/);
    // L'ancien message présentait la marchandise comme acquise.
    expect(ACHAT).not.toMatch(/t de \$\{nom\.toLowerCase\(\)\} · −\$\{r\.cost\} €`\)/);
  });

  it("fait rentrer la caisse par l'attelage, pas par téléportation", () => {
    /*
     * « On clique sur le paquet pour l'envoyer au silo et là c'est l'engin
     * qui l'amène. » Le convoi tracteur + remorque existait déjà pour les
     * livraisons entre joueurs ; il sert maintenant aussi à rentrer une
     * caisse du négociant, et il part de la case où elle était posée.
     */
    expect(APP_ENTIER).toMatch(/const caisse = supplies\.find\(\(s\) => s\.id === id\)/);
    expect(APP_ENTIER).toMatch(
      /flashDeliveryArrival\(r\.collected, caisse \? \{ x: caisse\.x, y: caisse\.y \} : undefined\)/,
    );
    expect(APP_ENTIER).toMatch(
      /function flashDeliveryArrival\(commodity\?: string, depuis\?: \{ x: number; y: number \}\)/,
    );
  });

  it("dit où le colis atterrit, quand, et quoi en faire", () => {
    // « ça va se stocker où ? » — la question n'avait pas de réponse à
    // l'écran. Elle en a une, et elle nomme le geste suivant.
    expect(ACHAT).toMatch(/colis/);
    expect(ACHAT).toMatch(/parcelle/);
    expect(ACHAT).toMatch(/dans \$\{secondes\} s/);
    expect(ACHAT).toMatch(/clique dessus pour l’envoyer au silo/);
    // Le délai vient du serveur, pas d'une constante recopiée côté écran.
    expect(ACHAT).toMatch(/r\.delivery\.arrivesAt/);
  });

  it("ne distribue plus un stock qui n'est pas rentré", () => {
    /*
     * L'enchaînement appelait `feedHerd` dans la foulée de l'achat. Il ne
     * pouvait que rater : la caisse est encore sur la route. Le joueur garde
     * son intention, mais on lui dit le geste qui manque.
     */
    expect(ACHAT).not.toMatch(/await feedHerd\(/);
    expect(ACHAT).toMatch(/Tu pourras nourrir le lot ensuite\./);
  });
});
