import { useEffect, useRef, useState } from "react";

/**
 * Les « +120 € » qui s'envolent de la bourse.
 *
 * Dans un jeu de ferme, l'argent qui rentre se voit : un chiffre jaillit de
 * la pastille et monte en s'effaçant. Ici on le déduit de la seule chose
 * qu'on connaisse — la trésorerie avant et après — ce qui couvre d'un coup
 * les ventes, les achats, les primes et les chantiers, sans toucher à aucun
 * d'eux. La première valeur ne compte pas : se connecter n'est pas un gain.
 */
type Gain = { id: number; montant: number };

export function Gains({ valeur, unite = "€" }: { valeur: number | null | undefined; unite?: string }) {
  const avant = useRef<number | null>(null);
  const suivant = useRef(1);
  const [gains, setGains] = useState<Gain[]>([]);

  useEffect(() => {
    if (valeur == null || !Number.isFinite(valeur)) return;
    const prec = avant.current;
    avant.current = valeur;
    if (prec == null) return;
    const montant = Math.round(valeur - prec);
    if (!montant) return;
    const id = suivant.current++;
    setGains((g) => [...g.slice(-2), { id, montant }]);
    const t = window.setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 1400);
    return () => window.clearTimeout(t);
  }, [valeur]);

  if (!gains.length) return null;
  return (
    <span className="gains-vol" aria-hidden="true">
      {gains.map((g) => (
        <span key={g.id} className={`gain-vol ${g.montant > 0 ? "plus" : "moins"}`}>
          {g.montant > 0 ? "+" : "−"}
          {Math.abs(g.montant).toLocaleString("fr-FR")} {unite}
        </span>
      ))}
    </span>
  );
}
