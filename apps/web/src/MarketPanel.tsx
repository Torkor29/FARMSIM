import { useEffect, useMemo, useState } from "react";
import {
  CROP_DEFS,
  DEALER_RATIO,
  LISTING_COMMISSION_RATE,
  LISTING_FEE_RATE,
  SALE_CHANNEL_HINTS,
  SALE_CHANNEL_LABELS,
  listingFee,
  listingProceeds,
  quoteAllChannels,
  type ChannelQuote,
  type CropCode,
  type SaleChannel,
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

type Props = {
  open: boolean;
  onClose: () => void;
  stock: StockItem[];
  listings: Listing[];
  marketPrices: { commodity: string; price: number; stockTons: number }[];
  crd: number;
  busy: boolean;
  onSellDealer: (commodity: CropCode, tons: number) => void;
  onSellMarket: (commodity: CropCode, tons: number) => void;
  onList: (commodity: CropCode, tons: number, pricePerTon: number) => void;
  onBuyListing: (id: string) => void;
  onCancelListing: (id: string) => void;
  onDry: (itemId: string) => void;
};

function moisturePenaltyOf(moisture: number): number {
  // Reprend la règle du serveur : au-delà du seuil, la vente est décotée.
  const over = moisture - 0.14;
  return over <= 0 ? 0 : Math.min(0.15, over * 1.5);
}

/** Écran de vente : stock, trois débouchés comparés, et la criée. */
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
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tons, setTons] = useState(0);
  const [ask, setAsk] = useState(0);
  const [tab, setTab] = useState<"SELL" | "BUY">("SELL");

  const item = useMemo(
    () => stock.find((s) => s.id === selectedId) ?? stock[0] ?? null,
    [stock, selectedId],
  );
  const price = useMemo(
    () => marketPrices.find((m) => m.commodity === item?.itemCode),
    [marketPrices, item],
  );

  useEffect(() => {
    if (!item) return;
    setTons(Math.round(item.qty * 100) / 100);
    if (price) setAsk(Math.round(price.price * 1.15));
  }, [item?.id, price?.price]);

  const quotes: ChannelQuote[] = useMemo(() => {
    if (!item || !price || tons <= 0) return [];
    return quoteAllChannels({
      commodity: item.itemCode as CropCode,
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
    const code = item.itemCode as CropCode;
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
        </div>

        {tab === "SELL" ? (
          !stock.length ? (
            <p className="market-empty">
              Votre silo est vide. Récoltez d’abord — le grain apparaîtra ici.
            </p>
          ) : (
            <>
              <div className="stock-row">
                {stock.map((s) => {
                  const wet = s.moisture > 0.14;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`stock-chip ${item?.id === s.id ? "on" : ""}`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <strong>{CROP_DEFS[s.itemCode as CropCode]?.name ?? s.itemCode}</strong>
                      <span>{s.qty.toFixed(2)} t</span>
                      <em className={wet ? "wet" : ""}>
                        {Math.round(s.moisture * 100)} % humidité
                      </em>
                    </button>
                  );
                })}
              </div>

              {item && price && (
                <>
                  {item.moisture > 0.14 && (
                    <p className="market-warn">
                      Grain trop humide : toute vente est décotée. Séchez d’abord.
                      <button type="button" disabled={busy} onClick={() => onDry(item.id)}>
                        Sécher
                      </button>
                    </p>
                  )}

                  <label className="market-field">
                    <span>
                      Quantité à vendre : <strong>{tons.toFixed(2)} t</strong> sur{" "}
                      {item.qty.toFixed(2)} t
                    </span>
                    <input
                      type="range"
                      min={0.01}
                      max={item.qty}
                      step={0.01}
                      value={Math.min(tons, item.qty)}
                      onChange={(e) => setTons(Number(e.target.value))}
                    />
                  </label>

                  <p className="market-course">
                    Cours du jour : <strong>{price.price.toFixed(1)} CRD/t</strong>
                  </p>

                  <div className="channel-grid">
                    {quotes.map((q) => (
                      <div
                        key={q.channel}
                        className={`channel-card ${q.channel === best?.channel ? "best" : ""}`}
                      >
                        <h3>{SALE_CHANNEL_LABELS[q.channel]}</h3>
                        <p className="channel-price">{q.pricePerTon.toFixed(1)} CRD/t</p>
                        <p className="channel-net">
                          {q.net} CRD
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
                              {CROP_DEFS[l.commodity as CropCode]?.name ?? l.commodity}
                            </strong>
                            <em>
                              {l.tons.toFixed(2)} t à {l.pricePerTon.toFixed(0)} CRD/t ·{" "}
                              {listingProceeds(l.pricePerTon, l.tons)} CRD net
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
              Les lots déposés par les autres exploitants, du moins cher au plus cher.
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
                          {CROP_DEFS[l.commodity as CropCode]?.name ?? l.commodity}
                        </strong>
                        <em>
                          {l.tons.toFixed(2)} t à {l.pricePerTon.toFixed(0)} CRD/t ·{" "}
                          {Math.round(l.moisture * 100)} % humidité
                        </em>
                        <em className="listing-seller">{l.sellerName}</em>
                      </span>
                      <span className="listing-right">
                        <strong>{l.total} CRD</strong>
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
          </>
        )}
      </div>
    </div>
  );
}

export { SALE_CHANNEL_HINTS };
