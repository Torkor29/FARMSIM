import { useEffect, useRef, useState } from "react";
import type { LedgerPage } from "@farmsim/shared";

/** Le curseur garde la même borne de temps pendant la consultation. */
export function useLedger(request: (path: string) => Promise<unknown>, userId: string | undefined, open: boolean) {
  const [jours, setJours] = useState(7);
  const [page, setPage] = useState<LedgerPage | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const snapshot = useRef<string | null>(null);

  useEffect(() => {
    setCursor(null);
    setPage(null);
    snapshot.current = null;
  }, [userId, open, jours]);

  useEffect(() => {
    if (!open || !userId) return;
    // Lors d’un changement de période, attendre la remise à zéro du curseur.
    if (cursor && !snapshot.current) return;
    let active = true;
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({ jours: String(jours) });
    if (cursor) query.set("cursor", cursor);
    if (snapshot.current) query.set("until", snapshot.current);
    void request(`/players/${userId}/ledger?${query}`)
      .then((result) => {
        if (!active) return;
        const next = result as LedgerPage;
        snapshot.current = next.until;
        setPage((previous) => ({ ...next, lignes: cursor && previous ? [...previous.lignes, ...next.lignes] : next.lignes }));
      })
      .catch(() => { if (active) setError("Impossible de charger le journal. Réessayez."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request, userId, open, jours, cursor, retry]);

  return {
    jours, setJours, page, loading, error,
    more: () => { if (!loading && page?.nextCursor) setCursor(page.nextCursor); },
    retry: () => setRetry((n) => n + 1),
  };
}
