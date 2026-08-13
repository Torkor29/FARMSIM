import { useEffect, useMemo, useState } from "react";
import { PriceSparkline } from "./PriceSparkline";
import {
  DRYING,
  GOOD_DEFS,
  lotQualityLine,
  SPOILAGE_PER_CYCLE,
  isPerishable,
  spoilageWarning,
  dealerAskPrice,
  DEALER_RATIO,
  LISTING_COMMISSION_RATE,
  LISTING_FEE_RATE,
  SALE_CHANNEL_LABELS,
  listingFee,
  listingProceeds,
  quoteAllChannels,
  maxSelectableTons,
  SELLABLE_GOODS,
  futuresPrice,
  FUTURES_HORIZONS_H,
  FUTURES_DISCOUNT,
  FUTURES_MIN_TONS,
  FUTURES_PENALTY_RATE,
  type ChannelQuote,
  type CropCode,
  type SaleChannel,
  type TradeGood,
} from "@farmsim/shared";

export type StockItem = {
  id: string;
  itemCode: string;
  qty: number;
  quality: number;
  moisture: number;
};

export type Listing = {
  id: string;
  commodity: string;
  tons: number;
  pricePerTon: number;
  total: number;
  moisture: number;
  quality: number;
  sellerName: string;
  mine: boolean;
  expiresInMs: number;
};

export type MarketDelivery = {
  id: string;
  commodity: string;
  tons: number;
  moisture: number;
  quality: number;
  status: string;
  role: "SELLER" | "BUYER";
  counterparty: string;
  dueInMs: number;
  autoFee: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  stock: StockItem[];
  listings: Listing[];
  deliveries: MarketDelivery[];
  marketPrices: { commodity: string; price: number; stockTons: number }[];
  crd: number;
  busy: boolean;
  onSellDealer: (commodity: TradeGood, tons: number) => void;
  onSellMarket: (commodity: TradeGood, tons: number) => void;
  onList: (commodity: TradeGood, tons: number, pricePerTon: number) => void;
  onBuyListing: (id: string) => void;
  onCancelListing: (id: string) => void;
  onDeliverLot: (id: string) => void;
  onAutoDeliverLot: (id: string) => void;
  onDry: (itemId: string) => void;
  onBuyInput: (commodity: TradeGood, tons: number) => void;
  /** Cours passés de la marchandise, du plus ancien au plus récent */
  onLoadHistory: (commodity: TradeGood) => Promise<{ at: string; price: number }[]>;
  futures: FuturesContract[];
  onOpenFuture: (commodity: TradeGood, tons: number, horizonH: number) => void;
  onDeliverFuture: (id: string) => void;
};

export type FuturesContract = {
  id: string;
  commodity: string;
  tons: number;
  pricePerTon: number;
  dueAt: number;
  status: string;
  spotNow: number | null;
};

function moisturePenaltyOf(moisture: number): number {
  return moisture > DRYING.sellThreshold ? DRYING.sellPenaltyAbove : 0;
}

function DeliveryList({
  deliveries,
  busy,
  crd,
  onDeliverLot,
  onAutoDeliverLot,
}: {
  deliveries: MarketDelivery[];
  busy: boolean;
  crd: number;
  onDeliverLot: (id: string) => void;
  onAutoDeliverLot: (id: string) => void;
}) {
  if (!deliveries.length) return null;
  return (
    <>
      <h3 className="spaced">Livraisons</h3>
      <ul className="listing-list">
        {deliveries.map((d) => (
          <li key={d.id}>
            <span>
              <strong>{GOOD_DEFS[d.commodity as TradeGood]?.name ?? d.commodity}</strong>
              <em>
                {d.status === "PENDING" ? "en attente de livraison" : "arrivé"}
                {" · "}
                {lotQualityLine({
                  tons: d.tons,
                  moisture: d.moisture,
                  quality: d.quality,
                })}
              </em>
              <em className="listing-seller">{d.counterparty}</em>
            </span>
            {d.status === "PENDING" && d.role === "SELLER" && (
              <span className="listing-right">
                <button type="button" className="channel-go" disabled={busy} onClick={() => onDeliverLot(d.id)}>
                  Livrer
                </button>
              </span>
            )}
            {d.status === "PENDING" && d.role === "BUYER" && (
              <span className="listing-right">
                <button
                  type="button"
                  className="channel-go"
                  disabled={busy || crd < d.autoFee}
                  onClick={() => onAutoDeliverLot(d.id)}
                >
                  Faire livrer · {d.autoFee} TRN
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Écran de vente : stock, trois débouchés comparés, et la criée. */
export function MarketPanel({
  open,
  onClose,
  stock,
  listings,
  deliveries,
  marketPrices,
  crd,
  busy,
  onSellDealer,
  onSellMarket,
  onList,
  onBuyListing,
  onCancelListing,
  onDeliverLot,
  onAutoDeliverLot,
  onDry,
  onBuyInput,
  onLoadHistory,
  futures,
  onOpenFuture,
  onDeliverFuture,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tons, setTons] = useState(0);
  const [ask, setAsk] = useState(0);
  const [tab, setTab] = useState<"SELL" | "BUY" | "SUPPLY" | "FUTURES">("SELL");
  const [horizon, setHorizon] = useState<number>(3);
  const [good, setGood] = useState<TradeGood>("WHEAT");
  const [futTons, setFutTons] = useState(10);
  const [hayTons, setHayTons] = useState(5);

  const item = useMemo(
    () => stock.find((s) => s.id === selectedId) ?? stock[0] ?? null,
    [stock, selectedId],
  );
  const price = useMemo(
    () => marketPrices.find((m) => m.commodity === item?.itemCode),
    [marketPrices, item],
  );

  /**
   * Plus grande quantité réellement sélectionnable, au pas du curseur.
   *
   * L'affichage travaille au centième de tonne quand le stock en compte
   * trois. Arrondir au plus proche proposait donc, une fois sur deux, une
   * quantité supérieure au stock : le serveur refusait, et le joueur voyait
   * un bouton « Vendre » sans effet. On tronque.
   */
  const maxTons = useMemo(() => (item ? maxSelectableTons(item.qty) : 0), [item?.qty]);

  useEffect(() => {
    if (!item) return;
    setTons(maxTons);
    if (price) setAsk(Math.round(price.price * 1.15));
  }, [item?.id, maxTons, price?.price]);

  const [history, setHistory] = useState<{ at: string; price: number }[]>([]);
  useEffect(() => {
    if (!open || !item) {
      setHistory([]);
      return;
    }
    let alive = true;
    onLoadHistory(item.itemCode as TradeGood)
      .then((pts) => {
        if (alive) setHistory(pts);
      })
      .catch(() => {
        if (alive) setHistory([]);
      });
    return () => {
      alive = false;
    };
  }, [open, item?.itemCode, onLoadHistory]);

  const quotes: ChannelQuote[] = useMemo(() => {
    if (!item || !price || tons <= 0) return [];
    return quoteAllChannels({
      commodity: item.itemCode as TradeGood,
      tons,
      marketPrice: price.price,
      stockTons: price.stockTons,
      moisturePenalty: moisturePenaltyOf(item.moisture),
      askPricePerTon: ask,
    });
  }, [item, price, tons, ask]);

  if (!open) return null;

  const best = quotes.reduce<ChannelQuote | null>(
    (acc, q) => (!acc || q.net > acc.net ? q : acc),
    null,
  );

  const act = (channel: SaleChannel) => {
    if (!item || tons <= 0) return;
    const code = item.itemCode as TradeGood;
    if (channel === "DEALER") onSellDealer(code, tons);
    else if (channel === "MARKET") onSellMarket(code, tons);
    else onList(code, tons, ask);
  };

  return (
    <div className="market-backdrop" role="dialog" aria-modal="true" aria-label="Vendre">
      <div className="market-sheet glass">
        <header className="market-head">
          <h2>Vendre ma récolte</h2>
          <button type="button" className="ghost" onClick={onClose}>
            Fermer
          </button>
        </header>

        <div className="market-tabs">
          <button
            type="button"
            className={`market-tab ${tab === "SELL" ? "on" : ""}`}
            onClick={() => setTab("SELL")}
          >
            Vendre
          </button>
          <button
            type="button"
            className={`market-tab ${tab === "BUY" ? "on" : ""}`}
            onClick={() => setTab("BUY")}
          >
            Acheter aux autres ({listings.filter((l) => !l.mine).length})
          </button>
          <button
            type="button"
            className={`market-tab ${tab === "SUPPLY" ? "on" : ""}`}
            onClick={() => setTab("SUPPLY")}
          >
            Intrants
          </button>
          <button
            type="button"
            className={`market-tab ${tab === "FUTURES" ? "on" : ""}`}
            onClick={() => setTab("FUTURES")}
          >
            À terme ({futures.filter((f) => f.status === "OPEN").length})
          </button>
        </div>

        {tab === "FUTURES" ? (
          <FuturesTab
            futures={futures}
            marketPrices={marketPrices}
            busy={busy}
            good={good}
            setGood={setGood}
            tons={futTons}
            setTons={setFutTons}
            horizon={horizon}
            setHorizon={setHorizon}
            onOpen={onOpenFuture}
            onDeliver={onDeliverFuture}
          />
        ) : tab === "SUPPLY" ? (
          <SupplyTab
            marketPrices={marketPrices}
            crd={crd}
            busy={busy}
            tons={hayTons}
            onTons={setHayTons}
            onBuy={onBuyInput}
          />
        ) : tab === "SELL" ? (
          !stock.length ? (
            <>
              <p className="market-empty">
                Votre silo est vide. Récoltez d’abord — le grain apparaîtra ici.
              </p>
              <DeliveryList
                deliveries={deliveries}
                busy={busy}
                crd={crd}
                onDeliverLot={onDeliverLot}
                onAutoDeliverLot={onAutoDeliverLot}
              />
            </>
          ) : (
            <>
              <div className="stock-row">
                {stock.map((s) => {
                  const wet = s.moisture > DRYING.sellThreshold;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`stock-chip ${item?.id === s.id ? "on" : ""}`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <strong>{GOOD_DEFS[s.itemCode as TradeGood]?.name ?? s.itemCode}</strong>
                      <span>
                        {s.qty.toFixed(2)} {GOOD_DEFS[s.itemCode as TradeGood]?.unit ?? "t"}
                      </span>
                      <em className={wet || s.quality <= 2 ? "wet" : ""}>
                        {isPerishable(s.itemCode as TradeGood)
                          ? `−${Math.round((SPOILAGE_PER_CYCLE[s.itemCode as TradeGood] ?? 0) * 100)} % / cycle`
                          : lotQualityLine({
                              tons: s.qty,
                              moisture: s.moisture,
                              quality: s.quality,
                            })}
                      </em>
                    </button>
                  );
                })}
              </div>

              {item && price && (
                <>
                  {spoilageWarning(item.itemCode as TradeGood, item.qty) && (
                    <p className="market-warn perish">
                      {spoilageWarning(item.itemCode as TradeGood, item.qty)}
                    </p>
                  )}

                  {item.moisture > DRYING.sellThreshold && (
                    <p className="market-warn">
                      Trop d’eau : le prix baisse. Séchez.
                      <button type="button" disabled={busy} onClick={() => onDry(item.id)}>
                        Sécher
                      </button>
                    </p>
                  )}
                  {item.quality <= 2 && item.moisture <= DRYING.sellThreshold && (
                    <p className="market-warn">Récolté trop tard — ce lot vaut moins.</p>
                  )}

                  <label className="market-field">
                    <span>
                      Quantité à vendre : <strong>{tons.toFixed(2)} t</strong> sur{" "}
                      {item.qty.toFixed(2)} t
                    </span>
                    <input
                      type="range"
                      min={0.01}
                      max={maxTons}
                      step={0.01}
                      value={Math.min(tons, maxTons)}
                      onChange={(e) => setTons(Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="ghost tiny"
                      disabled={tons >= maxTons}
                      onClick={() => setTons(maxTons)}
                    >
                      Tout ({maxTons.toFixed(2)} t)
                    </button>
                  </label>

                  <p className="market-course">
                    Cours du jour : <strong>{price.price.toFixed(1)} TRN/t</strong>
                  </p>
                  <PriceSparkline points={history} />

                  <div className="channel-grid">
                    {quotes.map((q) => (
                      <div
                        key={q.channel}
                        className={`channel-card ${q.channel === best?.channel ? "best" : ""}`}
                      >
                        <h3>{SALE_CHANNEL_LABELS[q.channel]}</h3>
                        <p className="channel-price">{q.pricePerTon.toFixed(1)} TRN/t</p>
                        <p className="channel-net">
                          {q.net} TRN
                          {q.guaranteed ? (
                            <em className="sure">encaissé tout de suite</em>
                          ) : (
                            <em className="risky">si un joueur achète</em>
                          )}
                        </p>
                        <p className="channel-note">{q.note}</p>

                        {q.channel === "LISTING" && (
                          <label className="ask-field">
                            <span>Votre prix</span>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={ask}
                              onChange={(e) => setAsk(Number(e.target.value))}
                            />
                          </label>
                        )}

                        <button
                          type="button"
                          className="channel-go"
                          disabled={
                            busy ||
                            tons <= 0 ||
                            (q.channel === "LISTING" && crd < listingFee(ask, tons))
                          }
                          onClick={() => act(q.channel)}
                        >
                          {q.channel === "LISTING" ? "Mettre en vente" : "Vendre"}
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="market-rules">
                    Le négociant paie {Math.round(DEALER_RATIO * 100)} % du cours mais achète
                    toujours. La criée prélève {Math.round(LISTING_FEE_RATE * 100)} % de frais
                    au dépôt, non remboursés, puis{" "}
                    {Math.round(LISTING_COMMISSION_RATE * 100)} % à la vente.
                  </p>
                </>
              )}

              <DeliveryList
                deliveries={deliveries}
                busy={busy}
                crd={crd}
                onDeliverLot={onDeliverLot}
                onAutoDeliverLot={onAutoDeliverLot}
              />

              {listings.some((l) => l.mine) && (
                <>
                  <h3 className="spaced">Mes annonces</h3>
                  <ul className="listing-list">
                    {listings
                      .filter((l) => l.mine)
                      .map((l) => (
                        <li key={l.id}>
                          <span>
                            <strong>
                              {GOOD_DEFS[l.commodity as TradeGood]?.name ?? l.commodity}
                            </strong>
                            <em>
                              {lotQualityLine({
                                tons: l.tons,
                                moisture: l.moisture,
                                quality: l.quality,
                              })}{" "}
                              · {l.pricePerTon.toFixed(0)} TRN/t ·{" "}
                              {listingProceeds(l.pricePerTon, l.tons)} TRN net
                            </em>
                          </span>
                          <span className="listing-right">
                            <em className="listing-ttl">
                              {Math.max(0, Math.round(l.expiresInMs / 60000))} min
                            </em>
                            <button type="button" disabled={busy} onClick={() => onCancelListing(l.id)}>
                              Retirer
                            </button>
                          </span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </>
          )
        ) : (
          <>
            <p className="muted tiny">
              Les lots des autres exploitants. Après l’achat : pas encore chez vous, quelqu’un
              doit livrer.
            </p>
            {listings.filter((l) => !l.mine).length === 0 ? (
              <p className="market-empty">Aucun lot en vente pour le moment.</p>
            ) : (
              <ul className="listing-list">
                {listings
                  .filter((l) => !l.mine)
                  .map((l) => (
                    <li key={l.id}>
                      <span>
                        <strong>
                          {GOOD_DEFS[l.commodity as TradeGood]?.name ?? l.commodity}
                        </strong>
                        <em>
                          {lotQualityLine({
                            tons: l.tons,
                            moisture: l.moisture,
                            quality: l.quality,
                          })}{" "}
                          · {l.pricePerTon.toFixed(0)} TRN/t
                        </em>
                        <em className="listing-seller">{l.sellerName}</em>
                      </span>
                      <span className="listing-right">
                        <strong>{l.total} TRN</strong>
                        <button
                          type="button"
                          className="channel-go"
                          disabled={busy || crd < l.total}
                          onClick={() => onBuyListing(l.id)}
                        >
                          Acheter
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <DeliveryList
              deliveries={deliveries}
              busy={busy}
              crd={crd}
              onDeliverLot={onDeliverLot}
              onAutoDeliverLot={onAutoDeliverLot}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Achat d'intrants au négociant : il vend plus cher qu'il ne rachète. */
function SupplyTab({
  marketPrices,
  crd,
  busy,
  tons,
  onTons,
  onBuy,
}: {
  marketPrices: { commodity: string; price: number }[];
  crd: number;
  busy: boolean;
  tons: number;
  onTons: (n: number) => void;
  onBuy: (commodity: TradeGood, tons: number) => void;
}) {
  const base =
    marketPrices.find((m) => m.commodity === "HAY")?.price ?? GOOD_DEFS.HAY.basePrice;
  const unit = dealerAskPrice(base);
  const total = Math.round(unit * tons);

  return (
    <div className="supply-tab">
      <p className="muted tiny">
        Le négociant vend le fourrage nécessaire au bétail. Il le facture plus cher
        qu&rsquo;il ne le rachète : produire son propre maïs revient moins cher.
      </p>
      <div className="supply-card">
        <img className="build-art" src="/assets/items/hay-bales.webp" alt="" />
        <span className="build-text">
          <strong>{GOOD_DEFS.HAY.name}</strong>
          <span>{unit.toFixed(1)} TRN/t</span>
        </span>
        <label className="supply-qty">
          <span>Quantité</span>
          <input
            type="number"
            min={1}
            step={1}
            value={tons}
            onChange={(e) => onTons(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <button
          type="button"
          className="channel-go"
          disabled={busy || crd < total}
          onClick={() => onBuy("HAY", tons)}
        >
          Acheter · {total} TRN
        </button>
      </div>
    </div>
  );
}


/**
 * Engager une récolte à venir.
 *
 * Le tableau montre côte à côte le prix garanti et le cours du moment : c'est
 * la seule façon pour le joueur de juger son pari, pendant puis après.
 */
function FuturesTab({
  futures,
  marketPrices,
  busy,
  good,
  setGood,
  tons,
  setTons,
  horizon,
  setHorizon,
  onOpen,
  onDeliver,
}: {
  futures: FuturesContract[];
  marketPrices: { commodity: string; price: number }[];
  busy: boolean;
  good: TradeGood;
  setGood: (g: TradeGood) => void;
  tons: number;
  setTons: (n: number) => void;
  horizon: number;
  setHorizon: (n: number) => void;
  onOpen: (commodity: TradeGood, tons: number, horizonH: number) => void;
  onDeliver: (id: string) => void;
}) {
  const spot = marketPrices.find((m) => m.commodity === good)?.price ?? 0;
  const garanti = futuresPrice(spot, horizon as (typeof FUTURES_HORIZONS_H)[number]);
  const open = futures.filter((f) => f.status === "OPEN");
  const closed = futures.filter((f) => f.status !== "OPEN").slice(0, 5);

  return (
    <div className="futures-tab">
      <p className="muted tiny">
        Vous engagez une récolte que vous n’avez pas encore, à un prix fixé
        maintenant. L’acheteur prend le risque à votre place et le facture :
        le prix garanti est sous le cours du jour. Livrer hors délai coûte{" "}
        {Math.round(FUTURES_PENALTY_RATE * 100)} % de la valeur du contrat.
      </p>

      <div className="futures-form">
        <label className="market-field">
          <span>Marchandise</span>
          <select value={good} onChange={(e) => setGood(e.target.value as TradeGood)}>
            {SELLABLE_GOODS.map((g) => (
              <option key={g} value={g}>
                {GOOD_DEFS[g].name}
              </option>
            ))}
          </select>
        </label>
        <label className="market-field">
          <span>Quantité (t)</span>
          <input
            type="number"
            min={FUTURES_MIN_TONS}
            step={1}
            value={tons}
            onChange={(e) => setTons(Number(e.target.value))}
          />
        </label>
        <label className="market-field">
          <span>Échéance</span>
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {FUTURES_HORIZONS_H.map((h) => (
              <option key={h} value={h}>
                {h} h · −{Math.round(FUTURES_DISCOUNT[h] * 100)} %
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="market-course">
        Cours du jour <strong>{spot.toFixed(1)}</strong> · garanti{" "}
        <strong>{garanti.toFixed(1)} TRN/t</strong> · total{" "}
        <strong>{Math.round(garanti * tons)} TRN</strong>
      </p>
      <button
        type="button"
        className="accent"
        disabled={busy || tons < FUTURES_MIN_TONS || spot <= 0}
        onClick={() => onOpen(good, tons, horizon)}
      >
        S’engager
      </button>

      <h3>Engagements en cours</h3>
      {!open.length && <p className="muted tiny">Aucun engagement.</p>}
      <ul className="list">
        {open.map((f) => {
          const reste = Math.max(0, f.dueAt - Date.now());
          const mins = Math.round(reste / 60000);
          const ecart = f.spotNow === null ? null : Math.round((f.pricePerTon - f.spotNow) * f.tons);
          return (
            <li key={f.id}>
              <span>
                {GOOD_DEFS[f.commodity as TradeGood]?.name ?? f.commodity} ·{" "}
                {f.tons.toFixed(2)} t à {f.pricePerTon.toFixed(0)} TRN/t · échéance dans{" "}
                {mins} min
                {ecart !== null && (
                  <em className={ecart >= 0 ? "gain" : "loss"}>
                    {" "}
                    {ecart >= 0 ? "+" : ""}
                    {ecart} TRN contre le comptant
                  </em>
                )}
              </span>
              <button type="button" className="accent" disabled={busy} onClick={() => onDeliver(f.id)}>
                Livrer
              </button>
            </li>
          );
        })}
      </ul>

      {closed.length > 0 && (
        <>
          <h3>Dénoués</h3>
          <ul className="list">
            {closed.map((f) => (
              <li key={f.id}>
                <span>
                  {GOOD_DEFS[f.commodity as TradeGood]?.name ?? f.commodity} · {f.tons.toFixed(2)} t ·{" "}
                  {f.status === "SETTLED" ? "livré" : "non honoré, pénalité prélevée"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
