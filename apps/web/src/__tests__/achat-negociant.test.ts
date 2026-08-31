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

describe("l'achat au négociant", () => {
  it("annonce une commande, jamais une livraison", () => {
    expect(ACHAT).toMatch(/commandées/);
    // L'ancien message présentait la marchandise comme acquise.
    expect(ACHAT).not.toMatch(/t de \$\{nom\.toLowerCase\(\)\} · −\$\{r\.cost\} €`\)/);
  });

  it("dit où la marchandise atterrit, et quand", () => {
    // « ça va se stocker où ? » — la question n'avait pas de réponse à
    // l'écran. Elle en a une, et elle nomme la cour.
    expect(ACHAT).toMatch(/caisse/);
    expect(ACHAT).toMatch(/cour/);
    expect(ACHAT).toMatch(/le camion arrive dans \$\{secondes\} s/);
    // La date vient du serveur, pas d'une constante recopiée côté écran.
    expect(ACHAT).toMatch(/r\.delivery\.arrivesAt/);
  });

  it("ne distribue plus un stock qui n'est pas rentré", () => {
    /*
     * L'enchaînement appelait `feedHerd` dans la foulée de l'achat. Il ne
     * pouvait que rater : la caisse est encore sur la route. Le joueur garde
     * son intention, mais on lui dit le geste qui manque.
     */
    expect(ACHAT).not.toMatch(/await feedHerd\(/);
    expect(ACHAT).toMatch(/Rentre la caisse posée dans ta cour, puis nourris le lot\./);
  });
});
