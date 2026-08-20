import { useEffect, useMemo, useState } from "react";
import { PriceSparkline } from "./PriceSparkline";
import {
  DRYING,
  GOOD_DEFS,
  GOOD_ICONS,
  lotQualityLine,
  isPerishable,
  spoilageWarning,
  dealerAskPrice,
  DEALER_SELL_MARKUP,
  listingFee,
  quoteAllChannels,
  maxSelectableTons,
  SELLABLE_GOODS,
  SALE_CHANNEL_LABELS,
  PURCHASABLE_GOODS,
  DEALER_INPUT_USE,
  futuresPenalty,
  futuresPrice,
  FUTURES_HORIZONS_H,
  FUTURES_DISCOUNT,
  FUTURES_MIN_TONS,
  FUTURES_PENALTY_RATE,
  type ChannelQuote,
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

function goodName(code: string): string {
  return GOOD_DEFS[code as TradeGood]?.name ?? code;
}

/**
 * Le dessin d'une marchandise.
 *
 * Le repli était l'emoji 📦 — un carton, pour une marchandise inconnue. Comme
 * `GOOD_ICONS` couvre par construction toutes les marchandises du jeu (le type
 * l'impose), ce repli ne se déclenchait jamais ; il ne servait qu'à faire
 * passer le typage. On le remplace par le sac de grain, qui au moins reste
 * dans la famille si un code inattendu remontait un jour du serveur.
 */
function GoodIcon({ code, size = 20 }: { code: string; size?: number }) {
  const src = GOOD_ICONS[code as TradeGood] ?? "/assets/icons/goods/wheat.svg";
  return <img className="good-icon" src={src} alt="" width={size} height={size} aria-hidden="true" />;
}

function qualityOf(code: string, tons: number, moisture: number, quality: number): string {
  const unit = GOOD_DEFS[code as TradeGood]?.unit;
  return lotQualityLine({ tons, moisture, quality, unit });
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
  const pending = deliveries.filter((d) => d.status === "PENDING");
  if (!pending.length) return null;
  return (
    <section className="hall-block">
      <h3>En route</h3>
      <p className="hall-lead">Payé, pas encore arrivé chez l’acheteur.</p>
      <div className="sale-grid">
        {pending.map((d) => (
          <article key={d.id} className="sale-card route">
            <span className="sale-icon" aria-hidden="true">
              <GoodIcon code={d.commodity} />
            </span>
            <div className="sale-body">
              <strong>{goodName(d.commodity)}</strong>
              <span>{qualityOf(d.commodity, d.tons, d.moisture, d.quality)}</span>
              <em>
                {d.role === "BUYER" ? `Acheté chez ${d.counterparty}` : `Pour ${d.counterparty}`}
              </em>
            </div>
            {d.role === "SELLER" ? (
              <button type="button" className="sale-go" disabled={busy} onClick={() => onDeliverLot(d.id)}>
                J’apporte
              </button>
            ) : (
              <span className="sale-pay">
                <button
                  type="button"
                  className="sale-go"
                  disabled={busy || crd < d.autoFee}
                  onClick={() => onAutoDeliverLot(d.id)}
                >
                  Faire venir · {d.autoFee} TRN
                </button>
                {crd < d.autoFee && (
                  <em className="supply-why">Il vous manque {Math.ceil(d.autoFee - crd)} TRN</em>
                )}
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/** Hôtel des ventes : acheter ou vendre, comme à l’entrée. */
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
  const [tab, setTab] = useState<"BUY" | "SELL" | "MORE">("BUY");
  const [horizon, setHorizon] = useState<number>(3);
  const [good, setGood] = useState<TradeGood>("WHEAT");
  const [futTons, setFutTons] = useState(10);
  // Une quantité par intrant : le négociant en vend quatre, et saisir « 12 »
  // pour de la paille ne doit pas changer la ligne du foin.
  const [inputTons, setInputTons] = useState<Partial<Record<TradeGood, number>>>({});

  const item = useMemo(
    () => stock.find((s) => s.id === selectedId) ?? stock[0] ?? null,
    [stock, selectedId],
  );
  const price = useMemo(
    () => marketPrices.find((m) => m.commodity === item?.itemCode),
    [marketPrices, item],
  );

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

  const act = (channel: SaleChannel) => {
    if (!item || tons <= 0) return;
    const code = item.itemCode as TradeGood;
    if (channel === "DEALER") onSellDealer(code, tons);
    else if (channel === "MARKET") onSellMarket(code, tons);
    else onList(code, tons, ask);
  };

  const others = listings.filter((l) => !l.mine);
  const mine = listings.filter((l) => l.mine);
  const dealerQ = quotes.find((q) => q.channel === "DEALER");
  const marketQ = quotes.find((q) => q.channel === "MARKET");
  const listQ = quotes.find((q) => q.channel === "LISTING");

  return (
    <div className="market-backdrop" role="dialog" aria-modal="true" aria-label="Hôtel des ventes">
      <div className="market-sheet glass hall">
        <header className="hall-head">
          <div>
            <p className="hall-kicker">Bienvenue</p>
            <h2>Hôtel des ventes</h2>
            <p className="hall-wallet">
              Vous avez <strong>{Math.round(crd)} TRN</strong>
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Fermer
          </button>
        </header>

        <div className="hall-doors" role="tablist" aria-label="Acheter ou vendre">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "BUY"}
            className={`hall-door buy ${tab === "BUY" ? "on" : ""}`}
            onClick={() => setTab("BUY")}
          >
            <img className="hall-door-icon" src="/assets/icons/goods/straw-bale.svg" alt="" aria-hidden="true" />
            <strong>Acheter</strong>
            <em>{others.length ? `${others.length} en vitrine` : "Rien en vitrine"}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "SELL"}
            className={`hall-door sell ${tab === "SELL" ? "on" : ""}`}
            onClick={() => setTab("SELL")}
          >
            <img className="hall-door-icon" src="/assets/icons/nav/marche.svg" alt="" aria-hidden="true" />
            <strong>Vendre</strong>
            <em>{stock.length ? "Votre stock" : "Rien à vendre"}</em>
          </button>
        </div>

        {/* Le contenu de l'onglet défile ; l'en-tête et les deux portes ne
            bougent pas. La feuille était en `overflow: hidden` : tout ce qui
            dépassait 92 % de la hauteur d'écran était simplement coupé, sans
            aucun moyen d'y accéder — sur téléphone, le formulaire des contrats
            à terme commençait juste sous le bord. */}
        <div className="hall-body">
        {tab === "MORE" ? (
          <div className="hall-more">
            <button type="button" className="ghost tiny" onClick={() => setTab("BUY")}>
              ← Retour
            </button>
            <SupplyTab
              marketPrices={marketPrices}
              crd={crd}
              busy={busy}
              tons={inputTons}
              onTons={(g, n) => setInputTons((t) => ({ ...t, [g]: n }))}
              onBuy={onBuyInput}
            />
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
          </div>
        ) : tab === "SELL" ? (
          !stock.length ? (
            <>
              <p className="market-empty">Rien à vendre. Récoltez d’abord, puis revenez ici.</p>
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
              <p className="hall-lead">Choisissez ce que vous vendez, puis comment.</p>
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
                      <strong>
                        <GoodIcon code={s.itemCode} /> {goodName(s.itemCode)}
                      </strong>
                      <span>
                        {s.qty.toFixed(2)} {GOOD_DEFS[s.itemCode as TradeGood]?.unit ?? "t"}
                      </span>
                      <em className={wet || s.quality <= 2 ? "wet" : ""}>
                        {isPerishable(s.itemCode as TradeGood)
                          ? "À vendre vite : ça se gâte"
                          : qualityOf(s.itemCode, s.qty, s.moisture, s.quality)}
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
                      Trop d’eau : on vous paie moins.
                      <button type="button" disabled={busy} onClick={() => onDry(item.id)}>
                        Sécher
                      </button>
                    </p>
                  )}
                  {item.quality <= 2 && item.moisture <= DRYING.sellThreshold && (
                    <p className="market-warn">Récolté trop tard — ça vaut moins.</p>
                  )}

                  <label className="market-field">
                    <span>
                      Combien : <strong>{tons.toFixed(2)}</strong> sur {item.qty.toFixed(2)}
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
                      Tout
                    </button>
                  </label>

                  <p className="market-course">
                    Prix du jour : <strong>{price.price.toFixed(0)} TRN / {GOOD_DEFS[item.itemCode as TradeGood]?.unit ?? "t"}</strong>
                  </p>
                  <PriceSparkline points={history} />

                  <div className="channel-grid hall-sell">
                    {marketQ && (
                      <div className="channel-card">
                        <h3>{SALE_CHANNEL_LABELS.MARKET}</h3>
                        <p className="channel-net">
                          {marketQ.net} TRN
                          <em className="sure">argent maintenant</em>
                        </p>
                        {/* La note du canal vient du domaine : elle dit qui
                            achète et pourquoi le prix diffère. Elle était
                            réécrite ici en « Le prix du jour. C'est vendu. »,
                            qui ne dit ni l'un ni l'autre. */}
                        <p className="channel-note">{marketQ.note}</p>
                        <button
                          type="button"
                          className="channel-go"
                          disabled={busy || tons <= 0}
                          onClick={() => act("MARKET")}
                        >
                          Vendre
                        </button>
                      </div>
                    )}
                    {listQ && (
                      <div className="channel-card">
                        <h3>{SALE_CHANNEL_LABELS.LISTING}</h3>
                        <p className="channel-net">
                          {listQ.net} TRN
                          <em className="risky">si un joueur achète</em>
                        </p>
                        <label className="ask-field">
                          <span>Votre prix (TRN / {GOOD_DEFS[item.itemCode as TradeGood]?.unit ?? "t"})</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={ask}
                            onChange={(e) => setAsk(Number(e.target.value))}
                          />
                        </label>
                        <button
                          type="button"
                          className="channel-go"
                          disabled={busy || tons <= 0 || crd < listingFee(ask, tons)}
                          onClick={() => act("LISTING")}
                        >
                          Mettre en vente
                        </button>
                        {/* Mettre en vente coûte une commission d'avance :
                            sans elle, le bouton restait gris sans raison
                            visible. */}
                        {tons > 0 && crd < listingFee(ask, tons) && (
                          <p className="supply-why">
                            Commission de {listingFee(ask, tons)} TRN à avancer — il vous en
                            manque {Math.ceil(listingFee(ask, tons) - crd)}.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Le troisième acheteur, dit comme les deux autres.
                      « Vendre à tout prix » ne nommait personne : on encaissait
                      40 % de moins sans savoir que c'était un PNJ de secours,
                      et on croyait à une panne du marché. */}
                  {dealerQ && (
                    <p className="market-rules">
                      <button
                        type="button"
                        className="ghost tiny"
                        disabled={busy || tons <= 0}
                        onClick={() => act("DEALER")}
                      >
                        {SALE_CHANNEL_LABELS.DEALER} · {dealerQ.net} TRN
                      </button>{" "}
                      <span className="channel-note">{dealerQ.note}</span>
                    </p>
                  )}
                </>
              )}

              <DeliveryList
                deliveries={deliveries}
                busy={busy}
                crd={crd}
                onDeliverLot={onDeliverLot}
                onAutoDeliverLot={onAutoDeliverLot}
              />

              {mine.length > 0 && (
                <section className="hall-block">
                  <h3>Encore en vitrine</h3>
                  <div className="sale-grid">
                    {mine.map((l) => (
                      <article key={l.id} className="sale-card mine">
                        <span className="sale-icon" aria-hidden="true">
                          <GoodIcon code={l.commodity} />
                        </span>
                        <div className="sale-body">
                          <strong>{goodName(l.commodity)}</strong>
                          <span>{qualityOf(l.commodity, l.tons, l.moisture, l.quality)}</span>
                          <em>
                            {l.pricePerTon.toFixed(0)} TRN · encore{" "}
                            {Math.max(0, Math.round(l.expiresInMs / 60000))} min
                          </em>
                        </div>
                        <button type="button" disabled={busy} onClick={() => onCancelListing(l.id)}>
                          Retirer
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )
        ) : (
          <>
            <p className="hall-lead">
              Vous payez, puis ça arrive chez vous. Un autre joueur l’apporte, ou vous payez pour
              le faire venir.
            </p>
            <DeliveryList
              deliveries={deliveries}
              busy={busy}
              crd={crd}
              onDeliverLot={onDeliverLot}
              onAutoDeliverLot={onAutoDeliverLot}
            />
            {others.length === 0 ? (
              /* Charte §7.7 : un écran vide porte une image, une phrase qui
                 explique, et l'action à faire — pas une ligne grise seule. */
              <div className="market-empty">
                <img className="market-empty-art" src="/assets/icons/nav/marche.svg" alt="" aria-hidden="true" />
                <strong>La vitrine est vide</strong>
                <span>
                  Personne ne vend pour l’instant. Mettez-y votre récolte, ou passez chez le
                  négociant.
                </span>
                <button type="button" className="accent-btn" onClick={() => setTab("MORE")}>
                  Voir le négociant
                </button>
              </div>
            ) : (
              <div className="sale-grid catalog">
                {others.map((l) => (
                  <article key={l.id} className="sale-card catalog">
                    <span className="sale-icon" aria-hidden="true">
                      <GoodIcon code={l.commodity} />
                    </span>
                    <div className="sale-body">
                      <strong>{goodName(l.commodity)}</strong>
                      <span>{qualityOf(l.commodity, l.tons, l.moisture, l.quality)}</span>
                      <em>Chez {l.sellerName}</em>
                    </div>
                    <div className="sale-pay">
                      <strong>{l.total} TRN</strong>
                      <em>
                        {l.pricePerTon.toFixed(0)} TRN /{" "}
                        {GOOD_DEFS[l.commodity as TradeGood]?.unit ?? "t"}
                      </em>
                      <button
                        type="button"
                        className="sale-go"
                        disabled={busy || crd < l.total}
                        onClick={() => onBuyListing(l.id)}
                      >
                        Acheter
                      </button>
                      {crd < l.total && (
                        <em className="supply-why">Il manque {Math.ceil(l.total - crd)} TRN</em>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {/* Une phrase entière dans un bouton de vingt-neuf pixels de haut :
                ni cliquable au doigt, ni lisible comme une action. La phrase
                devient l'explication, le bouton devient court.
                Vitrine vide, l'état vide propose déjà le négociant : le
                répéter deux fois dans le même écran ne l'aide pas. */}
            {others.length > 0 && (
              <p className="hall-more-link">
                <span>Besoin de fourrage, ou d’écouler une récolte pas encore mûre ?</span>
                <button type="button" className="ghost" onClick={() => setTab("MORE")}>
                  Voir le négociant
                </button>
              </p>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

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
  tons: Partial<Record<TradeGood, number>>;
  onTons: (good: TradeGood, n: number) => void;
  onBuy: (commodity: TradeGood, tons: number) => void;
}) {
  return (
    <div className="supply-tab">
      <h3>Acheter au négociant</h3>
      <p className="hall-lead">
        Achat direct au négociant, pas une annonce d’un autre joueur : servi à
        la demande, en quantité libre, à {Math.round((DEALER_SELL_MARKUP - 1) * 100)} %
        au-dessus du cours du jour. Vous payez maintenant ; un camion dépose la
        caisse dans votre cour, et c’est en la rentrant qu’elle entre au stock.
      </p>
      {PURCHASABLE_GOODS.map((good) => {
        const def = GOOD_DEFS[good];
        const base =
          marketPrices.find((m) => m.commodity === good)?.price ?? def.basePrice;
        const unit = dealerAskPrice(base);
        const qty = tons[good] ?? 5;
        const total = Math.round(unit * qty);
        return (
          <div className="supply-card" key={good}>
            <span className="sale-icon" aria-hidden="true">
              <GoodIcon code={good} />
            </span>
            <span className="build-text">
              <strong>{def.name}</strong>
              <span>
                {unit.toFixed(1)} TRN/{def.unit}
              </span>
              <em className="supply-use">{DEALER_INPUT_USE[good]}</em>
            </span>
            <label className="supply-qty">
              <span>Combien ({def.unit})</span>
              <input
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => onTons(good, Math.max(1, Number(e.target.value)))}
              />
            </label>
            <button
              type="button"
              className="channel-go"
              disabled={busy || crd < total}
              onClick={() => onBuy(good, qty)}
            >
              Acheter · {total} TRN
            </button>
            {/* Un bouton grisé ne dit pas ce qui cloche, et sur un écran tactile
                il n'y a pas d'infobulle pour le rattraper : on appuie, rien ne se
                passe, et on conclut que le jeu est cassé. C'était le cas ici — la
                route d'achat fonctionne, c'est la caisse qui ne suivait pas. */}
            {crd < total && (
              <p className="supply-why">
                Il vous manque {Math.ceil(total - crd)} TRN — réduisez la quantité
                ou vendez d’abord.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
      <h3>Vendre une récolte pas encore mûre</h3>
      {/* « Ça coûte 20 % de plus » ne voulait rien dire : rien ne coûte plus
          cher, et le chiffre tombait sans que personne sache d'où il sortait.
          C'est une pénalité — une part de la valeur du contrat, prélevée si
          l'échéance passe sans livraison —, et elle se chiffre en TRN sur le
          contrat qu'on est en train de composer. */}
      <p className="hall-lead">
        Vous bloquez dès maintenant le prix d’une récolte que vous n’avez pas
        encore. L’acheteur porte le risque à votre place : il prend une décote
        au passage, d’autant plus forte que l’échéance est lointaine.
      </p>
      <p className="hall-lead danger">
        Engagement ferme : si l’échéance passe sans livraison, vous payez une
        pénalité de {Math.round(FUTURES_PENALTY_RATE * 100)} % de la valeur du
        contrat — {futuresPenalty(garanti, tons)} TRN pour celui-ci. Elle peut
        mettre votre compte à découvert.
      </p>

      <div className="futures-form">
        <label className="market-field">
          <span>Quoi</span>
          <select value={good} onChange={(e) => setGood(e.target.value as TradeGood)}>
            {SELLABLE_GOODS.map((g) => (
              <option key={g} value={g}>
                <GoodIcon code={g} /> {GOOD_DEFS[g].name}
              </option>
            ))}
          </select>
        </label>
        <label className="market-field">
          <span>Combien (tonnes)</span>
          <input
            type="number"
            min={FUTURES_MIN_TONS}
            step={1}
            value={tons}
            onChange={(e) => setTons(Number(e.target.value))}
          />
        </label>
        <label className="market-field">
          <span>Dans combien de temps</span>
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
        Prix du jour <strong>{spot.toFixed(1)}</strong> · prix fixé{" "}
        <strong>{garanti.toFixed(1)} TRN/t</strong> · total{" "}
        <strong>{Math.round(garanti * tons)} TRN</strong>
      </p>
      <button
        type="button"
        className="accent"
        disabled={busy || tons < FUTURES_MIN_TONS || spot <= 0}
        onClick={() => onOpen(good, tons, horizon)}
      >
        Fixer le prix
      </button>

      <h3>En cours</h3>
      {!open.length && <p className="muted tiny">Rien en cours.</p>}
      <ul className="list">
        {open.map((f) => {
          const reste = Math.max(0, f.dueAt - Date.now());
          const mins = Math.round(reste / 60000);
          const ecart = f.spotNow === null ? null : Math.round((f.pricePerTon - f.spotNow) * f.tons);
          return (
            <li key={f.id}>
              <span>
                {GOOD_DEFS[f.commodity as TradeGood]?.name ?? f.commodity} · {f.tons.toFixed(2)} t à{" "}
                {f.pricePerTon.toFixed(0)} TRN/t · encore {mins} min
                {ecart !== null && (
                  <em className={ecart >= 0 ? "gain" : "loss"}>
                    {" "}
                    {ecart >= 0 ? "+" : ""}
                    {ecart} TRN contre le prix du jour
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
          <h3>Terminés</h3>
          <ul className="list">
            {closed.map((f) => (
              <li key={f.id}>
                <span>
                  {GOOD_DEFS[f.commodity as TradeGood]?.name ?? f.commodity} · {f.tons.toFixed(2)} t ·{" "}
                  {f.status === "SETTLED" ? "livré" : "pas livré à temps, pénalité"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
