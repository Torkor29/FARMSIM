/**
 * Réunir deux parcelles : la trame de la commune, son orientation, et ce que
 * coûte d'effacer le chemin de terre entre deux champs.
 *
 * Le paysage pose les parcelles d'une commune sur une trame régulière,
 * tournée d'un quart de tour pour montrer le gros de la commune. Pour réunir
 * deux parcelles, le serveur doit savoir **où** le paysage les dessine : la
 * trame, son pas en cases, et son orientation vivent donc ici, lus des deux
 * côtés.
 */

/** Un quart de tour : 0, 1, 2 ou 3. */
export type Quart = 0 | 1 | 2 | 3;

/**
 * De quel quart de tour poser la carte sur la trame.
 *
 * En vue isométrique, tout ce qui est en amont de la ferme sort par le haut du
 * cadre : la campagne ne peut montrer que le quartier **aval**, celui où
 * `col + rang` croît. Or la ferme du joueur n'est pas au milieu de sa commune
 * — elle peut être dans n'importe quel coin. Posée telle quelle, une ferme du
 * bord sud n'aurait aucun voisin visible : mesuré en jeu, seize parcelles
 * existaient autour et deux se dessinaient.
 *
 * On tourne donc la carte d'un quart de tour ou trois pour amener le gros de
 * la commune dans le quartier visible. C'est une **rotation** et jamais une
 * symétrie : le plan du Bureau et le paysage doivent rester superposables à
 * une rotation près, sinon la parcelle qu'on croit acheter à droite arriverait
 * à gauche.
 *
 * Le choix ne dépend que de la place du joueur dans sa commune : il ne change
 * donc pas d'un rafraîchissement à l'autre, et le pays ne pivote pas sous les
 * pieds.
 */
export function orientationTrame(
  cases: readonly { col: number; rang: number; statut?: string }[],
): Quart {
  let meilleur: Quart = 0;
  let record = -1;
  for (const quart of [0, 1, 2, 3] as const) {
    let vus = 0;
    for (const c of cases) {
      const t = tourner(c, quart);
      if (t.col === 0 && t.rang === 0) continue;
      if (t.col + t.rang < 0) continue;
      /*
       * Ses parcelles comptent comme les autres.
       *
       * Elles pesaient cent voisins, pour ne jamais tomber en amont, hors du
       * cadre. Mais une parcelle à soi ou à vendre se dessine maintenant
       * aussi en amont, la lisière reculant derrière elle : la peser à part
       * ne faisait plus que **tourner le pays** au moment de l'achat — la
       * parcelle qu'on venait de payer sautait à l'autre bout de l'écran.
       */
      vus += 1;
    }
    if (vus > record) {
      record = vus;
      meilleur = quart;
    }
  }
  return meilleur;
}

/**
 * Un quart de tour dans le plan de la trame.
 *
 * Le `+ 0` n'est pas décoratif : `-0` traverse les comparaisons de valeur du
 * langage sans se faire remarquer, puis ressort dans une clé de reconstruction
 * ou une comparaison stricte, où il ne vaut plus tout à fait zéro.
 */
export function tourner(
  c: { col: number; rang: number },
  quart: 0 | 1 | 2 | 3,
): { col: number; rang: number } {
  switch (quart) {
    case 1:
      return { col: -c.rang + 0, rang: c.col + 0 };
    case 2:
      return { col: -c.col + 0, rang: -c.rang + 0 };
    case 3:
      return { col: c.rang + 0, rang: -c.col + 0 };
    default:
      return { col: c.col + 0, rang: c.rang + 0 };
  }
}


/* ------------------------------------------------------------------ */
/* Réunir                                                               */
/* ------------------------------------------------------------------ */

/**
 * Le pas de la trame, en cases.
 *
 * Il loge la plus grande parcelle du catalogue (16 cases), son talus et un
 * chemin de terre. Un nombre **entier** de cases : deux parcelles réunies
 * tombent alors exactement à leur place, la seconde décalée d'un pas tout
 * rond de la première — sans le demi-pas qui la ferait glisser à chaque
 * réunion.
 */
export const PAS_TRAME_CASES = 20;

/** Ce que coûte une case de chemin de terre rendue au champ : défricher, niveler, labourer. */
export const PRIX_REUNION_PAR_CASE = 50;

export type ParcelleSurTrame = { mapX: number; mapY: number; gridW: number; gridH: number };

/**
 * Où tombe la grille d'une parcelle dans celle de l'hôte.
 *
 * Un décalage entier de cases : la case `(x, y)` de l'autre devient
 * `(x + dx, y + dy)` chez l'hôte. Les deux grilles sont centrées sur leur
 * case de trame ; l'écart de leurs centres est un pas de trame dans la
 * direction tournée, plus la demi-différence de leurs tailles.
 */
export function decalageDansHote(hote: ParcelleSurTrame, autre: ParcelleSurTrame, quart: Quart): { dx: number; dy: number } {
  const t = tourner({ col: autre.mapX - hote.mapX, rang: autre.mapY - hote.mapY }, quart);
  return {
    dx: t.col * PAS_TRAME_CASES + Math.round((hote.gridW - autre.gridW) / 2),
    dy: t.rang * PAS_TRAME_CASES + Math.round((hote.gridH - autre.gridH) / 2),
  };
}

/** Un rectangle de cases, bornes incluses. */
export type RectCases = { x0: number; y0: number; x1: number; y1: number };

/** La grille d'une parcelle, posée dans le repère de l'hôte. */
export function rectDansHote(hote: ParcelleSurTrame, autre: ParcelleSurTrame, quart: Quart): RectCases {
  const { dx, dy } = decalageDansHote(hote, autre, quart);
  return { x0: dx, y0: dy, x1: dx + autre.gridW - 1, y1: dy + autre.gridH - 1 };
}

/**
 * Le chemin de terre entre deux parcelles voisines, en cases.
 *
 * La bande qui les sépare, sur la longueur où elles se font face : c'est ce
 * qui devient du champ quand on les réunit. Vide si elles ne se font pas
 * face (en diagonale, ou séparées par plus d'une case de trame).
 */
export function couloirEntre(a: RectCases, b: RectCases): RectCases | null {
  // Côte à côte (est–ouest) : elles se recouvrent en y.
  const y0 = Math.max(a.y0, b.y0);
  const y1 = Math.min(a.y1, b.y1);
  if (y0 <= y1) {
    if (a.x1 < b.x0) return a.x1 + 1 <= b.x0 - 1 ? { x0: a.x1 + 1, x1: b.x0 - 1, y0, y1 } : null;
    if (b.x1 < a.x0) return b.x1 + 1 <= a.x0 - 1 ? { x0: b.x1 + 1, x1: a.x0 - 1, y0, y1 } : null;
  }
  const x0 = Math.max(a.x0, b.x0);
  const x1 = Math.min(a.x1, b.x1);
  if (x0 <= x1) {
    if (a.y1 < b.y0) return a.y1 + 1 <= b.y0 - 1 ? { y0: a.y1 + 1, y1: b.y0 - 1, x0, x1 } : null;
    if (b.y1 < a.y0) return b.y1 + 1 <= a.y0 - 1 ? { y0: b.y1 + 1, y1: a.y0 - 1, x0, x1 } : null;
  }
  return null;
}

/** Le nombre de cases d'un rectangle. */
export function surfaceRect(r: RectCases): number {
  return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
}

/**
 * La route sépare-t-elle ces deux parcelles ?
 *
 * La route du pays court dans le couloir de trame juste au sud de la cour du
 * siège, d'un bord à l'autre de la commune : entre le rang 0 et le rang 1 de
 * la trame tournée, comptés depuis le siège. C'est une route goudronnée, pas
 * un chemin de terre : elle ne s'efface pas.
 */
export function separeesParLaRoute(
  siege: { mapX: number; mapY: number },
  a: { mapX: number; mapY: number },
  b: { mapX: number; mapY: number },
  quart: Quart,
): boolean {
  const rang = (p: { mapX: number; mapY: number }) =>
    tourner({ col: p.mapX - siege.mapX, rang: p.mapY - siege.mapY }, quart).rang;
  const ra = rang(a);
  const rb = rang(b);
  return (ra <= 0 && rb >= 1) || (rb <= 0 && ra >= 1);
}

/**
 * La cour du siège est-elle entre les deux ?
 *
 * Elle déborde de l'île du siège vers l'ouest de la trame tournée — c'est par
 * là qu'arrivent les camions. Réunir le siège à sa voisine de ce côté
 * enterrerait le parking.
 */
export function separeesParLaCour(
  siege: { mapX: number; mapY: number },
  a: { mapX: number; mapY: number },
  b: { mapX: number; mapY: number },
  quart: Quart,
): boolean {
  const rel = (p: { mapX: number; mapY: number }) =>
    tourner({ col: p.mapX - siege.mapX, rang: p.mapY - siege.mapY }, quart);
  const ta = rel(a);
  const tb = rel(b);
  const estSiege = (t: { col: number; rang: number }) => t.col === 0 && t.rang === 0;
  const aLOuest = (t: { col: number; rang: number }) => t.col === -1 && t.rang === 0;
  return (estSiege(ta) && aLOuest(tb)) || (estSiege(tb) && aLOuest(ta));
}
