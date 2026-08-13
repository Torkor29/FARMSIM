import { useEffect, useMemo, useState } from "react";
import { PriceSparkline } from "./PriceSparkline";
import {
  GOOD_DEFS,
  PURCHASABLE_GOODS,
  SPOILAGE_PER_CYCLE,
  isPerishable,
  spoilageWarning,
  dealerAskPrice,
  DEALER_RATIO,
  LISTING_COMMISSION_RATE,
  LISTING_FEE_RATE,
  listingFee,
  listingProceeds,
  quoteAllChannels,
  maxSelectableTons,
  WORLD_MARKET_GOODS,
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
  sellerName: string;
  mine: boolean;
  expiresInMs: number;
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

type Props = {
  open: boolean;
  onClose: () => void;
  stock: StockItem[];
  listings: Listing[];
  marketPrices: { commodity: string; price: number; stockTons: number }[];
  crd: number;
  busy: boolean;
  onSellDealer: (commodity: TradeGood, tons: number) => void;
  onSellMarket: (commodity: TradeGood, tons: number) => void;
  onList: (commodity: TradeGood, tons: number, pricePerTon: number) => void;
  onBuyListing: (id: string) => void;
  onCancelListing: (id: string) => void;
  onDry: (itemId: string) => void;
  onBuyInput: (commodity: TradeGood, tons: number) => void;
  onLoadHistory: (commodity: TradeGood) => Promise<{ at: string; price: number }[]>;
  futures: FuturesContract[];
  onOpenFuture: (commodity: TradeGood, tons: number, horizonH: number) => void;
  onDeliverFuture: (id: string) => void;
};

type Mode = "BUY" | "SELL" | "ESTIMATE" | "FUTURES";
type CatId = "ALL" | "GRAIN" | "FEED" | "HERD" | "INPUT";

const CATS: { id: CatId; label: string; goods: TradeGood[] }[] = [
  { id: "ALL", label: "Toutes", goods: Object.keys(GOOD_DEFS) as TradeGood[] },
  { id: "GRAIN", label: "Céréales", goods: ["WHEAT", "MAIZE", "PEA"] },
  { id: "FEED", label: "Fourrage", goods: ["HAY", "STRAW", "SILAGE"] },
  { id: "HERD", label: "Élevage", goods: ["MILK", "MEAT"] },
  { id: "INPUT", label: "Intrants", goods: [...PURCHASABLE_GOODS] },
];

function moisturePenaltyOf(moisture: number): number {
  const over = moisture - 0.14;
  return over <= 0 ? 0 : Math.min(0.15, over * 1.5);
}

function changeOf(pts: { price: number }[] | undefined): number {
  if (!pts || pts.length < 2) return 0;
  const first = pts[0]!.price;
  const last = pts[pts.length - 1]!.price;
  if (first <= 0) return 0;
  return (last - first) / first;
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} TRN`;
}

function ttlMin(ms: number): string {
  return `${Math.max(0, Math.round(ms / 60_000))} min`;
}

/** Hôtel de vente : Acheter / Vendre / Estimations, catégories, lots. */
export function MarketPanel({
  open,
  onClose,
  stock,
  listings,
  marketPrices,
  crd,
  busy,
  onSellDealer,
  onSellMarket,
  onList,
  onBuyListing,
  onCancelListing,
  onDry,
  onBuyInput,
  onLoadHistory,
  futures,
  onOpenFuture,
  onDeliverFuture,
}: Props) {
  const [mode, setMode] = useState<Mode>("BUY");
  const [cat, setCat] = useState<CatId>("ALL");
  const [query, setQuery] = useState("");
  const [onlyListed, setOnlyListed] = useState(false);
  const [pick, setPick] = useState<TradeGood | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tons, setTons] = useState(0);
  const [ask, setAsk] = useState(0);
  const [horizon, setHorizon] = useState<number>(3);
  const [futTons, setFutTons] = useState(10);
  const [inputTons, setInputTons] = useState(5);
  const [history, setHistory] = useState<{ at: string; price: number }[]>([]);
  const [boardHist, setBoardHist] = useState<Record<string, { at: string; price: number }[]>>({});
  const [clock, setClock] = useState(() => new Date());

  const item = useMemo(
    () => stock.find((s) => s.id === selectedId) ?? stock.find((s) => s.itemCode === pick) ?? stock[0] ?? null,
    [stock, selectedId, pick],
  );

  const good = (pick ?? (item?.itemCode as TradeGood | undefined) ?? "WHEAT") as TradeGood;
  const def = GOOD_DEFS[good];
  const spotRow = marketPrices.find((m) => m.commodity === good);
  const spot = spotRow?.price ?? def.basePrice;
  const maxTons = useMemo(() => (item ? maxSelectableTons(item.qty) : 0), [item?.qty]);

  useEffect(() => {
    if (!item) return;
    setTons(maxTons);
    if (spot) setAsk(Math.round(spot * 1.15));
  }, [item?.id, maxTons, spot]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setClock(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setBoardHist({});
      return;
    }
    let alive = true;
    Promise.all(
      marketPrices.map(async (m) => {
        try {
          const pts = await onLoadHistory(m.commodity as TradeGood);
          return [m.commodity, pts] as const;
        } catch {
          return [m.commodity, [] as { at: string; price: number }[]] as const;
        }
      }),
    ).then((rows) => {
      if (alive) setBoardHist(Object.fromEntries(rows));
    });
    return () => {
      alive = false;
    };
  }, [open, marketPrices, onLoadHistory]);

  useEffect(() => {
    if (!open) {
      setHistory([]);
      return;
    }
    let alive = true;
    onLoadHistory(good)
      .then((pts) => {
        if (alive) setHistory(pts);
      })
      .catch(() => {
        if (alive) setHistory([]);
      });
    return () => {
      alive = false;
    };
  }, [open, good, onLoadHistory]);

  const quotes: ChannelQuote[] = useMemo(() => {
    if (!item || !spot || tons <= 0) return [];
    return quoteAllChannels({
      commodity: item.itemCode as TradeGood,
      tons,
      marketPrice: spot,
      stockTons: spotRow?.stockTons ?? 0,
      moisturePenalty: moisturePenaltyOf(item.moisture),
      askPricePerTon: ask,
    });
  }, [item, spot, spotRow?.stockTons, tons, ask]);

  const catGoods = CATS.find((c) => c.id === cat)?.goods ?? CATS[0]!.goods;
  const q = query.trim().toLowerCase();
  const others = listings.filter((l) => !l.mine);
  const mine = listings.filter((l) => l.mine);

  const catalog = useMemo(() => {
    return catGoods.filter((code) => {
      const name = GOOD_DEFS[code].name.toLowerCase();
      if (q && !name.includes(q) && !code.toLowerCase().includes(q)) return false;
      if (onlyListed) {
        const hasLot = others.some((l) => l.commodity === code);
        const dealer = GOOD_DEFS[code].purchasable;
        if (!hasLot && !dealer) return false;
      }
      return true;
    });
  }, [catGoods, q, onlyListed, others]);

  useEffect(() => {
    if (mode === "FUTURES" || mode === "SELL") return;
    if (pick && catalog.includes(pick)) return;
    setPick(catalog[0] ?? null);
  }, [catalog, pick, mode]);

  const lots = others.filter((l) => l.commodity === good).sort((a, b) => a.pricePerTon - b.pricePerTon);
  const ownStock = stock.filter((s) => s.itemCode === good).reduce((s, i) => s + i.qty, 0);
  const bestAsk = lots[0]?.pricePerTon ?? null;
  const bid = spot * DEALER_RATIO;
  const ch = changeOf(boardHist[good] ?? history);
  const siloTons = stock.reduce((s, i) => s + i.qty, 0);

  const act = (channel: SaleChannel) => {
    if (!item || tons <= 0) return;
    const code = item.itemCode as TradeGood;
    if (channel === "DEALER") onSellDealer(code, tons);
    else if (channel === "MARKET") onSellMarket(code, tons);
    else onList(code, tons, ask);
  };

  if (!open) return null;

  return (
    <div
      className="hdv-backdrop hall-backdrop market-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Hôtel de vente"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hdv-shell hall-sheet market-sheet glass" onClick={(e) => e.stopPropagation()}>
        <header className="hdv-top">
          <div className="hdv-brand">
            <p className="hdv-kicker">Hôtel de vente</p>
            <h2>Halle aux grains</h2>
          </div>
          <p className="hdv-session">
            Séance {clock.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="hdv-purse">
            <span>Caisse</span>
            <strong>{money(crd)}</strong>
            <em>{siloTons.toFixed(1)} t en silo</em>
          </div>
          <button type="button" className="ghost hdv-close" onClick={onClose}>
            Fermer
          </button>
        </header>

        <nav className="hdv-modes" aria-label="Modes de l’hôtel de vente">
          {(
            [
              ["BUY", "Acheter"],
              ["SELL", "Vendre"],
              ["ESTIMATE", "Estimations"],
              ["FUTURES", `À terme (${futures.filter((f) => f.status === "OPEN").length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? "on" : ""}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {mode === "FUTURES" ? (
          <FuturesBody
            futures={futures}
            marketPrices={marketPrices}
            busy={busy}
            good={WORLD_MARKET_GOODS.includes(good) ? good : "WHEAT"}
            setGood={(g) => setPick(g)}
            tons={futTons}
            setTons={setFutTons}
            horizon={horizon}
            setHorizon={setHorizon}
            onOpen={onOpenFuture}
            onDeliver={onDeliverFuture}
          />
        ) : (
          <div className="hdv-body">
            <aside className="hdv-cats" aria-label="Catégories">
              <p>Catégories</p>
              {CATS.map((c) => {
                const n = others.filter((l) => c.goods.includes(l.commodity as TradeGood)).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={cat === c.id ? "on" : ""}
                    onClick={() => setCat(c.id)}
                  >
                    <span>{c.label}</span>
                    <em>{n}</em>
                  </button>
                );
              })}
              {mode === "BUY" && (
                <label className="hdv-check">
                  <input
                    type="checkbox"
                    checked={onlyListed}
                    onChange={(e) => setOnlyListed(e.target.checked)}
                  />
                  En vente seulement
                </label>
              )}
            </aside>

            <section className="hdv-main">
              <div className="hdv-toolbar">
                <input
                  type="search"
                  placeholder="Rechercher une marchandise…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Recherche"
                />
                <span className="hdv-count">
                  {mode === "SELL" ? `${stock.length} lot(s) en silo` : `${catalog.length} marchandise(s)`}
                </span>
              </div>

              {mode === "SELL" ? (
                <SellList
                  stock={stock}
                  selectedId={item?.id ?? null}
                  onPick={(s) => {
                    setSelectedId(s.id);
                    setPick(s.itemCode as TradeGood);
                  }}
                />
              ) : (
                <CatalogTable
                  goods={catalog}
                  marketPrices={marketPrices}
                  listings={others}
                  stock={stock}
                  history={boardHist}
                  selected={good}
                  onPick={(code) => {
                    setPick(code);
                    const found = stock.find((s) => s.itemCode === code);
                    if (found) setSelectedId(found.id);
                  }}
                />
              )}
            </section>

            <aside className="hdv-detail">
              {mode === "SELL" ? (
                <SellDetail
                  item={item}
                  spot={spot}
                  history={history}
                  tons={tons}
                  setTons={setTons}
                  maxTons={maxTons}
                  ask={ask}
                  setAsk={setAsk}
                  quotes={quotes}
                  busy={busy}
                  crd={crd}
                  mine={mine.filter((l) => l.commodity === (item?.itemCode ?? ""))}
                  onAct={act}
                  onDry={onDry}
                  onCancel={onCancelListing}
                />
              ) : (
                <BuyDetail
                  good={good}
                  spot={spot}
                  bid={bid}
                  ask={bestAsk}
                  change={ch}
                  history={history}
                  lots={lots}
                  ownStock={ownStock}
                  crd={crd}
                  busy={busy}
                  inputTons={inputTons}
                  setInputTons={setInputTons}
                  onBuyLot={onBuyListing}
                  onBuyDealer={onBuyInput}
                  onSell={() => {
                    if (ownStock > 0) setMode("SELL");
                  }}
                />
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogTable({
  goods,
  marketPrices,
  listings,
  stock,
  history,
  selected,
  onPick,
}: {
  goods: TradeGood[];
  marketPrices: { commodity: string; price: number; stockTons: number }[];
  listings: Listing[];
  stock: StockItem[];
  history: Record<string, { at: string; price: number }[]>;
  selected: TradeGood | null;
  onPick: (code: TradeGood) => void;
}) {
  if (goods.length === 0) {
    return <p className="hdv-empty">Rien dans cette catégorie.</p>;
  }
  return (
    <div className="hdv-table-wrap">
      <table className="hdv-table">
        <thead>
          <tr>
            <th>Marchandise</th>
            <th>Lots</th>
            <th>Min.</th>
            <th>Cours</th>
            <th>3 h</th>
            <th>Silo</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((code) => {
            const d = GOOD_DEFS[code];
            const row = marketPrices.find((m) => m.commodity === code);
            const lots = listings.filter((l) => l.commodity === code);
            const min = lots.length ? Math.min(...lots.map((l) => l.pricePerTon)) : null;
            const own = stock.filter((s) => s.itemCode === code).reduce((s, i) => s + i.qty, 0);
            const ch = changeOf(history[code]);
            const trend = ch > 0.005 ? "up" : ch < -0.005 ? "down" : "";
            return (
              <tr
                key={code}
                className={`${selected === code ? "sel" : ""} ${trend}`}
                onClick={() => onPick(code)}
              >
                <td>
                  <strong>{d.name}</strong>
                  {d.localOnly && <em className="local-tag">local</em>}
                </td>
                <td className="num">{lots.length || (d.purchasable ? "∞" : "—")}</td>
                <td className="num">{min === null ? "—" : min.toFixed(1)}</td>
                <td className="num last">{(row?.price ?? d.basePrice).toFixed(1)}</td>
                <td className={`chg ${trend}`}>
                  {ch >= 0 ? "+" : ""}
                  {(ch * 100).toFixed(1)} %
                </td>
                <td className="num">{own > 0 ? `${own.toFixed(2)}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SellList({
  stock,
  selectedId,
  onPick,
}: {
  stock: StockItem[];
  selectedId: string | null;
  onPick: (s: StockItem) => void;
}) {
  if (stock.length === 0) {
    return <p className="hdv-empty">Silo vide. Récoltez d’abord — le grain apparaîtra ici.</p>;
  }
  return (
    <div className="hdv-table-wrap">
      <table className="hdv-table">
        <thead>
          <tr>
            <th>Votre stock</th>
            <th>Qté</th>
            <th>Qualité</th>
            <th>Humidité</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((s) => {
            const d = GOOD_DEFS[s.itemCode as TradeGood];
            const wet = s.moisture > 0.14;
            return (
              <tr
                key={s.id}
                className={selectedId === s.id ? "sel" : ""}
                onClick={() => onPick(s)}
              >
                <td>
                  <strong>{d?.name ?? s.itemCode}</strong>
                </td>
                <td className="num">
                  {s.qty.toFixed(2)} {d?.unit ?? "t"}
                </td>
                <td className="num">q{s.quality}</td>
                <td className={wet ? "warn" : ""}>
                  {isPerishable(s.itemCode as TradeGood)
                    ? `−${Math.round((SPOILAGE_PER_CYCLE[s.itemCode as TradeGood] ?? 0) * 100)} % / cycle`
                    : `${Math.round(s.moisture * 100)} %`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BuyDetail({
  good,
  spot,
  bid,
  ask,
  change,
  history,
  lots,
  ownStock,
  crd,
  busy,
  inputTons,
  setInputTons,
  onBuyLot,
  onBuyDealer,
  onSell,
}: {
  good: TradeGood;
  spot: number;
  bid: number;
  ask: number | null;
  change: number;
  history: { at: string; price: number }[];
  lots: Listing[];
  ownStock: number;
  crd: number;
  busy: boolean;
  inputTons: number;
  setInputTons: (n: number) => void;
  onBuyLot: (id: string) => void;
  onBuyDealer: (commodity: TradeGood, tons: number) => void;
  onSell: () => void;
}) {
  const d = GOOD_DEFS[good];
  const dealer = d.purchasable ? dealerAskPrice(spot) : null;
  const dealerTotal = dealer ? Math.round(dealer * inputTons) : 0;
  const trend = change > 0.005 ? "up" : change < -0.005 ? "down" : "flat";

  return (
    <div className="hdv-card">
      <header>
        <h3>{d.name}</h3>
        {d.localOnly && <em className="local-tag">local</em>}
      </header>
      <dl className="hdv-quotes">
        <div>
          <dt>Cours</dt>
          <dd>
            {spot.toFixed(1)} <small>TRN/{d.unit}</small>
          </dd>
        </div>
        <div>
          <dt>Bid</dt>
          <dd className="gain">{bid.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Ask</dt>
          <dd className="loss">{ask === null ? "—" : ask.toFixed(1)}</dd>
        </div>
        <div>
          <dt>3 h</dt>
          <dd className={trend}>
            {change >= 0 ? "+" : ""}
            {(change * 100).toFixed(1)} %
          </dd>
        </div>
      </dl>
      <PriceSparkline points={history} compact />
      <p className="hdv-own">
        Votre silo : {ownStock > 0 ? `${ownStock.toFixed(2)} ${d.unit}` : "vide"}
        {ownStock > 0 && (
          <button type="button" className="ghost tiny" onClick={onSell}>
            Vendre
          </button>
        )}
      </p>

      <h4>Lots en criée</h4>
      {lots.length === 0 ? (
        <p className="hdv-muted">Aucun lot déposé pour cette marchandise.</p>
      ) : (
        <table className="hdv-lots">
          <thead>
            <tr>
              <th>Qté</th>
              <th>Prix</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lots.map((l, i) => (
              <tr key={l.id} className={i === 0 ? "best-ask" : ""}>
                <td>
                  {l.tons.toFixed(2)} {d.unit}
                  <small>
                    {l.sellerName} · {ttlMin(l.expiresInMs)} · {Math.round(l.moisture * 100)} %
                  </small>
                </td>
                <td className="num">{l.pricePerTon.toFixed(1)}</td>
                <td className="num">
                  <strong>{l.total.toLocaleString("fr-FR")}</strong>
                </td>
                <td>
                  <button
                    type="button"
                    className="channel-go"
                    disabled={busy || crd < l.total}
                    onClick={() => onBuyLot(l.id)}
                  >
                    Acheter
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dealer !== null && (
        <div className="hdv-dealer">
          <h4>Négociant · stock illimité</h4>
          <p>
            {dealer.toFixed(1)} TRN/{d.unit} · il facture plus cher qu’il ne rachète.
          </p>
          <label>
            Quantité
            <input
              type="number"
              min={1}
              step={1}
              value={inputTons}
              onChange={(e) => setInputTons(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <button
            type="button"
            className="accent"
            disabled={busy || crd < dealerTotal}
            onClick={() => onBuyDealer(good, inputTons)}
          >
            Acheter · {money(dealerTotal)}
          </button>
        </div>
      )}
    </div>
  );
}

function SellDetail({
  item,
  spot,
  history,
  tons,
  setTons,
  maxTons,
  ask,
  setAsk,
  quotes,
  busy,
  crd,
  mine,
  onAct,
  onDry,
  onCancel,
}: {
  item: StockItem | null;
  spot: number;
  history: { at: string; price: number }[];
  tons: number;
  setTons: (n: number) => void;
  maxTons: number;
  ask: number;
  setAsk: (n: number) => void;
  quotes: ChannelQuote[];
  busy: boolean;
  crd: number;
  mine: Listing[];
  onAct: (channel: SaleChannel) => void;
  onDry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (!item) {
    return <p className="hdv-empty">Choisissez un lot dans votre silo.</p>;
  }
  const d = GOOD_DEFS[item.itemCode as TradeGood];
  const warn = spoilageWarning(item.itemCode as TradeGood, item.qty);

  return (
    <div className="hdv-card">
      <header>
        <h3>{d?.name ?? item.itemCode}</h3>
      </header>
      <p className="hdv-own">
        {item.qty.toFixed(2)} {d?.unit ?? "t"} · q{item.quality} · {Math.round(item.moisture * 100)} % hum.
      </p>
      {warn && <p className="market-warn perish">{warn}</p>}
      {item.moisture > 0.14 && (
        <p className="market-warn">
          Trop humide : toute vente est décotée.
          <button type="button" disabled={busy} onClick={() => onDry(item.id)}>
            Sécher
          </button>
        </p>
      )}
      <PriceSparkline points={history} compact />
      <p className="hdv-muted">Cours {spot.toFixed(1)} TRN/{d?.unit ?? "t"}</p>

      <label className="hdv-qty">
        Quantité · {tons.toFixed(2)} / {item.qty.toFixed(2)} {d?.unit ?? "t"}
        <input
          type="range"
          min={0.01}
          max={maxTons || 0.01}
          step={0.01}
          value={Math.min(tons, maxTons || 0.01)}
          onChange={(e) => setTons(Number(e.target.value))}
        />
        <button type="button" className="ghost tiny" disabled={tons >= maxTons} onClick={() => setTons(maxTons)}>
          Tout
        </button>
      </label>

      <label className="hdv-qty">
        Prix criée (TRN/{d?.unit ?? "t"})
        <input type="number" min={1} step={1} value={ask} onChange={(e) => setAsk(Number(e.target.value))} />
      </label>

      <ul className="hdv-channels">
        {quotes.map((q) => (
          <li key={q.channel}>
            <div>
              <strong>
                {q.channel === "DEALER" ? "Négociant" : q.channel === "MARKET" ? "Cours mondial" : "Criée"}
              </strong>
              <em>{q.note}</em>
            </div>
            <span>
              <b>{money(q.net)}</b>
              <small>{q.pricePerTon.toFixed(1)} / {d?.unit ?? "t"}</small>
            </span>
            <button
              type="button"
              className={q.guaranteed ? "accent" : "channel-go"}
              disabled={busy || tons <= 0 || (q.channel === "LISTING" && crd < listingFee(ask, tons))}
              onClick={() => onAct(q.channel)}
            >
              {q.channel === "LISTING" ? "Déposer" : "Vendre"}
            </button>
          </li>
        ))}
      </ul>
      <p className="hdv-muted">
        Négociant : {Math.round(DEALER_RATIO * 100)} % du cours, immédiat. Criée :{" "}
        {Math.round(LISTING_FEE_RATE * 100)} % de frais au dépôt, {Math.round(LISTING_COMMISSION_RATE * 100)} % à
        la vente.
      </p>

      <h4>Vos annonces</h4>
      {mine.length === 0 ? (
        <p className="hdv-muted">Aucune annonce en cours sur cette marchandise.</p>
      ) : (
        <ul className="hdv-mine">
          {mine.map((l) => (
            <li key={l.id}>
              <span>
                {l.tons.toFixed(2)} t · {l.pricePerTon.toFixed(0)} TRN/t · net{" "}
                {listingProceeds(l.pricePerTon, l.tons)} · {ttlMin(l.expiresInMs)}
              </span>
              <button type="button" className="ghost tiny" disabled={busy} onClick={() => onCancel(l.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FuturesBody({
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
  const closed = futures.filter((f) => f.status !== "OPEN").slice(0, 6);

  return (
    <div className="hdv-body">
      <aside className="hdv-cats">
        <p>Marchandises</p>
        {WORLD_MARKET_GOODS.map((g) => (
          <button key={g} type="button" className={good === g ? "on" : ""} onClick={() => setGood(g)}>
            <span>{GOOD_DEFS[g].name}</span>
          </button>
        ))}
      </aside>
      <section className="hdv-main">
        <div className="hdv-toolbar">
          <span className="hdv-count">Engagements ouverts : {open.length}</span>
        </div>
        {open.length === 0 ? (
          <p className="hdv-empty">Aucun contrat à terme en cours.</p>
        ) : (
          <div className="hdv-table-wrap">
            <table className="hdv-table">
              <thead>
                <tr>
                  <th>Contrat</th>
                  <th>Qté</th>
                  <th>Garanti</th>
                  <th>Échéance</th>
                  <th>vs spot</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {open.map((f) => {
                  const mins = Math.round(Math.max(0, f.dueAt - Date.now()) / 60_000);
                  const ecart = f.spotNow === null ? null : Math.round((f.pricePerTon - f.spotNow) * f.tons);
                  return (
                    <tr key={f.id}>
                      <td>
                        <strong>{GOOD_DEFS[f.commodity as TradeGood]?.name ?? f.commodity}</strong>
                      </td>
                      <td className="num">{f.tons.toFixed(2)} t</td>
                      <td className="num last">{f.pricePerTon.toFixed(0)}</td>
                      <td>{mins} min</td>
                      <td className={ecart === null ? "" : ecart >= 0 ? "gain" : "loss"}>
                        {ecart === null ? "—" : `${ecart >= 0 ? "+" : ""}${ecart}`}
                      </td>
                      <td>
                        <button type="button" className="accent" disabled={busy} onClick={() => onDeliver(f.id)}>
                          Livrer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {closed.length > 0 && (
          <ul className="hdv-mine">
            {closed.map((f) => (
              <li key={f.id}>
                <span>
                  {GOOD_DEFS[f.commodity as TradeGood]?.name ?? f.commodity} · {f.tons.toFixed(2)} t ·{" "}
                  {f.status === "SETTLED" ? "livré" : "non honoré, pénalité prélevée"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="hdv-detail">
        <div className="hdv-card">
          <header>
            <h3>Nouveau contrat</h3>
          </header>
          <p className="hdv-muted">
            Prix fixé maintenant, sous le cours. Hors délai : {Math.round(FUTURES_PENALTY_RATE * 100)} % de
            pénalité.
          </p>
          <label className="hdv-qty">
            Quantité (t)
            <input
              type="number"
              min={FUTURES_MIN_TONS}
              step={1}
              value={tons}
              onChange={(e) => setTons(Number(e.target.value))}
            />
          </label>
          <label className="hdv-qty">
            Échéance
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              {FUTURES_HORIZONS_H.map((h) => (
                <option key={h} value={h}>
                  {h} h · −{Math.round(FUTURES_DISCOUNT[h] * 100)} %
                </option>
              ))}
            </select>
          </label>
          <dl className="hdv-quotes">
            <div>
              <dt>Cours</dt>
              <dd>{spot.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Garanti</dt>
              <dd>{garanti.toFixed(1)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{money(garanti * tons)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="accent"
            disabled={busy || tons < FUTURES_MIN_TONS || spot <= 0}
            onClick={() => onOpen(good, tons, horizon)}
          >
            S’engager
          </button>
        </div>
      </aside>
    </div>
  );
}
