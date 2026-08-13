/**
 * Courbe des cours passés, en pleine largeur d'une ligne de texte.
 *
 * Sans mémoire des prix, une cotation ne veut rien dire : 265 TRN la tonne
 * est une bonne affaire ou une braderie selon d'où le cours vient. Le tracé
 * ne cherche pas la précision — pas d'axes, pas de graduations — mais la
 * forme : ça monte, ça descend, ça stagne.
 */

type Point = { at: string; price: number };

type Props = {
  points: Point[];
  /** Hauteur du tracé en pixels ; la largeur suit le conteneur */
  height?: number;
};

const VIEW_W = 100;

export function PriceSparkline({ points, height = 34 }: Props) {
  if (points.length < 2) {
    return <div className="sparkline empty">Pas encore d’historique</div>;
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  // Un cours parfaitement plat donnerait une division par zéro : on lui
  // réserve une bande, ce qui le dessine au milieu plutôt qu'au bord.
  const span = max - min || Math.max(1, max * 0.02);

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * VIEW_W;
    const y = height - ((p.price - min) / span) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = first > 0 ? (last - first) / first : 0;
  const trend = change > 0.005 ? "up" : change < -0.005 ? "down" : "flat";
  const pct = `${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)} %`;

  return (
    <div className={`sparkline ${trend}`}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Cours sur la période : ${pct}, de ${first.toFixed(0)} à ${last.toFixed(0)} TRN la tonne`}
      >
        <polyline points={coords.join(" ")} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="sparkline-meta">
        <span className="range">
          {min.toFixed(0)} – {max.toFixed(0)}
        </span>
        <span className="change">{pct}</span>
      </div>
    </div>
  );
}
