import express from "express";
import cors from "cors";
import {
  PrismaClient,
  Prisma,
  CropCode,
  BuildingType,
  ContractJobType,
  CellKind,
  FieldStage,
} from "@prisma/client";
import { z } from "zod";
import {
  BUILDING_DEFS,
  CROP_DEFS,
  CROP_CODES,
  cropGrowMs,
  harvestItemCode,
  isMowCrop,
  grassWillRegrow,
  grassCutsDone,
  isCropCode,
  DRYING,
  MARKET_BOUNDS,
  SPECIALIZATION_LABELS,
  WORK_LABELS,
  footprintCells,
  freeYardSlot,
  YARD_FULL,
  orientedFootprint,
  quarterTurns,
  xpFor,
  levelForXp,
  levelProgress,
  xpForLevel,
  shortfall,
  addStats,
  readStats,
  questsFor,
  CHEPTEL_DE,
  caseDeTrame,
  claimable,
  corpsDeFerme,
  cultureNpc,
  grainerVoisin,
  QUEST_DEFS,
  type XpEvent,
  type XpContext,
  type PlayerStats,
  type SkillSnapshot,
  type SkillBonuses,
  emptySnapshot,
  evaluateSkills,
  noSkillBonuses,
  SKILL_EFFECT_CAPS,
  bonusesFor,
  STAT_LABELS,
  DEFAULT_GRID,
  MACHINE_DEFS,
  CONTRACT_WORK,
  SIM_TICK_MS,
  DELIVERY_TRAVEL_MS,
  DELIVERY_AUTO_MS,
  WEATHER_LABELS,
  WORLD,
  CONTINENT_BY_CODE,
  REGION_BY_CODE,
  CLASS_PROFILES,
  parcelName,
  marketValue,
  askPrice,
  accessIndex,
  canAcquire,
  landTax,
  landStatusFor,
  estateBonuses,
  LAND_CAPS,
  LAND_STATUS_LABELS,
  requiredLevelForParcel,
  resumerChamp,
  type AcquisitionRule,
  buildingStatsAtLevel,
  buildingUpgradeCost,
  buildingLevelDef,
  MAX_BUILDING_LEVEL,
  urgentContractorQuote,
  contractorTotal,
  URGENT_CONTRACTOR_WORKS,
  LABOR_ORDER_WORKS,
  CONTRACTOR_YIELD_MALUS,
  missionPayout,
  laborEscrow,
  LABOR_ORDER_TTL_MS,
  LABOR_OPEN_MAX_PER_CLIENT,
  MISSION_CELLS_MIN,
  MISSION_CELLS_MAX,
  MISSION_OPEN_MAX,
  P2P_YIELD_MALUS,
  MISSION_CELL_CHOICES,
  clampMissionCells,
  appearanceFromJson,
  parseAppearance,
  FIELD_PRESENCE_TTL_MS,
  PLAYER_ONLINE_MS,
  parseConsignes,
  parseAbsenceLog,
  DEFAULT_CONSIGNES,
  CONSIGNE_AWAY_MS,
  NPC_PARCEL_SHARE,
  strawYieldFor,
  balesFromStraw,
  BALE_TONS,
  strawFromBales,
  DEFAULT_HOUSING,
  feltTempC,
  grazePasture,
  grazesForFood,
  feedSavedByPasture,
  parseHousing,
  thermalPenalty,
  thermalAlert,
  outdoorTempC,
  grassCapacity,
  type Housing,
  type Season,
  canSilageHarvest,
  silageYieldTons,
  WORLD_MARKET_GOODS,
  PURCHASABLE_GOODS,
  type Consignes,
  type AbsenceLog,
  repairHalfwayTarget,
  type FarmWork,
  type Specialization,
  ripenessAt,
  LOST_CROP_FERTILITY_MALUS,
  plowRequired,
  canStubble,
  canRegrass,
  applyStubble,
  applyRegrass,
  residueBonus,
  PLOW_COST_PER_CELL_SOIL,
  PLOW_FERTILITY_GAIN,
  STUBBLE_COST_PER_CELL,
  SOIL_WORK_REFUSAL_LABELS,
  MAX_HARVESTS_BEFORE_PLOW,
  applyDirectSeed,
  sowingPlan,
  DIRECT_SEED_COST_PER_CELL,
  DIRECT_SEED_FERTILITY_GAIN,
  nextRotation,
  type RotationState,
  quoteAllChannels,
  dealerPricePerTon,
  marketPricePerTon,
  listingFee,
  npcWouldBuy,
  listingProceeds,
  canList,
  LISTING_REFUSAL_LABELS,
  LISTING_TTL_MS,
  DELIVERY_TTL_MS,
  deliveryAutoFee,
  DEALER_MIN_TONS,
  volumeSlippage,
  machineResaleValue,
  machineDealerValue,
  jobHours,
  MACHINE_LISTING_TTL_MS,
  MACHINE_LISTING_MIN_RATE,
  MACHINE_LISTING_MAX_RATE,
  buildingResaleValue,
  isPaddockAdjacent,
  explainNoMachine as explainNoMachineShared,
  type MachineForWork,
  YARD_BUILDINGS,
  barnsForYard,
  buildingWithArticle,
  paddockCapacity,
  tickHappiness,
  canGraze,
  canLiveOutside,
  planGrazing,
  milkYield,
  eggYield,
  woolYield,
  meatYield,
  happinessLabel,
  hungerPenalty,
  kindForBarn,
  yardTypeForBarn,
  ANIMAL_PRICE,
  YOUNG_PRICE_RATIO,
  YOUNG_GROW_MS,
  YOUNG_FEED_RATIO,
  herdFeedNeed,
  troughCapacity,
  STARTER_COW_COUNT,
  STARTER_HAY_TONS,
  FEED_BASE,
  canBreed,
  gestationProgress,
  litterFor,
  BREEDING_REFUSAL_LABELS,
  mortalityToll,
  MORTALITY,
  blendedAgeMs,
  PURCHASED_AGE_MS,
  HUNGER,
  feedBurn,
  feedUnits,
  rationQuality,
  dealerAskPrice,
  GOOD_DEFS,
  isPerishable,
  SPOILAGE_SLOW_CAP,
  canOpenFuture,
  futuresPrice,
  futuresProceeds,
  futuresPenalty,
  futuresOutcome,
  FUTURES_HORIZONS_H,
  FUTURES_DISCOUNT,
  FUTURES_REFUSAL_LABELS,
  type FuturesHorizonH,
  afterSpoilage,
  SPOILAGE_PER_CYCLE,
  SELLABLE_GOODS,
  GRAIN_GOODS,
  allocateGrainIntake,
  grainForcedSaleReason,
  grainStockFromItems,
  isGrainGood,
  totalGrainTons,
  type GrainForcedSaleReason,
  type GrainGood,
  settleSaleTons,
  GRAZING_REFUSAL_LABELS,
  LIVESTOCK_CYCLE_MS,
  autoCollects,
  collectCapCycles,
  COLLECT_READY_RATIO,
  collectProgress,
  collectReady,
  MEAT_MATURITY_MS,
  type AnimalKind,
  type TradeGood,
  manureProduced,
  beddingBurn,
  beddingCover,
  beddingPenalty,
  welfareReasons,
  beddingManureMultiplier,
  beddingNeed,
  beddingCapacity,
  manurePitCapacity,
  addManureToPit,
  manureFill,
  manureSmellPenalty,
  manureNeededForCells,
  manureSaleProceeds,
  MANURE_FERTILITY_GAIN,
  currentSeason,
  canSowInSeason,
  GAME_DAY_MS,
  weedsAtSowing,
  weedsAfterSoilWork,
  weedPressureAfter,
  clampWeeds,
  WEED_AFTER_SPRAY,
  WEED_AFTER_PLOW,
  HERBICIDE_COST_PER_CELL,
  asTier,
  machinePower,
  machineRequiredHp,
  machineWidth,
  machineLifeHours,
  peutRacheter,
  machineHoursPerHectare,
  machineCost,
  machineVariant,
  machineUpgradeCost,
  nextMachineTier,
  machineRepairPerPoint,
  jobDurationMs,
  fuelForJob,
  MARKET_DEPTH_FLOOR,
  PROCESSING_BUILDINGS,
  RECIPES,
  processRun,
  processingMargin,
  processingThroughput,
  farmEquity,
  borrowingRoom,
  creditCeiling,
  creditHealth,
  seasonInterest,
  statutParcelle,
  type SowingPlanRefusal,
  accrueInterest,
  LOAN_MIN_CRD,
  fuelCost,
  FUEL_TANK_L,
  type MachineDef,
  type Tier,
  seasonProgress,
  gameDayIndex,
  weatherForDay,
  pickWeather,
  climateYieldFactor,
  type Hemisphere,
  type BuildingType as SharedBuildingType,
  type MachineType,
  type WeatherState,
  isBreakdownKind,
  type LedgerPoste,
  totauxParPoste,
  resultat,
  conditionYieldFactor,
  machineAgeYieldFactor,
  GREASE_COST_CRD,
  GREASE_FULL,
  CLEAN_COST_CRD,
  type BreakdownKind,
  DEV_DISPLAY_CRD,
  isDevEmail,
  canAfford,
  hasUnlimitedCrd,
  normalizeEmail,
  RECOVERY_REFUSAL,
  isRecoveryCode,
} from "@farmsim/shared";
import {
  simulateCell,
  projectReadyAt,
  integrateGrowth,
  sellToMarket,
  tickMarket,
  applyMachineWear,
  repairMachineCost,
  marketNpcPressure,
  buildSessionResume,
  harvestMoisture,
  dryInventory,
  moistureSellPenalty,
  mergeMoisture,
  applyJobCare,
  careWearMultiplier,
  careYieldBonus,
  machineWorkBlock,
  repairTargetCondition,
  pickBreakdownKind,
  type MachineCareState,
} from "@farmsim/sim";
import { randomBytes, randomUUID } from "crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { BAREMES, Limiteur, classer, cleAppelant } from "./rate-limit.js";
import { empreinteSecours, nouveauCodeSecours, secoursCorrespond } from "./recovery.js";

/**
 * Ce processus sert-il aussi le front construit ?
 *
 * En production oui — même conteneur, mêmes ports —, et les fichiers du front
 * n'ont alors pas le préfixe `/api`. En développement Vite s'en charge, et
 * tout ce qui arrive ici est un appel de jeu.
 */
const SERT_LE_FRONT = existsSync(
  path.join(process.env.WEB_DIST_DIR ?? path.join(__dirname, "web"), "index.html"),
);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Vrai pour un appel de jeu, faux pour un fichier du front. */
      estApi?: boolean;
    }
  }
}

const prisma = new PrismaClient();
const app = express();

/**
 * Express 4 ne rattrape pas les rejets d'un gestionnaire `async`.
 *
 * Les quatre-vingt-six routes sont écrites en `async (req, res) => …` et
 * quatre seulement portent un `try/catch`. Sur les autres, la moindre erreur
 * — une contrainte de base, un débit refusé — produisait un rejet non capté :
 * aucune réponse n'était envoyée, et le navigateur attendait jusqu'à
 * expiration devant une ferme figée. Rien dans le journal côté client, et
 * juste un avertissement de Node côté serveur.
 *
 * On enveloppe donc les méthodes de routage **avant** toute déclaration : le
 * rejet part vers le gestionnaire d'erreurs, qui répond.
 */
for (const method of ["get", "post", "put", "delete", "patch"] as const) {
  const original = app[method].bind(app) as (...a: unknown[]) => unknown;
  (app as unknown as Record<string, unknown>)[method] = (path: unknown, ...handlers: unknown[]) =>
    original(
      path,
      ...handlers.map((h) =>
        typeof h === "function" && (h as { length: number }).length < 4
          ? (req: express.Request, res: express.Response, next: express.NextFunction) => {
              try {
                const out = (h as (...a: unknown[]) => unknown)(req, res, next);
                if (out instanceof Promise) out.catch(next);
              } catch (e) {
                next(e);
              }
            }
          : h,
      ),
    );
}

/**
 * Derrière le portier commun (Caddy), l'adresse du client arrive dans
 * `X-Forwarded-For` : sans ce réglage, tous les joueurs partagent l'adresse du
 * proxy et se limiteraient les uns les autres. Un seul saut est déclaré — le
 * portier —, et l'en-tête n'est cru que pour ce saut-là.
 */
app.set("trust proxy", Number(process.env.FARMSIM_TRUST_PROXY ?? 1));

app.use(cors());
app.use(express.json());

// Le front (apps/web) appelle toujours `${API}${chemin}` avec API = "/api" —
// en développement, le serveur Vite réécrit `/api/xxx` en `/xxx` avant de
// relayer vers cette API (voir apps/web/vite.config.ts). En production, les
// deux sont servis par le même processus : on reproduit la même réécriture
// ici, pour que les routes ci-dessous (déclarées sans préfixe) n'aient pas à
// changer.
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/") || req.url === "/api") {
    req.url = req.url.slice(4) || "/";
    req.estApi = true;
  } else {
    // En développement, Vite sert le front et réécrit `/api/x` en `/x` avant
    // de relayer : tout ce qui arrive ici est un appel de jeu. En production,
    // le même processus sert aussi les fichiers du front, et eux ne portent
    // pas le préfixe.
    req.estApi = !SERT_LE_FRONT;
  }
  next();
});

/**
 * Toute action se fait au nom du porteur du jeton, et de personne d'autre.
 *
 * Soixante-quinze des quatre-vingt-six routes lisaient le `userId` dans le
 * corps de la requête et le croyaient sur parole — elles vérifiaient bien que
 * la machine appartenait à ce `userId`, mais jamais que l'appelant *était* ce
 * joueur. Et `/players`, publique, donne l'identifiant de chacun. Un visiteur
 * sans compte pouvait donc vendre le tracteur d'un autre :
 *
 *     POST /machines/<id>/sell   { "userId": "<id lu dans /players>" }
 *     → 200 { "sold": "TRACTOR", "value": 1540 }
 *
 * Corriger les soixante-quinze gestionnaires un par un aurait laissé passer
 * le prochain. La règle vit donc ici, en amont : **dès qu'une requête porte un
 * `userId`, il doit être celui de la session**. Les routes qui n'en portent
 * pas — inscription, connexion, monde, cotations — ne sont pas concernées et
 * restent ouvertes.
 *
 * Le client attache déjà son jeton à chaque appel (`api()`, App.tsx), et
 * aucun appel ne contourne ce helper : aucun gestionnaire n'a besoin de
 * changer.
 */
async function enforceIdentity(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const claimed =
    (typeof req.body?.userId === "string" ? req.body.userId : null) ??
    (typeof req.query.userId === "string" ? req.query.userId : null);
  if (!claimed) {
    next();
    return;
  }
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session expirée — reconnectez-vous" });
    return;
  }
  if (auth.user.id !== claimed) {
    res.status(403).json({ error: "Action refusée : ce n'est pas votre compte" });
    return;
  }
  next();
}

app.use((req, res, next) => {
  enforceIdentity(req, res, next).catch(next);
});

/**
 * Limitation de débit — cf. `rate-limit.ts` pour le pourquoi et les barèmes.
 *
 * Placée après la réécriture `/api` et après l'identité, donc avant toutes les
 * routes : une règle en amont ne peut pas oublier la prochaine route ajoutée,
 * là où cent quatre gestionnaires à modifier en auraient laissé passer.
 *
 * `estApi` distingue un appel de jeu d'un fichier du front : la page en tire
 * des dizaines d'un coup au chargement, et les compter comme des appels
 * ferait refuser sa propre page au joueur.
 */
const limiteur = new Limiteur();
setInterval(() => limiteur.purge(), 60_000).unref();

/**
 * Débrayage — **pour les tests, jamais en production**.
 *
 * Une suite d'intégration crée des dizaines de comptes en quelques secondes
 * depuis la même adresse : c'est exactement le profil que la limite arrête. Le
 * débrayage est donc explicite, bruyant au démarrage, et `debit.test.ts` tourne
 * sans lui — c'est lui qui prouve que le garde-fou fonctionne.
 */
const DEBIT_LIBRE = /^(0|off|false|no)$/i.test(process.env.FARMSIM_RATE_LIMIT ?? "");
if (DEBIT_LIBRE) {
  console.warn(
    "LIMITE DE DÉBIT DÉSACTIVÉE — le code d'accès se devine en boucle. Retirez FARMSIM_RATE_LIMIT en production.",
  );
}

app.use((req, res, next) => {
  if (DEBIT_LIBRE || !req.estApi || req.path === "/health") {
    next();
    return;
  }
  const classe = classer(req.method, req.path);
  const verdict = limiteur.autorise(
    `${classe}|${cleAppelant({ authorization: req.headers.authorization, ip: req.ip })}`,
    BAREMES[classe],
  );
  if (verdict.ok) {
    next();
    return;
  }
  res.setHeader("Retry-After", String(verdict.attendreS));
  res.status(429).json({
    error:
      classe === "AUTH"
        ? `Trop d'essais — réessayez dans ${verdict.attendreS} s`
        : `Vous allez trop vite — reprenez dans ${verdict.attendreS} s`,
  });
});

const PORT = Number(process.env.PORT ?? 3001);

/**
 * Outils de test, fermés par défaut.
 *
 * Ils donnent de l'argent, du niveau et du stock sur commande : ouverts en
 * production, ils videraient l'économie de tout enjeu et n'importe quel joueur
 * pourrait s'en servir. Il faut donc les demander explicitement, par variable
 * d'environnement, sur l'installation où l'on teste.
 */
const DEV_TOOLS = /^(1|true|yes|on)$/i.test(process.env.FARMSIM_DEV_TOOLS ?? "");

/**
 * Comptes autorisés à utiliser les outils de test **en production**.
 *
 * `FARMSIM_DEV_TOOLS=1` ouvre la triche à quiconque est connecté : c'est
 * acceptable sur une installation locale, jamais sur un jeu public. Or on a
 * besoin, sur le serveur en service, d'un compte capable de tout éprouver —
 * une trésorerie illimitée, un niveau donné, des cultures mûres.
 *
 * Un compte est déjà inscrit dans le code (`juju.dolou@gmail.com`). D'autres
 * s'ajoutent par `FARMSIM_TESTERS=vous@exemple.fr`. Les outils restent
 * introuvables (404) pour tous les autres, exactement comme avant.
 */
const DEV_EMAILS_ENV = process.env.FARMSIM_TESTERS ?? "";

function estCompteDev(email: string | null | undefined): boolean {
  if (!email) return false;
  return isDevEmail(email, DEV_EMAILS_ENV);
}

function estArgentIllimite(email: string | null | undefined): boolean {
  if (!email) return false;
  return hasUnlimitedCrd(email);
}

function peutPayer(
  user: { email: string; crd: number },
  cost: number,
): boolean {
  return canAfford(user, cost, DEV_EMAILS_ENV);
}

/**
 * L'appelant a-t-il droit aux outils de test ?
 *
 * Renvoie le compte, ou `null`. On répond volontairement 404 plutôt que 403
 * aux autres : une route de triche ne doit pas même signaler qu'elle existe.
 */
async function testeurAutorisé(req: express.Request) {
  const auth = await userFromAuthHeader(req);
  if (!auth) return null;
  if (DEV_TOOLS) return auth;
  return estCompteDev(auth.user.email) ? auth : null;
}

async function createParcelGrid(parcelId: string, gridW: number, gridH: number) {
  const data = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      data.push({ parcelId, x, y, kind: "EMPTY" as CellKind });
    }
  }
  await prisma.parcelCell.createMany({ data });
}

function farmInclude() {
  return {
    parcels: {
      include: {
        zone: true,
        cells: true,
        buildings: true,
        machines: true,
      },
    },
    machines: true,
    inventory: true,
  } as const;
}

/**
 * Le parc minimum d'une ferme neuve.
 *
 * Depuis la séparation porteur / outil, un tracteur ne sème ni ne laboure. La
 * liste vit ici pour que l'inscription et la reprise de parcelle ne puissent
 * pas diverger — deux endroits créent une ferme, et l'un des deux finirait
 * par oublier un outil.
 */
const STARTER_MACHINES: MachineType[] = ["TRACTOR", "SEEDER", "PLOUGH"];

/**
 * Le parc de départ, identique pour tous.
 *
 * Le déchaumeur en fait partie : sans lui, on ne peut pas resemer après la
 * première moisson, et c'est la toute première consigne du guide.
 */
const STARTER_KIT: MachineType[] = [...STARTER_MACHINES, "DISC_HARROW"];

type FarmMachine = {
  id: string;
  type: string;
  /** Palier de l'engin — la colonne existait sans jamais servir. */
  tier?: number;
  /** Occupée par un chantier jusqu'à cette heure. */
  busyUntil?: Date | null;
  condition: number;
  /** Compteur horaire. Absent sur les bases d'avant la migration. */
  hours?: number;
  storedInBuildingId: string | null;
  greased?: boolean;
  grease?: number;
  dirt?: number;
  greaseSkipStreak?: number;
  breakdown?: string | null;
};

/**
 * Le climat d'une parcelle, sous la forme que la simulation attend.
 *
 * Six appels à `simulateCell` doivent désormais transmettre l'hémisphère et
 * la zone, faute de quoi la pousse retombe silencieusement sur l'ancien
 * minuteur. Les répartir à la main aurait garanti qu'un site diverge : un
 * champ semé au même instant aurait mûri à deux dates selon la route qui
 * l'observe.
 */
function climatDe(parcel: {
  zone?: { koppen: string; code: string; hemisphere: string } | null;
}): { hemisphere?: Hemisphere; koppen?: string; zoneCode?: string } {
  const z = parcel.zone;
  if (!z) return {};
  return {
    hemisphere: z.hemisphere === "S" ? "S" : "N",
    koppen: z.koppen,
    zoneCode: z.code,
  };
}

/**
 * Pression d'adventices **effective** d'une case.
 *
 * Le stock ne porte que la valeur du dernier geste — semis, déchaumage,
 * labour, pulvérisateur — et la date à laquelle il a eu lieu. Ce qui a poussé
 * depuis s'intègre à la lecture, comme la croissance : pas de tick à faire
 * courir sur toutes les cases, et aucune valeur dérivée qui puisse se
 * désynchroniser de sa source.
 */
function pressionAdventices(
  cell: { weedPressure: number; weedAt: Date | null },
  season?: Season,
): number {
  if (!cell.weedAt) return clampWeeds(cell.weedPressure);
  return weedPressureAfter({
    start: cell.weedPressure,
    elapsedMs: Date.now() - cell.weedAt.getTime(),
    season,
  });
}

function careOf(m: FarmMachine): MachineCareState {
  const grease = m.grease ?? (m.greased === false ? 0 : GREASE_FULL);
  return {
    condition: m.condition,
    grease,
    greased: grease > 0,
    dirt: m.dirt ?? 0,
    greaseSkipStreak: m.greaseSkipStreak ?? 0,
    breakdown: isBreakdownKind(m.breakdown) ? m.breakdown : null,
  };
}

/**
 * Un attelage prêt à travailler : l'outil, et le tracteur qui le tire.
 *
 * `tractor` est nul pour un automoteur — moissonneuse, ensileuse — qui se
 * suffit à lui-même.
 */
type Rig = {
  machine: FarmMachine;
  def: MachineDef;
  tier: Tier;
  tractor: FarmMachine | null;
};

function tierOf(m: FarmMachine): Tier {
  return asTier(m.tier);
}

/**
 * Pourquoi ce travail ne peut pas se faire.
 *
 * La règle vit désormais dans le domaine : l'écran doit pouvoir dire avant le
 * clic ce que cette route répondrait après. Ici on ne fait que garantir une
 * phrase, là où l'appelant en attend toujours une.
 */
function explainNoMachine(machines: FarmMachine[], work: FarmWork): string {
  return (
    explainNoMachineShared(machines as unknown as MachineForWork[], work) ??
    "Aucune machine en état pour ce travail — achetez / réparez."
  );
}

/**
 * Choisit l'attelage qui fera le travail.
 *
 * Le jeu attelle **tout seul**, et c'est un choix de conception : la décision
 * intéressante est de savoir quel matériel posséder, pas lequel accrocher
 * derrière quoi avant chaque passage. Atteler à la main n'ajouterait que des
 * clics.
 *
 * À matériel égal on prend le plus large — c'est le plus rapide — puis le
 * mieux entretenu.
 */
function pickMachineForWork(machines: FarmMachine[], work: FarmWork): Rig | null {
  const libre = (m: FarmMachine) => !m.busyUntil || m.busyUntil.getTime() <= Date.now();
  const tracteurs = machines
    .filter((m) => MACHINE_DEFS[m.type as MachineType]?.kind === "TRACTOR")
    .filter(libre)
    .filter((m) => !machineWorkBlock(careOf(m), MACHINE_DEFS[m.type as MachineType].minCondition))
    .sort(
      (a, b) =>
        machinePower(b.type as MachineType, tierOf(b)) -
        machinePower(a.type as MachineType, tierOf(a)),
    );

  const candidats: Rig[] = [];
  for (const m of machines) {
    const def = MACHINE_DEFS[m.type as MachineType];
    if (!def || !def.works.includes(work)) continue;
    if (!libre(m)) continue;
    if (machineWorkBlock(careOf(m), def.minCondition)) continue;
    const tier = tierOf(m);
    if (def.kind === "IMPLEMENT") {
      const besoin = machineRequiredHp(def.type, tier);
      const porteur = tracteurs.find(
        (t) => machinePower(t.type as MachineType, tierOf(t)) >= besoin,
      );
      if (!porteur) continue;
      candidats.push({ machine: m, def, tier, tractor: porteur });
    } else {
      candidats.push({ machine: m, def, tier, tractor: null });
    }
  }
  if (!candidats.length) return null;
  candidats.sort((a, b) => {
    const la = machineWidth(a.def.type, a.tier);
    const lb = machineWidth(b.def.type, b.tier);
    if (la !== lb) return lb - la;
    return b.machine.condition - a.machine.condition;
  });
  return candidats[0]!;
}

type CellXY = { x: number; y: number };

function parseCellJson(raw: string): CellXY[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (c): c is CellXY =>
        !!c && typeof c === "object" && Number.isInteger((c as CellXY).x) && Number.isInteger((c as CellXY).y),
    );
  } catch {
    return [];
  }
}

function cellsSubset(inner: CellXY[], outer: CellXY[]): boolean {
  return inner.every((c) => outer.some((o) => o.x === c.x && o.y === c.y));
}

function subtractCells(from: CellXY[], remove: CellXY[]): CellXY[] {
  return from.filter((c) => !remove.some((r) => r.x === c.x && r.y === c.y));
}

type FieldAccess =
  | {
      ok: true;
      parcel: NonNullable<Awaited<ReturnType<typeof loadParcelForWork>>>;
      machines: FarmMachine[];
      charge: boolean;
      order: {
        id: string;
        remainingJson: string;
        /** Toutes les cases de la mission : c'est sur elles que se paie l'XP */
        cellsJson: string;
        work: string;
        crop: string | null;
        payoutCrd: number;
        escrowCrd: number;
        quoteCrd: number;
        clientId: string;
        providerId: string | null;
      } | null;
    }
  | { ok: false; status: number; error: string };

async function loadParcelForWork(parcelId: string) {
  return prisma.parcel.findUnique({
    where: { id: parcelId },
    include: { farm: { include: { machines: true, user: true } }, cells: true, zone: true },
  });
}

/* ------------------------------------------------------------------ */
/* Banque                                                              */
/* ------------------------------------------------------------------ */

/**
 * Ce que vaut une exploitation si l'on arrête tout.
 *
 * La terre à sa valeur de marché, les bâtiments à leur prix de démolition, le
 * matériel à sa cote d'occasion, les stocks au cours du jour. C'est l'assiette
 * de la ligne de crédit : une banque prête sur ce qu'elle peut reprendre.
 */
async function capitauxPropres(userId: string): Promise<{
  equity: number;
  landCrd: number;
  buildingsCrd: number;
  machinesCrd: number;
  stockCrd: number;
  cashCrd: number;
  debtCrd: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      farm: {
        include: {
          machines: true,
          inventory: true,
          parcels: { include: { buildings: true } },
        },
      },
    },
  });
  const vide = {
    equity: 0,
    landCrd: 0,
    buildingsCrd: 0,
    machinesCrd: 0,
    stockCrd: 0,
    cashCrd: 0,
    debtCrd: 0,
  };
  if (!user?.farm) return vide;

  const landCrd = user.farm.parcels.reduce((n, p) => n + (p.landPrice ?? 0), 0);
  const buildingsCrd = user.farm.parcels.reduce(
    (n, p) =>
      n +
      p.buildings.reduce(
        (m, b) => m + buildingResaleValue(b.type as BuildingType, b.level),
        0,
      ),
    0,
  );
  const machinesCrd = user.farm.machines.reduce(
    (n, m) =>
      n +
      machineResaleValue(m.type as MachineType, {
        condition: m.condition,
        hours: m.hours,
        tier: m.tier,
      }),
    0,
  );
  const prix = await prisma.marketPrice.findMany();
  const stockCrd = user.farm.inventory.reduce((n, i) => {
    const p = prix.find((x) => x.commodity === i.itemCode);
    return n + (p ? i.qty * p.price : 0);
  }, 0);

  const debtCrd = user.farm.debtCrd;
  return {
    landCrd,
    buildingsCrd,
    machinesCrd,
    stockCrd: Math.round(stockCrd * 100) / 100,
    cashCrd: user.crd,
    debtCrd,
    equity: farmEquity({
      landCrd,
      buildingsCrd,
      machinesCrd,
      stockCrd,
      cashCrd: user.crd,
      debtCrd,
    }),
  };
}

/**
 * Fait courir les intérêts sur toutes les lignes tirées.
 *
 * Au tick monde, et non à la lecture : les intérêts **modifient** la dette, ce
 * n'est pas une valeur dérivée. Les faire courir à chaque affichage les ferait
 * dépendre du nombre de fois où le joueur ouvre son Bureau.
 */
async function tickDebtInterest() {
  const endettees = await prisma.farm.findMany({
    where: { debtCrd: { gt: 0 } },
    select: { id: true, userId: true, debtCrd: true, debtAt: true },
  });
  const now = new Date();
  for (const f of endettees) {
    const depuis = f.debtAt?.getTime() ?? now.getTime();
    const { interest, debtCrd } = accrueInterest({
      debtCrd: f.debtCrd,
      elapsedMs: now.getTime() - depuis,
    });
    if (interest <= 0.01) {
      if (!f.debtAt) await prisma.farm.update({ where: { id: f.id }, data: { debtAt: now } });
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.farm.update({ where: { id: f.id }, data: { debtCrd, debtAt: now } });
      // L'intérêt est une charge : il apparaît au journal même s'il ne sort pas
      // de la trésorerie, sinon le Bureau ne dirait pas ce qu'il coûte.
      await tx.ledgerEntry.create({
        data: {
          userId: f.userId,
          amount: -interest,
          poste: "BANQUE",
          label: "Intérêts de la ligne de crédit",
        },
      });
    });
  }
}

/* ------------------------------------------------------------------ */
/* Ateliers de transformation                                          */
/* ------------------------------------------------------------------ */

/**
 * Fait tourner les laiteries et les moulins.
 *
 * Au tick monde, comme les intérêts : un atelier travaille pendant que le
 * joueur est ailleurs, c'est tout son intérêt. Le calculer à l'affichage le
 * ferait dépendre du nombre de fois qu'on ouvre l'écran.
 *
 * Trois choses le bornent, et ce sont elles qui font la décision : le débit du
 * bâtiment, la matière en stock, et le cours du produit fini — qui baisse
 * quand on en écoule.
 */
async function tickProcessing() {
  const ateliers = await prisma.building.findMany({
    where: { type: { in: PROCESSING_BUILDINGS } },
    include: { parcel: { select: { farmId: true } } },
  });
  const now = new Date();
  for (const b of ateliers) {
    const def = BUILDING_DEFS[b.type as BuildingType];
    if (!def.processing || !b.parcel.farmId) continue;
    const recette = RECIPES[def.processing];
    const depuis = b.processedAt ?? b.createdAt;
    const stock = await prisma.inventoryItem.findFirst({
      where: { farmId: b.parcel.farmId, itemCode: recette.input },
    });
    if (!stock || stock.qty <= 0) {
      // Un atelier à vide ne met rien de côté : sans cette remise à l'heure,
      // une laiterie sans lait accumulerait des semaines de capacité et
      // convertirait tout un silo à la première traite.
      await prisma.building.update({ where: { id: b.id }, data: { processedAt: now } });
      continue;
    }
    const run = processRun({
      kind: def.processing,
      perDay: processingThroughput(b.type as BuildingType, b.level),
      elapsedMs: now.getTime() - depuis.getTime(),
      stockIn: stock.qty,
    });
    // Rien de produit alors qu'il y a de la matière : le temps écoulé ne fait
    // pas encore une unité entière. On garde l'arrêté d'avant, sinon le
    // compteur repart à zéro à chaque tour et l'atelier ne produit jamais.
    if (run.produced <= 0) continue;
    await prisma.$transaction(async (tx) => {
      await drawFromStock(tx, stock, run.consumed);
      await addToStock(tx, b.parcel.farmId!, recette.output, run.produced);
      await tx.building.update({ where: { id: b.id }, data: { processedAt: now } });
    });
  }
}

/* ------------------------------------------------------------------ */
/* Chantiers qui durent                                                 */
/* ------------------------------------------------------------------ */

/**
 * Accélérateur de test.
 *
 * Sept minutes de labour sont le bon rythme pour un joueur et une éternité
 * dans une suite d'intégration. C'est un **diviseur**, pas une durée fixe :
 * une première version écrasait la durée à une constante, ce qui supprimait du
 * même coup la proportionnalité à la surface et à l'outil — précisément ce
 * qu'on veut vérifier.
 */
const JOB_SPEED = Math.max(1, Number(process.env.FARMSIM_JOB_SPEED ?? 1));

/**
 * Gazole d'un chantier, en litres.
 *
 * C'est le porteur qui brûle : un outil n'a pas de moteur. Pour un automoteur,
 * la charge vaut un — il est par définition dimensionné pour lui-même.
 */
function gazoleChantier(rig: Rig, cells: number): number {
  const heures = jobHours(machineHoursPerHectare(rig.def.type, rig.tier), cells);
  const porteur = rig.tractor
    ? { type: rig.tractor.type as MachineType, tier: tierOf(rig.tractor) }
    : { type: rig.def.type, tier: rig.tier };
  const dispo = machinePower(porteur.type, porteur.tier);
  const besoin = rig.tractor
    ? machineRequiredHp(rig.def.type, rig.tier)
    : dispo;
  return fuelForJob({ powerHp: dispo, requiredHp: besoin, hours: heures });
}

/** Durée réelle d'un chantier, attelage et surface compris. */
function dureeChantier(rig: Rig, cells: number): number {
  const reel = jobDurationMs(jobHours(machineHoursPerHectare(rig.def.type, rig.tier), cells));
  return Math.max(1, Math.round(reel / JOB_SPEED));
}

/** Les cases déjà prises par un chantier en cours sur cette parcelle. */
/**
 * Le délai au bout duquel un chantier jamais réclamé est tenu pour abandonné.
 *
 * Un chantier reste `RUNNING` jusqu'à ce que la route de travail vienne le
 * consommer. Si cet appel n'arrive jamais — onglet fermé, réseau coupé, ou
 * simplement un travail refusé après l'ouverture — le chantier restait
 * `RUNNING` **pour toujours**, et ses cases avec lui. « Case 5,9 déjà sur un
 * chantier en cours » alors qu'aucun chantier ne tourne : c'était un fantôme
 * d'il y a des heures, et rien dans le jeu ne permettait de le déloger.
 *
 * Le délai est large exprès. Le client réclame son travail dans la seconde
 * qui suit la fin ; mais un téléphone qui se met en veille suspend ses
 * minuteries, et le joueur qui revient doit retrouver son chantier. Cinq
 * minutes couvrent largement une reprise, et laissent le fantôme se dissiper
 * tout seul.
 */
const JOB_ABANDON_GRACE_MS = 5 * 60_000;

/**
 * Libère les chantiers que personne n'est venu réclamer.
 *
 * L'attelage rentre et le gazole retourne à la cuve : rien n'a été appliqué
 * au champ, le joueur n'a donc rien à payer. C'est exactement ce que fait un
 * abandon, à ceci près que personne ne l'a demandé.
 *
 * Appelé au fil de l'eau plutôt que par une tâche de fond : les deux routes
 * qui regardent les chantiers d'une parcelle passent ici d'abord, ce qui
 * suffit à ce qu'un fantôme ne survive jamais à la visite suivante.
 */
async function libererChantiersAbandonnes(parcelId: string): Promise<void> {
  const morts = await prisma.fieldJob.findMany({
    where: {
      parcelId,
      status: "RUNNING",
      endsAt: { lt: new Date(Date.now() - JOB_ABANDON_GRACE_MS) },
    },
  });
  if (!morts.length) return;
  const parcelle = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { farmId: true },
  });
  const gazole = morts.reduce((somme, j) => somme + (j.fuelL ?? 0), 0);
  const attelages = morts
    .flatMap((j) => [j.machineId, j.tractorId])
    .filter(Boolean) as string[];
  await prisma.$transaction(async (tx) => {
    await tx.fieldJob.updateMany({
      where: { id: { in: morts.map((j) => j.id) } },
      data: { status: "CANCELLED" },
    });
    await tx.machine.updateMany({ where: { id: { in: attelages } }, data: { busyUntil: null } });
    if (parcelle?.farmId && gazole > 0) {
      await tx.farm.update({
        where: { id: parcelle.farmId },
        data: { fuelL: { increment: gazole } },
      });
    }
  });
}

/**
 * Les cases qu'un chantier tient réservées, en ce moment.
 *
 * « En ce moment » compte : un chantier dont l'heure de fin est passée depuis
 * longtemps ne tient plus rien, qu'il ait été réclamé ou non. Le filtre sur
 * le temps double `libererChantiersAbandonnes` à dessein — même si le ménage
 * n'a pas encore eu lieu, un fantôme ne bloque pas le champ.
 */
async function occupiedJobCells(parcelId: string): Promise<Set<string>> {
  const jobs = await prisma.fieldJob.findMany({
    where: {
      parcelId,
      status: "RUNNING",
      endsAt: { gte: new Date(Date.now() - JOB_ABANDON_GRACE_MS) },
    },
    select: { cellsJson: true },
  });
  const pris = new Set<string>();
  for (const j of jobs) for (const c of parseCellJson(j.cellsJson)) pris.add(`${c.x},${c.y}`);
  return pris;
}

/**
 * Le chantier est-il arrivé à son terme, et couvre-t-il bien ce travail ?
 *
 * C'est le sas par lequel passent tous les travaux de champ. Sans lui, il
 * suffirait d'appeler la route directement pour effacer l'attente — et
 * l'attente est précisément ce qui donne sa valeur à un outil plus large.
 */
type JobVerdict =
  | { ok: true; job: { id: string; fuelL: number; parcelId: string } | null }
  | { ok: false; status: number; error: string; endsAt?: Date };

async function checkFieldJob(opts: {
  jobId?: string;
  userId: string;
  parcelId: string;
  works: FarmWork[];
  cells: CellXY[];
}): Promise<JobVerdict> {
  if (!opts.jobId) {
    return {
      ok: false,
      status: 409,
      error: "Il faut lancer le chantier avant de le terminer.",
    };
  }
  const job = await prisma.fieldJob.findUnique({ where: { id: opts.jobId } });
  if (!job || job.userId !== opts.userId || job.parcelId !== opts.parcelId) {
    return { ok: false, status: 404, error: "Chantier introuvable" };
  }
  if (job.status !== "RUNNING") {
    return { ok: false, status: 409, error: "Chantier déjà terminé" };
  }
  if (!opts.works.includes(job.work as FarmWork)) {
    return { ok: false, status: 409, error: "Ce chantier ne portait pas sur ce travail" };
  }
  if (job.endsAt.getTime() > Date.now()) {
    return {
      ok: false,
      status: 425,
      error: "Chantier encore en cours",
      endsAt: job.endsAt,
    };
  }
  // On ne travaille que les cases réservées : sans quoi on lancerait un
  // chantier sur quatre cases pour en labourer cent quarante-quatre.
  if (!cellsSubset(opts.cells, parseCellJson(job.cellsJson))) {
    return { ok: false, status: 409, error: "Ces cases ne font pas partie du chantier" };
  }
  /* Le chantier est consommé ici, dès qu'il est honoré — pas à la fin du
     travail.
     Fermer plus tard laissait un chantier ouvert chaque fois que la route
     refusait après le sas : « rien à récolter », « rien à désherber ». Les
     cases et l'attelage restaient verrouillés, et aucun écran ne permettait
     d'annuler. Libérer tout de suite coûte le chantier en cas de refus tardif ;
     ne pas libérer coûtait la parcelle. */
  await closeFieldJob(job.id);
  return { ok: true, job: { id: job.id, fuelL: job.fuelL, parcelId: job.parcelId } };
}

/**
 * Rend le gazole d'un chantier qui n'a finalement rien fait.
 *
 * Le plein part au départ de la cour. Quand la route de travail refuse ensuite
 * — « rien n'est mûr », « rien à presser » — l'engin n'a rien labouré et le
 * joueur perdait le carburant d'une sélection mal choisie. Le sas ne peut pas
 * tout prévoir sans simuler : ce qu'il ne prévoit pas, il le rembourse.
 */
async function rendreGazole(job: { id: string; fuelL: number; parcelId: string } | null) {
  if (!job?.fuelL) return;
  const parcel = await prisma.parcel.findUnique({
    where: { id: job.parcelId },
    select: { farmId: true },
  });
  if (!parcel?.farmId) return;
  await prisma.farm.update({
    where: { id: parcel.farmId },
    data: { fuelL: { increment: job.fuelL } },
  });
}

/**
 * Accroche le remboursement à la réponse : tout refus rend le gazole.
 *
 * Les routes de travail refusent en une vingtaine d'endroits — pas de
 * machine, pas d'argent, rien de mûr, case occupée. Les traiter un par un
 * aurait garanti l'oubli du vingt-et-unième. Le critère qui compte n'est
 * pas *où* l'on refuse mais *qu'on* refuse : c'est donc au code de retour
 * qu'on se raccroche, une fois par route.
 */
function gazoleSiRefus(
  res: express.Response,
  job: { id: string; fuelL: number; parcelId: string } | null,
): void {
  if (!job?.fuelL) return;
  res.on("finish", () => {
    if (res.statusCode >= 400) void rendreGazole(job);
  });
}

/** Clôt le chantier et rend l'attelage à son propriétaire. */
async function closeFieldJob(jobId: string | null | undefined) {
  if (!jobId) return;
  const job = await prisma.fieldJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  await prisma.$transaction(async (tx) => {
    await tx.fieldJob.update({ where: { id: jobId }, data: { status: "DONE" } });
    const ids = [job.machineId, job.tractorId].filter(Boolean) as string[];
    await tx.machine.updateMany({ where: { id: { in: ids } }, data: { busyUntil: null } });
  });
}

async function resolveFieldAccess(opts: {
  parcelId: string;
  userId: string;
  work: FarmWork;
  cells: CellXY[];
}): Promise<FieldAccess> {
  const parcel = await loadParcelForWork(opts.parcelId);
  if (!parcel?.farm) {
    return { ok: false, status: 404, error: "Parcelle introuvable" };
  }
  if (parcel.farm.userId === opts.userId) {
    return { ok: true, parcel, machines: parcel.farm.machines, charge: true, order: null };
  }
  const order = await prisma.laborOrder.findFirst({
    where: { parcelId: opts.parcelId, providerId: opts.userId, status: "ACCEPTED" },
  });
  if (!order) {
    return { ok: false, status: 403, error: "Parcelle non possédée" };
  }
  if (order.work !== opts.work) {
    return { ok: false, status: 409, error: `Ce travail est un ${WORK_LABELS[order.work as FarmWork] ?? order.work}` };
  }
  const remaining = parseCellJson(order.remainingJson);
  if (opts.cells.length && !cellsSubset(opts.cells, remaining)) {
    return { ok: false, status: 409, error: "Ces cases ne font pas partie du travail" };
  }
  const provider = await prisma.user.findUnique({
    where: { id: opts.userId },
    include: { farm: { include: { machines: true } } },
  });
  if (!provider?.farm) {
    return { ok: false, status: 409, error: "Ferme requise (machines) pour les contrats" };
  }
  return {
    ok: true,
    parcel,
    machines: provider.farm.machines,
    charge: false,
    order: {
      id: order.id,
      remainingJson: order.remainingJson,
      work: order.work,
      crop: order.crop,
      payoutCrd: order.payoutCrd,
      escrowCrd: order.escrowCrd,
      quoteCrd: order.quoteCrd,
      clientId: order.clientId,
      providerId: order.providerId,
      cellsJson: order.cellsJson,
    },
  };
}

async function settleLaborProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  order: NonNullable<Extract<FieldAccess, { ok: true }>["order"]>,
  worked: CellXY[],
): Promise<{ remaining: number; completed: boolean; payout?: number }> {
  const left = subtractCells(parseCellJson(order.remainingJson), worked);
  if (left.length > 0) {
    await tx.laborOrder.update({
      where: { id: order.id },
      data: { remainingJson: JSON.stringify(left) },
    });
    return { remaining: left.length, completed: false };
  }
  await tx.laborOrder.update({
    where: { id: order.id },
    data: { remainingJson: "[]", status: "COMPLETED", completedAt: new Date() },
  });
  if (order.providerId) {
    await grantXp(
      tx,
      order.providerId,
      "LABOR",
      { cells: parseCellJson(order.cellsJson).length },
      { contracts: 1 },
    );
    await crediter(tx, order.providerId, order.payoutCrd, "CHANTIERS", `Chantier ${WORK_LABELS[order.work as FarmWork] ?? order.work} livré`);
  }
  const rebate = Math.max(0, Math.round((order.quoteCrd - order.payoutCrd) * 100) / 100);
  if (rebate > 0) {
    await crediter(tx, order.clientId, rebate, "CHANTIERS", "Reliquat de chantier rendu");
  }
  return { remaining: 0, completed: true, payout: order.payoutCrd };
}

function publicLaborOrder(o: {
  id: string;
  work: string;
  crop: string | null;
  cellsJson: string;
  remainingJson: string;
  quoteCrd: number;
  extrasCrd: number;
  escrowCrd: number;
  payoutCrd: number;
  status: string;
  parcelId: string;
  clientId: string;
  providerId: string | null;
  expiresAt: Date;
  parcel?: { label: string; zone?: { name: string } | null; farm?: { user?: { displayName: string; isNpc?: boolean } | null } | null };
  client?: { displayName: string; isNpc?: boolean };
}) {
  const cells = parseCellJson(o.cellsJson);
  const remaining = parseCellJson(o.remainingJson);
  return {
    id: o.id,
    kind: "P2P" as const,
    work: o.work,
    crop: o.crop,
    cells: cells.length,
    remaining: remaining.length,
    cellList: remaining,
    quoteCrd: o.quoteCrd,
    escrowCrd: o.escrowCrd,
    payoutCrd: o.payoutCrd,
    status: o.status,
    parcelId: o.parcelId,
    parcelLabel: o.parcel?.label ?? "",
    zoneName: o.parcel?.zone?.name ?? "",
    clientName: o.client?.displayName ?? o.parcel?.farm?.user?.displayName ?? "Exploitant",
    npc: Boolean(o.client?.isNpc ?? o.parcel?.farm?.user?.isNpc),
    expiresAt: o.expiresAt.toISOString(),
  };
}

async function expireLaborOrders() {
  const now = new Date();
  const stale = await prisma.laborOrder.findMany({
    where: { status: { in: ["OPEN", "ACCEPTED"] }, expiresAt: { lte: now } },
  });
  for (const o of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.laborOrder.update({
        where: { id: o.id },
        data: { status: "CANCELLED", providerId: null },
      });
      await crediter(tx, o.clientId, o.escrowCrd, "CHANTIERS", "Chantier expiré — séquestre rendu");
    });
  }
}

async function applyWearToMachine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  opts: {
    rig: Rig;
    cells: number;
    work: FarmWork;
    specialization?: string;
  },
) {
  const { machine, def, tier, tractor } = opts.rig;
  /*
   * Le soin apporté au matériel ralentit son usure.
   *
   * Résolu ici, et pas chez les appelants : ils sont douze, un par travail de
   * champ. Leur demander de porter les compétences, ce serait douze occasions
   * d'en oublier une — et l'oubli ne se verrait pas, l'usure baisserait
   * simplement moins vite sur ce travail-là.
   */
  const proprio = await tx.machine.findUnique({
    where: { id: machine.id },
    select: { farm: { select: { userId: true } } },
  });
  const soin = proprio?.farm?.userId
    ? await getSkillBonuses(proprio.farm.userId)
    : noSkillBonuses();
  /* Les heures du chantier viennent de l'outil : c'est sa largeur qui décide
     du temps passé. Le tracteur en prend autant — il a tiré pendant tout ce
     temps-là — ce qui fait de lui la machine au compteur le plus chargé de la
     ferme, exactement comme sur une vraie exploitation. */
  const heures = jobHours(machineHoursPerHectare(def.type, tier), opts.cells);

  async function user(m: FarmMachine, t: MachineType, ti: Tier) {
    const care = careOf(m);
    const wear = applyMachineWear({
      condition: m.condition,
      hours: heures,
      lifeHours: machineLifeHours(t, ti),
      inShed: Boolean(m.storedInBuildingId),
      // L'entretien et le savoir-faire se multiplient : une machine graissée
      // par quelqu'un qui sait s'y prendre s'use moins que la somme des deux.
      careMult:
        careWearMultiplier({ grease: care.grease, dirt: care.dirt }) * (1 - soin.WEAR),
    });
    // Les deux pièces traversent le même champ : elles se salissent pareil,
    // et chacune a sa jauge et son nettoyage. Posséder plus de matériel coûte
    // plus d'entretien — c'est le prix d'un parc, pas un oubli.
    const after = applyJobCare({ ...care, condition: wear.condition }, {
      work: opts.work,
      cells: opts.cells,
    });
    const compteur = Math.round(((m.hours ?? 0) + heures) * 100) / 100;
    await tx.machine.update({
      where: { id: m.id },
      data: {
        condition: after.next.condition,
        hours: compteur,
        greased: after.next.greased,
        grease: after.next.grease ?? (after.next.greased ? GREASE_FULL : 0),
        dirt: after.next.dirt,
        greaseSkipStreak: after.next.greaseSkipStreak,
        breakdown: after.next.breakdown,
      },
    });
    return { wear, after, compteur };
  }

  const outil = await user(machine, def.type, tier);
  if (tractor) await user(tractor, tractor.type as MachineType, tierOf(tractor));

  return {
    ...outil.wear,
    hoursWorked: heures,
    hours: outil.compteur,
    condition: outil.after.next.condition,
    breakdown: outil.after.next.breakdown,
    dirt: outil.after.next.dirt,
    greased: outil.after.next.greased,
    grease: outil.after.next.grease,
    broke: outil.after.broke,
  };
}

function playableSpec(s: string | null | undefined): Specialization | undefined {
  if (!s) return undefined;
  return s === "ELEVEUR" ? "ELEVEUR" : "CEREALIER";
}

const appearanceSchema = z.object({
  skin: z.number().int(),
  eyeColor: z.number().int(),
  eyeShape: z.number().int(),
  mouth: z.number().int(),
  nose: z.number().int(),
  ears: z.number().int(),
  hat: z.number().int(),
  hatColor: z.number().int(),
  clothes: z.number().int(),
  clothColor: z.number().int(),
  accentColor: z.number().int(),
});

async function touchFieldPresence(userId: string, parcelId: string, cell?: CellXY) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: new Date(),
      lastParcelId: parcelId,
      lastCellX: cell?.x ?? undefined,
      lastCellY: cell?.y ?? undefined,
    },
  });
}

async function listFieldWorkers(parcelId: string) {
  const since = new Date(Date.now() - FIELD_PRESENCE_TTL_MS);
  const users = await prisma.user.findMany({
    where: { lastParcelId: parcelId, lastSeenAt: { gte: since } },
    select: {
      id: true,
      displayName: true,
      appearanceJson: true,
      specialization: true,
      lastCellX: true,
      lastCellY: true,
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.displayName,
    x: u.lastCellX ?? 0,
    y: u.lastCellY ?? 0,
    appearance: appearanceFromJson(u.appearanceJson, playableSpec(u.specialization)),
    specialization: playableSpec(u.specialization),
  }));
}

async function hasActiveMission(userId: string) {
  const [npc, p2p] = await Promise.all([
    prisma.npcContract.findFirst({ where: { status: "ACCEPTED", providerId: userId } }),
    prisma.laborOrder.findFirst({ where: { status: "ACCEPTED", providerId: userId } }),
  ]);
  return Boolean(npc || p2p);
}

const laborOrderInclude = {
  parcel: { include: { zone: true, farm: { include: { user: true } } } },
  client: true,
} as const;

async function canVisitParcel(userId: string, parcelId: string) {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: { farm: true },
  });
  if (!parcel?.farm) return false;
  if (parcel.farm.userId === userId) return true;
  const order = await prisma.laborOrder.findFirst({
    where: { parcelId, providerId: userId, status: "ACCEPTED" },
  });
  return Boolean(order);
}

/**
 * Motifs de refus d'achat.
 *
 * `LEVEL_TOO_LOW` est un gabarit : il se complète du palier requis et de
 * l'expérience qui reste à gagner. « Votre niveau est trop bas » n'apprenait
 * ni combien il faut, ni combien il manque — et le palier était de toute façon
 * inatteignable, faute de progression.
 */
const ACQUISITION_ERRORS: Record<AcquisitionRule, string> = {
  LEVEL_TOO_LOW: "Votre niveau est trop bas pour une parcelle de plus",
  MAX_PARCELS_PER_PLAYER: `Plafond atteint : ${LAND_CAPS.global} parcelles maximum`,
  MAX_PARCELS_PER_REGION: `Plafond régional atteint : ${LAND_CAPS.perRegion} parcelles par région`,
  MAX_REGION_SHARE_PLAYER: `Vous détiendriez plus de ${Math.round(LAND_CAPS.regionSharePct * 100)} % de la région`,
};

/** Le motif de refus, complété du chiffre qui manque quand il s'agit du niveau. */
function acquisitionRefusal(
  reason: AcquisitionRule,
  player: { level: number; xp: number },
  ownedTotal: number,
): string {
  if (reason !== "LEVEL_TOO_LOW") return ACQUISITION_ERRORS[reason] ?? "Acquisition refusée";
  return shortfall(player.xp, requiredLevelForParcel(ownedTotal + 1));
}

type OwnedParcel = { zoneId: string; mapX: number; mapY: number };

type QuoteCounts = {
  regionTotal: number;
  regionTaken: number;
  continentTotal: number;
  continentTaken: number;
};

type QuoteTarget = {
  id: string;
  zoneId: string;
  mapX: number;
  mapY: number;
  fertility: number;
  accessIndex: number;
  zone: { koppen: string; continentCode: string };
};

async function loadQuoteCounts(zoneId: string, continentCode: string): Promise<QuoteCounts> {
  const [regionTotal, regionTaken, continentTotal, continentTaken] = await Promise.all([
    prisma.parcel.count({ where: { zoneId } }),
    prisma.parcel.count({ where: { zoneId, farmId: { not: null } } }),
    prisma.parcel.count({ where: { zone: { continentCode } } }),
    prisma.parcel.count({
      where: { zone: { continentCode }, farmId: { not: null } },
    }),
  ]);
  return { regionTotal, regionTaken, continentTotal, continentTaken };
}

/**
 * Valorisation d'une parcelle : la valeur publique sert à la taxe et à
 * l'affichage, le prix demandé ajoute l'adjacence et l'escalade patrimoniale
 * propres à l'acheteur. Les comptages région / continent se partagent entre
 * toutes les parcelles d'une même commune.
 */
function quoteFromCounts(target: QuoteTarget, owned: OwnedParcel[], counts: QuoteCounts) {
  const { regionTotal, regionTaken, continentTotal, continentTaken } = counts;

  const neighborDensity = regionTotal > 0 ? regionTaken / regionTotal : 0;
  const occupancy = continentTotal > 0 ? continentTaken / continentTotal : 0;
  const adjacentOwnedBorders = owned.filter(
    (p) =>
      p.zoneId === target.zoneId &&
      ((Math.abs(p.mapX - target.mapX) === 1 && p.mapY === target.mapY) ||
        (Math.abs(p.mapY - target.mapY) === 1 && p.mapX === target.mapX)),
  ).length;

  const publicInput = {
    fertility: target.fertility,
    koppen: target.zone.koppen,
    accessIndex: target.accessIndex,
    neighborDensity,
    occupancy,
  };
  const priced = askPrice({
    ...publicInput,
    adjacentOwnedBorders,
    ownershipRank: owned.length + 1,
  });

  return {
    parcelId: target.id,
    marketValue: marketValue(publicInput),
    total: priced.total,
    breakdown: priced.breakdown,
    adjacentOwnedBorders,
    ownershipRank: owned.length + 1,
    neighborDensity,
    occupancy,
  };
}

async function quoteParcel(target: QuoteTarget, owned: OwnedParcel[], _playerLevel: number) {
  return quoteFromCounts(
    target,
    owned,
    await loadQuoteCounts(target.zoneId, target.zone.continentCode),
  );
}

/**
 * Le coup de pouce des ruches sur une case, s'il y en a un.
 *
 * C'est le seul bonus du jeu qui dépende de **où** l'on a posé le bâtiment,
 * et c'est tout l'intérêt : il donne une raison de réfléchir à la disposition
 * de la ferme au lieu de poser les ouvrages n'importe où.
 *
 * Il ne porte que sur les cultures entomophiles — colza et pois. Une ruche
 * n'aide pas un blé, qui se pollinise au vent ; prétendre le contraire ferait
 * de la ruche un bonus universel, donc un achat évident.
 *
 * La distance se mesure de centre à centre en cases, en diagonale comprise :
 * un cercle, pas un carré, sinon les coins porteraient plus loin que les
 * côtés sans qu'on comprenne pourquoi.
 */
const POLLINATED: ReadonlySet<string> = new Set(["RAPE", "PEA"]);

function pollinationBonusAt(
  buildings: { type: string; originX: number; originY: number }[],
  x: number,
  y: number,
  crop: string | null | undefined,
): number {
  if (!crop || !POLLINATED.has(crop)) return 0;
  let best = 0;
  for (const b of buildings) {
    const def = BUILDING_DEFS[b.type as SharedBuildingType];
    const portee = def?.pollinationRange ?? 0;
    if (portee <= 0) continue;
    const cx = b.originX + def.w / 2;
    const cy = b.originY + def.h / 2;
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= portee) best = Math.max(best, def.pollinationBonus ?? 0);
  }
  return best;
}

/**
 * L'instantané dont vit l'arbre de compétences.
 *
 * Un seul aller-retour en base, et il ne lit que ce que les conditions ont le
 * droit de regarder. C'est le pendant serveur de `SkillSnapshot` : tout ce qui
 * n'est pas ici ne peut pas devenir une condition, et c'est exactement la
 * garantie qu'on veut — un compteur qu'on ne sait pas lire est un verrou que
 * le joueur ne peut pas ouvrir.
 */
async function getSkillSnapshot(userId: string): Promise<SkillSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      xp: true,
      level: true,
      statsJson: true,
      farm: {
        select: {
          machines: { select: { type: true, tier: true, hours: true } },
          herds: { select: { kind: true, size: true } },
          parcels: { select: { buildings: { select: { type: true, level: true } } } },
        },
      },
    },
  });
  if (!user) return emptySnapshot();
  const buildings = (user.farm?.parcels ?? []).flatMap((p) =>
    p.buildings.map((b) => ({ type: b.type as SharedBuildingType, level: b.level })),
  );
  return {
    stats: readStats(user.statsJson),
    level: levelForXp(user.xp),
    buildings,
    machines: (user.farm?.machines ?? []).map((m) => ({
      type: m.type as MachineType,
      tier: m.tier ?? 1,
      hours: m.hours ?? 0,
    })),
    herds: (user.farm?.herds ?? []).map((h) => ({
      species: (h.kind ?? "COW") as AnimalKind,
      size: h.size ?? 0,
    })),
  };
}

/**
 * Les bonus de compétences d'un joueur.
 *
 * Volontairement séparé de `getFarmBonuses`, qui ne connaît qu'une ferme : les
 * compétences dépendent aussi du **joueur** — de ce qu'il a fait, pas
 * seulement de ce qu'il possède. Les deux enveloppes se cumulent chez
 * l'appelant, chacune avec son propre plafond.
 */
async function getSkillBonuses(userId: string): Promise<SkillBonuses> {
  return bonusesFor(await getSkillSnapshot(userId));
}

async function getFarmBonuses(farmId: string) {
  const buildings = await prisma.building.findMany({
    where: { parcel: { farmId } },
  });
  /*
   * Les compétences voyagent avec les bonus de bâtiments.
   *
   * Elles ne s'y **mélangent** pas — chaque enveloppe garde son plafond — mais
   * elles empruntent le même chemin. Les cinq endroits qui simulent une case
   * lisent déjà `bonuses` ; leur faire chercher les compétences ailleurs, ce
   * serait cinq fils à tirer et un oubli garanti au sixième.
   */
  const proprietaire = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { userId: true },
  });
  const skills = proprietaire?.userId
    ? await getSkillBonuses(proprietaire.userId)
    : noSkillBonuses();
  let yieldBonus = 0;
  let storageGrain = 0;
  let storageHay = 5;
  /* Places sans hangar. Deux suffisaient quand un seul tracteur faisait tout ;
     depuis la séparation porteur / outil, le parc minimum d'une ferme qui
     tourne en compte trois — tracteur, semoir, charrue — et la ferme neuve
     dépassait donc son plafond dès l'inscription. Cinq laissent la place
     d'ajouter un déchaumeur et un outil de son choix avant que le hangar
     matériel devienne le prochain achat. */
  let machineSlots = 5;
  let cattleSlots = 0;
  let pigSlots = 0;
  let repairDiscount = 0;
  let xpBonus = 0;
  let softDryer = false;
  let spoilageSlow = 0;
  /** Petits ouvrages : ils ne stockent rien, ils allègent ou accélèrent. */
  let careDiscount = 0;
  let freeDrying = false;
  /** Part du séchage payée par le courant produit sur la ferme. */
  let dryingDiscount = 0;
  for (const b of buildings) {
    if (!BUILDING_DEFS[b.type as SharedBuildingType]) continue;
    const stats = buildingStatsAtLevel(b.type as SharedBuildingType, b.level);
    yieldBonus += stats.yieldBonus ?? 0;
    storageGrain += stats.storageGrain ?? 0;
    storageHay += stats.storageHay ?? 0;
    machineSlots += stats.machineSlots ?? 0;
    cattleSlots += stats.cattleSlots ?? 0;
    pigSlots += stats.pigSlots ?? 0;
    repairDiscount += stats.repairDiscount ?? 0;
    xpBonus += stats.xpBonus ?? 0;
    spoilageSlow += stats.spoilageSlow ?? 0;
    if (stats.softDryer) softDryer = true;
    careDiscount += BUILDING_DEFS[b.type as SharedBuildingType].careDiscount ?? 0;
    dryingDiscount += BUILDING_DEFS[b.type as SharedBuildingType].dryingDiscount ?? 0;
    if (BUILDING_DEFS[b.type as SharedBuildingType].freeDrying) freeDrying = true;
  }
  return {
    /** Les compétences du propriétaire, chacune déjà bornée. */
    skills,
    yieldBonus: Math.min(0.1, yieldBonus),
    storageGrain: storageGrain + skills.STORAGE_GRAIN,
    storageHay,
    machineSlots,
    cattleSlots,
    pigSlots,
    repairDiscount: Math.min(0.3, repairDiscount),
    xpBonus: Math.min(0.1, xpBonus),
    // Plusieurs chambres aident, mais on ne conserve jamais indéfiniment.
    // Les compétences s'ajoutent après le plafond des bâtiments : chacune des
    // deux enveloppes garde la sienne, et ni l'une ni l'autre n'écrase l'autre.
    spoilageSlow: Math.min(
      SPOILAGE_SLOW_CAP + SKILL_EFFECT_CAPS.SPOILAGE_SLOW,
      Math.min(SPOILAGE_SLOW_CAP, spoilageSlow) + skills.SPOILAGE_SLOW,
    ),
    softDryer,
    // Deux champs de panneaux aident, mais l'entretien n'est jamais gratuit :
    // sans plafond, six ouvrages payaient les révisions à la place du joueur.
    careDiscount: Math.min(0.45, careDiscount),
    // Deux champs de panneaux ne font pas sécher deux fois moins cher : le
    // séchoir ne consomme qu'une fois. L'éolienne, elle, va jusqu'à zéro.
    dryingDiscount: Math.min(0.75, dryingDiscount),
    freeDrying,
    /**
     * Les ruches, avec leur position.
     *
     * Elles voyagent avec les bonus parce qu'elles en sont un — simplement un
     * bonus qui dépend de l'endroit. Les remonter ici évite d'ajouter les
     * bâtiments à quatre requêtes Prisma différentes pour une seule question.
     */
    hives: buildings
      .filter((b) => (BUILDING_DEFS[b.type as SharedBuildingType]?.pollinationRange ?? 0) > 0)
      .map((b) => ({ type: b.type, originX: b.originX, originY: b.originY })),
  };
}

/* ------------------------------------------------------------------ */
/* Progression                                                          */
/* ------------------------------------------------------------------ */

/** Ce qu'une action rapporte, une fois le compte fait. */
export type XpGain = {
  xp: number;
  level: number;
  /** Niveau franchi à l'instant, pour l'annoncer */
  levelUp: number | null;
};

/** Refus de débit : le solde ne couvre plus la dépense au moment de payer. */
class InsufficientFunds extends Error {
  constructor(readonly needed: number) {
    super(`€ insuffisants — il en faut ${Math.ceil(needed)}`);
    this.name = "InsufficientFunds";
  }
}

/**
 * Débite un joueur, **à la condition** qu'il ait de quoi payer.
 *
 * Les routes lisaient le solde, le comparaient au prix, puis débitaient sans
 * condition. Entre la lecture et l'écriture, rien n'empêchait une autre
 * requête de faire la même chose : huit constructions lancées ensemble avec
 * 1 500 € en poche en payaient quatre à 1 200, et laissaient le compte à
 * **−3 300 €**. Un double-clic un peu nerveux suffisait.
 *
 * La condition vit maintenant dans la clause `where` de l'écriture : la base
 * ne décrémente que si le solde couvre encore la dépense, et l'on relit le
 * nombre de lignes touchées pour savoir si le paiement a eu lieu. Zéro ligne
 * = plus assez d'argent = on lève, ce qui annule la transaction entière et
 * donc tout ce que la route avait déjà écrit.
 *
 * À n'appeler qu'à l'intérieur d'un `$transaction`, sans quoi l'annulation
 * ne couvre pas le reste de la route.
 */
/**
 * Écrit un mouvement au journal.
 *
 * Appelée dans la même transaction que le mouvement de solde : le journal ne
 * peut donc pas diverger du compte. Le montant est signé — négatif en sortie —
 * pour qu'une somme donne directement le résultat de l'atelier.
 *
 * Les comptes nominatifs (argent illimité) n'écrivent rien : leur solde ne
 * bouge pas, un journal en dirait le contraire.
 */
/**
 * De quel atelier vient cette marchandise.
 *
 * Le joueur ne se demande pas « combien m'a rapporté le code MILK », il se
 * demande si son élevage paie sa nourriture. Le poste suit donc l'atelier
 * d'origine, pas la marchandise.
 */
function posteDeVente(commodity: string): LedgerPoste {
  return ["MILK", "EGGS", "WOOL", "MEAT", "MANURE"].includes(commodity)
    ? "ELEVAGE"
    : "CULTURES";
}

async function ecrireJournal(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  poste: LedgerPoste,
  label: string,
): Promise<void> {
  if (!Number.isFinite(amount) || amount === 0) return;
  const owner = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (owner && estArgentIllimite(owner.email)) return;
  await tx.ledgerEntry.create({
    data: { userId, amount: Math.round(amount * 100) / 100, poste, label },
  });
}

/**
 * Crédite un joueur, et l'inscrit au journal.
 *
 * Les crédits étaient dix-sept `crd: { increment }` disséminés dans le
 * fichier. Passer par un point unique est ce qui rend le journal exhaustif
 * sans avoir à s'en souvenir à chaque fois.
 */
async function crediter(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  poste: LedgerPoste,
  label: string,
): Promise<void> {
  if (!Number.isFinite(amount)) throw new Error("Montant invalide");
  if (!(amount > 0)) return;
  await tx.user.update({ where: { id: userId }, data: { crd: { increment: amount } } });
  await ecrireJournal(tx, userId, amount, poste, label);
}

async function debit(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  poste?: LedgerPoste,
  label?: string,
): Promise<void> {
  // Un montant non fini vient d'un calcul qui a débordé (un `tons` à 1e308
  // suffit) : il ne doit pas se présenter au guichet, et surtout pas produire
  // un refus qui annonce « Infinity requis ».
  if (!Number.isFinite(amount)) throw new Error("Montant invalide");
  if (!(amount > 0)) return;
  const owner = await tx.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  // Compte nominatif : on n'écrit pas le débit. Le solde réel ne descend pas,
  // et l'écran affiche ∞ plutôt qu'un chiffre qui fondrait à chaque achat.
  if (owner && estArgentIllimite(owner.email)) return;
  const hit = await tx.user.updateMany({
    where: { id: userId, crd: { gte: amount } },
    data: { crd: { decrement: amount } },
  });
  if (hit.count === 0) throw new InsufficientFunds(amount);
  if (poste && label) await ecrireJournal(tx, userId, -amount, poste, label);
}

/**
 * Crédite le travail accompli.
 *
 * C'est le seul endroit qui écrit l'expérience. Avant, elle ne tombait qu'en
 * trois points — mission `+15`, contrat `+15`, vente `+10` quel que soit le
 * tonnage — et le **niveau ne se recalculait nulle part** : seul le triche-code
 * du panneau de développement y touchait. Un joueur légitime restait donc Nv.1
 * à vie devant des paliers de parcelle qui en demandaient six.
 *
 * Le helper fait trois choses indissociables : ajouter les points, en déduire
 * le niveau, et incrémenter les compteurs cumulés dont vivent les quêtes — le
 * même geste, comptabilisé une seule fois.
 */
async function grantXp(
  tx: Prisma.TransactionClient,
  userId: string,
  event: XpEvent,
  ctx: XpContext = {},
  stats: PlayerStats = {},
): Promise<XpGain> {
  const before = await tx.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true, statsJson: true },
  });
  if (!before) return { xp: 0, level: 1, levelUp: null };
  const gain = xpFor(event, ctx);
  const total = before.xp + gain;
  const level = levelForXp(total);
  await tx.user.update({
    where: { id: userId },
    data: {
      xp: total,
      level,
      statsJson: JSON.stringify(addStats(readStats(before.statsJson), stats)),
    },
  });
  return { xp: gain, level, levelUp: level > before.level ? level : null };
}

/**
 * Retire les zones héritées d'une version antérieure du monde (Beauce, Iowa…).
 * Sans ça, une base déjà amorçée garde éternellement l'ancien monde : le test
 * `zone.count() === 0` n'est jamais vrai et le nouveau monde n'arrive jamais.
 * Les zones où un joueur possède déjà une terre sont conservées.
 */
async function retireLegacyZones() {
  const zones = await prisma.zone.findMany({
    include: { parcels: { select: { farmId: true } } },
  });
  for (const zone of zones) {
    if (REGION_BY_CODE[zone.code]) continue;
    if (zone.parcels.some((p) => p.farmId)) {
      console.warn(`Zone héritée ${zone.code} conservée : des joueurs y sont installés`);
      continue;
    }
    await prisma.parcel.deleteMany({ where: { zoneId: zone.id } });
    await prisma.weatherSnapshot.deleteMany({ where: { zoneCode: zone.code } });
    await prisma.zone.delete({ where: { id: zone.id } });
    console.log(`Zone héritée ${zone.code} retirée`);
  }
}

const MISSION_JOBS: {
  jobType: ContractJobType;
  work: "PLANT" | "FERTILIZE" | "HARVEST" | "PLOW";
  regionNote: string;
  title: (cells: number) => string;
}[] = [
  { jobType: "HARVEST", work: "HARVEST", regionNote: "Beauce", title: (n) => `Récolter du blé · ${n} cases` },
  { jobType: "PLOW", work: "PLOW", regionNote: "Iowa", title: (n) => `Labourer · ${n} cases` },
  { jobType: "SOW", work: "PLANT", regionNote: "Beauce", title: (n) => `Semer du maïs · ${n} cases` },
  { jobType: "FERTILIZE", work: "FERTILIZE", regionNote: "Iowa", title: (n) => `Mettre de l’engrais · ${n} cases` },
  { jobType: "TRANSPORT", work: "PLOW", regionNote: "Beauce", title: (n) => `Labourer · ${n} cases` },
];

function pickMissionCells(): number {
  return MISSION_CELL_CHOICES[Math.floor(Math.random() * MISSION_CELL_CHOICES.length)]!;
}

function makeMissionRow(job = MISSION_JOBS[Math.floor(Math.random() * MISSION_JOBS.length)]!) {
  const cells = pickMissionCells();
  return {
    jobType: job.jobType,
    title: job.title(cells),
    rewardCrd: missionPayout(job.work, cells, "NPC"),
    regionNote: job.regionNote,
    cells,
  };
}

async function topUpOpenMissions() {
  // Les contrats fantômes ne sont plus créés : la bourse pointe des parcelles réelles.
}

const NPC_FARM_NAMES = [
  "Ferme Martin",
  "Élevage Lefèvre",
  "GAEC des Haies",
  "Les Blés d’Or",
  "Ferme du Tilleul",
  "Élevage Moreau",
  "La Prairie",
  "Céréales Lambert",
  "Ferme des Saules",
  "Troupeau Roux",
];

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function placeNpcBuilding(
  parcelId: string,
  type: BuildingType,
  originX: number,
  originY: number,
) {
  const def = BUILDING_DEFS[type as SharedBuildingType];
  const b = await prisma.building.create({
    data: { parcelId, type, originX, originY },
  });
  for (const c of footprintCells(originX, originY, def.w, def.h)) {
    await prisma.parcelCell.update({
      where: { parcelId_x_y: { parcelId, x: c.x, y: c.y } },
      // La culture qui s'y trouvait s'efface : une case bâtie ne porte plus de
      // blé, et laisser la trace en base ferait mentir tout ce qui la relit.
      data: { kind: "BUILDING", buildingId: b.id, crop: null, fieldStage: "EMPTY" },
    });
  }
  return b;
}

/**
 * Pose le corps de ferme d'un voisin le long d'un bord de sa parcelle.
 *
 * Le long d'un bord, et non au milieu : c'est ainsi qu'on bâtit, pour ne pas
 * couper le champ en deux. On balaie les origines possibles et l'on garde la
 * première qui tient sur des cases libres — l'ordre venant de la parcelle,
 * deux voisins n'ont pas leur cour au même endroit.
 */
async function poserCorpsDeFerme(parcel: {
  id: string;
  gridW: number;
  gridH: number;
}): Promise<{ type: SharedBuildingType; id: string }[]> {
  const h = hash32(parcel.id);
  const corps = corpsDeFerme(parcel.id);
  // Le bord retenu : haut, bas, gauche ou droite. La ferme se lit alors comme
  // une cour rangée, et non comme des ouvrages semés dans le champ.
  const bord = (h >> 3) % 4;
  /*
   * Seuls les ouvrages et les engins bloquent une place, pas les cultures.
   *
   * Mesuré : la première version évitait toute case non vide, or les champs
   * des voisins sont emblavés d'un bord à l'autre — quatre-vingt-seize
   * parcelles n'ont donc reçu aucun bâtiment, et la passe les reprenait à
   * chaque démarrage sans jamais aboutir. Un corps de ferme est là avant le
   * blé : la culture lui cède la place.
   */
  const prises = new Set<string>();
  const occupe = await prisma.parcelCell.findMany({
    where: { parcelId: parcel.id, kind: { in: ["BUILDING", "VEHICLE"] } },
    select: { x: true, y: true },
  });
  for (const c of occupe) prises.add(`${c.x},${c.y}`);

  const poses: { type: SharedBuildingType; id: string }[] = [];
  for (const type of corps) {
    const def = BUILDING_DEFS[type];
    let place: { x: number; y: number } | null = null;
    // On longe le bord choisi, en partant d'un décalage propre à la parcelle.
    const longueur = bord < 2 ? parcel.gridW : parcel.gridH;
    const depart = h % Math.max(1, longueur);
    for (let k = 0; k < longueur && !place; k++) {
      const i = (depart + k) % longueur;
      const x = bord === 0 || bord === 1 ? i : bord === 2 ? 0 : parcel.gridW - def.w;
      const y = bord === 0 ? 0 : bord === 1 ? parcel.gridH - def.h : i;
      if (x < 0 || y < 0 || x + def.w > parcel.gridW || y + def.h > parcel.gridH) continue;
      const cases = footprintCells(x, y, def.w, def.h);
      if (cases.some((c) => prises.has(`${c.x},${c.y}`))) continue;
      place = { x, y };
      for (const c of cases) prises.add(`${c.x},${c.y}`);
    }
    if (!place) continue;
    const b = await placeNpcBuilding(parcel.id, type, place.x, place.y);
    poses.push({ type, id: b.id });
  }
  return poses;
}

/**
 * Sème le champ d'un voisin sur tout ce qui reste libre.
 *
 * Dix-huit cases sur cent quarante-quatre — ce que faisait l'ancien semeur —
 * laissent une parcelle vide à neuf dixièmes. Un exploitant emblave son champ.
 * La culture et son avance viennent de la parcelle : la commune doit montrer
 * des blés mûrs à côté de maïs qui lèvent, pas un damier synchronisé.
 */
async function semerChampNpc(
  parcel: { id: string; gridW: number; gridH: number },
  /**
   * Semis de reprise, après moisson.
   *
   * Le premier semis échelonne les avances pour que la commune ne mûrisse pas
   * d'un bloc. Une reprise, elle, part de zéro : un champ qu'on vient de
   * moissonner et de ressemer n'est pas mûr le lendemain.
   */
  reprise = false,
) {
  const { crop, avance, stade } = cultureNpc(parcel.id);
  const growMs = CROP_DEFS[crop].growMs;
  const pousse = reprise ? 0.02 + (grainerVoisin(parcel.id) % 12) / 100 : avance;
  const plantedAt = new Date(Date.now() - growMs * pousse);
  const readyAt = new Date(plantedAt.getTime() + growMs);
  await prisma.parcelCell.updateMany({
    where: { parcelId: parcel.id, kind: "EMPTY" },
    data: {
      kind: "CROP",
      crop,
      fieldStage: (reprise ? "PLANTED" : stade) as FieldStage,
      plantedAt,
      readyAt,
    },
  });
}

/**
 * Garnit les fermes PNJ qui manquent de quelque chose.
 *
 * Séparé de la création : le monde déjà installé compte des centaines de
 * fermes pauvres, et il n'y a aucune raison de les laisser telles quelles en
 * attendant une remise à zéro. Chaque passe ne travaille que sur ce qui
 * manque, si bien qu'au démarrage suivant les requêtes ne rendent plus rien et
 * ne coûtent plus rien.
 */
/**
 * Combien de tics entre deux tours de ressemis.
 *
 * Un voisin qui vient de moissonner laisse un chaume : c'est juste, et ça se
 * regarde. Mais s'il ne resème jamais, la commune se vide champ par champ, et
 * après quelques jours de serveur il ne reste qu'un damier nu — précisément ce
 * qu'on vient de corriger. Cinq minutes d'intervalle : assez pour qu'une
 * jachère se voie, assez peu pour qu'on ne joue jamais devant un désert.
 */
const TICS_ENTRE_RESSEMIS = 15;
let ticsDepuisRessemis = 0;

/**
 * Remet en culture les champs de voisins qui viennent d'être moissonnés.
 *
 * La garniture du démarrage ne suffisait pas : les consignes font moissonner
 * les PNJ au fil des tics, et leurs parcelles retombaient à vide jusqu'au
 * prochain redémarrage du serveur. Mesuré après quelques minutes de tic :
 * douze parcelles déjà nues.
 */
async function ressemerVoisinage() {
  if (++ticsDepuisRessemis < TICS_ENTRE_RESSEMIS) return;
  ticsDepuisRessemis = 0;
  const nus = await prisma.parcel.findMany({
    where: { farm: { user: { isNpc: true } }, cells: { none: { kind: "CROP" } } },
    select: { id: true, gridW: true, gridH: true },
  });
  for (const parcel of nus) await semerChampNpc(parcel, true);
}

async function garnirFermesNpc() {
  const sansBatiment = await prisma.parcel.findMany({
    where: { farm: { user: { isNpc: true } }, buildings: { none: {} } },
    select: { id: true, gridW: true, gridH: true, farmId: true },
  });
  for (const parcel of sansBatiment) {
    const poses = await poserCorpsDeFerme(parcel);
    /*
     * Un bâtiment d'élevage sans bête est un décor. On peuple donc celui qui
     * vient d'être posé — et un seul : c'est le troupeau qui coûte au tic du
     * monde, pas le bâtiment.
     */
    for (const b of poses) {
      const profil = CHEPTEL_DE[b.type];
      if (!profil || !parcel.farmId) continue;
      const deja = await prisma.herd.findFirst({ where: { buildingId: b.id } });
      if (deja) continue;
      await prisma.herd.create({
        data: {
          farmId: parcel.farmId,
          buildingId: b.id,
          kind: profil.kind,
          size: profil.size,
          happiness: 0.72,
          // Mangeoire pleine : un troupeau affamé entre dans les balayages du
          // tic, et deux cents voisins affamés le paieraient cher.
          feedStock: 900,
          feedQuality: 0.35,
          lastFedAt: new Date(),
        },
      });
      break;
    }
  }

  const sansCulture = await prisma.parcel.findMany({
    where: { farm: { user: { isNpc: true } }, cells: { none: { kind: "CROP" } } },
    select: { id: true, gridW: true, gridH: true },
  });
  for (const parcel of sansCulture) await semerChampNpc(parcel);

  if (sansBatiment.length || sansCulture.length) {
    console.log(
      `Voisinage garni : ${sansBatiment.length} corps de ferme, ${sansCulture.length} champs semés`,
    );
  }
}

async function seedNpcFarms() {
  const zones = await prisma.zone.findMany({
    include: {
      parcels: {
        include: { farm: { include: { user: true } } },
        orderBy: [{ mapY: "asc" }, { mapX: "asc" }],
      },
    },
  });
  for (const zone of zones) {
    const target = Math.floor(zone.parcels.length * NPC_PARCEL_SHARE);
    const npcCount = zone.parcels.filter((p) => p.farm?.user.isNpc).length;
    const free = zone.parcels.filter((p) => !p.farmId);
    const need = Math.max(0, target - npcCount);
    if (!need || !free.length) continue;
    const pick = [...free].sort((a, b) => hash32(a.id) - hash32(b.id)).slice(0, need);
    for (const parcel of pick) {
      const h = hash32(parcel.id);
      const livestock = h % 5 === 0;
      const name = NPC_FARM_NAMES[h % NPC_FARM_NAMES.length]!;
      const email = `npc.${parcel.id}@farmsim.npc`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) continue;
      const spec = livestock ? "ELEVEUR" : "CEREALIER";
      const user = await prisma.user.create({
        data: {
          email,
          displayName: name,
          specialization: spec,
          accessCode: `npc-${parcel.id.slice(-8)}`,
          crd: 48_000,
          isNpc: true,
          lastSeenAt: new Date(0),
          consignesJson: JSON.stringify({
            ...DEFAULT_CONSIGNES,
            plow: false,
            maxSpend: 2000,
          }),
        },
      });
      const farm = await prisma.farm.create({
        data: { userId: user.id, name },
      });
      await prisma.parcel.update({ where: { id: parcel.id }, data: { farmId: farm.id } });
      await prisma.machine.create({
        data: { farmId: farm.id, type: "TRACTOR", parkedParcelId: parcel.id },
      });
      // Le foin sert au troupeau que la garniture posera, s'il y en a un.
      if (livestock) {
        await prisma.inventoryItem.create({
          data: { farmId: farm.id, itemCode: "HAY", qty: 8, quality: 3, moisture: 0 },
        });
      }
      /*
       * Le contenu de la ferme — bâtiments, cultures, cheptel — est posé par
       * `garnirFermesNpc`, en une passe qui rattrape aussi les fermes déjà en
       * base. Le faire ici seulement laissait des centaines d'exploitations
       * pauvres dans tout monde installé avant ce changement.
       */
    }
  }
  await garnirFermesNpc();
}

async function publishFromConsignes() {
  const cutoff = new Date(Date.now() - CONSIGNE_AWAY_MS);
  const users = await prisma.user.findMany({
    where: {
      farm: { isNot: null },
      OR: [{ isNpc: true }, { lastSeenAt: { lt: cutoff } }, { lastSeenAt: null }],
    },
    include: {
      farm: { include: { parcels: { include: { cells: true, zone: true } } } },
    },
  });
  const now = Date.now();
  for (const user of users) {
    if (!user.farm) continue;
    const consignes = parseConsignes(user.consignesJson);
    const log = parseAbsenceLog(user.absenceLogJson);
    const openCount = await prisma.laborOrder.count({
      where: { clientId: user.id, status: { in: ["OPEN", "ACCEPTED"] } },
    });
    let slots = LABOR_OPEN_MAX_PER_CLIENT - openCount;
    let budget = Math.max(0, consignes.maxSpend - log.spent);
    if (slots <= 0 || budget <= 0) continue;

    for (const parcel of user.farm.parcels) {
      if (slots <= 0 || budget <= 0) break;
      const busy = await occupiedLaborCells(parcel.id);
      const bonuses = await getFarmBonuses(parcel.farmId!);
      type Job = { work: FarmWork; cells: CellXY[] };
      const jobs: Job[] = [];

      if (consignes.harvest) {
        const ready: CellXY[] = [];
        const silage: CellXY[] = [];
        for (const cell of parcel.cells) {
          if (busy.has(`${cell.x},${cell.y}`)) continue;
          if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) continue;
          const sim = simulateCell({
            ...climatDe(parcel),
            crop: cell.crop,
            plantedAt: cell.plantedAt.getTime(),
            now,
            fertility: parcel.fertility,
            weedPressure: pressionAdventices(cell, currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now())),
            fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
            residuePasses: cell.residuePasses,
            directSeeded: cell.directSeeded,
            rotation: rotationOf(cell),
            specialization: playableSpec(user.specialization),
            buildingYieldBonus:
              bonuses.yieldBonus +
              pollinationBonusAt(bonuses.hives, cell.x, cell.y, cell.crop),
            skillYieldBonus: bonuses.skills.CROP_YIELD,
          });
          if (sim.lost) continue;
          if (sim.ready) ready.push({ x: cell.x, y: cell.y });
          else if (canSilageHarvest({ crop: cell.crop, progress: sim.progress })) {
            silage.push({ x: cell.x, y: cell.y });
          }
        }
        for (const batch of chunkCells(ready, seedOf(parcel.id))) jobs.push({ work: "HARVEST", cells: batch });
        for (const batch of chunkCells(silage, seedOf(parcel.id))) jobs.push({ work: "SILAGE", cells: batch });
      }
      if (consignes.straw) {
        const windrow = parcel.cells
          .filter((c) => c.strawTons > 0 && c.baleCount <= 0 && !busy.has(`${c.x},${c.y}`))
          .map((c) => ({ x: c.x, y: c.y }));
        const bales = parcel.cells
          .filter((c) => c.baleCount > 0 && !busy.has(`${c.x},${c.y}`))
          .map((c) => ({ x: c.x, y: c.y }));
        for (const batch of chunkCells(windrow, seedOf(parcel.id))) jobs.push({ work: "BALE", cells: batch });
        for (const batch of chunkCells(bales, seedOf(parcel.id))) jobs.push({ work: "COLLECT", cells: batch });
      }
      if (consignes.stubble) {
        const stub = parcel.cells
          .filter(
            (c) =>
              c.hasStubble &&
              c.strawTons <= 0 &&
              c.baleCount <= 0 &&
              !busy.has(`${c.x},${c.y}`),
          )
          .map((c) => ({ x: c.x, y: c.y }));
        for (const batch of chunkCells(stub, seedOf(parcel.id))) jobs.push({ work: "STUBBLE", cells: batch });
      }
      if (consignes.plow) {
        const plow = parcel.cells
          .filter(
            (c) =>
              (c.fieldStage === "SPOILED" || c.harvestsSincePlow >= MAX_HARVESTS_BEFORE_PLOW) &&
              c.kind !== "BUILDING" &&
              c.kind !== "VEHICLE" &&
              !busy.has(`${c.x},${c.y}`),
          )
          .map((c) => ({ x: c.x, y: c.y }));
        for (const batch of chunkCells(plow, seedOf(parcel.id))) jobs.push({ work: "PLOW", cells: batch });
      }

      for (const job of jobs) {
        if (slots <= 0 || budget <= 0) break;
        const money = laborEscrow(job.work, job.cells.length, null, user.isNpc);
        if (money.escrow > budget || money.escrow > user.crd) continue;
        const created = await createLaborOrderForCells({
          parcelId: parcel.id,
          userId: user.id,
          work: job.work,
          cells: job.cells,
          npcClient: user.isNpc,
        });
        if (!created.ok) continue;
        slots -= 1;
        budget -= created.escrow;
        await appendAbsenceLog(
          user.id,
          `${WORK_LABELS[job.work]} publié · ${job.cells.length} cases · ${created.escrow} €`,
          created.escrow,
        );
        const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { crd: true } });
        if (fresh) user.crd = fresh.crd;
        for (const c of job.cells) busy.add(`${c.x},${c.y}`);
      }
    }
  }
}

async function tickNpcFarms() {
  const npcs = await prisma.user.findMany({
    where: { isNpc: true, specialization: "CEREALIER" },
    include: { farm: { include: { parcels: { include: { cells: true, zone: true } } } } },
  });
  const now = Date.now();
  const growMs = CROP_DEFS.WHEAT.growMs;
  for (const npc of npcs) {
    if (!npc.farm) continue;
    for (const parcel of npc.farm.parcels) {
      const busy = await occupiedLaborCells(parcel.id);
      const empty = parcel.cells.filter(
        (c) =>
          c.kind === "EMPTY" &&
          !c.hasStubble &&
          c.strawTons <= 0 &&
          c.baleCount <= 0 &&
          c.fieldStage !== "SPOILED" &&
          !busy.has(`${c.x},${c.y}`),
      );
      // Les PNJ suivent le même calendrier que les joueurs : sans cela ils
      // sèmeraient du blé toute l'année et l'offre du marché ne connaîtrait
      // plus les saisons.
      const climat = climatDe(parcel);
      if (!canSowInSeason("WHEAT", currentSeason(climat.hemisphere ?? "N", now)).ok) continue;
      const pretLe = projectReadyAt({ crop: "WHEAT", plantedAt: now, growMs, ...climat });
      const toPlant = empty.slice(0, 18);
      for (const cell of toPlant) {
        await prisma.parcelCell.update({
          where: { id: cell.id },
          data: {
            kind: "CROP",
            crop: "WHEAT",
            fieldStage: "PLANTED",
            plantedAt: new Date(now),
            readyAt: new Date(pretLe),
            fertilizedPasses: 0,
            weedPressure: 0,
            directSeeded: false,
          },
        });
      }
    }
  }
}

async function ensureSeed() {
  await prisma.user.updateMany({
    where: { specialization: "ETA" },
    data: { specialization: "CEREALIER" },
  });
  await retireLegacyZones();

  // Amorçage par région, et non « tout ou rien » : une région ajoutée dans une
  // version ultérieure apparaît sans avoir à réinitialiser la base.
  for (const continent of WORLD) {
    for (const region of continent.regions) {
      if (await prisma.zone.findUnique({ where: { code: region.code } })) continue;
      {
        const zone = await prisma.zone.create({
          data: {
            code: region.code,
            name: region.name,
            country: continent.code,
            koppen: region.koppen,
            riskNote: region.riskNote,
            mapW: region.mapW,
            mapH: region.mapH,
            continentCode: continent.code,
            continentName: continent.name,
            city: region.city,
            climateLabel: region.climateLabel,
            hemisphere: continent.hemisphere,
            lat: region.lat,
            lon: region.lon,
            priceMult: region.priceMult,
            baseFertility: region.fertility,
          },
        });
        let n = 0;
        for (let my = 0; my < region.mapH; my++) {
          for (let mx = 0; mx < region.mapW; mx++) {
            // Variation locale de fertilité : le centre de la région est
            // toujours un peu meilleur que ses marges.
            const dx = (mx - (region.mapW - 1) / 2) / Math.max(1, region.mapW);
            const dy = (my - (region.mapH - 1) / 2) / Math.max(1, region.mapH);
            const edge = Math.sqrt(dx * dx + dy * dy);
            const fertility = Math.max(
              0.25,
              Math.min(0.97, region.fertility * (1.08 - edge * 0.35)),
            );
            // La distance au hub de marché fait le gros de l'indice d'accès :
            // le centre de la région vaut plus cher que ses confins.
            const hubDistance = Math.max(
              Math.abs(mx - Math.floor((region.mapW - 1) / 2)),
              Math.abs(my - Math.floor((region.mapH - 1) / 2)),
            );
            const access = accessIndex({ hubDistance, road: 0.6, silo: 0.3, rail: 0.1 });
            const parcel = await prisma.parcel.create({
              data: {
                zoneId: zone.id,
                label: parcelName(continent.code, n++),
                mapX: mx,
                mapY: my,
                gridW: DEFAULT_GRID.w,
                gridH: DEFAULT_GRID.h,
                fertility,
                accessIndex: access,
                landPrice: marketValue({
                  fertility,
                  koppen: region.koppen,
                  cropFitA: region.crops.length >= 2,
                  accessIndex: access,
                  neighborDensity: 0,
                  occupancy: 0,
                }),
              },
            });
            await createParcelGrid(parcel.id, DEFAULT_GRID.w, DEFAULT_GRID.h);
          }
        }
      }
    }
  }

  for (const code of Object.keys(MARKET_BOUNDS) as TradeGood[]) {
    const existing = await prisma.marketPrice.findUnique({ where: { commodity: code } });
    if (!existing) {
      await prisma.marketPrice.create({
        data: {
          commodity: code,
          price: MARKET_BOUNDS[code].initial,
          /*
           * Le carnet part à son point neutre, pas à un chiffre rond.
           *
           * Deux mille tonnes pour tout le monde, c'était plus de quarante
           * fois la profondeur du lait et seize fois celle du blé : dès le
           * premier tour de simulation, le terme de carnet écrasait le prix
           * contre sa borne basse. Un monde neuf ouvrait donc avec toutes ses
           * marchandises au plus bas, ce qui n'est le reflet d'aucune offre.
           *
           * `depth * MARKET_DEPTH_FLOOR` est exactement le stock pour lequel
           * le carnet est à l'équilibre — voir `stepMarket`.
           */
          stockTons: Math.round(MARKET_BOUNDS[code].depth * MARKET_DEPTH_FLOOR * 100) / 100,
        },
      });
      continue;
    }

    /*
     * Un cours sorti de ses bornes est ramené dedans — et lui seul.
     *
     * Le semis ne créait que ce qui manquait : un monde déjà ouvert gardait
     * ses prix pour toujours. Quand le colza, l'ensilage, la viande et le
     * fumier sont passés à leur vrai cours en euros, la partie en cours a
     * continué de coter les anciens : l'ensilage à 110 € la tonne quand son
     * plafond venait de tomber à 70.
     *
     * On ne réécrit pas les prix à chaque démarrage pour autant : un cours qui
     * a bougé de lui-même, c'est le marché qui travaille, et l'effacer serait
     * pire que le laisser. Seul ce qui est hors des bornes est recalé — ce que
     * les bornes veulent dire, précisément.
     */
    const bornes = MARKET_BOUNDS[code];
    if (existing.price < bornes.min || existing.price > bornes.max) {
      const recale = Math.min(bornes.max, Math.max(bornes.min, bornes.initial));
      await prisma.marketPrice.update({
        where: { commodity: code },
        data: { price: recale },
      });
      console.log(
        `Cours ${code} recalé : ${existing.price} € était hors des bornes ` +
          `[${bornes.min} ; ${bornes.max}] — remis à ${recale} €.`,
      );
    }
  }

  const leftover = await prisma.npcContract.findMany({
    where: { status: "OPEN" },
  });
  if (leftover.length) {
    await prisma.npcContract.updateMany({
      where: { id: { in: leftover.map((c) => c.id) } },
      data: { status: "CANCELLED" },
    });
  }
  // Semer cent cinquante fermes PNJ prend deux bonnes minutes sur une machine
  // d'intégration à deux cœurs — assez pour que la suite de tests expire avant
  // que le serveur ne réponde, et qu'un déploiement parfaitement sain soit
  // refusé. Les tests d'API n'ont besoin d'aucun PNJ : ils peuvent s'en
  // passer. Le drapeau n'existe que pour eux, et n'est jamais posé en
  // production.
  if (process.env.FARMSIM_SKIP_NPC !== "1") await seedNpcFarms();

  const zonesForWeather = await prisma.zone.findMany({ select: { code: true } });
  for (const z of zonesForWeather) {
    const existing = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: z.code } });
    if (!existing) {
      await prisma.weatherSnapshot.create({ data: { zoneCode: z.code, state: "CLEAR" } });
    }
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "farmsim-api" }));
app.get("/meta/specializations", (_req, res) => res.json(SPECIALIZATION_LABELS));
app.get("/meta/buildings", (_req, res) => res.json(BUILDING_DEFS));
app.get("/meta/machines", (_req, res) => res.json(MACHINE_DEFS));

app.get("/zones", async (_req, res) => {
  const zones = await prisma.zone.findMany({
    include: {
      parcels: {
        select: {
          id: true,
          label: true,
          mapX: true,
          mapY: true,
          landPrice: true,
          farmId: true,
          gridW: true,
          gridH: true,
          farm: { select: { user: { select: { isNpc: true } } } },
        },
      },
    },
  });
  res.json(
    zones.map((z) => ({
      ...z,
      parcels: z.parcels.map((p) => ({
        id: p.id,
        label: p.label,
        mapX: p.mapX,
        mapY: p.mapY,
        landPrice: p.landPrice,
        farmId: p.farmId,
        gridW: p.gridW,
        gridH: p.gridH,
        npc: Boolean(p.farm?.user.isNpc),
      })),
    })),
  );
});

app.get("/meta/classes", (_req, res) => res.json(CLASS_PROFILES));

/**
 * Vue globe : un continent par entrée, avec l'occupation réelle des terres.
 * Sert à peindre la carte du monde avant même que le joueur ait un compte.
 */
app.get("/world", async (_req, res) => {
  const zones = await prisma.zone.findMany({
    include: { parcels: { select: { farmId: true } } },
  });
  const byContinent = new Map<string, { total: number; taken: number; regions: number }>();
  for (const z of zones) {
    const entry = byContinent.get(z.continentCode) ?? { total: 0, taken: 0, regions: 0 };
    entry.total += z.parcels.length;
    entry.taken += z.parcels.filter((p) => p.farmId).length;
    entry.regions += 1;
    byContinent.set(z.continentCode, entry);
  }
  const now = Date.now();
  res.json({
    seasonProgress: seasonProgress(now),
    continents: WORLD.map((c) => {
      const stats = byContinent.get(c.code) ?? { total: 0, taken: 0, regions: 0 };
      return {
        code: c.code,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        hemisphere: c.hemisphere,
        difficulty: c.difficulty,
        lat: c.lat,
        lon: c.lon,
        color: c.color,
        accent: c.accent,
        priceMult: c.priceMult,
        season: currentSeason(c.hemisphere as Hemisphere, now),
        regionCount: stats.regions,
        parcelTotal: stats.total,
        parcelTaken: stats.taken,
        parcelFree: stats.total - stats.taken,
      };
    }),
  });
});

/** Détail d'un continent : régions, parcelles, propriétaires. */
app.get("/world/:continent", async (req, res) => {
  const continent = CONTINENT_BY_CODE[req.params.continent.toUpperCase()];
  if (!continent) {
    res.status(404).json({ error: "Continent inconnu" });
    return;
  }
  const zones = await prisma.zone.findMany({
    where: { continentCode: continent.code },
    include: {
      parcels: {
        select: {
          id: true,
          label: true,
          mapX: true,
          mapY: true,
          gridW: true,
          gridH: true,
          fertility: true,
          landPrice: true,
          farmId: true,
          farm: { select: { name: true, user: { select: { displayName: true } } } },
        },
        orderBy: [{ mapY: "asc" }, { mapX: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
  const weather = await prisma.weatherSnapshot.findMany();
  const now = Date.now();
  res.json({
    continent: {
      code: continent.code,
      name: continent.name,
      tagline: continent.tagline,
      description: continent.description,
      hemisphere: continent.hemisphere,
      difficulty: continent.difficulty,
      color: continent.color,
      accent: continent.accent,
      season: currentSeason(continent.hemisphere as Hemisphere, now),
    },
    regions: zones.map((z) => {
      const region = REGION_BY_CODE[z.code];
      const crops = region?.crops ?? [];
      return {
      code: z.code,
      name: z.name,
      city: z.city,
      koppen: z.koppen,
      climateLabel: z.climateLabel,
      riskNote: z.riskNote,
      crops,
      // Une région où ni blé ni maïs ne pousse est un piège pour un débutant :
      // elle reste achetable plus tard, mais jamais comme ferme de départ.
      starterEligible: crops.length > 0,
      lat: z.lat,
      lon: z.lon,
      mapW: z.mapW,
      mapH: z.mapH,
      fertility: z.baseFertility,
      weather: weather.find((w) => w.zoneCode === z.code)?.state ?? "CLEAR",
      parcels: z.parcels.map((p) => ({
        id: p.id,
        label: p.label,
        mapX: p.mapX,
        mapY: p.mapY,
        gridW: p.gridW,
        gridH: p.gridH,
        fertility: p.fertility,
        landPrice: p.landPrice,
        taken: Boolean(p.farmId),
        ownerName: p.farm?.user?.displayName ?? null,
      })),
      };
    }),
  });
});

/**
 * Coin libre pour poser l'étable de départ.
 *
 * Elle évitait le tracteur et la cour de livraison, qui occupaient alors des
 * cases. L'un comme l'autre sont sortis de la grille : les quatre coins sont
 * désormais également valables.
 */
function findStarterBarnSpot(gridW: number, gridH: number): { x: number; y: number } | null {
  const w = BUILDING_DEFS.CATTLE_BARN.w;
  const h = BUILDING_DEFS.CATTLE_BARN.h;
  const candidates = [
    { x: Math.max(0, gridW - w), y: 0 },
    { x: 0, y: 0 },
    { x: Math.max(0, gridW - w), y: Math.max(0, gridH - h) },
    { x: 0, y: Math.max(0, gridH - h) },
  ];
  for (const c of candidates) {
    if (c.x + w > gridW || c.y + h > gridH) continue;
    return c;
  }
  return null;
}

/**
 * Attribution de la parcelle de départ : gratuite, une seule fois, et
 * seulement si le joueur n'a pas encore de terre.
 */
app.post("/world/claim", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const body = z
    .object({
      parcelId: z.string(),
      specialization: z.enum(["CEREALIER", "ELEVEUR"]),
      appearance: appearanceSchema.optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        include: { farm: { include: { parcels: true, machines: true } } },
      });
      if (!user) throw new Error("NOT_FOUND");
      if (user.farm && user.farm.parcels.length > 0) throw new Error("ALREADY_SETTLED");

      const parcel = await tx.parcel.findFirst({
        where: { id: body.data.parcelId, farmId: null },
        include: { zone: true },
      });
      if (!parcel) throw new Error("PARCEL_UNAVAILABLE");
      // La parcelle de départ ne doit jamais être un piège : on refuse les
      // régions où aucune culture du catalogue ne pousse.
      if ((REGION_BY_CODE[parcel.zone.code]?.crops.length ?? 0) === 0) {
        throw new Error("REGION_NOT_STARTER");
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          specialization: body.data.specialization,
          appearanceJson: JSON.stringify(
            parseAppearance(body.data.appearance, body.data.specialization),
          ),
        },
      });

      let farm = user.farm;
      if (!farm) {
        farm = await tx.farm.create({
          data: { userId: user.id, name: `Ferme ${user.displayName}` },
          include: { parcels: true, machines: true },
        });
      }

      if (farm.machines.length === 0) {
        /* Un tracteur seul ne fait plus rien : il tire. Le parc de départ doit
           donc porter de quoi travailler, sinon la première parcelle reste en
           friche. Semoir et charrue sont le minimum pour boucler un cycle —
           la moissonneuse, elle, se gagne : la première récolte passe par le
           Bureau, comme avant. */
        /*
         * Le même parc pour tout le monde.
         *
         * Le déchaumeur n'allait qu'au céréalier. Un éleveur qui décidait de
         * cultiver — ce que rien ne lui interdisait — se retrouvait donc sans
         * l'outil que le guide lui réclamait dès la première récolte, sans
         * qu'aucun écran ne lui dise pourquoi. Le choix d'inscription ne
         * verrouillait aucune règle ; il ne creusait qu'un écart de matériel,
         * silencieux et définitif.
         */
        for (const type of STARTER_KIT) {
          await tx.machine.create({ data: { type, tier: 1, farmId: farm.id } });
        }
      }

      await tx.parcel.update({ where: { id: parcel.id }, data: { farmId: farm.id } });

      const tractor = await tx.machine.findFirst({
        where: { farmId: farm.id, type: "TRACTOR" },
      });
      if (tractor) {
        // Le tracteur se range sur la cour de stationnement, hors grille : il
        // ne prend plus la case du coin, et le champ reste entier.
        await tx.machine.update({
          where: { id: tractor.id },
          data: { parkedParcelId: parcel.id },
        });
      }

      /*
       * L'étable de départ, pour tout le monde aussi.
       *
       * C'est la moitié du jeu : la laisser derrière un choix d'inscription,
       * c'était demander au joueur de parier sur ce qui lui plairait avant
       * d'avoir rien essayé. Trois vaches ne font pas un élevage — elles font
       * découvrir qu'il en existe un, et la branche s'ouvre en les menant.
       */
      {
        const barnSpot = findStarterBarnSpot(parcel.gridW, parcel.gridH);
        if (barnSpot) {
          const barnDef = BUILDING_DEFS.CATTLE_BARN;
          const cells = footprintCells(barnSpot.x, barnSpot.y, barnDef.w, barnDef.h);
          const barn = await tx.building.create({
            data: {
              parcelId: parcel.id,
              type: "CATTLE_BARN",
              originX: barnSpot.x,
              originY: barnSpot.y,
            },
          });
          for (const c of cells) {
            await tx.parcelCell.update({
              where: { parcelId_x_y: { parcelId: parcel.id, x: c.x, y: c.y } },
              data: { kind: "BUILDING", buildingId: barn.id },
            });
          }
          await tx.herd.create({
            data: {
              farmId: farm.id,
              buildingId: barn.id,
              kind: "COW",
              size: STARTER_COW_COUNT,
              avgAgeMs: PURCHASED_AGE_MS,
            },
          });
          await addToStock(tx, farm.id, "HAY", STARTER_HAY_TONS, 0, 3);
        }
      }
    });
    const player = await playerPayload(auth.user.id);
    res.status(201).json({ player });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "PARCEL_UNAVAILABLE") {
      res.status(409).json({ error: "Cette parcelle vient d'être prise" });
      return;
    }
    if (msg === "ALREADY_SETTLED") {
      res.status(409).json({ error: "Vous possédez déjà une exploitation" });
      return;
    }
    if (msg === "REGION_NOT_STARTER") {
      res.status(409).json({
        error: "Aucune culture ne pousse ici — choisissez une autre région pour débuter",
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* ------------------------------------------------------------------ */
/* Contrats à terme                                                     */
/* ------------------------------------------------------------------ */

/** Engagements du joueur, les plus proches de l'échéance d'abord. */
app.get("/futures", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const rows = await prisma.futuresContract.findMany({
    where: { sellerId: auth.user.id },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    take: 30,
  });
  const market = await prisma.marketPrice.findMany();
  res.json({
    contracts: rows.map((c) => ({
      id: c.id,
      commodity: c.commodity,
      tons: c.tons,
      pricePerTon: c.pricePerTon,
      dueAt: c.dueAt.getTime(),
      status: c.status,
      marketAtDue: c.marketAtDue,
      // Ce que vaudrait la même quantité au comptant, pour juger sur pièce.
      spotNow: market.find((m) => m.commodity === c.commodity)?.price ?? null,
    })),
    horizons: FUTURES_HORIZONS_H.map((h) => ({
      hours: h,
      discount: FUTURES_DISCOUNT[h],
    })),
  });
});

/** S'engager à livrer plus tard, au prix d'aujourd'hui moins la décote. */
app.post("/futures", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const body = z
    .object({
      commodity: z.enum(SELLABLE_GOODS as unknown as [TradeGood, ...TradeGood[]]),
      tons: z.number().positive().max(10_000),
      horizonH: z.number(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const openContracts = await prisma.futuresContract.count({
    where: { sellerId: auth.user.id, status: "OPEN" },
  });
  const verdict = canOpenFuture({
    commodity: body.data.commodity,
    tons: body.data.tons,
    horizonH: body.data.horizonH,
    openContracts,
    tradable: WORLD_MARKET_GOODS,
  });
  if (!verdict.ok) {
    res.status(409).json({ error: FUTURES_REFUSAL_LABELS[verdict.reason!] });
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const horizon = body.data.horizonH as FuturesHorizonH;
  const pricePerTon = futuresPrice(market.price, horizon);
  const contract = await prisma.futuresContract.create({
    data: {
      sellerId: auth.user.id,
      commodity: body.data.commodity,
      tons: body.data.tons,
      pricePerTon,
      dueAt: new Date(Date.now() + horizon * 60 * 60 * 1000),
    },
  });
  res.status(201).json({ contract, pricePerTon });
});

/** Livrer un engagement avant son échéance. */
app.post("/futures/:id/deliver", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const contract = await prisma.futuresContract.findUnique({ where: { id: req.params.id } });
  if (!contract || contract.sellerId !== auth.user.id) {
    res.status(404).json({ error: "Contrat introuvable" });
    return;
  }
  if (contract.status !== "OPEN") {
    res.status(409).json({ error: "Contrat déjà dénoué" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: { farm: { include: { inventory: true } } },
  });
  const inv = user?.farm?.inventory.find((i) => i.itemCode === contract.commodity);
  const tons = settleSaleTons(contract.tons, inv?.qty ?? 0);
  if (!inv || tons === null) {
    res.status(409).json({ error: "Stock insuffisant pour honorer l'engagement" });
    return;
  }
  const revenue = futuresProceeds(contract.pricePerTon, tons);
  const market = await prisma.marketPrice.findUnique({ where: { commodity: contract.commodity } });
  await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv, tons);
    await crediter(tx, user!.id, revenue, posteDeVente(contract.commodity), `Contrat à terme — ${contract.commodity}, ${tons} t`);
    // La marchandise part sur le marché comme n'importe quelle vente.
    await tx.marketPrice.update({
      where: { commodity: contract.commodity },
      data: { stockTons: { increment: tons } },
    });
    await tx.futuresContract.update({
      where: { id: contract.id },
      data: { status: "SETTLED", settledAt: new Date(), marketAtDue: market?.price ?? null },
    });
  });
  res.json({
    revenue,
    tons,
    outcome: futuresOutcome({
      pricePerTon: contract.pricePerTon,
      tons,
      marketPriceAtDue: market?.price ?? contract.pricePerTon,
    }),
  });
});

/**
 * Solde les engagements dont l'échéance est passée.
 *
 * Ne rien faire serait le plus simple, mais alors s'engager ne coûterait rien
 * et le contrat n'aurait aucune portée : on prendrait le prix garanti quand il
 * arrange, et on oublierait sinon.
 */
async function settleDueFutures() {
  const due = await prisma.futuresContract.findMany({
    where: { status: "OPEN", dueAt: { lte: new Date() } },
    take: 100,
  });
  if (!due.length) return;
  const market = await prisma.marketPrice.findMany();
  for (const c of due) {
    const penalty = futuresPenalty(c.pricePerTon, c.tons);
    await prisma.$transaction(async (tx) => {
      // Seul débit qui ne passe **pas** par `debit()` : une pénalité de
      // contrat à terme non honoré peut légitimement creuser le compte. Une
      // dette se rembourse, elle ne s'efface pas faute de trésorerie — et un
      // débit conditionnel l'effacerait en silence.
      const seller = await tx.user.findUnique({
        where: { id: c.sellerId },
        select: { email: true },
      });
      // Compte dev : pas de dette artificielle, la trésorerie reste illimitée.
      if (!seller || !estArgentIllimite(seller.email)) {
        await tx.user.update({
          where: { id: c.sellerId },
          data: { crd: { decrement: penalty } },
        });
      }
      await tx.futuresContract.update({
        where: { id: c.id },
        data: {
          status: "DEFAULTED",
          settledAt: new Date(),
          marketAtDue: market.find((m) => m.commodity === c.commodity)?.price ?? null,
        },
      });
    });
  }
}

/* ------------------------------------------------------------------ */
/* Outils de test — inertes sans FARMSIM_DEV_TOOLS                     */
/* ------------------------------------------------------------------ */

/**
 * L'écran ne montre le panneau de test que si le serveur l'autorise **pour ce
 * compte-là**. Un joueur ordinaire reçoit `false` sur le jeu public, même
 * quand un compte de test existe.
 */
app.get("/dev/status", async (req, res) => {
  res.json({ enabled: Boolean(await testeurAutorisé(req)) });
});

/**
 * Accorde ce qu'il faut pour éprouver une mécanique sans y passer l'après-midi.
 *
 * Chaque champ est facultatif : on ne touche qu'à ce qu'on demande. Les
 * montants sont bornés, moins par méfiance que pour éviter qu'une faute de
 * frappe ne rende les cours du marché absurdes pour tout le monde.
 */
app.post("/dev/grant", async (req, res) => {
  const auth = await testeurAutorisé(req);
  if (!auth) {
    // 404 et non 403 : une route de triche ne doit pas signaler qu'elle
    // existe à celui qui n'y a pas droit.
    res.status(404).json({ error: "Route inconnue" });
    return;
  }
  const body = z
    .object({
      crd: z.number().min(0).max(100_000_000).optional(),
      level: z.number().int().min(1).max(50).optional(),
      xp: z.number().int().min(0).max(1_000_000).optional(),
      stock: z
        .object({
          commodity: z.enum(SELLABLE_GOODS as unknown as [TradeGood, ...TradeGood[]]),
          tons: z.number().min(0).max(100_000),
        })
        .optional(),
      /** Amène toutes les cultures en terre à maturité */
      ripenAll: z.boolean().optional(),
      /** Remplit la mangeoire de tous les troupeaux */
      feedHerds: z.boolean().optional(),
      /** Répare et remet à neuf toutes les machines */
      fixMachines: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    include: { farm: { include: { parcels: true, machines: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const done: string[] = [];

  if (body.data.crd !== undefined) {
    await prisma.user.update({ where: { id: user.id }, data: { crd: body.data.crd } });
    done.push(`trésorerie à ${Math.round(body.data.crd)} €`);
  }
  if (body.data.level !== undefined || body.data.xp !== undefined) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.data.level !== undefined ? { level: body.data.level } : {}),
        ...(body.data.xp !== undefined ? { xp: body.data.xp } : {}),
      },
    });
    done.push("niveau et expérience");
  }
  if (body.data.stock && user.farm) {
    await addToStock(prisma, user.farm.id, body.data.stock.commodity, body.data.stock.tons, 0);
    done.push(`${body.data.stock.tons} t de ${body.data.stock.commodity}`);
  }
  if (body.data.ripenAll && user.farm) {
    /**
     * On recule la date de semis, parce qu'il n'existe pas d'état « mûr » à
     * forcer : la maturité se déduit de la culture.
     *
     * Reculer de `growMs` suffisait tant que la pousse était un compte à
     * rebours. Depuis le calendrier cultural elle s'intègre jour par jour, et
     * une case reculée de cinq jours en plein hiver n'a gagné qu'un jour et
     * demi de croissance : l'outil rendait des champs qui n'étaient pas prêts.
     * On remonte donc jusqu'à ce que le **cumul** atteigne le temps de pousse.
     */
    const parcels = await prisma.parcel.findMany({
      where: { farmId: user.farm.id },
      include: { zone: true },
    });
    const climatParParcelle = new Map(parcels.map((p) => [p.id, climatDe(p)]));
    const cells = await prisma.parcelCell.findMany({
      where: { parcelId: { in: parcels.map((p) => p.id) }, kind: "CROP", crop: { not: null } },
    });
    const now = Date.now();
    for (const c of cells) {
      const crop = c.crop as CropCode;
      const grow = cropGrowMs(crop, grassCutsDone(c));
      const climat = climatParParcelle.get(c.parcelId) ?? {};
      let semis = now - grow;
      for (let i = 0; i < 60; i++) {
        if (integrateGrowth({ crop, plantedAt: semis, until: now, ...climat }) >= grow) break;
        semis -= GAME_DAY_MS;
      }
      await prisma.parcelCell.update({
        where: { id: c.id },
        data: { plantedAt: new Date(semis), readyAt: new Date(now), fieldStage: "READY" },
      });
    }
    done.push(`${cells.length} case(s) à maturité`);
  }
  if (body.data.feedHerds && user.farm) {
    const herds = await prisma.herd.findMany({ where: { farmId: user.farm.id } });
    for (const h of herds) {
      await prisma.herd.update({
        where: { id: h.id },
        data: {
          feedStock: Math.max(1, h.size) * HUNGER.unitsPerAnimalPerCycle * 40,
          feedQuality: 1,
          mortalityDebt: 0,
          lastFedAt: new Date(),
        },
      });
    }
    done.push(`${herds.length} troupeau(x) nourri(s)`);
  }
  if (body.data.fixMachines && user.farm) {
    await prisma.machine.updateMany({
      where: { farmId: user.farm.id },
      data: { condition: 100, greased: true, grease: GREASE_FULL, dirt: 0, greaseSkipStreak: 0, breakdown: null },
    });
    done.push("machines remises à neuf");
  }

  res.json({ ok: true, done, player: await playerPayload(user.id) });
});

app.get("/market", async (_req, res) => res.json(await prisma.marketPrice.findMany()));

/**
 * Cours passés d'une marchandise, du plus ancien au plus récent. Le joueur y
 * lit la tendance : vendre maintenant, ou laisser courir.
 */
app.get("/market/history", async (req, res) => {
  const parsed = z
    .object({
      commodity: z.enum(SELLABLE_GOODS as unknown as [TradeGood, ...TradeGood[]]).optional(),
      hours: z.coerce.number().min(0.25).max(12).optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const since = new Date(Date.now() - (parsed.data.hours ?? 3) * 60 * 60 * 1000);
  const rows = await prisma.marketTick.findMany({
    where: {
      at: { gte: since },
      ...(parsed.data.commodity ? { commodity: parsed.data.commodity } : {}),
    },
    orderBy: { at: "asc" },
    select: { commodity: true, price: true, at: true },
  });
  const series: Record<string, { at: string; price: number }[]> = {};
  for (const r of rows) {
    (series[r.commodity] ??= []).push({ at: r.at.toISOString(), price: r.price });
  }
  res.json({ since: since.toISOString(), series });
});
app.get("/weather", async (_req, res) => res.json(await prisma.weatherSnapshot.findMany()));
app.get("/sim/status", (_req, res) => {
  res.json({
    lastTickAt: lastSimTick?.at ?? null,
    lastTick: lastSimTick,
    tickMs: SIM_TICK_MS,
    weatherLabels: WEATHER_LABELS,
  });
});
/**
 * Avance le monde d'un cran, à la demande.
 *
 * Elle était **ouverte à tous, sans jeton** : un seul appel fait pousser les
 * cultures, tourner la météo, bouger les cours, publier les chantiers des
 * fermes voisines et régler les troupeaux. Répétée en boucle, elle vieillit
 * la partie de tout le monde en quelques secondes — l'économie entière au
 * bout d'un `curl`. C'est un outil de mise au point, il est traité comme tel.
 */
app.post("/sim/tick", async (req, res) => {
  const auth = await testeurAutorisé(req);
  if (!auth) {
    res.status(404).json({ error: "Route inconnue" });
    return;
  }
  const result = await runWorldTick();
  res.json(result);
});
app.get("/contracts", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  const open = await prisma.npcContract.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: MISSION_OPEN_MAX,
  });
  const active = userId
    ? await prisma.npcContract.findFirst({
        where: { status: "ACCEPTED", providerId: userId },
      })
    : null;
  res.json({ contracts: open, active });
});

let lastSimTick: {
  at: string;
  weather: { zoneCode: string; state: string; changed: boolean }[];
  market: { commodity: string; price: number; stockTons: number; supply: number; demand: number }[];
} | null = null;

/**
 * Dégradation des denrées périssables en silo.
 *
 * Le lait perd plus de dix pour cent par cycle : c'est ce qui donne enfin une
 * raison d'accepter le prix bas du négociant plutôt que d'attendre la criée.
 * La décroissance est exponentielle, donc indépendante du découpage des ticks.
 */
async function spoilPerishables() {
  const perishables = (Object.keys(GOOD_DEFS) as TradeGood[]).filter(isPerishable);
  if (!perishables.length) return;
  const items = await prisma.inventoryItem.findMany({
    where: { itemCode: { in: perishables } },
  });
  const now = Date.now();
  // Le froid dépend de la ferme : on le résout une fois par exploitation
  // concernée plutôt qu'à chaque lot.
  const chill = new Map<string, number>();
  for (const item of items) {
    if (!chill.has(item.farmId)) {
      const bonuses = await getFarmBonuses(item.farmId);
      chill.set(item.farmId, bonuses.spoilageSlow ?? 0);
    }
    const elapsedMs = now - item.lastDecayAt.getTime();
    if (elapsedMs < 5000) continue;
    const left = afterSpoilage({
      good: item.itemCode as TradeGood,
      qty: item.qty,
      elapsedMs,
      cycleMs: LIVESTOCK_CYCLE_MS,
      spoilageSlow: chill.get(item.farmId) ?? 0,
    });
    if (left <= 0) await prisma.inventoryItem.delete({ where: { id: item.id } });
    else {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { qty: left, lastDecayAt: new Date(now) },
      });
    }
  }
}

async function runWorldTick() {
  await expireListings();
  await settleOverdueDeliveries();
  await expireLaborOrders();
  await tickNpcFarms();
  await publishFromConsignes();
  await ressemerVoisinage();
  await runNpcBuyers();
  await spoilPerishables();
  await settleAllHerds();
  await settleDueFutures();
  // Les intérêts modifient la dette : ils courent au tick, pas à la lecture.
  // Les faire courir à l'affichage les ferait dépendre du nombre de fois où
  // le joueur ouvre son Bureau.
  await tickDebtInterest();
  // Les ateliers tournent aussi hors connexion : c'est tout leur intérêt.
  await tickProcessing();
  const zones = await prisma.zone.findMany();
  const snapshots = await prisma.weatherSnapshot.findMany();
  const weatherOut: { zoneCode: string; state: string; changed: boolean }[] = [];

  const now = Date.now();
  for (const snap of snapshots) {
    const zone = zones.find((z) => z.code === snap.zoneCode);
    const koppen = zone?.koppen ?? "Cfb";
    const season = currentSeason((zone?.hemisphere as Hemisphere) ?? "N", now);
    // La météo suit le climat Köppen réel de la région et sa saison locale :
    // il ne peut pas neiger en Méridie l'été, ni faire sec en mousson.
    //
    // Elle tient la journée. Tirée au sort à chaque tour, elle changeait
    // toutes les vingt secondes : on passait du soleil à la neige et retour
    // dans la même minute, et plus aucune saison n'était reconnaissable.
    const state = weatherForDay(koppen, season, snap.zoneCode, gameDayIndex(now));
    const changed = state !== snap.state;
    if (changed) {
      await prisma.weatherSnapshot.update({ where: { id: snap.id }, data: { state } });
    }
    weatherOut.push({ zoneCode: snap.zoneCode, state, changed });
  }

  const states = weatherOut.map((w) => w.state as WeatherState);
  const prices = await prisma.marketPrice.findMany();
  const marketOut: {
    commodity: string;
    price: number;
    stockTons: number;
    supply: number;
    demand: number;
  }[] = [];

  // La saison de l'hémisphère nord sert de référence au marché mondial : les
  // cours sont uniques, ils ne peuvent pas suivre quatre calendriers à la fois.
  const saisonMarche = currentSeason("N", now);
  for (const row of prices) {
    // Le cours du jour entre dans le calcul des flux PNJ : c'est lui qui fait
    // se retirer les vendeurs quand il cède, et revenir les acheteurs. Sans
    // cette boucle, seul un rappel décrété ramenait le prix à son point de
    // départ, quoi qu'ait fait le joueur.
    const pressure = marketNpcPressure({
      weatherStates: states,
      season: saisonMarche,
      price: row.price,
      reference: MARKET_BOUNDS[row.commodity as TradeGood]?.initial,
    });
    // Légère asymétrie blé / maïs. Les flux se comptent désormais en tonnes et
    // en dixièmes de tonne : les arrondir à l'entier effaçait l'asymétrie.
    const supply =
      GOOD_DEFS[row.commodity as TradeGood]?.localOnly
        ? 0
        : row.commodity === "MAIZE"
          ? pressure.supplyTons * 1.05
          : pressure.supplyTons;
    const demand =
      GOOD_DEFS[row.commodity as TradeGood]?.localOnly
        ? 0
        : row.commodity === "WHEAT"
          ? pressure.demandTons * 1.05
          : pressure.demandTons;
    const tick = tickMarket({
      commodity: row.commodity as TradeGood,
      price: row.price,
      supplyTons: supply,
      demandTons: demand,
      stockTons: row.stockTons,
    });
    await prisma.marketPrice.update({
      where: { id: row.id },
      data: { price: tick.price, stockTons: tick.stockTons },
    });
    marketOut.push({
      commodity: row.commodity,
      price: tick.price,
      stockTons: tick.stockTons,
      supply,
      demand,
    });
  }

  await recordMarketHistory(marketOut);

  /**
   * Le filet des livraisons oubliées.
   *
   * Une marchandise payée ne doit jamais se perdre parce qu'on a fermé
   * l'onglet. Passé `autoAt`, la caisse se range seule ; le geste reste le
   * chemin normal, et le seul qui donne l'animation.
   */
  const oubliees = await prisma.supplyOrder.findMany({ where: { autoAt: { lte: new Date() } } });
  for (const d of oubliees) await collectDelivery(d);

  /**
   * Les jeunes deviennent adultes.
   *
   * Rien à recalculer : ils étaient déjà comptés dans `size` et occupaient
   * déjà leur place. Passer adulte, c'est simplement cesser d'être un jeune —
   * on supprime le lot, et le troupeau se met à manger et à produire pour eux.
   */
  const grandis = await prisma.youngBatch.findMany({ where: { maturesAt: { lte: new Date() } } });
  if (grandis.length > 0) {
    await prisma.youngBatch.deleteMany({ where: { id: { in: grandis.map((b) => b.id) } } });
  }

  /**
   * Un jeune mal nourri grandit plus lentement.
   *
   * C'est ce qui donne son risque à la voie économique. Acheter jeune revient
   * beaucoup moins cher et ne coûte, en apparence, qu'un peu de patience : le
   * lait auquel on renonce pendant la croissance vaut le quart de ce qu'on a
   * économisé. Sans contrepartie, ce serait un choix évident, donc pas un
   * choix.
   *
   * La contrepartie n'est pas un bouton de plus : c'est la même exigence que
   * pour le reste du lot — nourrir. Une mangeoire vide et l'échéance recule
   * d'autant, si bien qu'un éleveur négligent paie sa réduction en temps, et
   * peut la payer très cher.
   */
  const affames = await prisma.herd.findMany({
    where: { feedStock: { lte: 0 }, youngBatches: { some: {} } },
    include: { youngBatches: true },
  });
  for (const lot of affames) {
    for (const y of lot.youngBatches) {
      if (y.maturesAt.getTime() <= Date.now()) continue;
      await prisma.youngBatch.update({
        where: { id: y.id },
        data: { maturesAt: new Date(y.maturesAt.getTime() + SIM_TICK_MS) },
      });
    }
  }

  lastSimTick = {
    at: new Date().toISOString(),
    weather: weatherOut,
    market: marketOut,
  };
  return lastSimTick;
}

/**
 * Archive les cours du tick et élague les plus vieux.
 *
 * Sans mémoire des prix, le joueur ne peut ni juger si l'offre du jour est
 * bonne, ni décider d'attendre : il vend au hasard. Une fenêtre glissante
 * suffit — personne ne spécule sur le cours d'avant-hier — et elle borne la
 * table, qui grossirait sinon de cinq lignes toutes les vingt secondes.
 */
const MARKET_HISTORY_MS = 12 * 60 * 60 * 1000;

async function recordMarketHistory(rows: { commodity: string; price: number }[]) {
  if (!rows.length) return;
  const at = new Date();
  await prisma.marketTick.createMany({
    data: rows.map((r) => ({ commodity: r.commodity, price: r.price, at })),
  });
  await prisma.marketTick.deleteMany({
    where: { at: { lt: new Date(at.getTime() - MARKET_HISTORY_MS) } },
  });
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function newSessionToken() {
  return randomBytes(24).toString("hex");
}

async function createSession(userId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

/**
 * Remettre un code de secours au compte, et n'en garder que l'empreinte.
 *
 * Le clair remonte une fois — dans la réponse HTTP qui suit — puis n'existe
 * plus nulle part : ni en base, ni dans les journaux. C'est le prix du
 * mécanisme, et c'est aussi ce qui le rend utile ; un code que le serveur
 * pourrait relire ne protégerait rien.
 */
async function remettreCodeSecours(userId: string): Promise<string> {
  const code = nouveauCodeSecours();
  await prisma.user.update({
    where: { id: userId },
    data: { recoveryHash: empreinteSecours(userId, code), recoveryAt: new Date() },
  });
  return code;
}

async function userFromAuthHeader(req: express.Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { farm: { include: farmInclude() } } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { session, user: session.user };
}

async function marketPriceMap() {
  const rows = await prisma.marketPrice.findMany();
  return Object.fromEntries(rows.map((r) => [r.commodity, r.price])) as Record<string, number>;
}

async function buildResumeForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      farm: {
        include: {
          parcels: { include: { cells: true, zone: true } },
        },
      },
    },
  });
  if (!user) return null;
  const now = Date.now();
  const last = user.lastSeenAt?.getTime() ?? user.createdAt.getTime();
  const awayMs = Math.max(0, now - last);
  let cropsReady = 0;
  let cropsGrowing = 0;
  let cropsLost = 0;
  let cropsDeclining = 0;
  for (const parcel of user.farm?.parcels ?? []) {
    for (const cell of parcel.cells) {
      if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) continue;
      const sim = simulateCell({
        ...climatDe(parcel),
        crop: cell.crop,
        plantedAt: cell.plantedAt.getTime(),
        now,
        fertility: parcel.fertility,
        weedPressure: pressionAdventices(cell, currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now())),
        fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
        residuePasses: cell.residuePasses,
        directSeeded: cell.directSeeded,
        rotation: rotationOf(cell),
        specialization: playableSpec(user.specialization),
        cutsDone: grassCutsDone(cell),
      });
      if (sim.lost) cropsLost += 1;
      else if (sim.ripeness && sim.ripeness.stage !== "PEAK") cropsDeclining += 1;
      else if (sim.ready) cropsReady += 1;
      else cropsGrowing += 1;
    }
  }
  let marketBefore: Record<string, number> = {};
  try {
    marketBefore = user.lastMarketJson ? JSON.parse(user.lastMarketJson) : {};
  } catch {
    marketBefore = {};
  }
  const marketNow = await marketPriceMap();
  const weather = await prisma.weatherSnapshot.findMany();
  const herdsHungry = (
    await prisma.herd.findMany({
      where: { farm: { userId } },
      select: { size: true, feedStock: true },
    })
  ).filter((h) => hungerPenalty({ feedStock: h.feedStock, herdSize: h.size }) > 0.3).length;

  const resume = buildSessionResume({
    awayMs,
    cropsReady,
    cropsGrowing,
    cropsLost,
    cropsDeclining,
    herdsHungry,
    marketBefore,
    marketNow,
    weatherStates: weather.map((w) => w.state),
  });
  const log = parseAbsenceLog(user.absenceLogJson);
  return {
    ...resume,
    absenceLog: log.lines,
    spent: log.spent,
    consignes: parseConsignes(user.consignesJson),
  };
}

async function touchUserPresence(userId: string) {
  const market = await marketPriceMap();
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: new Date(),
      lastMarketJson: JSON.stringify(market),
    },
  });
}

async function playerPayload(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: { farm: { include: farmInclude() } },
  });
  if (!user) return null;
  let grainDump: GrainCapacityResult | undefined;
  if (user.farm) {
    const bonusesNow = await getFarmBonuses(user.farm.id);
    const currentGrain = grainStockFromItems(user.farm.inventory);
    if (totalGrainTons(currentGrain) > bonusesNow.storageGrain) {
      grainDump = await prisma.$transaction((tx) =>
        applyGrainCapacity(tx, {
          farmId: user!.farm!.id,
          userId: user!.id,
          capacity: bonusesNow.storageGrain,
        }),
      );
      if (grainDump.soldTons > 0) {
        const fresh = await prisma.user.findUnique({
          where: { id: userId },
          include: { farm: { include: farmInclude() } },
        });
        if (fresh) user = fresh;
      }
    }
  }
  const bonuses = user.farm ? await getFarmBonuses(user.farm.id) : null;
  const {
    accessCode: _omit,
    // L'empreinte du code de secours ne sort pas du serveur. Elle ne rend
    // pas le code, mais elle permet de vérifier une supposition hors ligne :
    // la donner au navigateur transformerait 80 bits en cible.
    recoveryHash: _secours,
    appearanceJson,
    statsJson,
    consignesJson,
    absenceLogJson,
    ...safe
  } = user;
  void _omit;
  void _secours;
  void absenceLogJson;
  const dev = estCompteDev(user.email);
  const unlimited = estArgentIllimite(user.email);
  return {
    ...safe,
    dev,
    unlimitedCrd: unlimited,
    crd: unlimited ? Math.max(user.crd, DEV_DISPLAY_CRD) : user.crd,
    appearance: appearanceFromJson(appearanceJson, playableSpec(user.specialization)),
    consignes: parseConsignes(consignesJson),
    bonuses,
    // La jauge du bandeau et le chapitre « Niveaux » du guide lisent ceci :
    // sans la borne du palier, « 0 XP » ne dit pas où l'on en est.
    progress: levelProgress(user.xp),
    stats: readStats(statsJson),
    grainDump: grainDump && grainDump.soldTons > 0 ? grainDump : undefined,
  };
}

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(32),
  /** Choisie plus tard, pendant l'installation guidée */
  specialization: z.enum(["CEREALIER", "ELEVEUR"]).optional(),
  parcelId: z.string().optional(),
  accessCode: z.string().min(3).max(32).optional(),
});

app.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const { email, displayName, specialization, parcelId, accessCode } = parsed.data;
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          displayName,
          specialization: specialization ?? "CEREALIER",
          accessCode: accessCode ?? "ferme",
          lastSeenAt: new Date(),
        },
      });
      const farm = await tx.farm.create({
        data: {
          userId: u.id,
          name: `Ferme ${displayName}`,
          machines: {
            /*
             * Le parc de départ se crée à **deux** endroits — ici, et à la
             * prise de parcelle. Les deux doivent poser le même kit, sinon
             * celui qui passe en premier décide, et l'autre ne fait rien : sa
             * garde `machines.length === 0` est déjà fausse. C'est ce qui
             * privait de déchaumeur tous ceux qui s'inscrivaient avec une
             * parcelle.
             */
            create: specialization ? STARTER_KIT.map((type) => ({ type, tier: 1 })) : [],
          },
        },
      });
      if (parcelId) {
        const parcel = await tx.parcel.findFirst({ where: { id: parcelId, farmId: null } });
        if (!parcel) throw new Error("PARCEL_UNAVAILABLE");
        const fresh = await tx.user.findUnique({ where: { id: u.id } });
        if (!fresh || !peutPayer(fresh, parcel.landPrice)) throw new Error("INSUFFICIENT_FUNDS");
        await debit(tx, u.id, parcel.landPrice, "TERRES", "Parcelle de départ");
        await tx.parcel.update({ where: { id: parcel.id }, data: { farmId: farm.id } });
        const machine = await tx.machine.findFirst({ where: { farmId: farm.id } });
        if (machine) {
          await tx.machine.update({
            where: { id: machine.id },
            data: { parkedParcelId: parcel.id },
          });
        }
      }
      return tx.user.findUnique({
        where: { id: u.id },
        include: { farm: { include: farmInclude() } },
      });
    });
    if (!user) {
      res.status(500).json({ error: "Erreur création" });
      return;
    }
    const token = await createSession(user.id);
    await touchUserPresence(user.id);
    const player = await playerPayload(user.id);
    res.status(201).json({
      token,
      player,
      accessCodeHint: accessCode ?? "ferme",
      // Remis une seule fois, ici. Il n'y a pas d'envoi d'e-mail sur ce
      // serveur : sans ce code noté quelque part, un code d'accès oublié
      // signifie une ferme perdue.
      recoveryCode: await remettreCodeSecours(user.id),
      resume: await buildResumeForUser(user.id),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "PARCEL_UNAVAILABLE") {
      res.status(409).json({ error: "Parcelle indisponible" });
      return;
    }
    if (msg === "INSUFFICIENT_FUNDS") {
      res.status(402).json({ error: "€ insuffisants" });
      return;
    }
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      res.status(409).json({ error: "Email déjà utilisé" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/*
 * Le compte d'essai a été retiré.
 *
 * `POST /auth/demo` fabriquait une identité jetable **et lui attribuait une
 * parcelle du monde**, définitivement — rien ne la reprenait jamais. La route
 * était publique et sans limite : mesuré, soixante comptes en 2,4 secondes
 * avec une boucle de trois lignes. Le monde ayant un nombre fixe de
 * parcelles, il suffisait de quelques secondes pour qu'aucun nouveau joueur
 * ne puisse plus s'installer.
 *
 * Elle n'est pas mise derrière un drapeau mais supprimée : une route de ce
 * genre, laissée éteinte quelque part, finit par être rallumée un jour où
 * l'on a oublié pourquoi elle ne l'était pas.
 *
 * Pour éprouver le jeu, c'est le compte développeur inscrit dans le code,
 * plus `FARMSIM_TESTERS` : les outils de test ouverts à des comptes nommés,
 * sur un compte ordinaire.
 */

async function findUserByEmail(email: string) {
  const trimmed = email.trim();
  const exact = await prisma.user.findUnique({ where: { email: trimmed } });
  if (exact) return exact;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE lower("email") = ${normalizeEmail(trimmed)} LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

app.post("/auth/login", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      accessCode: z.string().min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await findUserByEmail(body.data.email);
  if (!user || user.accessCode !== body.data.accessCode) {
    res.status(401).json({ error: "Email ou code incorrect" });
    return;
  }
  const resume = await buildResumeForUser(user.id);
  const token = await createSession(user.id);
  await touchUserPresence(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { absenceLogJson: JSON.stringify({ spent: 0, lines: [] } satisfies AbsenceLog) },
  });
  const player = await playerPayload(user.id);
  /*
   * Rattrapage des comptes créés avant le mécanisme.
   *
   * Ils n'ont pas de code de secours et ne peuvent donc pas se dépanner. On
   * leur en remet un à la première connexion réussie — le seul moment où
   * l'on est sûr d'avoir affaire au propriétaire du compte, puisqu'il vient
   * de donner son code d'accès. Pas de script de rattrapage en base : celui
   * qui ne se reconnecte jamais n'a de toute façon rien à récupérer.
   */
  const recoveryCode = user.recoveryHash ? undefined : await remettreCodeSecours(user.id);
  res.json({ token, player, resume, recoveryCode });
});

/**
 * Code d'accès oublié.
 *
 * Le joueur donne son adresse et le code de secours qu'il a noté, et choisit
 * un nouveau code d'accès. Trois précautions :
 *
 * - **le refus est muet** — adresse inconnue et mauvais code rendent le même
 *   message, sinon l'écran devient un annuaire des comptes qui jouent ;
 * - **le code de secours est brûlé** — un nouveau est remis dans la foulée,
 *   pour qu'un bout de papier retrouvé dans six mois ne rouvre pas la ferme ;
 * - **les sessions ouvertes tombent** — si quelqu'un d'autre était entré avec
 *   l'ancien code, changer ce code doit le mettre dehors, sans quoi la
 *   reprise en main est une illusion.
 *
 * Le seau `AUTH` de la limite de débit couvre cette route (`/auth/…`) : dix
 * essais, puis un toutes les trente secondes.
 */
app.post("/auth/recover", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      recoveryCode: z.string().min(1).max(64),
      accessCode: z.string().min(3).max(32),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  if (!isRecoveryCode(body.data.recoveryCode)) {
    res.status(401).json({ error: RECOVERY_REFUSAL });
    return;
  }
  const user = await findUserByEmail(body.data.email);
  if (!user || !secoursCorrespond(user.recoveryHash, user.id, body.data.recoveryCode)) {
    res.status(401).json({ error: RECOVERY_REFUSAL });
    return;
  }
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({
    where: { id: user.id },
    data: { accessCode: body.data.accessCode },
  });
  const recoveryCode = await remettreCodeSecours(user.id);
  const resume = await buildResumeForUser(user.id);
  const token = await createSession(user.id);
  await touchUserPresence(user.id);
  const player = await playerPayload(user.id);
  res.json({ token, player, resume, recoveryCode });
});

app.get("/auth/me", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const player = await playerPayload(auth.user.id);
  res.json({ token: auth.session.token, player });
});

const patchMeSchema = z
  .object({
    displayName: z.string().min(2).max(32).optional(),
    email: z.string().email().optional(),
    accessCode: z.string().min(3).max(32).optional(),
    currentAccessCode: z.string().min(1).max(32).optional(),
  })
  .refine(
    (d) => Boolean(d.displayName || d.email || d.accessCode),
    { message: "Rien à modifier" },
  );

/**
 * Mettre à jour le compte connecté : pseudo, e-mail (identifiant), code d'accès.
 *
 * L'id Prisma ne se change pas — ce n'est pas un identifiant de joueur. Changer
 * l'e-mail ou le code demande le code actuel, comme on le ferait d'un mot de
 * passe. Les autres sessions tombent si le code change, pour que l'ancien
 * n'ouvre plus la ferme ailleurs.
 */
app.patch("/auth/me", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const parsed = patchMeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const { displayName, email, accessCode, currentAccessCode } = parsed.data;
  const needsSecret = Boolean(email || accessCode);
  if (needsSecret && currentAccessCode !== auth.user.accessCode) {
    res.status(403).json({ error: "Code d'accès actuel incorrect" });
    return;
  }

  const data: { displayName?: string; email?: string; accessCode?: string } = {};
  if (displayName && displayName !== auth.user.displayName) data.displayName = displayName;
  if (email && normalizeEmail(email) !== normalizeEmail(auth.user.email)) {
    const other = await findUserByEmail(email);
    if (other && other.id !== auth.user.id) {
      res.status(409).json({ error: "Email déjà utilisé" });
      return;
    }
    data.email = email.trim();
  }
  if (accessCode && accessCode !== auth.user.accessCode) data.accessCode = accessCode;

  if (!Object.keys(data).length) {
    res.json({ player: await playerPayload(auth.user.id) });
    return;
  }

  try {
    await prisma.user.update({ where: { id: auth.user.id }, data });
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      res.status(409).json({ error: "Email déjà utilisé" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
    return;
  }

  if (data.accessCode) {
    await prisma.session.deleteMany({
      where: { userId: auth.user.id, token: { not: auth.session.token } },
    });
  }

  res.json({ player: await playerPayload(auth.user.id) });
});

/* ------------------------------------------------------------------ */
/* Quêtes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Les objectifs du joueur et leur avancement.
 *
 * L'avancement n'est stocké nulle part : il se **déduit** des compteurs
 * cumulés qu'alimente `grantXp`. Seul l'encaissement d'une récompense est
 * enregistré, parce que c'est le seul fait qui ne se recalcule pas. Il n'y a
 * donc rien à synchroniser — et donc rien qui puisse se désynchroniser, comme
 * le faisaient les drapeaux rangés dans le stockage local du navigateur.
 */
app.get("/quests", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const claims = await prisma.questClaim.findMany({
    where: { userId },
    select: { questId: true },
  });
  const stats = readStats(user.statsJson);
  res.json({
    quests: questsFor(
      playableSpec(user.specialization) ?? "CEREALIER",
      user.level,
      stats,
      claims.map((c) => c.questId),
    ),
    stats,
    xp: user.xp,
    level: user.level,
  });
});

/** Encaisser une quête tenue. Une fois, et pas deux. */
app.post("/quests/:id/claim", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const def = QUEST_DEFS.find((q) => q.id === req.params.id);
  if (!def) {
    res.status(404).json({ error: "Objectif inconnu" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const claims = await prisma.questClaim.findMany({
    where: { userId: user.id },
    select: { questId: true },
  });
  const open = claimable(
    playableSpec(user.specialization) ?? "CEREALIER",
    user.level,
    readStats(user.statsJson),
    claims.map((c) => c.questId),
  );
  if (!open.some((q) => q.id === def.id)) {
    res.status(409).json({ error: "Objectif pas encore tenu, ou déjà encaissé" });
    return;
  }

  const gain = await prisma.$transaction(async (tx) => {
    // La contrainte d'unicité fait le gardien : deux clics simultanés ne
    // peuvent pas encaisser deux fois.
    await tx.questClaim.create({ data: { userId: user.id, questId: def.id } });
    await crediter(tx, user.id, def.reward.crd, "PROGRESSION", `Objectif — ${def.title}`);
    return grantXp(tx, user.id, "QUEST", { reward: def.reward.xp });
  });
  res.json({ quest: def.id, reward: def.reward, gain });
});

/** Les autres fermes : qui est connecté, qui est passé récemment. */
app.get("/players", async (req, res) => {
  const mine = typeof req.query.userId === "string" ? req.query.userId : null;
  const since = new Date(Date.now() - PLAYER_ONLINE_MS);
  const users = await prisma.user.findMany({
    select: { id: true, displayName: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
    take: 40,
  });
  res.json({
    players: users
      .filter((u) => u.id !== mine)
      .map((u) => ({
        id: u.id,
        name: u.displayName,
        online: Boolean(u.lastSeenAt && u.lastSeenAt >= since),
        lastSeenAt: u.lastSeenAt?.getTime() ?? null,
      })),
  });
});

app.patch("/me/appearance", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const body = appearanceSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const appearance = parseAppearance(body.data, playableSpec(auth.user.specialization));
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { appearanceJson: JSON.stringify(appearance) },
  });
  const player = await playerPayload(auth.user.id);
  res.json({ player, appearance });
});

app.post("/me/consignes", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const body = z
    .object({
      harvest: z.boolean().optional(),
      stubble: z.boolean().optional(),
      plow: z.boolean().optional(),
      straw: z.boolean().optional(),
      npcAllowed: z.boolean().optional(),
      maxSpend: z.number().min(0).max(20_000).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const next: Consignes = {
    ...parseConsignes(auth.user.consignesJson),
    ...body.data,
    maxSpend: body.data.maxSpend != null ? Math.round(body.data.maxSpend) : parseConsignes(auth.user.consignesJson).maxSpend,
  };
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { consignesJson: JSON.stringify(next) },
  });
  res.json({ consignes: next });
});

app.get("/session/resume", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const resume = await buildResumeForUser(auth.user.id);
  await prisma.user.update({
    where: { id: auth.user.id },
    data: { absenceLogJson: JSON.stringify({ spent: 0, lines: [] } satisfies AbsenceLog) },
  });
  res.json(resume);
});

app.post("/session/heartbeat", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  await touchUserPresence(auth.user.id);
  res.json({ ok: true, at: new Date().toISOString() });
});

app.get("/players/:id", async (req, res) => {
  const player = await playerPayload(req.params.id);
  if (!player) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(player);
});
app.get("/parcels/:id", async (req, res) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: {
      zone: true,
      cells: true,
      buildings: true,
      machines: true,
      farm: { include: { user: { select: { id: true, displayName: true } } } },
    },
  });
  if (!parcel) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  const weather = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: parcel.zone.code } });
  const bonuses = parcel.farmId ? await getFarmBonuses(parcel.farmId) : null;
  const now = Date.now();
  const season = currentSeason((parcel.zone.hemisphere as Hemisphere) ?? "N", now);
  const climate = {
    season,
    koppen: parcel.zone.koppen,
    label: parcel.zone.climateLabel,
    yieldFactor: climateYieldFactor(parcel.zone.koppen, season),
  };
  const cellSims = [];
  for (const c of parcel.cells) {
    if (c.kind === "CROP" && c.crop && c.plantedAt) {
      const sim = simulateCell({
        ...climatDe(parcel),
        crop: c.crop,
        plantedAt: c.plantedAt.getTime(),
        now,
        fertility: parcel.fertility,
        weedPressure: pressionAdventices(c, currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now())),
        fertilizedPasses: Math.min(2, c.fertilizedPasses) as 0 | 1 | 2,
        residuePasses: c.residuePasses,
        directSeeded: c.directSeeded,
        rotation: rotationOf(c),
        buildingYieldBonus:
          (bonuses?.yieldBonus ?? 0) +
          pollinationBonusAt(bonuses?.hives ?? [], c.x, c.y, c.crop),
        skillYieldBonus: bonuses?.skills.CROP_YIELD ?? 0,
        weatherAtHarvest: weather?.state as WeatherState | undefined,
        cutsDone: grassCutsDone(c),
      });
      if (sim.ready && c.fieldStage !== "READY") {
        await prisma.parcelCell.update({
          where: { id: c.id },
          data: { fieldStage: "READY" },
        });
      }
      cellSims.push({ x: c.x, y: c.y, sim });
    }
  }
  const workers = await listFieldWorkers(parcel.id);
  const labor = await prisma.laborOrder.findMany({
    where: { parcelId: parcel.id, status: { in: ["OPEN", "ACCEPTED"] } },
    include: laborOrderInclude,
  });
  res.json({
    parcel,
    weather,
    bonuses,
    cellSims,
    climate,
    workers,
    labor: labor.map(publicLaborOrder),
  });
});

app.post("/parcels/:id/presence", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const allowed = await canVisitParcel(body.data.userId, req.params.id);
  if (!allowed) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  await touchFieldPresence(
    body.data.userId,
    req.params.id,
    body.data.x != null && body.data.y != null ? { x: body.data.x, y: body.data.y } : undefined,
  );
  res.json({ ok: true, workers: await listFieldWorkers(req.params.id) });
});

/**
 * Découpe une planche de cases en chantiers publiables.
 *
 * La taille était fixée à seize alors que la règle en autorise huit à
 * vingt-quatre. Conséquence : chaque lot faisait exactement seize cases, donc
 * rapportait exactement la même chose, et la bourse alignait vingt-quatre
 * lignes « 16/16 · 203 € » indiscernables. La taille varie maintenant d'un
 * lot à l'autre, ce qui fait varier la paie sans toucher au barème.
 *
 * La variation est **déterministe**, tirée de `seed` : une même parcelle
 * redécoupée deux fois donne les mêmes lots. Un tirage au hasard ferait
 * bouger les offres à chaque passage du générateur.
 */
function chunkCells(cells: CellXY[], seed = 0): CellXY[][] {
  const SIZES = [MISSION_CELLS_MIN + 2, 14, MISSION_CELLS_MAX - 6, 11, MISSION_CELLS_MAX - 2];
  const out: CellXY[][] = [];
  let i = 0;
  let k = Math.abs(Math.trunc(seed));
  while (i < cells.length) {
    const n = Math.max(
      MISSION_CELLS_MIN,
      Math.min(MISSION_CELLS_MAX, SIZES[k % SIZES.length]),
    );
    k += 1;
    const slice = cells.slice(i, i + n);
    i += n;
    if (slice.length >= MISSION_CELLS_MIN) out.push(slice);
  }
  return out;
}

/** Graine stable tirée d'un identifiant : deux parcelles se découpent autrement. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

async function occupiedLaborCells(parcelId: string): Promise<Set<string>> {
  const open = await prisma.laborOrder.findMany({
    where: { parcelId, status: { in: ["OPEN", "ACCEPTED"] } },
    select: { remainingJson: true },
  });
  const keys = new Set<string>();
  for (const o of open) {
    for (const c of parseCellJson(o.remainingJson)) keys.add(`${c.x},${c.y}`);
  }
  return keys;
}

async function appendAbsenceLog(userId: string, text: string, spentDelta: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { absenceLogJson: true } });
  const log = parseAbsenceLog(user?.absenceLogJson);
  log.spent = Math.round((log.spent + spentDelta) * 100) / 100;
  log.lines.push({ at: new Date().toISOString(), text });
  if (log.lines.length > 24) log.lines = log.lines.slice(-24);
  await prisma.user.update({
    where: { id: userId },
    data: { absenceLogJson: JSON.stringify(log) },
  });
}

async function createLaborOrderForCells(opts: {
  parcelId: string;
  userId: string;
  work: FarmWork;
  crop?: CropCode | null;
  cells: CellXY[];
  npcClient?: boolean;
}): Promise<
  | { ok: true; order: ReturnType<typeof publicLaborOrder>; escrow: number }
  | { ok: false; status: number; error: string }
> {
  const unique = opts.cells.filter(
    (c, i, arr) => arr.findIndex((o) => o.x === c.x && o.y === c.y) === i,
  );
  const n = unique.length;
  /*
   * Plus de plafond sur ce qu'un joueur demande pour son propre champ.
   *
   * Les vingt-quatre cases étaient le calibre des offres **PNJ** — la taille
   * à laquelle on découpe le tableau pour qu'un chantier se prenne entre deux
   * travaux. Rien ne justifiait de l'imposer à quelqu'un qui veut faire
   * déchaumer sa parcelle : « il ne faut pas que ça soit limité à 24 cases ».
   *
   * Le plancher reste : en dessous de huit cases, une demande d'entraide coûte
   * plus de dérangement qu'elle ne rend service, et rien n'empêcherait d'en
   * publier trente d'une case. Le prix, lui, suit désormais le travail réel —
   * sans quoi lever le plafond ferait travailler l'aidant à perte.
   */
  if (n < MISSION_CELLS_MIN) {
    return {
      ok: false,
      status: 400,
      error: `Un chantier fait ${MISSION_CELLS_MIN} cases au minimum`,
    };
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: opts.parcelId },
    include: { farm: true, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== opts.userId) {
    return { ok: false, status: 403, error: "Parcelle non possédée" };
  }
  for (const { x, y } of unique) {
    const cell = parcel.cells.find((c) => c.x === x && c.y === y);
    if (!cell || cell.kind === "BUILDING" || cell.kind === "VEHICLE") {
      return { ok: false, status: 409, error: `Case ${x},${y} hors du travail` };
    }
  }
  const openCount = await prisma.laborOrder.count({
    where: { clientId: opts.userId, status: { in: ["OPEN", "ACCEPTED"] } },
  });
  if (openCount >= LABOR_OPEN_MAX_PER_CLIENT) {
    return {
      ok: false,
      status: 409,
      error: `Au plus ${LABOR_OPEN_MAX_PER_CLIENT} demandes d’aide en même temps`,
    };
  }
  const crop = opts.work === "PLANT" ? (opts.crop ?? "WHEAT") : null;
  const money = laborEscrow(opts.work, unique.length, crop, Boolean(opts.npcClient));
  // Le fumier déjà au bord du champ tient lieu d'engrais : on ne fait pas
  // payer deux fois celui qui l'a produit.
  if (opts.work === "FERTILIZE") {
    const available = await parcelManureTons(parcel.id);
    if (available >= manureNeededForCells(unique.length)) {
      money.extras = 0;
      money.escrow = money.quote;
    }
  }
  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  if (!user || !peutPayer(user, money.escrow)) {
    return {
      ok: false,
      status: 402,
      error: `Pas assez d’argent — ${money.escrow} € mis de côté`,
    };
  }
  const order = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, money.escrow, "CHANTIERS", `Chantier posté — ${WORK_LABELS[opts.work] ?? opts.work}`);
    return tx.laborOrder.create({
      data: {
        parcelId: parcel.id,
        clientId: user.id,
        work: opts.work,
        crop,
        cellsJson: JSON.stringify(unique),
        remainingJson: JSON.stringify(unique),
        quoteCrd: money.quote,
        extrasCrd: money.extras,
        escrowCrd: money.escrow,
        payoutCrd: money.payout,
        expiresAt: new Date(Date.now() + LABOR_ORDER_TTL_MS),
      },
      include: laborOrderInclude,
    });
  });
  return { ok: true, order: publicLaborOrder(order), escrow: money.escrow };
}

app.post("/parcels/:id/labor-orders", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      work: z.enum(LABOR_ORDER_WORKS),
      crop: z.enum(CROP_CODES).optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const result = await createLaborOrderForCells({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: body.data.work,
    crop: body.data.crop,
    cells: body.data.cells,
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json({ order: result.order, escrow: result.escrow });
});

app.get("/labor-orders", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  await expireLaborOrders();
  const open = await prisma.laborOrder.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: laborOrderInclude,
  });
  const active = userId
    ? await prisma.laborOrder.findFirst({
        where: { status: "ACCEPTED", providerId: userId },
        include: laborOrderInclude,
      })
    : null;
  const posted = userId
    ? await prisma.laborOrder.findMany({
        where: { clientId: userId, status: { in: ["OPEN", "ACCEPTED"] } },
        include: laborOrderInclude,
      })
    : [];
  res.json({
    orders: open.map(publicLaborOrder),
    active: active ? publicLaborOrder(active) : null,
    posted: posted.map(publicLaborOrder),
  });
});

app.post("/labor-orders/:id/accept", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true } } },
  });
  if (!user?.farm) {
    res.status(409).json({ error: "Ferme requise (machines) pour les contrats" });
    return;
  }
  if (await hasActiveMission(user.id)) {
    res.status(409).json({ error: "Une mission à la fois — finissez d’abord celle en cours." });
    return;
  }
  const order = await prisma.laborOrder.findUnique({
    where: { id: req.params.id },
    include: laborOrderInclude,
  });
  if (!order || order.status !== "OPEN") {
    res.status(409).json({ error: "Chantier indisponible" });
    return;
  }
  if (order.clientId === user.id) {
    res.status(409).json({ error: "Vous ne pouvez pas prendre votre propre demande" });
    return;
  }
  const picked = pickMachineForWork(user.farm.machines, order.work as FarmWork);
  if (!picked) {
    res.status(409).json({ error: explainNoMachine(user.farm.machines, order.work as FarmWork) });
    return;
  }
  const updated = await prisma.laborOrder.update({
    where: { id: order.id },
    data: { providerId: user.id, status: "ACCEPTED" },
    include: laborOrderInclude,
  });
  const remaining = parseCellJson(updated.remainingJson);
  await touchFieldPresence(user.id, updated.parcelId, remaining[0]);
  res.json({ order: publicLaborOrder(updated) });
});

app.post("/labor-orders/:id/cancel", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const order = await prisma.laborOrder.findUnique({ where: { id: req.params.id } });
  if (!order || order.clientId !== body.data.userId) {
    res.status(403).json({ error: "Ce n’est pas votre demande" });
    return;
  }
  if (order.status !== "OPEN") {
    res.status(409).json({ error: "Annulation seulement tant que personne n’a pris le travail" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.laborOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    await crediter(tx, order.clientId, order.escrowCrd, "CHANTIERS", "Chantier annulé — séquestre rendu");
  });
  res.json({ ok: true, refunded: order.escrowCrd });
});

app.post("/labor-orders/:id/abandon", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const order = await prisma.laborOrder.findUnique({
    where: { id: req.params.id },
    include: laborOrderInclude,
  });
  if (!order || order.providerId !== body.data.userId || order.status !== "ACCEPTED") {
    res.status(409).json({ error: "Ce n’est pas votre demande" });
    return;
  }
  const updated = await prisma.laborOrder.update({
    where: { id: order.id },
    data: { providerId: null, status: "OPEN" },
    include: laborOrderInclude,
  });
  res.json({ order: publicLaborOrder(updated) });
});

/** Achat d'une parcelle libre ou cédée par un PNJ (jamais un autre joueur). */
app.post("/parcels/:id/buy", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const target = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true, farm: { include: { user: true } } },
  });
  if (!target) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  /* Libre, ou cédée par un PNJ. Un autre joueur, jamais. */
  const npcCede = Boolean(target.farm?.user.isNpc);
  if (target.farmId && !npcCede) {
    res.status(409).json({ error: "Parcelle indisponible" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { parcels: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }

  const owned = user.farm.parcels;
  const quote = await quoteParcel(target, owned, user.level);

  const gate = canAcquire({
    playerLevel: user.level,
    ownedTotal: owned.length,
    ownedInRegion: owned.filter((p) => p.zoneId === target.zoneId).length,
    regionParcelCount: await prisma.parcel.count({ where: { zoneId: target.zoneId } }),
  });
  if (!gate.ok) {
    res.status(403).json({ error: acquisitionRefusal(gate.reason!, user, owned.length) });
    return;
  }
  if (!peutPayer(user, quote.total)) {
    res.status(402).json({ error: `€ insuffisants — ${quote.total} requis` });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, quote.total, "TERRES", `Achat de parcelle — ${target.label}`);
    if (npcCede && target.farmId) {
      const batis = await tx.building.findMany({
        where: { parcelId: target.id },
        select: { id: true },
      });
      const ids = batis.map((b) => b.id);
      if (ids.length) {
        await tx.herd.updateMany({
          where: { buildingId: { in: ids } },
          data: { farmId: user.farm!.id },
        });
        // Les engins du voisin restent les siens : on les sort du hangar.
        await tx.machine.updateMany({
          where: { storedInBuildingId: { in: ids } },
          data: { storedInBuildingId: null, parkedParcelId: null },
        });
      }
      await tx.machine.updateMany({
        where: { parkedParcelId: target.id, farmId: target.farmId },
        data: { parkedParcelId: null },
      });
    }
    await tx.parcel.update({
      where: { id: target.id },
      data: { farmId: user.farm!.id, landPrice: quote.marketValue },
    });
    return tx.user.findUnique({
      where: { id: user.id },
      include: { farm: { include: farmInclude() } },
    });
  });
  res.json({
    ...updated,
    paid: quote.total,
    marketValue: quote.marketValue,
    breakdown: quote.breakdown,
    adjacentOwned: quote.adjacentOwnedBorders,
  });
});

/** Devis détaillé avant achat : le joueur voit chaque facteur du prix. */
app.get("/parcels/:id/quote", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const target = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true },
  });
  if (!target) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  const farm = await prisma.farm.findUnique({
    where: { userId: auth.user.id },
    include: { parcels: true },
  });
  const owned = farm?.parcels ?? [];
  const quote = await quoteParcel(target, owned, auth.user.level);
  const gate = canAcquire({
    playerLevel: auth.user.level,
    ownedTotal: owned.length,
    ownedInRegion: owned.filter((p) => p.zoneId === target.zoneId).length,
    regionParcelCount: await prisma.parcel.count({ where: { zoneId: target.zoneId } }),
  });
  res.json({
    ...quote,
    taken: Boolean(target.farmId),
    canAcquire: gate.ok,
    reason: gate.ok ? null : acquisitionRefusal(gate.reason!, auth.user, owned.length),
    caps: LAND_CAPS,
  });
});

/**
 * Le voisinage d'une parcelle : la campagne, telle qu'elle est en base.
 *
 * La vue 3D inventait ses voisins à partir d'une graine — des cultures
 * tirées au sort, des états tirés au sort, des bâtiments tirés au sort. Ces
 * parcelles-là n'avaient pas d'identifiant : on ne pouvait donc ni les
 * regarder vraiment, ni les acheter. Or la carte existe, et trente pour cent
 * de ses parcelles appartiennent déjà à des fermes PNJ qui ont leurs cases
 * semées, leurs étables et leurs troupeaux.
 *
 * Cette route est la jointure. Elle ne simule rien et n'écrit rien : elle rend
 * la trame de la commune autour d'une parcelle, avec de quoi la dessiner et de
 * quoi la convoiter.
 *
 * Le devis accompagne toute parcelle libre ou PNJ du voisinage. L'adjacence
 * pondère le prix (bordures mitoyennes), elle ne verrouille plus l'achat.
 * Les quatre comptages région / continent se font une fois pour la commune.
 */
app.get("/parcels/:id/voisinage", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const rayon = Math.max(1, Math.min(4, Number(req.query.rayon ?? 3) || 3));

  const centre = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true },
  });
  if (!centre) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }

  const [farm, autour] = await Promise.all([
    prisma.farm.findUnique({ where: { userId: auth.user.id }, include: { parcels: true } }),
    prisma.parcel.findMany({
      where: {
        zoneId: centre.zoneId,
        mapX: { gte: centre.mapX - rayon, lte: centre.mapX + rayon },
        mapY: { gte: centre.mapY - rayon, lte: centre.mapY + rayon },
      },
      include: {
        cells: { select: { kind: true, crop: true, fieldStage: true } },
        buildings: {
          select: { id: true, type: true, level: true, originX: true, originY: true, rotation: true },
        },
        farm: {
          select: {
            id: true,
            name: true,
            user: { select: { displayName: true, isNpc: true } },
            herds: { select: { kind: true, size: true, buildingId: true } },
          },
        },
      },
      orderBy: [{ mapY: "asc" }, { mapX: "asc" }],
    }),
  ]);

  const owned = farm?.parcels ?? [];
  const monFarmId = farm?.id ?? null;
  const counts = await loadQuoteCounts(centre.zoneId, centre.zone.continentCode);
  const gate = canAcquire({
    playerLevel: auth.user.level,
    ownedTotal: owned.length,
    ownedInRegion: owned.filter((p) => p.zoneId === centre.zoneId).length,
    regionParcelCount: counts.regionTotal,
  });

  const parcelles = autour.map((p) => {
      const { col, rang } = caseDeTrame(centre, p);
      const statut = statutParcelle(p, p.farm?.user ?? null, monFarmId);
      const champ = resumerChamp(p.cells, p.gridW * p.gridH);
      /*
       * Le cheptel de **cette** parcelle, et non celui de la ferme : un
       * éleveur qui possède trois parcelles n'a pas ses vaches sur les trois.
       * Le troupeau tient à un bâtiment, et le bâtiment à une parcelle.
       */
      const ici = new Set(p.buildings.map((b) => b.id));
      const cheptel = (p.farm?.herds ?? [])
        .filter((h) => ici.has(h.buildingId))
        .map((h) => ({ kind: h.kind, size: h.size }));

      const rachetable = peutRacheter(statut);
      const devis = rachetable ? quoteFromCounts({ ...p, zone: centre.zone }, owned, counts) : null;

      return {
        id: p.id,
        label: p.label,
        col,
        rang,
        mapX: p.mapX,
        mapY: p.mapY,
        gridW: p.gridW,
        gridH: p.gridH,
        fertility: p.fertility,
        accessIndex: p.accessIndex,
        statut,
        proprietaire: p.farm?.user?.displayName ?? null,
        exploitation: p.farm?.name ?? null,
        culture: champ.culture,
        stade: champ.stade,
        partCultivee: champ.partCultivee,
        batiments: p.buildings.map((b) => ({
          type: b.type,
          level: b.level,
          x: b.originX,
          y: b.originY,
          rotation: b.rotation,
        })),
        cheptel,
        landPrice: p.landPrice,
        prix: devis?.total ?? null,
        achetable: Boolean(devis) && gate.ok,
        refus:
          rachetable && !gate.ok
            ? acquisitionRefusal(gate.reason!, auth.user, owned.length)
            : null,
      };
  });

  res.json({
    centre: {
      id: centre.id,
      mapX: centre.mapX,
      mapY: centre.mapY,
      gridW: centre.gridW,
      gridH: centre.gridH,
    },
    zone: {
      code: centre.zone.code,
      name: centre.zone.name,
      mapW: centre.zone.mapW,
      mapH: centre.zone.mapH,
    },
    rayon,
    parcelles,
  });
});

/**
 * Faire venir une entreprise (filet urgent PNJ) : barème client +15 %,
 * malus de rendement, l'argent sort. Aucun matériel requis côté joueur.
 */
app.post("/parcels/:id/contractor", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      // La liste vit dans `shared` : l'écran s'en sert pour décider s'il
      // propose le bouton, la route pour décider si elle l'accepte.
      work: z.enum(URGENT_CONTRACTOR_WORKS),
      crop: z.enum(CROP_CODES).optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const { work, cells, crop } = body.data;

  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true, cells: true, zone: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }

  // La même fonction que le bouton : c'est ce qui garantit que le prix
  // affiché est le prix débité. Ils divergeaient de la valeur des semences.
  const { service, supplies: seeds, total } = contractorTotal(work, cells.length, crop);
  if (!peutPayer(user, total)) {
    res.status(402).json({ error: `€ insuffisants — ${total} requis` });
    return;
  }

  const bonuses = await getFarmBonuses(parcel.farm.id);
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: parcel.zone.code },
  });
  const now = Date.now();

  if (work === "PLANT") {
    if (!crop) {
      res.status(400).json({ error: "Culture requise pour un semis" });
      return;
    }
    const sol = planSemisLot(cells, parcel.cells);
    if (!sol.ok) {
      res.status(409).json({ error: sol.error });
      return;
    }
    const growMs = cropGrowMs(crop, 0);
    const climat = climatDe(parcel);
    const fenetre = canSowInSeason(crop, currentSeason(climat.hemisphere ?? "N", now));
    if (!fenetre.ok) {
      // L'entreprise ne sème pas hors saison non plus : la payer pour
      // contourner le calendrier viderait la règle de son sens.
      res.status(409).json({ error: fenetre.reason, window: fenetre.window });
      return;
    }
    const pretLe = projectReadyAt({ crop, plantedAt: now, growMs, ...climat });
    const enDirect = sol.plans.some((p) => p.directSeed);
    await prisma.$transaction(async (tx) => {
      await debit(tx, user.id, total, "CHANTIERS", "Prestataire — moisson");
      for (const plan of sol.plans) {
        const soil = plan.directSeed ? applyDirectSeed(plan.cell) : null;
        await tx.parcelCell.update({
          where: { parcelId_x_y: { parcelId: parcel.id, x: plan.x, y: plan.y } },
          data: {
            kind: "CROP",
            crop,
            fieldStage: "PLANTED",
            plantedAt: new Date(now),
            readyAt: new Date(pretLe),
            fertilizedPasses: 0,
            weedAt: new Date(now),
            weedPressure: weedsAtSowing({
              carried: plan.directSeed
                ? weedsAfterSoilWork("DIRECT_SEED", plan.cell.weedPressure ?? 0)
                : (plan.cell.weedPressure ?? 0),
              sameCropAgain: plan.cell.lastCrop === crop,
            }),
            directSeeded: plan.directSeed,
            ...(soil
              ? {
                  harvestsSincePlow: soil.harvestsSincePlow,
                  residuePasses: soil.residuePasses,
                  hasStubble: soil.hasStubble,
                }
              : {}),
          },
        });
      }
      if (enDirect) {
        await tx.parcel.update({
          where: { id: parcel.id },
          data: { fertility: Math.min(1, parcel.fertility + DIRECT_SEED_FERTILITY_GAIN) },
        });
      }
    });
    res.json({ work, cells: cells.length, cost: total, service, seeds });
    return;
  }

  if (work === "PLOW") {
    const lost = cells
      .map(({ x, y }) => parcel.cells.find((c) => c.x === x && c.y === y))
      .filter((c): c is NonNullable<typeof c> => {
        if (!c || c.kind !== "CROP" || !c.crop || !c.plantedAt) return false;
        const grow = cropGrowMs(c.crop, grassCutsDone(c));
        return ripenessAt(c.plantedAt.getTime() + grow, grow, now).needsPlowing;
      });
    if (!lost.length) {
      res.status(409).json({ error: "Aucune culture perdue à labourer ici" });
      return;
    }
    const malus = LOST_CROP_FERTILITY_MALUS * lost.length;
    await prisma.$transaction(async (tx) => {
      await debit(tx, user.id, total, "CHANTIERS", "Prestataire — pressage");
      for (const cell of lost) {
        await tx.parcelCell.update({
          where: { id: cell.id },
          data: {
            kind: "EMPTY",
            crop: null,
            fieldStage: "PREPARED",
            plantedAt: null,
            readyAt: null,
            fertilizedPasses: 0,
            weedPressure: 0,
          },
        });
      }
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { fertility: Math.max(0.2, parcel.fertility - malus) },
      });
    });
    res.json({ work, cells: lost.length, cost: total, service, seeds: 0 });
    return;
  }

  if (work === "FERTILIZE") {
    const cropCells = cells.filter(({ x, y }) => {
      const cell = parcel.cells.find((c) => c.x === x && c.y === y);
      return cell && cell.kind === "CROP" && cell.fertilizedPasses < 2;
    });
    const needed = manureNeededForCells(cropCells.length);
    const available = await parcelManureTons(parcel.id);
    const usedManure = needed > 0 && available >= needed;
    await prisma.$transaction(async (tx) => {
      await debit(tx, user.id, total, "CHANTIERS", "Prestataire — ramassage");
      if (usedManure) await drawManureFromPits(tx, parcel.id, needed);
      for (const { x, y } of cropCells) {
        const cell = parcel.cells.find((c) => c.x === x && c.y === y);
        if (!cell) continue;
        await tx.parcelCell.update({
          where: { parcelId_x_y: { parcelId: parcel.id, x, y } },
          data: {
            fertilizedPasses: Math.min(2, cell.fertilizedPasses + 1),
            weedPressure: 0,
          },
        });
      }
      if (usedManure && cropCells.length) {
        await tx.parcel.update({
          where: { id: parcel.id },
          data: {
            fertility: Math.min(1, parcel.fertility + MANURE_FERTILITY_GAIN * cropCells.length),
          },
        });
      }
    });
    res.json({
      work,
      cells: cells.length,
      cost: total,
      service,
      seeds: 0,
      usedManure,
    });
    return;
  }

  // HARVEST / MOW — grain au silo, herbe au hangar. L'herbe peut reprendre.
  const ready = cells
    .map(({ x, y }) => parcel.cells.find((c) => c.x === x && c.y === y))
    .filter((c): c is NonNullable<typeof c> => Boolean(c && c.kind === "CROP" && c.plantedAt));
  if (!ready.length) {
    res.status(409).json({ error: "Aucune culture à récolter sur la sélection" });
    return;
  }

  let totalTons = 0;
  let hayTons = 0;
  const perItem = new Map<string, number>();
  const taken: typeof ready = [];
  for (const cell of ready) {
    if (work === "MOW" && !isMowCrop(cell.crop)) continue;
    const sim = simulateCell({
      ...climatDe(parcel),
      crop: cell.crop!,
      plantedAt: cell.plantedAt!.getTime(),
      now,
      fertility: parcel.fertility,
      weedPressure: pressionAdventices(cell, currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now())),
      fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
      buildingYieldBonus:
        bonuses.yieldBonus + pollinationBonusAt(bonuses.hives, cell.x, cell.y, cell.crop),
      skillYieldBonus: bonuses.skills.CROP_YIELD,
      weatherAtHarvest: weather?.state as WeatherState | undefined,
      specialization: playableSpec(user.specialization),
      cutsDone: grassCutsDone(cell),
    });
    if (!sim.ready) continue;
    const tons = sim.estimatedYieldTons * (1 - CONTRACTOR_YIELD_MALUS);
    totalTons += tons;
    const item = harvestItemCode(cell.crop!);
    perItem.set(item, (perItem.get(item) ?? 0) + tons);
    if (item === "HAY") hayTons += tons;
    taken.push(cell);
  }

  if (totalTons <= 0) {
    res.status(409).json({
      error: work === "MOW" ? "Rien à faucher sur la sélection" : "Rien n'est mûr sur la sélection",
    });
    return;
  }

  const moisture = harvestMoisture(weather?.state as WeatherState | undefined);

  await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, total, "CHANTIERS", `Prestataire — ${WORK_LABELS[work] ?? work}`);
    for (const cell of taken) {
      const next = afterTakeField(
        {
          crop: cell.crop!,
          lastCrop: cell.lastCrop,
          cropStreak: cell.cropStreak,
          harvestsSincePlow: cell.harvestsSincePlow,
        },
        now,
      );
      await tx.parcelCell.update({ where: { id: cell.id }, data: next.data });
    }
    for (const [code, tons] of perItem) {
      await addToStock(tx, parcel.farm!.id, code, tons, moisture, 3);
    }
  });

  res.json({
    work,
    cells: taken.length,
    cost: total,
    service,
    seeds: 0,
    totalTons,
    hayTons,
    moisture,
  });
});

/**
 * Mémoire de rotation d'une case, telle que la simulation doit la lire.
 *
 * Les colonnes retiennent ce que la case a **déjà produit**, pas ce qu'elle
 * porte : elles ne sont écrites qu'à la libération de la case, moisson ou
 * culture perdue. Une culture en terre voit donc le précédent qui la concerne,
 * sans avoir à défalquer son propre cycle.
 */
function rotationOf(cell: { lastCrop: CropCode | null; cropStreak: number }): RotationState {
  return { lastCrop: cell.lastCrop, cropStreak: cell.cropStreak };
}

/** Le cycle qui s'achève entre dans la mémoire de la case. */
function rotationUpdate(cell: { lastCrop: CropCode | null; cropStreak: number }, crop: CropCode) {
  const next = nextRotation(rotationOf(cell), crop);
  return { lastCrop: next.lastCrop, cropStreak: next.cropStreak };
}

/** Après une coupe : l'herbe reprend, le grain laisse des chaumes. */
function afterTakeField(
  cell: {
    crop: CropCode;
    lastCrop: CropCode | null;
    cropStreak: number;
    harvestsSincePlow: number;
  },
  now: number,
  silage = false,
  /**
   * Garder l'andain derrière la machine, ou le broyer.
   *
   * Vrai par défaut : c'était le seul comportement possible jusqu'ici, et une
   * valeur par défaut qui prive une ferme existante de sa paille serait une
   * régression silencieuse pour tous les appels qui ne passent pas l'option
   * (prestataire, consignes, missions).
   */
  keepSwath = true,
) {
  const nextCuts = Math.min(MAX_HARVESTS_BEFORE_PLOW, cell.harvestsSincePlow + 1);
  if (isMowCrop(cell.crop) && grassWillRegrow(nextCuts)) {
    return {
      regrow: true as const,
      data: {
        kind: "CROP" as const,
        crop: "GRASS" as CropCode,
        fieldStage: "PLANTED" as const,
        plantedAt: new Date(now),
        readyAt: new Date(now + cropGrowMs("GRASS", nextCuts)),
        fertilizedPasses: 0,
        weedPressure: 0,
        hasStubble: false,
        harvestsSincePlow: nextCuts,
        lastCrop: "GRASS" as CropCode,
        cropStreak: 1,
        strawTons: 0,
        baleCount: 0,
        plantedAsSilage: false,
      },
    };
  }
  // La moisson ne rend pas une case nue : elle laisse des chaumes qu'il faudra
  // déchaumer ou labourer avant de resemer — et un andain de paille. Sauf
  // ensilage : la plante est partie entière, il ne reste rien à presser.
  return {
    regrow: false as const,
    data: {
      kind: "EMPTY" as const,
      crop: null,
      fieldStage: "HARVESTED" as const,
      plantedAt: null,
      readyAt: null,
      fertilizedPasses: 0,
      weedPressure: 0,
      hasStubble: true,
      harvestsSincePlow: nextCuts,
      strawTons: strawYieldFor(cell.crop, silage, keepSwath),
      baleCount: 0,
      plantedAsSilage: false,
      ...rotationUpdate(cell, cell.crop),
    },
  };
}

async function resolveHarvestOrMowAccess(opts: {
  parcelId: string;
  userId: string;
  cells: CellXY[];
}): Promise<FieldAccess> {
  const harvest = await resolveFieldAccess({ ...opts, work: "HARVEST" });
  if (harvest.ok) return harvest;
  const mow = await resolveFieldAccess({ ...opts, work: "MOW" });
  if (mow.ok) return mow;
  return harvest;
}

/**
 * Lancer un chantier.
 *
 * Tout est vérifié ici — l'attelage, les cases, la saison — pour que le joueur
 * sache tout de suite si son champ partira, plutôt qu'au bout de sept minutes
 * d'attente.
 */
/**
 * Y a-t-il seulement de quoi travailler sur ces cases ?
 *
 * Le sas vérifiait l'accès, les conflits, la fenêtre de semis, l'attelage et
 * le gazole — tout sauf **la seule chose que le joueur regarde**. On pouvait
 * donc lancer un labour sur de la terre nue : le chantier partait, l'engin
 * traversait le champ, et sept minutes plus tard la route de labour répondait
 * « rien à labourer ». Le refus était juste, il arrivait simplement après le
 * travail.
 *
 * Ne sont traités ici que les cas où l'on peut conclure **sans simuler** :
 * le labour et le désherbage. Les autres travaux gardent leur refus tardif,
 * dont le gazole est désormais rendu.
 *
 * Renvoie `null` quand il y a de quoi faire, ou la phrase du refus.
 */
function sowingRefusalFr(x: number, y: number, reason: SowingPlanRefusal): string {
  if (reason === "OCCUPIED") return `Case ${x},${y} non libre`;
  if (reason === "PLOW_REQUIRED") {
    return `Case ${x},${y} : sol trop tassé — le semis direct ne décompacte pas, il faut labourer`;
  }
  return `Case ${x},${y} : pas de chaumes — semez normalement`;
}

type SowableCell = {
  x: number;
  y: number;
  kind: string;
  hasStubble: boolean;
  harvestsSincePlow: number;
  residuePasses: number;
  weedPressure?: number;
  lastCrop?: string | null;
};

/**
 * Décision de semis, case par case.
 *
 * Le prestataire et le joueur lisaient deux règles : l'un plantait sur les
 * chaumes, l'autre se faisait renvoyer après le chantier. Une seule fonction
 * tranche, et les deux routes s'y tiennent.
 */
function planSemisLot(
  cells: CellXY[],
  parcelCells: SowableCell[],
):
  | { ok: true; plans: { x: number; y: number; directSeed: boolean; cell: SowableCell }[] }
  | { ok: false; error: string } {
  const plans: { x: number; y: number; directSeed: boolean; cell: SowableCell }[] = [];
  for (const { x, y } of cells) {
    const cell = parcelCells.find((c) => c.x === x && c.y === y);
    if (!cell) return { ok: false, error: `Case ${x},${y} non libre` };
    const plan = sowingPlan(cell);
    if (!plan.ok) return { ok: false, error: sowingRefusalFr(x, y, plan.reason) };
    plans.push({ x, y, directSeed: plan.directSeed, cell });
  }
  return { ok: true, plans };
}

function rienAFaire(
  work: FarmWork,
  cells: CellXY[],
  parcel: { cells: { x: number; y: number; kind: string; hasStubble: boolean; fieldStage: string }[] },
  season?: Season,
): string | null {
  const vues = cells
    .map(({ x, y }) => parcel.cells.find((c) => c.x === x && c.y === y))
    .filter(Boolean) as (typeof parcel.cells)[number][];

  if (work === "PLOW") {
    // Même règle que la route de labour : chaumes, culture perdue, ou sol qui
    // réclame la charrue. Ce qui suit ne dépend que de l'état stocké.
    const bons = vues.filter(
      (c) => c.hasStubble || c.fieldStage === "SPOILED" || c.kind === "CROP",
    );
    if (bons.length) return null;
    const ailleurs = parcel.cells.filter((c) => c.hasStubble || c.fieldStage === "SPOILED").length;
    return ailleurs
      ? `Rien à labourer dans la sélection — ${ailleurs} case(s) attendent la charrue ailleurs sur la parcelle`
      : "Rien à labourer : aucune case ne porte de chaumes ni de culture perdue";
  }

  if (work === "WEED") {
    const bons = vues.filter(
      (c) => c.kind === "CROP" && pressionAdventices(c as never, season) > WEED_AFTER_SPRAY,
    );
    if (bons.length) return null;
    return "Rien à désherber : ces cases sont déjà propres.";
  }

  if (work === "PLANT") {
    const bons = vues.filter((c) => c.kind === "EMPTY");
    if (bons.length) return null;
    return "Rien à semer : ces cases ne sont pas libres.";
  }

  return null;
}

app.post("/parcels/:id/jobs", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      work: z.enum(["PLANT", "FERTILIZE", "HARVEST", "PLOW", "STUBBLE", "MOW", "BALE", "COLLECT", "SILAGE", "WEED"]),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
      crop: z.enum(CROP_CODES).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const { work, cells: demandees, crop } = body.data;
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work,
    cells: demandees,
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  const parcel = access.parcel;

  /*
   * Une case déjà réservée ne part pas deux fois — mais elle ne fait pas
   * capoter le reste.
   *
   * Le refus portait sur le lot entier : une seule case retenue ailleurs, et
   * la sélection de soixante-treize était rejetée, à charge pour le joueur de
   * deviner laquelle retirer. « Si j'ai quelque chose en cours, ignore les
   * cases concernées » — c'est la seule issue qui ne demande rien à personne.
   * On garde ce qui peut partir, on dit combien on a laissé.
   */
  await libererChantiersAbandonnes(parcel.id);
  const pris = await occupiedJobCells(parcel.id);
  const cells = demandees.filter((c) => !pris.has(`${c.x},${c.y}`));
  const ignorees = demandees.length - cells.length;
  if (!cells.length) {
    res.status(409).json({
      error:
        demandees.length === 1
          ? "Cette case est déjà sur un chantier en cours."
          : "Toutes ces cases sont déjà sur un chantier en cours.",
      skipped: ignorees,
    });
    return;
  }

  if (work === "PLANT") {
    if (!crop) {
      res.status(400).json({ error: "Culture manquante" });
      return;
    }
    const saison = currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now());
    const fenetre = canSowInSeason(crop, saison);
    if (!fenetre.ok) {
      res.status(409).json({ error: fenetre.reason, window: fenetre.window, season: saison });
      return;
    }
    // Sol : on refuse tout de suite, pas après le chrono. Semer sur des
    // chaumes part en semis direct ; un sol trop tassé, lui, demande la charrue.
    const sol = planSemisLot(cells, parcel.cells);
    if (!sol.ok) {
      res.status(409).json({ error: sol.error });
      return;
    }
  }

  /* Avant l'attelage et avant le plein : un chantier qui n'a rien à faire ne
     doit pas partir. Le refus existait déjà, il arrivait après le travail. */
  const vide = rienAFaire(
    work,
    cells,
    parcel,
    currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now()),
  );
  if (vide) {
    res.status(409).json({ error: vide });
    return;
  }

  const picked = pickMachineForWork(access.machines, work);
  if (!picked) {
    res.status(409).json({ error: explainNoMachine(access.machines, work) });
    return;
  }

  /*
   * Le tour de main du chauffeur se voit sur le chrono et sur la cuve.
   *
   * `WORK_SPEED` et `FUEL_USE` sont des fractions **retirées** : une conduite
   * économe ne rend pas le gazole gratuit, elle en brûle moins. Les deux
   * plafonds valent 15 et 20 %, ce qui laisse la largeur de travail décider de
   * l'essentiel — c'est le matériel qui fait le rendement, pas l'habitude.
   */
  const competences = await getSkillBonuses(body.data.userId);
  const duree = Math.max(
    1,
    Math.round(dureeChantier(picked, cells.length) * (1 - competences.WORK_SPEED)),
  );
  /* Le plein se fait au départ, pas à l'arrivée : le gazole part dans le
     réservoir au moment où l'engin quitte la cour. Un chantier abandonné le
     rend, puisqu'il n'a rien brûlé. */
  const gazole = gazoleChantier(picked, cells.length) * (1 - competences.FUEL_USE);
  const cuve = await prisma.farm.findUnique({
    where: { id: parcel.farmId! },
    select: { fuelL: true },
  });
  if ((cuve?.fuelL ?? 0) < gazole) {
    res.status(409).json({
      error: `Pas assez de gazole — ${Math.ceil(gazole)} L nécessaires, ${Math.floor(cuve?.fuelL ?? 0)} L en cuve.`,
      needL: Math.ceil(gazole),
      haveL: Math.floor(cuve?.fuelL ?? 0),
    });
    return;
  }
  const endsAt = new Date(Date.now() + duree);
  const job = await prisma.$transaction(async (tx) => {
    await tx.farm.update({
      where: { id: parcel.farmId! },
      data: { fuelL: { decrement: gazole } },
    });
    const created = await tx.fieldJob.create({
      data: {
        parcelId: parcel.id,
        userId: body.data.userId,
        work,
        cellsJson: JSON.stringify(cells),
        crop: crop ?? null,
        machineId: picked.machine.id,
        tractorId: picked.tractor?.id ?? null,
        fuelL: gazole,
        endsAt,
      },
    });
    // L'attelage part au champ : il ne peut ni repartir sur un autre travail,
    // ni se vendre pendant ce temps-là.
    const ids = [picked.machine.id, picked.tractor?.id].filter(Boolean) as string[];
    await tx.machine.updateMany({ where: { id: { in: ids } }, data: { busyUntil: endsAt } });
    return created;
  });

  res.status(201).json({
    job: {
      id: job.id,
      work,
      // Les cases **retenues**, qui ne sont pas forcément celles demandées :
      // c'est cette liste-là que la route de travail acceptera.
      cells,
      skipped: ignorees,
      crop: crop ?? null,
      endsAt: job.endsAt,
      durationMs: duree,
      fuelL: gazole,
      machine: { id: picked.machine.id, type: picked.machine.type, tier: picked.tier },
      tractor: picked.tractor ? { id: picked.tractor.id, type: picked.tractor.type } : null,
    },
  });
});

/**
 * Remplir la cuve.
 *
 * Le prix suit la région, comme le reste : une ferme éloignée paie son gazole
 * plus cher, et c'est la même logique que pour les cours.
 */
app.post("/farm/fuel", async (req, res) => {
  const body = z
    .object({ userId: z.string(), liters: z.number().positive().max(FUEL_TANK_L) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { parcels: { include: { zone: true } } } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  // On ne verse pas à côté : la commande est ramenée à ce qui tient en cuve.
  const place = Math.max(0, FUEL_TANK_L - user.farm.fuelL);
  const litres = Math.min(body.data.liters, place);
  if (litres <= 0) {
    res.status(409).json({ error: "Cuve déjà pleine" });
    return;
  }
  const mult = user.farm.parcels[0]?.zone?.priceMult ?? 1;
  const cout = fuelCost(litres, mult);
  if (!peutPayer(user, cout)) {
    res.status(402).json({ error: `€ insuffisants — ${cout} requis` });
    return;
  }
  const apres = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, cout, "MACHINES", `Gazole — ${Math.round(litres)} L`);
    return tx.farm.update({
      where: { id: user.farm!.id },
      data: { fuelL: { increment: litres } },
    });
  });
  res.json({ fuelL: apres.fuelL, liters: litres, cost: cout });
});

/** L'état de la ligne de crédit, tel que le Bureau le montre. */
/**
 * Ce que font les ateliers, et si ça vaut le coup aujourd'hui.
 *
 * La marge est le seul chiffre qui compte : sans elle, le joueur ne peut pas
 * savoir que sa laiterie travaille à perte parce que le lait a flambé.
 */
app.get("/farm/processing", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      farm: {
        include: {
          inventory: true,
          parcels: { include: { buildings: true } },
        },
      },
    },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const prix = await prisma.marketPrice.findMany();
  const cours = (code: string) => prix.find((p) => p.commodity === code)?.price ?? 0;
  const ateliers = user.farm.parcels
    .flatMap((p) => p.buildings)
    .filter((b) => BUILDING_DEFS[b.type as BuildingType].processing)
    .map((b) => {
      const kind = BUILDING_DEFS[b.type as BuildingType].processing!;
      const recette = RECIPES[kind];
      const perDay = processingThroughput(b.type as BuildingType, b.level);
      const stockIn = user.farm!.inventory.find((i) => i.itemCode === recette.input)?.qty ?? 0;
      const inputPrice = cours(recette.input);
      const outputPrice = cours(recette.output);
      return {
        buildingId: b.id,
        kind,
        name: recette.name,
        level: b.level,
        input: recette.input,
        output: recette.output,
        ratio: recette.ratio,
        perDay,
        stockIn: Math.round(stockIn * 100) / 100,
        inputPrice,
        outputPrice,
        margin: processingMargin({ kind, inputPrice, outputPrice }),
        // Ce qu'il reste à traiter au rythme du bâtiment : « trois jours de
        // travail devant elle » se lit mieux qu'un débit par jour.
        daysOfWork: Math.round((stockIn / Math.max(0.01, perDay)) * 10) / 10,
      };
    });
  res.json({ ateliers });
});

app.get("/farm/credit", async (req, res) => {
  const userId = String(req.query.userId ?? "");
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  const bilan = await capitauxPropres(userId);
  res.json({
    ...bilan,
    ceiling: creditCeiling(bilan.equity),
    room: borrowingRoom({ equity: bilan.equity, debtCrd: bilan.debtCrd }),
    seasonInterest: seasonInterest(bilan.debtCrd),
    health: creditHealth({ equity: bilan.equity, debtCrd: bilan.debtCrd }),
  });
});

/** Tirer sur la ligne. */
app.post("/farm/loan", async (req, res) => {
  const body = z
    .object({ userId: z.string(), amount: z.number().min(LOAN_MIN_CRD).max(1_000_000) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const bilan = await capitauxPropres(body.data.userId);
  const room = borrowingRoom({ equity: bilan.equity, debtCrd: bilan.debtCrd });
  if (body.data.amount > room) {
    res.status(409).json({
      error: `La banque s'arrête à ${Math.floor(room)} € — vos capitaux propres ne portent pas davantage.`,
      room,
      ceiling: creditCeiling(bilan.equity),
    });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: true },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const apres = await prisma.$transaction(async (tx) => {
    await crediter(tx, user.id, body.data.amount, "BANQUE", "Tirage sur la ligne de crédit");
    return tx.farm.update({
      where: { id: user.farm!.id },
      // La date d'arrêté part de maintenant : les intérêts ne courent pas sur
      // un capital qui n'était pas encore prêté.
      data: { debtCrd: { increment: body.data.amount }, debtAt: new Date() },
    });
  });
  res.status(201).json({ debtCrd: apres.debtCrd, borrowed: body.data.amount });
});

/** Rembourser, en tout ou en partie. */
app.post("/farm/repay", async (req, res) => {
  const body = z
    .object({ userId: z.string(), amount: z.number().positive().max(1_000_000) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: true },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  if (user.farm.debtCrd <= 0) {
    res.status(409).json({ error: "Rien à rembourser" });
    return;
  }
  // On ne rembourse jamais plus qu'on ne doit, ni plus qu'on n'a.
  const montant = Math.min(body.data.amount, user.farm.debtCrd, user.crd);
  if (montant <= 0) {
    res.status(402).json({ error: "€ insuffisants" });
    return;
  }
  const apres = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, montant, "BANQUE", "Remboursement de la ligne de crédit");
    return tx.farm.update({
      where: { id: user.farm!.id },
      data: { debtCrd: { decrement: montant }, debtAt: new Date() },
    });
  });
  res.json({ debtCrd: Math.max(0, apres.debtCrd), repaid: montant });
});

/**
 * L'arbre de compétences d'un joueur, tel qu'il s'affiche.
 *
 * Le serveur envoie l'état **calculé**, pas les définitions : l'écran ne
 * refait aucun calcul, il dessine. C'est ce qui garantit qu'un joueur ne voit
 * jamais « débloquée » une compétence que le serveur tient pour fermée — le
 * défaut classique d'un arbre qui vit des deux côtés.
 */
/** Les compétences dont une condition dépend — pour dessiner les liens. */
function prerequisSkills(cond: unknown): string[] {
  if (!cond || typeof cond !== "object") return [];
  const c = cond as { kind?: string; skill?: string; of?: unknown[] };
  if (c.kind === "skill" && c.skill) return [c.skill];
  return (c.of ?? []).flatMap((sous) => prerequisSkills(sous));
}

app.get("/players/:id/skills", async (req, res) => {
  const snap = await getSkillSnapshot(req.params.id);
  const states = evaluateSkills(snap, (s) => STAT_LABELS[s] ?? String(s));
  res.json({
    skills: states.map((s) => ({
      id: s.def.id,
      name: s.def.name,
      description: s.def.description,
      branch: s.def.branch,
      tier: s.def.tier,
      icon: s.def.icon,
      // Les prérequis remontent tels quels : c'est ce qui permet à l'écran de
      // tracer les liens de l'arbre sans reconstruire les conditions.
      requires: prerequisSkills(s.def.condition),
      unlocked: s.unlocked,
      ratio: Math.round(s.ratio * 1000) / 1000,
      effects: s.def.effects,
      progress: s.progress,
    })),
    bonuses: bonusesFor(snap),
  });
});

/** Les chantiers en cours d'une parcelle — pour l'écran et les reprises. */
app.get("/parcels/:id/jobs", async (req, res) => {
  await libererChantiersAbandonnes(req.params.id);
  const jobs = await prisma.fieldJob.findMany({
    where: { parcelId: req.params.id, status: "RUNNING" },
    orderBy: { endsAt: "asc" },
  });
  res.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      work: j.work,
      crop: j.crop,
      cells: parseCellJson(j.cellsJson),
      startedAt: j.startedAt,
      endsAt: j.endsAt,
    })),
  });
});

/** Abandonner un chantier — l'attelage rentre, rien n'a été fait. */
app.post("/jobs/:id/cancel", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const job = await prisma.fieldJob.findUnique({ where: { id: req.params.id } });
  if (!job || job.userId !== body.data.userId) {
    res.status(404).json({ error: "Chantier introuvable" });
    return;
  }
  if (job.status !== "RUNNING") {
    res.status(409).json({ error: "Chantier déjà terminé" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.fieldJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
    const ids = [job.machineId, job.tractorId].filter(Boolean) as string[];
    await tx.machine.updateMany({ where: { id: { in: ids } }, data: { busyUntil: null } });
    // Le plein retourne à la cuve : l'engin n'est pas parti.
    const parcelle = await tx.parcel.findUnique({ where: { id: job.parcelId } });
    if (parcelle?.farmId && job.fuelL > 0) {
      await tx.farm.update({
        where: { id: parcelle.farmId },
        data: { fuelL: { increment: job.fuelL } },
      });
    }
  });
  res.json({ cancelled: job.id, fuelBackL: job.fuelL });
});

app.post("/parcels/:id/plant", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      crop: z.enum(CROP_CODES),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
      /** Semer dans les chaumes, sans travail du sol préalable */
      directSeed: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "PLANT",
    cells: body.data.cells,
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["PLANT"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const picked = pickMachineForWork(access.machines, "PLANT");
  if (!picked) {
    res.status(409).json({
      error: explainNoMachine(access.machines, "PLANT"),
    });
    return;
  }
  const plantCrop =
    isCropCode(access.order?.crop) ? access.order.crop : body.data.crop;
  if (access.order?.crop && access.order.crop !== body.data.crop) {
    res.status(409).json({ error: `Ce travail demande du ${access.order.crop}` });
    return;
  }
  const sol = planSemisLot(body.data.cells, parcel.cells);
  if (!sol.ok) {
    res.status(409).json({ error: sol.error });
    return;
  }
  const seedCost = CROP_DEFS[plantCrop].seedCostPerCell * body.data.cells.length;
  const directCells = sol.plans.filter((p) => p.directSeed).length;
  const cost = seedCost + DIRECT_SEED_COST_PER_CELL * directCells;
  if (access.charge && !peutPayer(user, cost)) {
    res.status(402).json({ error: "€ insuffisants pour semences" });
    return;
  }

  const now = Date.now();
  const growMs = cropGrowMs(plantCrop, 0);
  /* Le calendrier cultural. La saison décide de deux choses : si l'on a le
     droit de semer, et à quelle vitesse ça poussera. La date de maturité
     n'est donc plus `now + growMs` mais une projection — exacte, parce que
     météo et saison sont des fonctions pures du calendrier. */
  const climat = climatDe(parcel);
  const saison = currentSeason(climat.hemisphere ?? "N", now);
  const fenetre = canSowInSeason(plantCrop, saison);
  if (!fenetre.ok) {
    res.status(409).json({ error: fenetre.reason, window: fenetre.window, season: saison });
    return;
  }
  const pretLe = projectReadyAt({ crop: plantCrop, plantedAt: now, growMs, ...climat });
  const last = body.data.cells[body.data.cells.length - 1];
  const { wear, labor, gain } = await prisma.$transaction(async (tx) => {
    if (access.charge) {
      await debit(tx, user.id, cost, "CULTURES", "Semences");
    }
    for (const plan of sol.plans) {
      const cell = plan.cell;
      // Le semis direct perce les chaumes : la case est semée sans qu'aucun
      // outil ne soit passé, et le sol garde son tassement.
      const soil = plan.directSeed ? applyDirectSeed(cell) : null;
      await tx.parcelCell.update({
        where: { parcelId_x_y: { parcelId: parcel.id, x: plan.x, y: plan.y } },
        data: {
          kind: "CROP",
          crop: plantCrop,
          fieldStage: "PLANTED",
          plantedAt: new Date(now),
          readyAt: new Date(pretLe),
          fertilizedPasses: 0,
          /* Ce que le précédent lègue. Sans travail du sol, les graines
             d'adventices restent en place : c'est le vrai coût agronomique du
             semis direct, et il manquait. */
          weedAt: new Date(now),
          weedPressure: weedsAtSowing({
            carried: plan.directSeed
              ? weedsAfterSoilWork("DIRECT_SEED", cell.weedPressure ?? 0)
              : (cell.weedPressure ?? 0),
            sameCropAgain: cell.lastCrop === plantCrop,
          }),
          directSeeded: plan.directSeed,
          ...(soil
            ? {
                harvestsSincePlow: soil.harvestsSincePlow,
                residuePasses: soil.residuePasses,
                hasStubble: soil.hasStubble,
              }
            : {}),
        },
      });
    }
    if (directCells) {
      // La couverture permanente protège de l'érosion : le sol s'en trouve un
      // peu mieux, ce qui compense en partie la perte de rendement.
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { fertility: Math.min(1, parcel.fertility + DIRECT_SEED_FERTILITY_GAIN) },
      });
    }
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells: body.data.cells.length,
      work: "PLANT",
      specialization: user.specialization,
    });
    const labor = access.order
      ? await settleLaborProgress(tx, access.order, body.data.cells)
      : null;
    // Le travail se paie en expérience, à la case. C'est ce qui manquait :
    // l'XP ne tombait que sur trois gestes forfaitaires, jamais sur le champ.
    const gain = await grantXp(
      tx,
      user.id,
      "PLANT",
      { cells: body.data.cells.length },
      { cellsPlanted: body.data.cells.length },
    );
    return { wear, labor, gain };
  });
  await touchFieldPresence(user.id, parcel.id, last);
  res.json({
    parcel: await prisma.parcel.findUnique({
      where: { id: parcel.id },
      include: { cells: true, buildings: true },
    }),
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
    labor,
    gain,
    directSeeded: directCells > 0,
  });
});

app.post("/parcels/:id/fertilize", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "FERTILIZE",
    cells: body.data.cells,
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["FERTILIZE"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  const picked = pickMachineForWork(access.machines, "FERTILIZE");
  if (!picked) {
    res.status(409).json({
      error: explainNoMachine(access.machines, "FERTILIZE"),
    });
    return;
  }
  const eligible = body.data.cells.filter(({ x, y }) => {
    const cell = parcel.cells.find((c) => c.x === x && c.y === y);
    return Boolean(cell && cell.kind === "CROP" && cell.fertilizedPasses < 2);
  });
  const needed = manureNeededForCells(eligible.length);
  const available = await parcelManureTons(parcel.id);
  const usedManure = needed > 0 && available >= needed;
  const cost = usedManure || !access.charge ? 0 : 10 * body.data.cells.length;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || (access.charge && !peutPayer(user, cost))) {
    res.status(402).json({ error: "€ insuffisants" });
    return;
  }
  let fertilized = 0;
  const last = body.data.cells[body.data.cells.length - 1];
  const { wear, labor, gain } = await prisma.$transaction(async (tx) => {
    if (access.charge && cost > 0) {
      await debit(tx, user.id, cost, "CULTURES", "Fertilisation");
    }
    if (usedManure) await drawManureFromPits(tx, parcel.id, needed);
    for (const { x, y } of body.data.cells) {
      const cell = parcel.cells.find((c) => c.x === x && c.y === y);
      if (!cell || cell.kind !== "CROP" || cell.fertilizedPasses >= 2) continue;
      await tx.parcelCell.update({
        where: { id: cell.id },
        // La fertilisation ne désherbe plus au passage : c'était la confusion
        // de deux opérations réelles distinctes, épandeur et pulvérisateur.
        data: { fertilizedPasses: { increment: 1 } },
      });
      fertilized += 1;
    }
    if (usedManure && fertilized > 0) {
      await tx.parcel.update({
        where: { id: parcel.id },
        data: {
          fertility: Math.min(1, parcel.fertility + MANURE_FERTILITY_GAIN * fertilized),
        },
      });
    }
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells: Math.max(1, fertilized),
      work: "FERTILIZE",
      specialization: user.specialization,
    });
    const labor = access.order
      ? await settleLaborProgress(tx, access.order, body.data.cells)
      : null;
    // Le travail se paie en expérience, à la case. C'est ce qui manquait :
    // l'XP ne tombait que sur trois gestes forfaitaires, jamais sur le champ.
    const gain = await grantXp(
      tx,
      user.id,
      "FERTILIZE",
      { cells: body.data.cells.length },
      { cellsFertilized: body.data.cells.length },
    );
    return { wear, labor, gain };
  });
  await touchFieldPresence(user.id, parcel.id, last);
  res.json({
    ok: true,
    fertilized,
    usedManure,
    manureTons: usedManure ? needed : 0,
    cost,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
    labor,
    gain,
  });
});

/**
 * Labour : la seule façon de libérer une case dont la culture est perdue.
 * Le sol s'appauvrit un peu au passage — laisser pourrir une récolte se paie
 * au-delà de la récolte elle-même.
 */
app.post("/parcels/:id/plow", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "PLOW",
    cells: body.data.cells ?? [],
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["PLOW"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  const picked = pickMachineForWork(access.machines, "PLOW");
  if (!picked) {
    res.status(409).json({
      error: explainNoMachine(access.machines, "PLOW"),
    });
    return;
  }

  const now = Date.now();
  const remaining = access.order ? parseCellJson(access.order.remainingJson) : null;
  // La charrue traite deux situations : les chaumes après moisson, et les
  // cultures perdues qu'on ne peut plus récolter.
  const candidates = (
    body.data.cells
      ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
      : remaining
        ? parcel.cells.filter((c) => remaining.some((t) => t.x === c.x && t.y === c.y))
        : parcel.cells
  ).filter((cell) => {
    if (cell.hasStubble) return true;
    // Une case qui a atteint la limite de récoltes réclame la charrue, même
    // sans chaumes visibles : la refuser enfermerait le joueur, puisque le
    // déchaumage et le semis direct la refusent déjà pour la même raison.
    if (cell.kind === "EMPTY" && plowRequired(cell)) return true;
    if (cell.fieldStage === "SPOILED") return true;
    if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) return false;
    const grow = cropGrowMs(cell.crop, grassCutsDone(cell));
    const readyAt = cell.plantedAt.getTime() + grow;
    return ripenessAt(readyAt, grow, now).needsPlowing;
  });

  if (!candidates.length) {
    // Dire ce qui n'est pas labourable ne sert à rien : le joueur veut savoir
    // où aller. On lui indique donc ce qui, ailleurs sur la parcelle, l'est.
    const elsewhere = parcel.cells.filter(
      (c) => c.hasStubble || c.fieldStage === "SPOILED" || (c.kind === "EMPTY" && plowRequired(c)),
    ).length;
    res.status(409).json({
      error: elsewhere
        ? `Rien à labourer dans la sélection — ${elsewhere} case(s) attendent la charrue ailleurs sur la parcelle`
        : "Rien à labourer : aucune case ne porte de chaumes ni de culture perdue",
    });
    return;
  }

  const lostCount = candidates.filter((c) => c.kind === "CROP").length;
  const cost = PLOW_COST_PER_CELL_SOIL * candidates.length;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || (access.charge && !peutPayer(user, cost))) {
    res.status(402).json({ error: `€ insuffisants — ${cost} requis` });
    return;
  }

  // Un labour d'entretien décompacte et enfouit les adventices ; seules les
  // cultures perdues coûtent de la fertilité.
  const malus =
    LOST_CROP_FERTILITY_MALUS * lostCount -
    PLOW_FERTILITY_GAIN * (candidates.length - lostCount);
  const worked = candidates.map((c) => ({ x: c.x, y: c.y }));
  const { wear, labor, gain } = await prisma.$transaction(async (tx) => {
    if (access.charge) {
      await debit(tx, user.id, cost, "CULTURES", "Labour");
    }
    for (const cell of candidates) {
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          kind: "EMPTY",
          crop: null,
          fieldStage: "PREPARED",
          plantedAt: null,
          readyAt: null,
          fertilizedPasses: 0,
          /* Le labour enfouit tout. `soil.ts` l'affirmait déjà — « il
             décompacte et enfouit la pression d'adventices » — sans que rien
             ne l'implémente. */
          weedPressure: WEED_AFTER_PLOW,
          weedAt: new Date(),
          hasStubble: false,
          harvestsSincePlow: 0,
          residuePasses: 0,
        },
      });
    }
    await tx.parcel.update({
      where: { id: parcel.id },
      data: { fertility: Math.max(0.2, Math.min(0.99, parcel.fertility - malus)) },
    });
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells: candidates.length,
      work: "PLOW",
      specialization: user.specialization,
    });
    const labor = access.order ? await settleLaborProgress(tx, access.order, worked) : null;
    // Le travail se paie en expérience, à la case. C'est ce qui manquait :
    // l'XP ne tombait que sur trois gestes forfaitaires, jamais sur le champ.
    const gain = await grantXp(
      tx,
      user.id,
      "PLOW",
      { cells: candidates.length },
      { cellsPlowed: candidates.length },
    );
    return { wear, labor, gain };
  });

  await touchFieldPresence(user.id, parcel.id, worked[worked.length - 1]);
  res.json({
    plowed: candidates.length,
    lostCleared: lostCount,
    cost: access.charge ? cost : 0,
    fertilityDelta: Math.round(-malus * 1000) / 1000,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
    labor,
    gain,
  });
});

/**
 * Déchaumage : travail superficiel qui incorpore les résidus de la récolte
 * précédente. Moins cher que le labour, il bonifie la culture suivante, mais
 * il ne remet pas le compteur à zéro — au bout de trois récoltes, il refuse.
 */
app.post("/parcels/:id/stubble", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "STUBBLE",
    cells: body.data.cells ?? [],
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["STUBBLE"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  const picked = pickMachineForWork(access.machines, "STUBBLE");
  if (!picked) {
    res.status(409).json({
      error: explainNoMachine(access.machines, "STUBBLE"),
    });
    return;
  }

  const remaining = access.order ? parseCellJson(access.order.remainingJson) : null;
  const selection = body.data.cells
    ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
    : remaining
      ? parcel.cells.filter((c) => remaining.some((t) => t.x === c.x && t.y === c.y))
      : parcel.cells;

  const targets: (typeof selection)[number][] = [];
  /**
   * Cases à remettre en herbe : travaillées, nues, sans chaumes.
   *
   * Le même outil, le même bouton. Une terre labourée puis abandonnée restait
   * marron indéfiniment, et « Déchaumer » la refusait avec « la case n'a pas de
   * chaumes » — un refus juste, mais sans issue. Le déchaumeur sait aussi
   * reprendre une terre nue et la remettre en herbe : c'est ce qu'il fait ici.
   */
  const enherber: (typeof selection)[number][] = [];
  let blockedByPlow = 0;
  for (const cell of selection) {
    if (cell.kind !== "EMPTY") continue;
    const verdict = canStubble({
      harvestsSincePlow: cell.harvestsSincePlow,
      residuePasses: cell.residuePasses,
      hasStubble: cell.hasStubble,
    });
    if (verdict.ok) {
      if (cell.baleCount > 0) continue;
      targets.push(cell);
      continue;
    }
    if (verdict.reason === "PLOW_REQUIRED") {
      blockedByPlow += 1;
      continue;
    }
    if (
      canRegrass({
        hasStubble: cell.hasStubble,
        hasCrop: Boolean(cell.crop),
        worked: cell.fieldStage !== "EMPTY",
      })
    ) {
      enherber.push(cell);
    }
  }

  if (!targets.length && !enherber.length) {
    res.status(409).json({
      error: blockedByPlow
        ? SOIL_WORK_REFUSAL_LABELS.PLOW_REQUIRED
        : SOIL_WORK_REFUSAL_LABELS.NO_STUBBLE,
      blockedByPlow,
    });
    return;
  }

  const cost = STUBBLE_COST_PER_CELL * (targets.length + enherber.length);
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || (access.charge && !peutPayer(user, cost))) {
    res.status(402).json({ error: `€ insuffisants — ${cost} requis` });
    return;
  }

  const worked = [...targets, ...enherber].map((c) => ({ x: c.x, y: c.y }));
  const { wear, labor, gain } = await prisma.$transaction(async (tx) => {
    if (access.charge) {
      await debit(tx, user.id, cost, "CULTURES", "Déchaumage");
    }
    for (const cell of enherber) {
      const next = applyRegrass();
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          fieldStage: "EMPTY",
          hasStubble: false,
          strawTons: 0,
          harvestsSincePlow: next.harvestsSincePlow,
          residuePasses: next.residuePasses,
          // L'herbe reprend : la case n'est plus un lit de semence propre.
          weedPressure: 0,
          directSeeded: false,
        },
      });
    }
    for (const cell of targets) {
      const next = applyStubble({
        harvestsSincePlow: cell.harvestsSincePlow,
        residuePasses: cell.residuePasses,
        hasStubble: cell.hasStubble,
      });
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          fieldStage: "PREPARED",
          hasStubble: false,
          strawTons: 0,
          residuePasses: next.residuePasses,
          /* Faux-semis : le déchaumage fait lever les graines puis les détruit
             aussitôt. `soil.ts` l'affirmait déjà en toutes lettres — « il
             détruit les adventices » — sans que rien ne l'implémente. */
          weedPressure: weedsAfterSoilWork("STUBBLE", pressionAdventices(cell)),
          weedAt: new Date(),
        },
      });
    }
    // Remettre en herbe use la machine et paie l'expérience autant que
    // déchaumer : c'est le même passage d'outil sur la même surface.
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells: worked.length,
      work: "STUBBLE",
      specialization: user.specialization,
    });
    const labor = access.order ? await settleLaborProgress(tx, access.order, worked) : null;
    // Le travail se paie en expérience, à la case. C'est ce qui manquait :
    // l'XP ne tombait que sur trois gestes forfaitaires, jamais sur le champ.
    const gain = await grantXp(
      tx,
      user.id,
      "STUBBLE",
      { cells: worked.length },
      { cellsStubbled: worked.length },
    );
    return { wear, labor, gain };
  });

  await touchFieldPresence(user.id, parcel.id, worked[worked.length - 1]);
  res.json({
    stubbled: targets.length,
    regrassed: enherber.length,
    blockedByPlow,
    cost: access.charge ? cost : 0,
    // Sans déchaumage, il n'y a pas de résidus à porter au crédit du semis
    // suivant : annoncer un bonus serait mentir.
    nextBonus: targets.length ? residueBonus(targets[0].residuePasses + 1) : null,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
    labor,
    gain,
  });
});

app.post("/parcels/:id/harvest", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
      mode: z.enum(["GRAIN", "SILAGE"]).optional(),
      /**
       * Laisser l'andain derrière la machine. Absent = on garde, pour que les
       * anciens clients et les appels internes gardent leur comportement.
       */
      swath: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const keepSwath = body.data.swath !== false;
  /**
   * L'ensilage n'est plus un bouton de menu : c'est **la machine qui décide**.
   *
   * Le joueur choisissait « Grain » ou « Ensilage » dans la barre d'outils,
   * alors qu'aux champs on n'ensile pas parce qu'on l'a coché — on ensile
   * parce qu'on a une ensileuse et du maïs. Le mode explicite reste accepté
   * pour les appels internes (missions, consignes) qui, eux, savent ce qu'ils
   * demandent ; sans lui, la décision se prend case par case plus bas.
   */
  const forcedSilage = body.data.mode === "SILAGE";
  const forcedGrain = body.data.mode === "GRAIN";
  // Une même route sert la moisson, la fauche et l'ensilage. La fauche comme
  // l'ensilage se déduisent de ce qui pousse sur la case et de ce qu'on a au
  // hangar : on résout donc l'accès sur la moisson, qui est le cas général.
  const access = forcedSilage
    ? await resolveFieldAccess({
        parcelId: req.params.id,
        userId: body.data.userId,
        work: "SILAGE",
        cells: body.data.cells ?? [],
      })
    : await resolveHarvestOrMowAccess({
        parcelId: req.params.id,
        userId: body.data.userId,
        cells: body.data.cells ?? [],
      });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["HARVEST", "MOW", "SILAGE"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  if (!parcel.farm) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  const farm = parcel.farm;
  // L'ensileuse de la ferme, si elle existe et qu'elle tient debout. C'est
  // elle, et rien d'autre, qui rend l'ensilage possible.
  const pickedSilage = forcedGrain ? null : pickMachineForWork(access.machines, "SILAGE");
  if (forcedSilage && !pickedSilage) {
    res.status(409).json({ error: explainNoMachine(access.machines, "SILAGE") });
    return;
  }

  /**
   * Cette case part-elle en ensilage ?
   *
   * Trois conditions, toutes nécessaires : une ensileuse au hangar, du maïs
   * sur la case, et une plante assez avancée. Le blé d'un joueur qui possède
   * une ensileuse continue donc d'être moissonné en grain — la machine ne
   * décide que là où elle sait travailler.
   */
  function cellGoesToSilage(crop: CropCode, progress: number, lost: boolean): boolean {
    if (!pickedSilage) return false;
    if (!forcedSilage && crop !== "MAIZE") return false;
    return canSilageHarvest({ crop, progress, lost });
  }
  const bonuses = await getFarmBonuses(parcel.farmId!);
  const weather = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: parcel.zone.code } });
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  const remaining = access.order ? parseCellJson(access.order.remainingJson) : null;
  const targets = body.data.cells
    ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
    : remaining
      ? parcel.cells.filter((c) => remaining.some((t) => t.x === c.x && t.y === c.y))
      : parcel.cells.filter((c) => c.kind === "CROP");

  const now = Date.now();
  let previewGrass = 0;
  let previewGrain = 0;
  let previewSilage = 0;
  for (const cell of targets) {
    if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) continue;
    const sim = simulateCell({
      ...climatDe(parcel),
      crop: cell.crop,
      plantedAt: cell.plantedAt.getTime(),
      now,
      fertility: parcel.fertility,
      weedPressure: pressionAdventices(cell, currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now())),
      fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
      residuePasses: cell.residuePasses,
      directSeeded: cell.directSeeded,
      rotation: rotationOf(cell),
      specialization: playableSpec(farm.user.specialization ?? user?.specialization),
      buildingYieldBonus:
        bonuses.yieldBonus + pollinationBonusAt(bonuses.hives, cell.x, cell.y, cell.crop),
      skillYieldBonus: bonuses.skills.CROP_YIELD,
      weatherAtHarvest: weather?.state as WeatherState | undefined,
      cutsDone: grassCutsDone(cell),
    });
    // Le maïs qui part en ensilage se récolte avant maturité grain : il ne
    // faut donc pas exiger `sim.ready` de lui, ni lui réclamer une
    // moissonneuse. Sans cela, un joueur équipé de la seule ensileuse se
    // voyait refuser sa propre récolte de maïs.
    if (cellGoesToSilage(cell.crop, sim.progress, Boolean(sim.lost))) {
      previewSilage += 1;
      continue;
    }
    if (!sim.ready || sim.lost) continue;
    if (isMowCrop(cell.crop)) previewGrass += 1;
    else previewGrain += 1;
  }
  // L'ensilage a sa propre machine, déjà vérifiée : la moissonneuse et le
  // tracteur ne sont exigés que pour ce qui part en grain ou en fourrage.
  const pickedHarvest = previewGrain > 0 ? pickMachineForWork(access.machines, "HARVEST") : null;
  const pickedMow = previewGrass > 0 ? pickMachineForWork(access.machines, "MOW") : null;
  if (previewGrain > 0 && !pickedHarvest) {
    res.status(409).json({ error: explainNoMachine(access.machines, "HARVEST") });
    return;
  }
  if (previewGrass > 0 && !pickedMow) {
    res.status(409).json({ error: explainNoMachine(access.machines, "MOW") });
    return;
  }
  // Rien à faire du tout : le dire, plutôt que de rendre une récolte vide.
  if (previewGrain + previewGrass + previewSilage === 0 && forcedSilage) {
    res.status(409).json({ error: "Aucun maïs assez avancé pour l'ensilage" });
    return;
  }

  const harvested: {
    crop: CropCode;
    tons: number;
    moisturePenalty: number;
    moisture: number;
    silage?: boolean;
  }[] = [];
  const harvestedCells: CellXY[] = [];
  let lostCells = 0;
  let hayTons = 0;
  let grassRegrew = 0;

  const outcome = await prisma.$transaction(async (tx) => {
    let grainCells = 0;
    let grassCells = 0;
    let silageCells = 0;
    for (const cell of targets) {
      if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) continue;
      const sim = simulateCell({
        ...climatDe(parcel),
        crop: cell.crop,
        plantedAt: cell.plantedAt.getTime(),
        now,
        fertility: parcel.fertility,
        weedPressure: pressionAdventices(cell, currentSeason(climatDe(parcel).hemisphere ?? "N", Date.now())),
        fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
        residuePasses: cell.residuePasses,
        directSeeded: cell.directSeeded,
        rotation: rotationOf(cell),
        specialization: playableSpec(farm.user.specialization ?? user?.specialization),
        buildingYieldBonus:
          bonuses.yieldBonus + pollinationBonusAt(bonuses.hives, cell.x, cell.y, cell.crop),
        skillYieldBonus: bonuses.skills.CROP_YIELD,
        weatherAtHarvest: weather?.state as WeatherState | undefined,
        cutsDone: grassCutsDone(cell),
      });
      if (cellGoesToSilage(cell.crop, sim.progress, Boolean(sim.lost))) {
        silageCells += 1;
        if (sim.lost) {
          lostCells += 1;
          await tx.parcelCell.update({
            where: { id: cell.id },
            data: { fieldStage: "SPOILED", ...rotationUpdate(cell, cell.crop) },
          });
          continue;
        }
        const grainEq = access.charge
          ? sim.estimatedYieldTons
          : sim.estimatedYieldTons * (1 - P2P_YIELD_MALUS);
        // L'ensileuse s'use comme le reste : son état pèse sur ce qu'elle
        // rentre, et ses heures aussi — celles-là ne se réparent pas.
        const usure = pickedSilage
          ? conditionYieldFactor(pickedSilage.machine.condition) *
            machineAgeYieldFactor(pickedSilage.machine.hours ?? 0)
          : 1;
        const tons = silageYieldTons(grainEq, sim.progress) * usure;
        harvested.push({
          crop: cell.crop,
          tons,
          moisturePenalty: 0,
          moisture: 0,
          silage: true,
        });
        harvestedCells.push({ x: cell.x, y: cell.y });
        const after = afterTakeField(
          {
            crop: cell.crop,
            lastCrop: cell.lastCrop,
            cropStreak: cell.cropStreak,
            harvestsSincePlow: cell.harvestsSincePlow,
          },
          now,
          true,
        );
        await tx.parcelCell.update({ where: { id: cell.id }, data: after.data });
        continue;
      }
      if (!sim.ready) continue;
      if (sim.lost) {
        lostCells += 1;
        await tx.parcelCell.update({
          where: { id: cell.id },
          data: { fieldStage: "SPOILED", ...rotationUpdate(cell, cell.crop) },
        });
        continue;
      }
      const moisture = harvestMoisture(weather?.state as WeatherState | undefined);
      const picked = isMowCrop(cell.crop) ? pickedMow : pickedHarvest;
      const care = picked ? careOf(picked.machine) : null;
      /**
       * Ce que l'engin ramasse vraiment.
       *
       * Trois choses, et chacune a manqué à son tour. La graisse et la
       * propreté agissaient déjà. La condition, non : une moissonneuse au bout
       * du rouleau rendait autant qu'une neuve, si bien qu'entretenir
       * au-dessus du seuil de blocage ne servait à rien.
       *
       * Les heures non plus, et c'était le trou du marché de l'occasion : une
       * machine de 1 500 h remise à neuf ramassait comme une neuve. On
       * achetait moins cher sans rien perdre. Ce facteur-là ne se répare pas.
       */
      const careMult = care
        ? (1 + careYieldBonus(care)) *
          conditionYieldFactor(picked!.machine.condition) *
          machineAgeYieldFactor(picked!.machine.hours ?? 0)
        : 1;
      const tons =
        (access.charge ? sim.estimatedYieldTons : sim.estimatedYieldTons * (1 - P2P_YIELD_MALUS)) *
        careMult;
      harvested.push({
        crop: cell.crop,
        tons,
        moisturePenalty: sim.moisturePenalty,
        moisture,
      });
      harvestedCells.push({ x: cell.x, y: cell.y });
      if (isMowCrop(cell.crop)) {
        grassCells += 1;
        hayTons += tons;
      } else {
        grainCells += 1;
      }
      const next = afterTakeField(
        {
          crop: cell.crop,
          lastCrop: cell.lastCrop,
          cropStreak: cell.cropStreak,
          harvestsSincePlow: cell.harvestsSincePlow,
        },
        now,
        false,
        keepSwath,
      );
      if (next.regrow) grassRegrew += 1;
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: next.data,
      });
    }

    const byCrop = new Map<CropCode, { tons: number; wet: boolean; moistureSum: number }>();
    for (const h of harvested) {
      if (h.silage) continue;
      const cur = byCrop.get(h.crop) ?? { tons: 0, wet: false, moistureSum: 0 };
      cur.tons += h.tons;
      cur.moistureSum += h.tons * h.moisture;
      if (h.moisturePenalty > 0 || h.moisture > DRYING.sellThreshold) cur.wet = true;
      byCrop.set(h.crop, cur);
    }
    const incomingGrain: {
      code: GrainGood;
      tons: number;
      moisture: number;
      quality: number;
    }[] = [];
    for (const [crop, { tons, wet, moistureSum }] of byCrop) {
      if (!isGrainGood(crop)) continue;
      const batchMoisture = tons > 0 ? moistureSum / tons : harvestMoisture();
      incomingGrain.push({
        code: crop,
        tons,
        moisture: Math.round(batchMoisture * 1000) / 1000,
        quality: wet ? 2 : 3,
      });
    }
    const silageTons = harvested.filter((h) => h.silage).reduce((s, h) => s + h.tons, 0);
    if (silageTons > 0) {
      await addToStock(tx, parcel.farmId!, "SILAGE", silageTons, 0, 3);
    }
    const grain =
      incomingGrain.length === 0
        ? { soldTons: 0, storedTons: silageTons, revenue: 0, reason: null }
        : await applyGrainCapacity(tx, {
            farmId: parcel.farmId!,
            userId: farm.userId,
            capacity: bonuses.storageGrain,
            incoming: incomingGrain,
          });
    if (hayTons > 0) {
      await addToStock(tx, parcel.farmId!, "HAY", hayTons, 0, 3);
    }

    if (harvested.length === 0) {
      return { wear: null, mowWear: null, grain, labor: null, gain: null };
    }
    // Trois machines possibles sur la même route : l'ensileuse use pour toutes
    // les cases, la moissonneuse pour le grain, le tracteur pour l'herbe.
    // Une même sélection peut mêler du maïs ensilé et du blé moissonné : chaque
    // machine n'use que sur les cases qu'elle a réellement faites. L'ensileuse
    // usait auparavant sur `harvested.length`, c'est-à-dire aussi sur les cases
    // que la moissonneuse avait travaillées.
    const silageWear =
      pickedSilage && silageCells > 0
        ? await applyWearToMachine(tx, {
            rig: pickedSilage,
            cells: silageCells,
            work: "SILAGE",
            specialization: user?.specialization,
          })
        : null;
    const grainWear =
      pickedHarvest && grainCells > 0
        ? await applyWearToMachine(tx, {
            rig: pickedHarvest,
            cells: grainCells,
            work: "HARVEST",
            specialization: user?.specialization,
          })
        : null;
    const wear = silageWear ?? grainWear;
    const mowWear =
      pickedMow && grassCells > 0
        ? await applyWearToMachine(tx, {
            rig: pickedMow,
            cells: grassCells,
            work: "MOW",
            specialization: user?.specialization,
          })
        : null;
    const labor = access.order ? await settleLaborProgress(tx, access.order, harvestedCells) : null;
    // La moisson paie la surface parcourue **et** ce qu'elle a donné : c'est
    // ce qui distingue un champ bien mené d'un champ affamé, alors qu'un
    // forfait les payait pareil.
    const tons = harvested.reduce((sum, h) => sum + h.tons, 0);
    const gain = user
      ? await grantXp(
          tx,
          user.id,
          grainCells > 0 ? "HARVEST" : "MOW",
          { cells: harvestedCells.length, tons },
          { cellsHarvested: harvestedCells.length, tonsHarvested: tons },
        )
      : null;
    return { wear, mowWear, grain, labor, gain };
  });

  if (harvested.length === 0) {
    res.status(409).json({
      error: lostCells
        ? `${lostCells} case(s) perdue(s) — trop tard pour récolter, il faut labourer`
        : forcedSilage
          ? "Rien à ensiler (maïs pas assez avancé)"
          : "Rien à récolter (pas prêt)",
      lostCells,
    });
    return;
  }
  const last = harvestedCells[harvestedCells.length - 1];
  if (user && last) await touchFieldPresence(user.id, parcel.id, last);
  const shown = pickedHarvest ?? pickedMow;
  const shownWear = outcome.wear ?? outcome.mowWear;
  res.json({
    harvested,
    lostCells,
    hayTons,
    grassRegrew,
    totalTons: harvested.reduce((s, h) => s + h.tons, 0),
    storedTons: outcome.grain.storedTons,
    soldTons: outcome.grain.soldTons,
    soldRevenue: outcome.grain.revenue,
    soldReason: outcome.grain.reason,
    bonuses,
    machine: shown
      ? { id: shown.machine.id, type: shown.machine.type, ...shownWear }
      : null,
    labor: outcome.labor,
    gain: outcome.gain,
  });
});

/**
 * Désherber la culture en place.
 *
 * Le geste n'existait pas. `weedsControlled` valait dix pour cent de rendement
 * et ne passait à vrai qu'en même temps que la fertilisation, en silence : deux
 * opérations réelles distinctes — épandeur et pulvérisateur — confondues, et un
 * bonus que personne ne pouvait ni voir ni viser.
 */
app.post("/parcels/:id/weed", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "WEED",
    cells: body.data.cells,
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["WEED"],
    cells: body.data.cells,
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  const picked = pickMachineForWork(access.machines, "WEED");
  if (!picked) {
    res.status(409).json({ error: explainNoMachine(access.machines, "WEED") });
    return;
  }
  // On ne traite que ce qui pousse : pulvériser une case nue ne fait rien.
  const cibles = body.data.cells.filter(({ x, y }) => {
    const cell = parcel.cells.find((c) => c.x === x && c.y === y);
    return Boolean(cell && cell.kind === "CROP" && pressionAdventices(cell) > WEED_AFTER_SPRAY);
  });
  if (!cibles.length) {
    res.status(409).json({ error: "Rien à désherber : ces cases sont déjà propres." });
    return;
  }
  const cout = access.charge ? HERBICIDE_COST_PER_CELL * cibles.length : 0;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || (access.charge && !peutPayer(user, cout))) {
    res.status(402).json({ error: `€ insuffisants — ${cout} requis` });
    return;
  }
  const { wear, labor, gain } = await prisma.$transaction(async (tx) => {
    if (cout > 0) await debit(tx, user.id, cout, "CULTURES", "Herbicide");
    for (const { x, y } of cibles) {
      const cell = parcel.cells.find((c) => c.x === x && c.y === y)!;
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: { weedPressure: WEED_AFTER_SPRAY, weedAt: new Date() },
      });
    }
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells: cibles.length,
      work: "WEED",
      specialization: user.specialization,
    });
    const labor = access.order
      ? await settleLaborProgress(tx, access.order, body.data.cells)
      : null;
    const gain = await grantXp(
      tx,
      user.id,
      "WEED",
      { cells: cibles.length },
      { cellsWeeded: cibles.length },
    );
    return { wear, labor, gain };
  });
  res.json({
    ok: true,
    weeded: cibles.length,
    cost: cout,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
    labor,
    gain,
  });
});

app.post("/parcels/:id/bale", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "BALE",
    cells: body.data.cells ?? [],
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["BALE"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  const picked = pickMachineForWork(access.machines, "BALE");
  if (!picked) {
    res.status(409).json({ error: explainNoMachine(access.machines, "BALE") });
    return;
  }
  const remaining = access.order ? parseCellJson(access.order.remainingJson) : null;
  const selection = body.data.cells
    ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
    : remaining
      ? parcel.cells.filter((c) => remaining.some((t) => t.x === c.x && t.y === c.y))
      : parcel.cells;
  const targets = selection.filter((c) => c.strawTons > 0);
  if (!targets.length) {
    res.status(409).json({ error: "Aucun andain à presser" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  const worked = targets.map((c) => ({ x: c.x, y: c.y }));
  let bales = 0;
  const { wear, labor } = await prisma.$transaction(async (tx) => {
    for (const cell of targets) {
      const n = balesFromStraw(cell.strawTons);
      bales += n;
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: { strawTons: 0, baleCount: cell.baleCount + n },
      });
    }
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells: targets.length,
      work: "BALE",
      specialization: user?.specialization,
    });
    const labor = access.order ? await settleLaborProgress(tx, access.order, worked) : null;
    return { wear, labor };
  });
  if (user) await touchFieldPresence(user.id, parcel.id, worked[worked.length - 1]);
  res.json({
    baled: targets.length,
    bales,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
    labor,
  });
});

app.post("/parcels/:id/collect", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /** Chantier arrivé à échéance — sans lui, le travail ne part pas. */
      jobId: z.string().optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const access = await resolveFieldAccess({
    parcelId: req.params.id,
    userId: body.data.userId,
    work: "COLLECT",
    cells: body.data.cells ?? [],
  });
  if (!access.ok) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  /* Le sas du chantier. Un travail de champ ne s'exécute qu'au terme du
     chantier qui l'a réservé : appeler la route directement effacerait
     l'attente, et l'attente est ce qui donne sa valeur à un outil plus large. */
  const chantier = await checkFieldJob({
    jobId: body.data.jobId,
    userId: body.data.userId,
    parcelId: req.params.id,
    works: ["COLLECT"],
    cells: body.data.cells ?? [],
  });
  if (!chantier.ok) {
    res.status(chantier.status).json({ error: chantier.error, endsAt: chantier.endsAt });
    return;
  }
  // Refusé plus loin ? L'engin n'aura rien fait : le plein lui est rendu.
  gazoleSiRefus(res, chantier.job);
  const parcel = access.parcel;
  if (!parcel.farm) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  const picked = pickMachineForWork(access.machines, "COLLECT");
  if (!picked && !access.charge) {
    res.status(409).json({ error: explainNoMachine(access.machines, "COLLECT") });
    return;
  }
  const remaining = access.order ? parseCellJson(access.order.remainingJson) : null;
  const selection = body.data.cells
    ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
    : remaining
      ? parcel.cells.filter((c) => remaining.some((t) => t.x === c.x && t.y === c.y))
      : parcel.cells;
  const targets = selection.filter((c) => c.baleCount > 0);
  if (!targets.length) {
    res.status(409).json({ error: "Aucune botte à ramasser" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  const worked = targets.map((c) => ({ x: c.x, y: c.y }));
  let tons = 0;
  let bales = 0;
  const { wear, labor } = await prisma.$transaction(async (tx) => {
    for (const cell of targets) {
      bales += cell.baleCount;
      tons += strawFromBales(cell.baleCount);
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: { baleCount: 0 },
      });
    }
    // Ce qu'on charge, ce sont des bottes — pas un tas de vrac. Le stock les
    // compte à l'unité ; `BALE_TONS` reste la conversion partout où c'est un
    // tonnage qui compte (litière, ration).
    await addToStock(tx, parcel.farmId!, "STRAW_BALE", bales, 0, 3);
    const wear =
      picked && user
        ? await applyWearToMachine(tx, {
            rig: picked,
            cells: targets.length,
            work: "COLLECT",
            specialization: user.specialization,
          })
        : null;
    const labor = access.order ? await settleLaborProgress(tx, access.order, worked) : null;
    return { wear, labor };
  });
  if (user) await touchFieldPresence(user.id, parcel.id, worked[worked.length - 1]);
  res.json({
    collected: targets.length,
    bales,
    tons: Math.round(tons * 1000) / 1000,
    machine: picked && wear ? { id: picked.machine.id, type: picked.machine.type, ...wear } : null,
    labor,
  });
});

app.post("/parcels/:id/build", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      /**
       * Les types viennent du catalogue, ils ne sont pas recopiés.
       *
       * Cette liste était écrite à la main : une seconde source de vérité à
       * côté de `BUILDING_DEFS`. Trois bâtiments ajoutés au catalogue, et la
       * route les refusait avec « Invalid enum value » — le catalogue les
       * proposait à l'achat, le serveur ne les connaissait pas. C'est la même
       * faute que la grille de bureau définie à deux endroits : dérivée, elle
       * ne peut plus diverger.
       */
      type: z.enum(Object.keys(BUILDING_DEFS) as [string, ...string[]]),
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      /** Quarts de tour, 0 à 3 */
      rotation: z.number().int().min(0).max(3).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    const flat = body.error.flatten();
    res.status(400).json({
      error: flat.formErrors[0] ?? "Impossible de poser ce bâtiment",
      ...flat,
    });
    return;
  }
  const typeDemande = body.data.type as SharedBuildingType;
  const def = BUILDING_DEFS[typeDemande];
  if (!def) {
    res.status(400).json({ error: "Bâtiment inconnu" });
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  // L'emprise suit l'orientation : un hangar 3×2 tourné d'un quart occupe
  // 2×3. Sans cette lecture, la borne de grille et le marquage des cases
  // porteraient sur la mauvaise forme, et deux bâtiments pourraient se
  // superposer.
  const rotation = quarterTurns(body.data.rotation);
  const foot = orientedFootprint(body.data.type as BuildingType, rotation);
  if (body.data.x + foot.w > parcel.gridW || body.data.y + foot.h > parcel.gridH) {
    res.status(400).json({ error: "Emprise hors grille" });
    return;
  }
  /*
   * La cour reste libre.
   *
   * Les livraisons s'y posent, et elles n'ont nulle part ailleurs où aller. La
   * laisser bâtir menait droit au blocage constaté : plus une case libre, donc
   * plus aucun achat possible — on ne pouvait plus rien commander parce qu'on
   * avait bien joué.
   *
   * Le refus tombe **avant** le débit : un bâtiment payé qu'on ne peut pas
   * poser est exactement l'accident qu'on cherche à éviter.
   */
  const cells = footprintCells(body.data.x, body.data.y, foot.w, foot.h);
  for (const c of cells) {
    const cell = parcel.cells.find((p) => p.x === c.x && p.y === c.y);
    if (!cell || cell.kind !== "EMPTY") {
      res.status(409).json({ error: `Collision en ${c.x},${c.y}` });
      return;
    }
  }

  /*
   * Une aire de sortie ne vaut que collée à son abri.
   *
   * Elle était acceptée n'importe où, débitée sans un mot, et n'apparaissait
   * ensuite sur aucun écran : ni dans l'Élevage, qui ne liste que les abris,
   * ni à l'achat de bêtes, qui répond « ce bâtiment n'héberge pas d'animaux ».
   * Le joueur repartait avec une construction payée, muette et inutile — et
   * rien ne lui disait qu'il lui manquait la porcherie.
   *
   * On refuse donc au moment où c'est encore réparable, en nommant ce qui
   * manque. Poser l'abri d'abord est aussi l'ordre réel : on ne bâtit pas une
   * courette pour des porcs qu'on ne peut pas encore acheter.
   */
  if (YARD_BUILDINGS.includes(typeDemande)) {
    const abris = barnsForYard(typeDemande);
    const voisins = await prisma.building.findMany({
      where: { parcelId: parcel.id, type: { in: abris } },
    });
    const pose = { originX: body.data.x, originY: body.data.y, w: foot.w, h: foot.h };
    const colle = voisins.some((b) =>
      isPaddockAdjacent(
        {
          originX: b.originX,
          originY: b.originY,
          ...orientedFootprint(b.type as SharedBuildingType, b.rotation),
        },
        pose,
      ),
    );
    if (!colle) {
      const noms = abris.map(buildingWithArticle);
      const liste =
        noms.length > 1 ? `${noms.slice(0, -1).join(", ")} ou ${noms[noms.length - 1]}` : noms[0];
      res.status(409).json({
        error: voisins.length
          ? `${def.name} : elle se colle à ${liste}. La vôtre est trop loin — les emprises doivent se toucher.`
          : `${def.name} : posez d'abord ${liste}. Seule, elle n'accueille aucune bête.`,
      });
      return;
    }
  }

  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || !peutPayer(user, def.cost)) {
    res.status(402).json({ error: "€ insuffisants" });
    return;
  }

  try {
    const building = await prisma.$transaction(async (tx) => {
      await debit(tx, user.id, def.cost, "BATIMENTS", `Construction — ${def.name}`);
      const b = await tx.building.create({
        data: {
          parcelId: parcel.id,
          type: body.data.type as BuildingType,
          originX: body.data.x,
          originY: body.data.y,
          rotation,
        },
      });
      for (const c of cells) {
        await tx.parcelCell.update({
          where: { parcelId_x_y: { parcelId: parcel.id, x: c.x, y: c.y } },
          data: { kind: "BUILDING", buildingId: b.id },
        });
      }
      await grantXp(tx, user.id, "BUILD", { cost: def.cost }, { buildingsBuilt: 1 });
      return b;
    });

    const bonuses = await getFarmBonuses(parcel.farmId!);
    res.status(201).json({ building, bonuses, def });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pose impossible";
    res.status(500).json({ error: `Impossible de poser ${def.name} — ${msg}` });
  }
});

/**
 * Quart de tour d'un bâtiment déjà posé.
 *
 * L'orientation n'est pas qu'un effet : elle change l'emprise des types non
 * carrés, donc la place occupée. On revalide donc entièrement la nouvelle
 * forme — bornes de grille, et cases libres **hors** de celles que le bâtiment
 * occupe déjà — avant de retourner quoi que ce soit.
 */
app.post("/buildings/:id/rotate", async (req, res) => {
  const body = z
    .object({ userId: z.string(), rotation: z.number().int().min(0).max(3).optional() })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true, cells: true } } },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  const next = quarterTurns(body.data.rotation ?? building.rotation + 1);
  const foot = orientedFootprint(building.type as SharedBuildingType, next);
  if (
    building.originX + foot.w > building.parcel.gridW ||
    building.originY + foot.h > building.parcel.gridH
  ) {
    res.status(409).json({ error: "Pas la place de tourner ici" });
    return;
  }
  const wanted = footprintCells(building.originX, building.originY, foot.w, foot.h);
  for (const c of wanted) {
    const cell = building.parcel.cells.find((p) => p.x === c.x && p.y === c.y);
    // La case peut être occupée par le bâtiment lui-même : il tourne sur
    // place, il ne se pose pas à côté.
    if (!cell || (cell.kind !== "EMPTY" && cell.buildingId !== building.id)) {
      res.status(409).json({ error: `Pas la place de tourner — ${c.x},${c.y} occupée` });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.parcelCell.updateMany({
      where: { buildingId: building.id },
      data: { kind: "EMPTY", buildingId: null },
    });
    for (const c of wanted) {
      await tx.parcelCell.update({
        where: { parcelId_x_y: { parcelId: building.parcelId, x: c.x, y: c.y } },
        data: { kind: "BUILDING", buildingId: building.id },
      });
    }
    return tx.building.update({ where: { id: building.id }, data: { rotation: next } });
  });
  res.json({ building: updated });
});

/** Passage d'un bâtiment au palier suivant (5 niveaux au total). */
app.post("/buildings/:id/upgrade", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } } },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  if (building.level >= MAX_BUILDING_LEVEL) {
    res.status(409).json({ error: "Niveau maximum atteint" });
    return;
  }
  const cost = buildingUpgradeCost(building.type as SharedBuildingType, building.level);
  if (cost === null) {
    res.status(409).json({ error: "Niveau maximum atteint" });
    return;
  }
  const nextDef = buildingLevelDef(building.level + 1);
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  if (user.level < nextDef.requiredLevel) {
    res.status(403).json({ error: shortfall(user.xp, nextDef.requiredLevel) });
    return;
  }
  if (!peutPayer(user, cost)) {
    res.status(402).json({ error: `€ insuffisants — ${cost} requis` });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, cost, "BATIMENTS", `Amélioration — ${BUILDING_DEFS[building.type as SharedBuildingType]?.name ?? building.type}`);
    await grantXp(tx, user.id, "UPGRADE", { cost }, { buildingsUpgraded: 1 });
    return tx.building.update({
      where: { id: building.id },
      data: { level: building.level + 1 },
    });
  });
  const bonuses = await getFarmBonuses(building.parcel.farm.id);
  res.json({
    building: updated,
    cost,
    levelName: nextDef.name,
    stats: buildingStatsAtLevel(building.type as SharedBuildingType, updated.level),
    bonuses,
  });
});

/* ------------------------------------------------------------------ */
/* Élevage                                                             */
/* ------------------------------------------------------------------ */

/** Places d'hébergement selon l'espèce du bâtiment. */
function barnCapacity(
  type: string,
  stats: ReturnType<typeof buildingStatsAtLevel>,
): number {
  const kind = kindForBarn(type);
  if (kind === "COW") return stats.cattleSlots ?? 0;
  if (kind === "PIG") return stats.pigSlots ?? 0;
  if (kind === "HEN") return stats.henSlots ?? 0;
  if (kind === "SHEEP") return stats.sheepSlots ?? 0;
  return 0;
}

function collectClock(lastAt: Date | null, bornAt: Date, now: number) {
  const last = lastAt?.getTime() ?? null;
  const born = bornAt.getTime();
  return {
    ready: collectReady(last, born, now),
    progress: collectProgress(last, born, now),
  };
}

/** Enclos collés à une étable, avec leur capacité de sortie cumulée. */
function paddocksFor(
  barn: { originX: number; originY: number; type: string; rotation?: number },
  buildings: { type: string; originX: number; originY: number; rotation?: number }[],
): { cells: number; capacity: number; yardType: SharedBuildingType } {
  // L'adjacence se juge sur l'emprise **posée**, orientation comprise : une
  // étable tournée d'un quart ne touche plus les mêmes cases, et son pré non
  // plus. Lire `def.w × def.h` ici déclarerait collés deux bâtiments qui ne se
  // touchent pas — ou l'inverse.
  const footprint = {
    originX: barn.originX,
    originY: barn.originY,
    ...orientedFootprint(barn.type as SharedBuildingType, barn.rotation),
  };
  // Chaque espèce a son aire : pré, courette à porcs, courette à poules.
  const yardType = yardTypeForBarn(barn.type) as SharedBuildingType;
  let cells = 0;
  for (const b of buildings) {
    if (b.type !== yardType) continue;
    const foot = orientedFootprint(yardType, b.rotation);
    const other = { originX: b.originX, originY: b.originY, ...foot };
    if (isPaddockAdjacent(footprint, other)) cells += foot.w * foot.h;
  }
  return { cells, capacity: paddockCapacity(cells), yardType };
}

/** Fumier encore dans les fosses de la parcelle, en tonnes. */
async function parcelManureTons(parcelId: string): Promise<number> {
  const buildings = await prisma.building.findMany({
    where: { parcelId },
    include: { herd: true },
  });
  return buildings.reduce((sum, b) => sum + (b.herd?.manureTons ?? 0), 0);
}

/** Vide les fosses les plus pleines d'abord. Retourne ce qui a vraiment été pris. */
async function drawManureFromPits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  parcelId: string,
  tons: number,
): Promise<number> {
  const want = Math.max(0, tons);
  if (want <= 1e-6) return 0;
  const buildings = await tx.building.findMany({
    where: { parcelId },
    include: { herd: true },
  });
  const herds = buildings
    .map((b: { herd: { id: string; manureTons: number } | null }) => b.herd)
    .filter((h: { id: string; manureTons: number } | null): h is { id: string; manureTons: number } =>
      Boolean(h && h.manureTons > 0),
    )
    .sort((a: { manureTons: number }, b: { manureTons: number }) => b.manureTons - a.manureTons);
  let left = want;
  let taken = 0;
  for (const h of herds) {
    if (left <= 1e-6) break;
    const take = Math.min(h.manureTons, left);
    await tx.herd.update({
      where: { id: h.id },
      data: { manureTons: Math.round((h.manureTons - take) * 1000) / 1000 },
    });
    left -= take;
    taken += take;
  }
  return Math.round(taken * 1000) / 1000;
}

/**
 * Fait vivre tous les troupeaux, à chaque tick du monde.
 *
 * Cette avance ne tenait auparavant qu'au sondage de l'écran d'élevage : un
 * joueur qui ne l'ouvrait pas ne voyait jamais une gestation démarrer, et son
 * cheptel ne grandissait que par achat. Une bête vit qu'on la regarde ou non.
 */
async function settleAllHerds() {
  const herds = await prisma.herd.findMany({
    include: {
      building: {
        include: { parcel: { include: { buildings: true, zone: true } } },
      },
    },
  });
  const now = Date.now();
  // La météo se lit une fois pour toutes : une requête par troupeau ferait
  // autant d'allers-retours que de fermes, à chaque tick.
  const weathers = await prisma.weatherSnapshot.findMany();
  const weatherByZone = new Map(weathers.map((w) => [w.zoneCode, w.state as WeatherState]));

  for (const herd of herds) {
    const barn = herd.building;
    const paddock = paddocksFor(barn, barn.parcel.buildings);
    const stats = buildingStatsAtLevel(barn.type as SharedBuildingType, barn.level);
    const capacity = barnCapacity(barn.type, stats);
    // Saison et météo n'arrivaient jamais jusqu'ici : un hiver dehors valait
    // un été dehors, et un orage n'était consulté qu'à l'ouverture de la porte.
    const zone = barn.parcel.zone;
    const season = currentSeason((zone?.hemisphere as Hemisphere) ?? "N", now);
    const weather = weatherByZone.get(zone?.code ?? "") ?? "CLEAR";
    const apres = await settleHerd(herd, paddock.capacity, now, barn.level, capacity, {
      season,
      weather,
      paddockCells: paddock.cells,
    });
    // La salle de traite fait son travail, que le joueur regarde ou non.
    await ramasserAutomatiquement(herd, barn.level, apres.size, now);
  }
}

/**
 * Ramasse la production d'un lot quand le bâtiment est mécanisé.
 *
 * Le reproche était direct : « j'ai mis l'étable niveau 2 mais je dois toujours
 * me taper le lait à traire moi-même ». Améliorer coûtait cher et ne changeait
 * rien à la corvée — d'autant que la traite se refait toutes les quinze minutes
 * réelles. À partir du premier palier, le lait, les œufs et la laine tombent
 * donc au silo tout seuls.
 *
 * Le calcul est **exactement** celui des routes manuelles : même rendement,
 * même plafond de cuve, même horodatage. Automatiser ne doit rien changer à ce
 * qu'on récolte, seulement au nombre de clics.
 */
async function ramasserAutomatiquement(
  herd: {
    id: string;
    farmId: string;
    kind: string;
    happiness: number;
    feedQuality: number;
    lastMilkedAt: Date | null;
    bornAt: Date;
  },
  barnLevel: number,
  taille: number,
  now: number,
): Promise<void> {
  if (!autoCollects(barnLevel) || taille <= 0) return;

  const since = herd.lastMilkedAt?.getTime() ?? herd.bornAt.getTime();
  const cycles = Math.min(collectCapCycles(), (now - since) / LIVESTOCK_CYCLE_MS);
  // Le même seuil qu'à la main : on ne trait pas un lot qui vient de l'être.
  if (cycles < COLLECT_READY_RATIO) return;

  const commun = {
    herdSize: taille,
    happiness: herd.happiness,
    barnLevel,
    feedQuality: herd.feedQuality,
  };
  let bien: TradeGood | null = null;
  let quantite = 0;
  if (herd.kind === "COW") {
    bien = "MILK";
    // Le lait se compte en hectolitres au silo : cent litres la tonne d'échange.
    quantite = Math.round(((milkYield(commun) * cycles) / 100) * 1000) / 1000;
  } else if (herd.kind === "HEN") {
    bien = "EGGS";
    quantite = Math.round(eggYield(commun) * cycles * 100) / 100;
  } else if (herd.kind === "SHEEP") {
    bien = "WOOL";
    quantite = Math.round(woolYield(commun) * cycles * 1000) / 1000;
  }
  if (!bien || quantite <= 0) return;

  await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, bien, quantite, 0, 3);
    await tx.herd.update({ where: { id: herd.id }, data: { lastMilkedAt: new Date(now) } });
  });
}

/** Fait vieillir le bonheur d'un troupeau jusqu'à maintenant. */
async function settleHerd(
  herd: {
    id: string;
    size: number;
    happiness: number;
    lastTickAt: Date;
    lastGrazedAt: Date | null;
    grazingUntil: Date | null;
    feedStock: number;
    kind: string;
    gestatingSince: Date | null;
    lastCalvedAt: Date | null;
    avgAgeMs: number;
    mortalityDebt: number;
    manureTons?: number;
    beddingTons?: number;
    housing?: string;
    grassTons?: number;
    /**
     * Jeunes du lot, comptés dans `size`.
     *
     * Ils mangent moins — c'est ce qui donne au pari « acheter jeune » un coût
     * courant réduit. Facultatif : sans lui, on retombe sur un lot d'adultes,
     * soit exactement l'ancien comportement.
     */
    young?: number;
    /**
     * La ferme à qui appartient le lot.
     *
     * Elle sert à retrouver les compétences de l'éleveur. Facultative :
     * absente, le lot se comporte comme avant, ce qui garde les tests de
     * troupeau indépendants du système de compétences.
     */
    farmId?: string;
  },
  paddockCapacityCells: number,
  now: number,
  barnLevel = 1,
  capacity = 0,
  /**
   * Environnement du lot.
   *
   * Facultatif pour que les appels d'avant — il en reste dans les routes —
   * gardent exactement leur comportement : sans lui, on retombe sur un
   * printemps par temps clair et un pré nul, ce qui reproduit l'ancien
   * fonctionnement.
   */
  env?: { season: Season; weather: WeatherState; paddockCells: number },
): Promise<{
  happiness: number;
  feedStock: number;
  size: number;
  gestatingSince: Date | null;
  born: number;
  died: number;
  avgAgeMs: number;
  manureTons: number;
  beddingTons: number;
}> {
  /*
   * Les compétences de l'éleveur, résolues ici plutôt qu'aux appelants.
   *
   * `settleHerd` a deux appelants aujourd'hui et en aura trois demain : leur
   * demander de porter les compétences, c'est garantir l'oubli du troisième.
   * On les cherche donc là où on s'en sert.
   */
  const proprietaire = herd.farmId
    ? await prisma.farm.findUnique({ where: { id: herd.farmId }, select: { userId: true } })
    : null;
  const competencesEleveur = proprietaire?.userId
    ? await getSkillBonuses(proprietaire.userId)
    : noSkillBonuses();

  const elapsedMs = Math.max(0, now - herd.lastTickAt.getTime());
  if (elapsedMs < 1000) {
    return {
      happiness: herd.happiness,
      feedStock: herd.feedStock,
      size: herd.size,
      gestatingSince: herd.gestatingSince,
      born: 0,
      died: 0,
      avgAgeMs: herd.avgAgeMs,
      manureTons: herd.manureTons ?? 0,
      beddingTons: herd.beddingTons ?? 0,
    };
  }

  const kind = herd.kind as AnimalKind;
  const season = env?.season ?? "SPRING";
  const weather = env?.weather ?? "CLEAR";
  const paddockCells = env?.paddockCells ?? 0;

  /**
   * Le lot est-il dehors ?
   *
   * Le lieu de vie est désormais un **état** choisi par le joueur. La séance
   * minutée d'avant subsiste et compte encore comme une sortie : elle est
   * devenue l'animation de la transition, elle n'est plus le mécanisme.
   */
  const housing = parseHousing(herd.housing);
  const grazing =
    housing === "OUTSIDE" || Boolean(herd.grazingUntil && herd.grazingUntil.getTime() > now);

  // Combien de bêtes tiennent réellement au pré : l'enclos borne le troupeau.
  const outside = grazing ? Math.min(herd.size, Math.max(0, paddockCapacityCells)) : 0;
  const cycles = elapsedMs / LIVESTOCK_CYCLE_MS;

  /**
   * L'herbe pousse et se broute.
   *
   * C'est ce qui remplace la remise forfaitaire de 35 % : un pré vert couvre
   * tout le besoin des bêtes sorties, un pré épuisé — surpâturé, ou l'hiver —
   * ne couvre rien et le troupeau retombe sur le stock du hangar.
   */
  const pasture = grazesForFood(kind)
    ? grazePasture({
        grassTons: herd.grassTons ?? 0,
        paddockCells,
        season,
        animalsOutside: outside,
        cycles,
      })
    : { grassTons: herd.grassTons ?? 0, eatenTons: 0, coverage: 0 };

  const saved = feedSavedByPasture({
    herdSize: herd.size,
    animalsOutside: outside,
    coverage: pasture.coverage,
  });

  // La ration stockée n'est entamée que de ce que le pré n'a pas couvert.
  /**
   * Les jeunes mangent moins.
   *
   * `feedBurn` raisonne en têtes ; on lui passe donc un effectif **équivalent
   * adulte** — un veau vaut 0,45 vache à l'auge. Sans cela un troupeau de
   * veaux coûtait autant à nourrir qu'un troupeau de vaches, et la moitié de
   * l'intérêt du pari disparaissait.
   */
  const jeunes = Math.max(0, Math.min(herd.size, Math.floor(herd.young ?? 0)));
  const bouchesAdultes = herd.size - jeunes + jeunes * YOUNG_FEED_RATIO;
  const burnt =
    feedBurn({
      herdSize: bouchesAdultes,
      elapsedMs,
      cycleMs: LIVESTOCK_CYCLE_MS,
      // Le forfait d'avant est neutralisé : c'est `saved` qui fait le travail.
      grazing: false,
      barnLevel,
      kind,
    }) *
    (1 - saved) *
    /*
     * Une ration mieux calculée se gaspille moins.
     *
     * L'économie se **multiplie** avec celle du pâturage au lieu de s'y
     * ajouter : deux fractions qu'on additionne finissent par dépasser un, et
     * un troupeau qui ne mange plus rien n'est plus un troupeau.
     */
    (1 - competencesEleveur.FEED_USE);
  const feedStock = Math.max(0, herd.feedStock - burnt);
  const hunger = hungerPenalty({ feedStock, herdSize: bouchesAdultes, kind });
  // La litière se salit au même rythme que la ration se mange. On mesure la
  // couverture **après** consommation : c'est l'état dans lequel les bêtes
  // viennent de passer la période, pas celui du début.
  const beddingTons = Math.max(
    0,
    (herd.beddingTons ?? 0) -
      beddingBurn({ kind, herdSize: herd.size, elapsedMs, cycleMs: LIVESTOCK_CYCLE_MS, grazing }),
  );
  const cover = beddingCover({ kind, herdSize: herd.size, stockTons: beddingTons });

  const pitCap = manurePitCapacity(kind, capacity);
  // La paille ne disparaît pas : elle passe dans le tas. C'est ce qui rend le
  // paillage rentable au lieu d'être une taxe — l'éleveur achète de la paille
  // au céréalier et lui revend du fumier.
  const produced =
    manureProduced({
      kind,
      herdSize: herd.size,
      elapsedMs,
      cycleMs: LIVESTOCK_CYCLE_MS,
    }) * beddingManureMultiplier(cover);
  const pit = addManureToPit({
    current: herd.manureTons ?? 0,
    produced,
    capacity: pitCap,
  });
  const smell = manureSmellPenalty(manureFill(pit.tons, pitCap));

  /**
   * Le froid mord — et la chaleur aussi.
   *
   * Aucune chaîne nouvelle : la pénalité entre par la même porte que la faim
   * et la litière, et ressort donc en lait, en reproduction et, si l'on
   * s'obstine, en mortalité.
   */
  const tempC = feltTempC({ kind, housing, season, weather, barnLevel });
  const thermal = thermalPenalty({ kind, tempC });

  const happiness = tickHappiness({
    happiness: herd.happiness,
    hasPaddock: paddockCapacityCells > 0,
    grazedRecentlyMs: herd.lastGrazedAt ? now - herd.lastGrazedAt.getTime() : Number.MAX_SAFE_INTEGER,
    crowding: paddockCapacityCells > 0 ? herd.size / Math.max(1, paddockCapacityCells) : 1,
    elapsedMs,
    /*
     * L'œil de l'éleveur **allège la peine**, il ne fabrique pas du bonheur.
     *
     * Retirer une pénalité plutôt qu'ajouter des points garde la hiérarchie
     * intacte : un troupeau affamé reste malheureux quel que soit le
     * savoir-faire, et la ration continue de décider. Un bonus additif, lui,
     * aurait fini par masquer la faim.
     */
    hunger: Math.max(0, (hunger + smell + thermal) * (1 - competencesEleveur.ANIMAL_HAPPINESS)),
    bedding: beddingPenalty(cover),
  });

  // Reproduction : une gestation démarre quand tout est réuni, et aboutit
  // quand elle arrive à terme. Un troupeau bien mené grossit tout seul.
  const feedPer = FEED_BASE[kind] ?? HUNGER.unitsPerAnimalPerCycle;
  const feedRatio = feedStock / Math.max(1, herd.size * feedPer);
  const freeSlots = capacity - herd.size;
  let size = herd.size;
  let gestatingSince: Date | null = herd.gestatingSince;
  let lastCalvedAt = herd.lastCalvedAt;
  let born = 0;

  if (gestatingSince) {
    const progress = gestationProgress({
      kind: herd.kind as AnimalKind,
      gestatingSince: gestatingSince.getTime(),
      now,
      cycleMs: LIVESTOCK_CYCLE_MS,
    });
    if (progress >= 1) {
      born = litterFor(herd.kind as AnimalKind, freeSlots);
      size += born;
      gestatingSince = null;
      lastCalvedAt = new Date(now);
    }
  } else {
    const verdict = canBreed({
      kind: herd.kind as AnimalKind,
      size: herd.size,
      happiness,
      feedRatio,
      freeSlots,
      gestatingSince: null,
    });
    if (verdict.ok) gestatingSince = new Date(now);
  }

  // Le lot vieillit du temps écoulé, puis la moyenne se dilue des veaux qui
  // viennent de naître : sans quoi un nouveau-né compterait comme un adulte à
  // l'abattage.
  let avgAgeMs = Math.max(0, herd.avgAgeMs) + elapsedMs;
  if (born > 0) {
    avgAgeMs = blendedAgeMs({
      herdSize: size - born,
      averageAgeMs: avgAgeMs,
      added: born,
      addedAgeMs: 0,
    });
  }

  // Un troupeau affamé finit par perdre des bêtes. Lentement : on doit avoir
  // le temps de réagir en rentrant.
  const toll = mortalityToll({
    happiness,
    herdSize: size,
    elapsedMs,
    cycleMs: LIVESTOCK_CYCLE_MS,
    debt: herd.mortalityDebt,
  });
  size = Math.max(0, size - toll.deaths);

  // Plus une bête : le lot n'existe plus. Sans cela la ligne survivait à
  // zéro, et le panneau continuait d'en parler — litière à refaire, traite
  // possible — pour un troupeau mort. Seul l'abattage nettoyait jusqu'ici.
  if (size <= 0) {
    await prisma.herd.delete({ where: { id: herd.id } });
    return {
      happiness,
      feedStock,
      size: 0,
      gestatingSince: null,
      born,
      died: toll.deaths,
      avgAgeMs,
      manureTons: pit.tons,
      beddingTons,
    };
  }

  await prisma.herd.update({
    where: { id: herd.id },
    data: {
      happiness,
      feedStock,
      size,
      gestatingSince: size > 0 ? gestatingSince : null,
      lastCalvedAt,
      avgAgeMs,
      mortalityDebt: toll.debt,
      manureTons: pit.tons,
      beddingTons,
      grassTons: pasture.grassTons,
      lastTickAt: new Date(now),
    },
  });
  return {
    happiness,
    feedStock,
    size,
    gestatingSince,
    born,
    died: toll.deaths,
    avgAgeMs,
    manureTons: pit.tons,
    beddingTons,
  };
}

/** État complet de l'élevage d'une parcelle, prêt pour l'affichage. */
app.get("/parcels/:id/livestock", async (req, res) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: {
      buildings: { include: { herd: { include: { youngBatches: true } } } },
      zone: true,
      farm: true,
    },
  });
  if (!parcel) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: parcel.zone.code },
  });
  const now = Date.now();
  // Saison et météo : elles décident du confort ressenti et de la pousse de
  // l'herbe. Le panneau doit les voir, sans quoi le joueur subit sans savoir.
  const saison = currentSeason((parcel.zone.hemisphere as Hemisphere) ?? "N", now);
  const meteo = (weather?.state as WeatherState) ?? "CLEAR";

  const barns = [];
  for (const b of parcel.buildings) {
    if (!kindForBarn(b.type)) continue;
    const paddock = paddocksFor(b, parcel.buildings);
    const stats = buildingStatsAtLevel(b.type as SharedBuildingType, b.level);
    const capacity = barnCapacity(b.type, stats);
    const herdKind = (b.herd?.kind as AnimalKind | undefined) ?? kindForBarn(b.type);
    // Température ressentie par ce lot-ci : calculée une fois, relue trois
    // fois plus bas. La recalculer à chaque champ rendait la charge utile
    // illisible pour un gain nul.
    const herdTempC = feltTempC({
      kind: herdKind ?? "COW",
      housing: parseHousing(b.herd?.housing),
      season: saison,
      weather: meteo,
      barnLevel: b.level,
    });
    let happiness = b.herd?.happiness ?? 0;
    let feedStock = b.herd?.feedStock ?? 0;
    let herdSize = b.herd?.size ?? 0;
    let gestatingSince: Date | null = b.herd?.gestatingSince ?? null;
    let manureTons = b.herd?.manureTons ?? 0;
    let beddingTons = b.herd?.beddingTons ?? 0;
    /**
     * Les jeunes encore en croissance.
     *
     * On les compte au moment de la lecture plutôt que de tenir un compteur
     * sur le troupeau : un lot arrivé à maturité entre deux ticks doit cesser
     * de compter tout de suite, sans attendre le passage du tick.
     */
    const jeunes = (b.herd?.youngBatches ?? [])
      .filter((y) => y.maturesAt.getTime() > now)
      .reduce((n, y) => n + y.count, 0);
    /** Le prochain lot à passer adulte, pour l'annoncer au joueur. */
    const prochaineMaturite = (b.herd?.youngBatches ?? [])
      .filter((y) => y.maturesAt.getTime() > now)
      .sort((a, c) => a.maturesAt.getTime() - c.maturesAt.getTime())[0];
    if (b.herd) {
      const settled = await settleHerd(
        { ...b.herd, young: jeunes },
        paddock.capacity,
        now,
        b.level,
        capacity,
      );
      happiness = settled.happiness;
      feedStock = settled.feedStock;
      herdSize = settled.size;
      gestatingSince = settled.gestatingSince;
      manureTons = settled.manureTons;
      beddingTons = settled.beddingTons;
    }
    const pitCap = herdKind
      ? manurePitCapacity(herdKind, capacity)
      : manurePitCapacity("COW", capacity);
    const pitFill = manureFill(manureTons, pitCap);

    const graze = b.herd
      ? canGraze({
          paddock: {
            adjacent: paddock.capacity > 0,
            cells: paddock.cells,
            capacity: paddock.capacity,
          },
          animals: b.herd.size,
          weather: (weather?.state as WeatherState) ?? "CLEAR",
          kind: b.herd.kind as AnimalKind,
          paddockKind: kindForBarn(b.type) ?? "COW",
        })
      // Étable vide : dire pourquoi, et non « pas d'enclos » — c'était faux, et
      // ça contredisait le bandeau vert affiché juste au-dessus.
      : { ok: false as const, reason: "NO_ANIMALS" as const, animals: 0, sheltered: 0 };

    /**
     * Le lieu de vie durable — l'autre verdict, et le seul que l'interrupteur
     * « Dedans / Dehors » doit consulter. Il doit dire exactement ce que la
     * route `/herds/:id/housing` acceptera : elle n'exige qu'un enclos.
     */
    const dehors = b.herd
      ? canLiveOutside({
          paddock: {
            adjacent: paddock.capacity > 0,
            cells: paddock.cells,
            capacity: paddock.capacity,
          },
          animals: b.herd.size,
          kind: b.herd.kind as AnimalKind,
          paddockKind: kindForBarn(b.type) ?? "COW",
        })
      : { ok: false as const, reason: "NO_ANIMALS" as const, animals: 0, sheltered: 0 };

    const feedPer = herdKind ? (FEED_BASE[herdKind] ?? HUNGER.unitsPerAnimalPerCycle) : HUNGER.unitsPerAnimalPerCycle;
    barns.push({
      buildingId: b.id,
      type: b.type,
      level: b.level,
      capacity,
      paddockCells: paddock.cells,
      paddockCapacity: paddock.capacity,
      yardType: paddock.yardType,
      herd: b.herd
        ? {
            id: b.herd.id,
            kind: b.herd.kind,
            size: herdSize,
            happiness,
            label: happinessLabel(happiness),
            // Prévenir vaut mieux que constater : au-dessous du seuil, le lot
            // commence à perdre des bêtes, et le joueur doit pouvoir agir
            // avant d'en compter les pertes.
            atRisk: happiness < MORTALITY.floor,
            grazingUntil: b.herd.grazingUntil?.getTime() ?? null,
            feedStock: Math.round(feedStock * 10) / 10,
            gestation: gestationProgress({
              kind: b.herd.kind as AnimalKind,
              gestatingSince: gestatingSince?.getTime() ?? null,
              now,
              cycleMs: LIVESTOCK_CYCLE_MS,
            }),
            breedRefusal: (() => {
              if (gestatingSince) return null;
              const v = canBreed({
                kind: b.herd.kind as AnimalKind,
                size: herdSize,
                happiness,
                feedRatio: feedStock / Math.max(1, herdSize * feedPer),
                freeSlots: capacity - herdSize,
                gestatingSince: null,
              });
              return v.ok || !v.reason ? null : BREEDING_REFUSAL_LABELS[v.reason];
            })(),
            /* Le besoin décompte les jeunes : ils mangent 45 % d'une ration.
               Sans cela le panneau réclamait pour des veaux comme pour des
               vaches, et la jauge de faim mentait. */
            feedNeed: herdFeedNeed({ size: herdSize, young: jeunes, kind: herdKind ?? "COW" }),
            /** Combien de jeunes, et quand le prochain lot passe adulte. */
            young: jeunes,
            youngMaturesAt: prochaineMaturite?.maturesAt.getTime() ?? null,
            // Litière : la part du besoin d'un cycle réellement couverte, et
            // les tonnes qu'il faudrait pour la compléter. Le joueur ne doit
            // pas avoir à calculer des tonnes de paille de tête.
            beddingTons: Math.round(beddingTons * 100) / 100,
            beddingNeed: beddingNeed(herdKind ?? "COW", herdSize),
            beddingCap: beddingCapacity(herdKind ?? "COW", capacity),
            beddingCover: Math.round(
              beddingCover({ kind: herdKind ?? "COW", herdSize, stockTons: beddingTons }) * 100,
            ) / 100,
            feedQuality: b.herd.feedQuality,
            /* — Environnement : ce que la simulation lit désormais — */
            housing: parseHousing(b.herd.housing),
            tempC: Math.round(herdTempC),
            outdoorTempC: Math.round(outdoorTempC(saison, meteo)),
            thermal: Math.round(thermalPenalty({ kind: herdKind ?? "COW", tempC: herdTempC }) * 100) / 100,
            thermalAlert: thermalAlert(
              thermalPenalty({ kind: herdKind ?? "COW", tempC: herdTempC }),
            ),
            grassTons: Math.round((b.herd.grassTons ?? 0) * 100) / 100,
            grassCapacityTons: Math.round(grassCapacity(paddock.cells) * 100) / 100,
            grazes: grazesForFood(herdKind ?? "COW"),
            hungry: hungerPenalty({
              feedStock,
              herdSize: b.herd.size,
              kind: b.herd.kind as AnimalKind,
            }) > 0.05,
            /*
              Pourquoi le lot va mal, et quoi faire.

              « Elles sont stressées pour quoi ? » L'écran donnait la note sans
              jamais la copie. Les causes sont calculées ici, avec **les mêmes
              entrées** que la dérive du bien-être — les recalculer côté écran
              les aurait laissées diverger au premier changement de règle.
            */
            welfareCauses: welfareReasons({
              hasPaddock: paddock.capacity > 0,
              grazedRecentlyMs: b.herd.lastGrazedAt
                ? now - b.herd.lastGrazedAt.getTime()
                : Number.MAX_SAFE_INTEGER,
              crowding:
                paddock.capacity > 0 ? b.herd.size / Math.max(1, paddock.capacity) : 1,
              hunger: hungerPenalty({
                feedStock,
                herdSize: b.herd.size,
                kind: b.herd.kind as AnimalKind,
              }),
              bedding: beddingPenalty(
                beddingCover({
                  kind: b.herd.kind as AnimalKind,
                  herdSize: b.herd.size,
                  stockTons: b.herd.beddingTons ?? 0,
                }),
              ),
            }),
            /* Un lot entièrement composé de jeunes n'a rien à donner : sans
               ce garde, « traite prête » s'affichait sur une étable de veaux
               et le geste ramenait zéro litre. */
            canMilk:
              b.herd.kind === "COW" &&
              herdSize - jeunes > 0 &&
              collectClock(b.herd.lastMilkedAt, b.herd.bornAt, now).ready,
            canCollectEggs:
              b.herd.kind === "HEN" &&
              herdSize - jeunes > 0 &&
              collectClock(b.herd.lastMilkedAt, b.herd.bornAt, now).ready,
            canShear:
              b.herd.kind === "SHEEP" &&
              herdSize - jeunes > 0 &&
              collectClock(b.herd.lastMilkedAt, b.herd.bornAt, now).ready,
            collectProgress: collectClock(b.herd.lastMilkedAt, b.herd.bornAt, now).progress,
            /* Un veau ne donne ni lait, ni œufs, ni laine : la production ne
               compte que les adultes. C'est le prix du pari — on paie moins
               cher, on attend une saison avant que la bête rapporte. */
            milkPerCycle: milkYield({
              herdSize: Math.max(0, herdSize - jeunes),
              happiness,
              barnLevel: b.level,
              feedQuality: b.herd.feedQuality,
            }),
            eggsPerCycle: eggYield({
              herdSize: Math.max(0, herdSize - jeunes),
              happiness,
              barnLevel: b.level,
              feedQuality: b.herd.feedQuality,
            }),
            woolPerShear: woolYield({
              herdSize: Math.max(0, herdSize - jeunes),
              happiness,
              barnLevel: b.level,
              feedQuality: b.herd.feedQuality,
            }),
            meatAtSlaughter: meatYield({
              herdSize: b.herd.size,
              happiness,
              averageAgeMs: b.herd.avgAgeMs,
              barnLevel: b.level,
              kind: b.herd.kind as AnimalKind,
            }),
            manureTons: Math.round(manureTons * 1000) / 1000,
            manureCap: pitCap,
            manureFill: pitFill,
            smelly: pitFill >= 0.8,
          }
        : null,
      canGraze: graze.ok,
      grazeRefusal: graze.ok || !graze.reason ? null : GRAZING_REFUSAL_LABELS[graze.reason],
      /* — Vivre dehors : la décision durable, et ce qu'elle donne — */
      canLiveOutside: dehors.ok,
      outsideRefusal: dehors.ok || !dehors.reason ? null : GRAZING_REFUSAL_LABELS[dehors.reason],
      /**
       * Bêtes qui **tiendraient** au pré ; le reste attendrait son tour à
       * l'étable. C'est une capacité, pas un état : elle répond à « si je les
       * sors, combien sortent ? ».
       */
      outsideCount: dehors.animals,
      shelteredCount: dehors.sheltered,
      /**
       * Bêtes réellement dehors, à cet instant.
       *
       * Le panneau n'avait que la capacité et l'affichait comme un constat :
       * « 18 bêtes au pré, 1 à l'étable » restait écrit après avoir rentré le
       * troupeau, et le joueur en concluait — à raison — que le bouton n'avait
       * rien fait. Le lieu de vie décide, la capacité borne.
       */
      outsideNow:
        b.herd && parseHousing(b.herd.housing) === "OUTSIDE" ? dehors.animals : 0,
      cowPrice: herdKind ? ANIMAL_PRICE[herdKind] : ANIMAL_PRICE.COW,
    });
  }
  /*
   * Les aires de sortie qui ne touchent aucun abri.
   *
   * L'écran ne listait que les abris, si bien qu'une courette posée seule
   * n'apparaissait nulle part : payée, muette, invisible. Il est désormais
   * impossible d'en poser une orpheline, mais il en reste des anciennes — et
   * démolir un abri en recrée. Une ligne qui dit ce qui manque vaut mieux
   * qu'un bâtiment qu'on cherche à comprendre.
   */
  const orphanYards = parcel.buildings
    .filter((b) => YARD_BUILDINGS.includes(b.type as SharedBuildingType))
    .filter((y) => {
      const abris = barnsForYard(y.type as SharedBuildingType);
      const foot = {
        originX: y.originX,
        originY: y.originY,
        ...orientedFootprint(y.type as SharedBuildingType, y.rotation),
      };
      return !parcel.buildings.some(
        (b) =>
          abris.includes(b.type as SharedBuildingType) &&
          isPaddockAdjacent(
            {
              originX: b.originX,
              originY: b.originY,
              ...orientedFootprint(b.type as SharedBuildingType, b.rotation),
            },
            foot,
          ),
      );
    })
    .map((y) => ({
      buildingId: y.id,
      type: y.type,
      name: BUILDING_DEFS[y.type as SharedBuildingType].name,
      needs: barnsForYard(y.type as SharedBuildingType).map(buildingWithArticle),
    }));

  res.json({ barns, orphanYards, weather: weather?.state ?? "CLEAR" });
});

/** Achat de bêtes pour une étable. */
app.post("/buildings/:id/animals", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      count: z.number().int().min(1).max(50),
      /**
       * Acheter des jeunes plutôt que des adultes.
       *
       * Deux cinquièmes du prix, mais rien à traire avant une saison : c'est
       * du capital contre du temps. Ils entrent dans la même étable — un
       * second bâtiment n'aurait ajouté que de la comptabilité.
       */
      young: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } }, herd: true },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  const kind = kindForBarn(building.type);
  if (!kind) {
    res.status(409).json({ error: "Ce bâtiment n'héberge pas d'animaux" });
    return;
  }
  const stats = buildingStatsAtLevel(building.type as SharedBuildingType, building.level);
  const capacity = barnCapacity(building.type, stats);
  const current = building.herd?.size ?? 0;
  if (current + body.data.count > capacity) {
    res.status(409).json({
      error: `Capacité dépassée — ${capacity} places, ${current} occupées`,
    });
    return;
  }
  const jeune = body.data.young === true;
  const cost = Math.round(
    ANIMAL_PRICE[kind] * (jeune ? YOUNG_PRICE_RATIO : 1) * body.data.count,
  );
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || !peutPayer(user, cost)) {
    res.status(402).json({ error: `€ insuffisants — ${cost} requis` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await debit(
      tx,
      user.id,
      cost,
      "ELEVAGE",
      `Achat de ${body.data.count} ${jeune ? "jeune" : "bête"}${body.data.count > 1 ? "s" : ""}`,
    );
    if (building.herd) {
      // On achète du bétail déjà élevé : la moyenne d'âge du lot se déplace
      // vers celle des arrivantes, au prorata des effectifs.
      await tx.herd.update({
        where: { id: building.herd.id },
        data: {
          size: current + body.data.count,
          // Un jeune arrive sans âge : c'est ce qui fait qu'il pèse peu à
          // l'abattage, et qu'attendre a une valeur.
          avgAgeMs: blendedAgeMs({
            herdSize: current,
            averageAgeMs: building.herd.avgAgeMs,
            added: body.data.count,
            addedAgeMs: jeune ? 0 : PURCHASED_AGE_MS,
          }),
        },
      });
      if (jeune) {
        await tx.youngBatch.create({
          data: {
            herdId: building.herd.id,
            count: body.data.count,
            maturesAt: new Date(Date.now() + YOUNG_GROW_MS),
          },
        });
      }
    } else {
      const lot = await tx.herd.create({
        data: {
          farmId: building.parcel.farm!.id,
          buildingId: building.id,
          kind,
          size: body.data.count,
          avgAgeMs: jeune ? 0 : PURCHASED_AGE_MS,
        },
      });
      if (jeune) {
        await tx.youngBatch.create({
          data: {
            herdId: lot.id,
            count: body.data.count,
            maturesAt: new Date(Date.now() + YOUNG_GROW_MS),
          },
        });
      }
    }
  });
  res.status(201).json({ added: body.data.count, cost, young: jeune });
});

/** Vente locale : le fumier part au voisin, pas au silo ni au négociant. */
app.post("/buildings/:id/manure/sell", async (req, res) => {
  const body = z
    .object({ userId: z.string(), tons: z.number().positive().max(100_000).optional() })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } }, herd: true },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  if (!building.herd || building.herd.manureTons <= 0) {
    res.status(409).json({ error: "Fosse vide — rien à vendre" });
    return;
  }
  const tons = Math.min(building.herd.manureTons, body.data.tons ?? building.herd.manureTons);
  if (tons <= 1e-6) {
    res.status(409).json({ error: "Fosse vide — rien à vendre" });
    return;
  }
  const proceeds = manureSaleProceeds(tons);
  await prisma.$transaction(async (tx) => {
    await tx.herd.update({
      where: { id: building.herd!.id },
      data: { manureTons: Math.round((building.herd!.manureTons - tons) * 1000) / 1000 },
    });
    await crediter(tx, body.data.userId, proceeds, "ELEVAGE", "Vente de fumier au voisin");
  });
  res.json({ tons: Math.round(tons * 1000) / 1000, proceeds });
});

/** Sortie au pâturage : c'est l'enclos adjacent qui la rend possible. */
app.post("/herds/:id/graze", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: {
      farm: true,
      building: { include: { parcel: { include: { buildings: true, zone: true } } } },
    },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  const paddock = paddocksFor(herd.building, herd.building.parcel.buildings);
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: herd.building.parcel.zone.code },
  });
  const verdict = canGraze({
    paddock: {
      adjacent: paddock.capacity > 0,
      cells: paddock.cells,
      capacity: paddock.capacity,
    },
    animals: herd.size,
    weather: (weather?.state as WeatherState) ?? "CLEAR",
    kind: herd.kind as AnimalKind,
    paddockKind: kindForBarn(herd.building.type) ?? "COW",
  });
  if (!verdict.ok) {
    res.status(409).json({
      error: verdict.reason ? GRAZING_REFUSAL_LABELS[verdict.reason] : "Sortie impossible",
    });
    return;
  }

  const now = Date.now();
  const window = planGrazing(
    now,
    {
      id: herd.id,
      kind: herd.kind as AnimalKind,
      size: herd.size,
      happiness: herd.happiness,
      averageAgeMs: herd.avgAgeMs,
      lastGrazedAt: herd.lastGrazedAt?.getTime() ?? null,
      lastMilkedAt: herd.lastMilkedAt?.getTime() ?? null,
    },
    { adjacent: true, cells: paddock.cells, capacity: paddock.capacity },
  );
  if (!window) {
    res.status(409).json({ error: "Sortie impossible pour le moment" });
    return;
  }
  const gain = await prisma.$transaction(async (tx) => {
    await tx.herd.update({
      where: { id: herd.id },
      data: {
        lastGrazedAt: new Date(now),
        grazingUntil: new Date(window.endsAt),
        lastTickAt: new Date(now),
      },
    });
    return grantXp(tx, body.data.userId, "GRAZE", {}, { grazings: 1 });
  });
  res.json({ window, animals: window.animals, gain });
});

/**
 * Rentrer le troupeau avant la fin de sa sortie.
 *
 * La sortie ne savait qu'expirer d'elle-même : une fois les bêtes dehors, le
 * joueur n'avait aucun moyen de les faire rentrer, alors qu'il peut vouloir
 * les traire, les tondre, ou simplement fermer la grange avant l'orage. Le
 * dernier passage au pré reste compté — rentrer n'annule pas la pâture déjà
 * faite, sans quoi on pourrait sortir et rentrer en boucle pour la relancer.
 */
app.post("/herds/:id/shelter", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  const now = Date.now();
  if (!herd.grazingUntil || herd.grazingUntil.getTime() <= now) {
    res.status(409).json({ error: "Le troupeau est déjà à l'abri" });
    return;
  }
  await prisma.herd.update({
    where: { id: herd.id },
    data: { grazingUntil: new Date(now), lastTickAt: new Date(now) },
  });
  res.json({ animals: herd.size });
});

/**
 * Marchandises que le joueur peut écouler. Restreindre les endpoints de vente
 * au blé et au maïs rendait le lait et la viande produisibles mais
 * invendables : ils s'accumulaient au silo sans débouché.
 */
const sellableGood = z.enum(
  SELLABLE_GOODS as [TradeGood, ...TradeGood[]],
);

/** Ajoute une marchandise au silo, en fusionnant l'humidité si besoin. */
async function addToStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  farmId: string,
  itemCode: string,
  qty: number,
  moisture = 0,
  quality = 3,
) {
  const existing = await tx.inventoryItem.findFirst({ where: { farmId, itemCode } });
  if (existing) {
    await tx.inventoryItem.update({
      where: { id: existing.id },
      data: {
        qty: existing.qty + qty,
        moisture: mergeMoisture(existing.qty, existing.moisture, qty, moisture),
      },
    });
  } else {
    await tx.inventoryItem.create({ data: { farmId, itemCode, qty, quality, moisture } });
  }
}

type GrainIncoming = {
  code: GrainGood;
  tons: number;
  moisture: number;
  quality: number;
};

type GrainCapacityResult = {
  soldTons: number;
  storedTons: number;
  revenue: number;
  reason: GrainForcedSaleReason | null;
};

/** Rachat forcé au tarif négociant : immédiat, moins-disant, sans minimum de lot. */
async function creditForcedGrainSales(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  opts: {
    userId: string;
    lots: { commodity: string; tons: number; moisture: number }[];
  },
): Promise<{ revenue: number; soldTons: number }> {
  let revenue = 0;
  let soldTons = 0;
  for (const lot of opts.lots) {
    if (lot.tons <= 1e-6) continue;
    const market = await tx.marketPrice.findUnique({ where: { commodity: lot.commodity } });
    if (!market) continue;
    const keep = 1 - moistureSellPenalty(lot.moisture);
    const pricePerTon = dealerPricePerTon(market.price) * keep;
    const rev = Math.round(pricePerTon * lot.tons);
    if (rev !== 0) {
      await crediter(tx, opts.userId, rev, posteDeVente(lot.commodity), `Vente au négociant — ${lot.commodity}, ${lot.tons} t`);
    }
    await tx.marketPrice.update({
      where: { commodity: lot.commodity },
      data: { stockTons: { increment: lot.tons } },
    });
    revenue += rev;
    soldTons += lot.tons;
  }
  return { revenue, soldTons };
}

/**
 * Range le grain dans la capacité du silo, vend le reste au négociant.
 *
 * Sans silo la capacité est nulle : rien ne reste en stock.
 */
async function applyGrainCapacity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  opts: {
    farmId: string;
    userId: string;
    capacity: number;
    incoming?: GrainIncoming[];
  },
): Promise<GrainCapacityResult> {
  const incoming = opts.incoming ?? [];
  const items = (await tx.inventoryItem.findMany({
    where: { farmId: opts.farmId, itemCode: { in: [...GRAIN_GOODS] } },
  })) as { id: string; itemCode: string; qty: number; moisture: number }[];
  const plan = allocateGrainIntake({
    capacity: opts.capacity,
    current: grainStockFromItems(items),
    incoming: incoming.map((i) => ({ code: i.code, tons: i.tons })),
  });
  const itemByCode = new Map(items.map((i) => [i.itemCode, i]));
  const incomingByCode = new Map(incoming.map((i) => [i.code, i]));

  for (const g of GRAIN_GOODS) {
    const dump = plan.dumpedExisting[g] ?? 0;
    const item = itemByCode.get(g);
    if (dump > 0 && item) await drawFromStock(tx, item, dump);
  }

  for (const g of GRAIN_GOODS) {
    const keep = plan.keptIncoming[g] ?? 0;
    if (keep <= 0) continue;
    const inc = incomingByCode.get(g);
    await addToStock(tx, opts.farmId, g, keep, inc?.moisture ?? 0, inc?.quality ?? 3);
    if (inc && inc.quality <= 2) {
      const row = await tx.inventoryItem.findFirst({
        where: { farmId: opts.farmId, itemCode: g },
      });
      if (row) {
        await tx.inventoryItem.update({
          where: { id: row.id },
          data: { quality: Math.min(row.quality, inc.quality) },
        });
      }
    }
  }

  const lots: { commodity: string; tons: number; moisture: number }[] = [];
  for (const g of GRAIN_GOODS) {
    const dump = plan.dumpedExisting[g] ?? 0;
    if (dump > 0) {
      const item = itemByCode.get(g);
      lots.push({ commodity: g, tons: dump, moisture: item?.moisture ?? 0 });
    }
    const soldIn = plan.soldIncoming[g] ?? 0;
    if (soldIn > 0) {
      lots.push({
        commodity: g,
        tons: soldIn,
        moisture: incomingByCode.get(g)?.moisture ?? 0,
      });
    }
  }

  const sale = await creditForcedGrainSales(tx, { userId: opts.userId, lots });
  return {
    soldTons: sale.soldTons,
    storedTons: totalGrainTons(plan.stored),
    revenue: sale.revenue,
    reason: grainForcedSaleReason(opts.capacity, sale.soldTons),
  };
}

/** Distribution de la ration : le fourrage et le maïs quittent le silo. */
app.post("/herds/:id/feed", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      hayTons: z.number().min(0).default(0),
      maizeTons: z.number().min(0).default(0),
      barleyTons: z.number().min(0).default(0),
      wheatTons: z.number().min(0).default(0),
      silageTons: z.number().min(0).default(0),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const { hayTons, maizeTons, barleyTons, wheatTons, silageTons } = body.data;
  if (hayTons + maizeTons + barleyTons + wheatTons + silageTons <= 0) {
    res.status(400).json({ error: "Indiquez une quantité à distribuer" });
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { inventory: true } } },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  const hay = herd.farm.inventory.find((i) => i.itemCode === "HAY");
  const maize = herd.farm.inventory.find((i) => i.itemCode === "MAIZE");
  const barley = herd.farm.inventory.find((i) => i.itemCode === "BARLEY");
  const wheat = herd.farm.inventory.find((i) => i.itemCode === "WHEAT");
  const silage = herd.farm.inventory.find((i) => i.itemCode === "SILAGE");
  if (hayTons > (hay?.qty ?? 0)) {
    res.status(409).json({ error: "Réserve insuffisante — achetez de quoi nourrir au négociant" });
    return;
  }
  if (maizeTons > (maize?.qty ?? 0)) {
    res.status(409).json({ error: "Maïs insuffisant" });
    return;
  }
  if (barleyTons > (barley?.qty ?? 0)) {
    res.status(409).json({ error: "Orge insuffisante" });
    return;
  }
  if (wheatTons > (wheat?.qty ?? 0)) {
    res.status(409).json({ error: "Blé insuffisant" });
    return;
  }
  if (silageTons > (silage?.qty ?? 0)) {
    res.status(409).json({ error: "Ensilage insuffisant" });
    return;
  }

  const units = feedUnits(hayTons, maizeTons, barleyTons, wheatTons, silageTons);
  const quality = rationQuality(hayTons, maizeTons, barleyTons, wheatTons, silageTons);
  /**
   * La mangeoire a un fond.
   *
   * Une distribution couvre désormais un jour réel, soit quatre-vingt-seize
   * cycles : sans plafond, un clic de trop viderait le silo pour laisser
   * l'élevage tourner seul une saison. Le refus est explicite plutôt que
   * silencieux — on ne prend pas le grain d'un joueur pour le jeter.
   */
  const maintenant = Date.now();
  // Somme des **bêtes**, pas des lots : un lot de six veaux mange comme six.
  const jeunesEnCours = (
    await prisma.youngBatch.findMany({
      where: { herdId: herd.id, maturesAt: { gt: new Date(maintenant) } },
      select: { count: true },
    })
  ).reduce((n, y) => n + y.count, 0);
  const besoinParCycle = herdFeedNeed({
    size: herd.size,
    young: jeunesEnCours,
    kind: (herd.kind as AnimalKind) ?? "COW",
  });
  const capacite = troughCapacity(besoinParCycle);
  if (herd.feedStock + units > capacite * 1.02) {
    const reste = Math.max(0, capacite - herd.feedStock);
    res.status(409).json({
      error:
        reste < 1
          ? "La mangeoire est pleine — revenez quand les bêtes auront mangé"
          : `La mangeoire ne peut plus recevoir que ${Math.floor(reste)} kg`,
    });
    return;
  }
  await prisma.$transaction(async (tx) => {
    if (hayTons > 0 && hay) await drawFromStock(tx, hay, hayTons);
    if (maizeTons > 0 && maize) await drawFromStock(tx, maize, maizeTons);
    if (barleyTons > 0 && barley) await drawFromStock(tx, barley, barleyTons);
    if (wheatTons > 0 && wheat) await drawFromStock(tx, wheat, wheatTons);
    if (silageTons > 0 && silage) await drawFromStock(tx, silage, silageTons);
    await tx.herd.update({
      where: { id: herd.id },
      data: {
        feedStock: herd.feedStock + units,
        feedQuality: quality,
        lastFedAt: new Date(),
      },
    });
    /*
     * Distribuer une ration comptait pour rien.
     *
     * Ni expérience, ni compteur — alors que `XP_TABLE.FEED` existait et que
     * la quête « Nourrir le troupeau » attendait dix rations. Elle ne pouvait
     * donc **jamais** se terminer : le seul compteur qu'elle lisait n'était
     * écrit nulle part. Un verrou sans serrure.
     */
    await grantXp(tx, body.data.userId, "FEED", {}, { feedings: 1 });
  });
  res.json({ units: Math.round(units * 100) / 100, quality });
});

/**
 * Pailler : la paille du céréalier devient la litière de l'éleveur.
 *
 * C'est la moitié aller du pont entre les deux métiers. Jusqu'ici la paille
 * était produite à la moisson, pressable, vendable — et sans le moindre
 * usage. Elle sert maintenant : une étable paillée garde ses bêtes de
 * meilleure humeur, et **produit davantage de fumier**, que le céréalier
 * rachètera. Chacun vit du déchet de l'autre.
 */
/**
 * Rentrer ou sortir le troupeau, durablement.
 *
 * C'est la décision que le joueur n'avait pas : « Sortir les bêtes » ouvrait
 * une séance de trois heures, puis tout le monde rentrait tout seul. Ici
 * l'état persiste jusqu'à ce qu'on en change — et c'est lui que la simulation
 * lit pour décider si le pré nourrit et si le froid mord.
 */
/**
 * Le journal d'un joueur, et ses totaux par poste.
 *
 * Le Bureau ne pouvait pas répondre à « comment se porte mon activité ? » :
 * le jeu ne gardait qu'un solde. Cette route rend les mouvements bruts et
 * laisse le domaine (`totauxParPoste`) faire l'agrégation — de sorte que la
 * même règle serve à l'écran et à un test.
 */
app.get("/players/:id/ledger", async (req, res) => {
  const jours = Math.min(30, Math.max(1, Number(req.query.jours ?? 7)));
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
  const lignes = await prisma.ledgerEntry.findMany({
    where: { userId: req.params.id, at: { gte: depuis } },
    orderBy: { at: "desc" },
    // Le Bureau montre les mouvements récents ; l'historique complet n'a pas
    // à traverser le réseau pour être résumé.
    take: 200,
  });
  const vues = lignes.map((l) => ({
    amount: l.amount,
    poste: l.poste as LedgerPoste,
    label: l.label,
    at: l.at.toISOString(),
  }));
  res.json({
    lignes: vues,
    postes: totauxParPoste(vues),
    resultat: resultat(vues),
    jours,
  });
});

app.post("/herds/:id/housing", async (req, res) => {
  const body = z
    .object({ userId: z.string(), housing: z.enum(["INSIDE", "OUTSIDE"]) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: {
      farm: true,
      building: { include: { parcel: { include: { buildings: true, zone: true } } } },
    },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }

  if (body.data.housing === "OUTSIDE") {
    const paddock = paddocksFor(herd.building, herd.building.parcel.buildings);
    if (paddock.capacity <= 0) {
      res.status(409).json({
        error: "Aucune aire de sortie accolée — construisez un enclos",
      });
      return;
    }
    // On ne bloque pas la sortie par mauvais temps : c'est justement la
    // décision qu'on veut rendre au joueur. On le prévient, il tranche.
    const zone = herd.building.parcel.zone;
    const season = currentSeason((zone?.hemisphere as Hemisphere) ?? "N", Date.now());
    const snap = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: zone?.code ?? "" } });
    const weather = (snap?.state as WeatherState) ?? "CLEAR";
    const tempC = outdoorTempC(season, weather);
    const risque = thermalPenalty({ kind: herd.kind as AnimalKind, tempC });
    // La séance minutée n'est plus le mécanisme, mais elle reste la belle
    // image : le troupeau franchit la porte et gagne le pré. On la déclenche
    // à la transition, pour que la sortie se voie sur la ferme.
    const window = planGrazing(Date.now(), herdForPlan(herd), {
      adjacent: true,
      cells: paddock.cells,
      capacity: paddock.capacity,
    });
    await prisma.herd.update({
      where: { id: herd.id },
      data: {
        grazingUntil: window ? new Date(window.endsAt) : new Date(Date.now() + 60_000),
        lastGrazedAt: new Date(),
      },
    });
    // L'enclos plus petit que le troupeau ne refuse pas : il borne. Le tick
    // sort ce qui tient, on annonce ici ce qui reste à l'étable.
    const sortent = Math.min(herd.size, paddock.capacity);
    const restent = Math.max(0, herd.size - sortent);
    /**
     * Sortir le troupeau compte, quel que soit le chemin.
     *
     * La mission « Faites sortir le troupeau cinq fois » comptait sur la seule
     * route `/graze`. En faisant du lieu de vie le mécanisme, on lui avait
     * coupé sa source : le joueur pouvait sortir ses bêtes tous les jours sans
     * que le compteur bouge. C'est le même geste, il compte pareil.
     */
    const gain =
      parseHousing(herd.housing) === "OUTSIDE"
        ? null
        : await prisma.$transaction((tx) =>
            grantXp(tx, body.data.userId, "GRAZE", {}, { grazings: 1 }),
          );
    res.json({
      housing: await setHousing(herd.id, "OUTSIDE"),
      gain,
      tempC: Math.round(tempC),
      outside: sortent,
      sheltered: restent,
      warning:
        thermalAlert(risque) === "danger"
          ? "Dehors, les bêtes vont souffrir du temps"
          : restent > 0
            ? `${sortent} bêtes au pré, ${restent} restent à l’étable faute de place`
            : null,
    });
    return;
  }

  /**
   * Rentrer, c'est aussi mettre fin à la séance en cours.
   *
   * Le lieu de vie n'est qu'une moitié de la vérité : la vue et le tick lisent
   * `housing === "OUTSIDE" || grazingUntil > maintenant`. Sortir le troupeau
   * pose une fenêtre de pâture — c'est elle qui fait franchir la porte à
   * l'écran. Rentrer ne posait que `housing = INSIDE` et laissait la fenêtre
   * courir : le message annonçait « bêtes rentrées » pendant qu'elles
   * restaient au pré, parfois de longues minutes. Deux sources pour un seul
   * fait, et elles se contredisaient.
   */
  await prisma.herd.update({ where: { id: herd.id }, data: { grazingUntil: null } });
  res.json({ housing: await setHousing(herd.id, "INSIDE"), tempC: null, warning: null });
});

/** Le lot, réduit à ce dont `planGrazing` a besoin. */
function herdForPlan(h: { size: number; lastGrazedAt: Date | null; kind: string }) {
  return {
    size: h.size,
    // On ne fait pas jouer le délai de vingt heures ici : c'est l'animation
    // qu'on déclenche, pas une ration de pâture à rationner.
    lastGrazedAt: null,
    kind: h.kind as AnimalKind,
  } as Parameters<typeof planGrazing>[1];
}

async function setHousing(id: string, housing: Housing): Promise<Housing> {
  await prisma.herd.update({ where: { id }, data: { housing } });
  return housing;
}

app.post("/herds/:id/bedding", async (req, res) => {
  const body = z
    .object({ userId: z.string(), tons: z.number().min(0).default(0) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { inventory: true } }, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  const kind = herd.kind as AnimalKind;
  const stats = buildingStatsAtLevel(herd.building.type as SharedBuildingType, herd.building.level);
  const capacity = barnCapacity(herd.building.type, stats);
  const plafond = beddingCapacity(kind, capacity);
  /**
   * La litière se sert d'abord dans les bottes, puis dans le vrac.
   *
   * Le ramassage rentre désormais des **bottes** et non plus des tonnes de
   * paille : ne lire que `STRAW` aurait laissé un éleveur avec un hangar
   * plein de bottes et le message « aucune paille en stock ». Les bottes
   * d'abord, parce que c'est ce qu'on a sous la main et que le vrac s'achète
   * pour compléter.
   */
  const bottes = herd.farm.inventory.find((i) => i.itemCode === "STRAW_BALE");
  const paille = herd.farm.inventory.find((i) => i.itemCode === "STRAW");
  const tonnesEnBottes = strawFromBales(bottes?.qty ?? 0);
  const enStock = tonnesEnBottes + (paille?.qty ?? 0);

  // Sans quantité, on paille ce qu'il faut : personne n'a envie de calculer
  // des tonnes de paille à la main pour un geste qu'on répète chaque cycle.
  const place = Math.max(0, plafond - herd.beddingTons);
  /**
   * Sans tonnage demandé, on **refait le lit** au lieu d'en remettre un cycle.
   *
   * Le geste servait une seule journée de jeu, soit un quart d'heure : le
   * bouton « Pailler » était à cliquer trois fois par heure. La litière tient
   * maintenant un jour réel, et « refaire la litière » veut dire la refaire.
   */
  const voulu = body.data.tons > 0 ? body.data.tons : place;
  const tons = Math.round(Math.min(voulu, place, enStock) * 1000) / 1000;

  if (place <= 0) {
    res.status(409).json({ error: "Litière déjà complète" });
    return;
  }
  if (enStock <= 0) {
    res.status(409).json({
      error: "Aucune paille en stock — achetez-en à un céréalier, ou pressez la vôtre",
    });
    return;
  }
  if (tons <= 0) {
    res.status(400).json({ error: "Indiquez une quantité à étaler" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // On entame les bottes en premier, à la botte entière : une demi-botte
    // étalée n'existe pas. Le vrac finit le compte.
    let reste = tons;
    if (bottes && tonnesEnBottes > 0) {
      const prises = Math.min(bottes.qty, Math.ceil((reste - 1e-9) / BALE_TONS));
      if (prises > 0) {
        await drawFromStock(tx, bottes, prises);
        reste = Math.max(0, reste - strawFromBales(prises));
      }
    }
    if (reste > 1e-9 && paille) await drawFromStock(tx, paille, reste);
    await tx.herd.update({
      where: { id: herd.id },
      data: { beddingTons: herd.beddingTons + tons },
    });
  });
  res.json({
    tons,
    beddingTons: Math.round((herd.beddingTons + tons) * 1000) / 1000,
    capacity: plafond,
  });
});

/** Traite : le lait s'accumule entre deux passages, et se perd s'il attend. */
app.post("/herds/:id/milk", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  if (herd.kind !== "COW") {
    res.status(409).json({ error: "Seules les vaches se traient" });
    return;
  }
  if (herd.size <= 0) {
    res.status(409).json({ error: "Étable vide" });
    return;
  }

  const now = Date.now();
  const since = herd.lastMilkedAt?.getTime() ?? herd.bornAt.getTime();
  // La cuve tient un jour réel, plus trente minutes : au-delà de deux cycles,
  // tout ce que les bêtes produisaient disparaissait sans un mot.
  const cycles = Math.min(collectCapCycles(), (now - since) / LIVESTOCK_CYCLE_MS);
  if (cycles < 0.15) {
    const wait = Math.ceil(((0.15 - cycles) * LIVESTOCK_CYCLE_MS) / 1000);
    res.status(409).json({ error: `Les vaches viennent d'être traites — ${wait} s` });
    return;
  }

  /*
   * Le métier de l'éleveur se voit au litre.
   *
   * La compétence multiplie ce que le troupeau donne — elle ne le remplace
   * pas : une bête mal nourrie dans une étable de fortune produira toujours
   * peu, quel que soit le savoir-faire. C'est bien ce qu'on veut, sinon la
   * ration et le bâtiment cesseraient de compter.
   */
  const laitier = await getSkillBonuses(body.data.userId);
  const perCycle =
    milkYield({
      herdSize: herd.size,
      happiness: herd.happiness,
      barnLevel: herd.building.level,
      feedQuality: herd.feedQuality,
    }) * (1 + laitier.MILK_YIELD);
  // Le lait se compte en hectolitres au silo : cent litres la tonne d'échange.
  const litres = perCycle * cycles;
  const hectolitres = Math.round((litres / 100) * 1000) / 1000;
  if (hectolitres <= 0) {
    res.status(409).json({ error: "Rien à traire : le troupeau ne produit pas" });
    return;
  }

  const gain = await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, "MILK", hectolitres, 0, 3);
    await tx.herd.update({ where: { id: herd.id }, data: { lastMilkedAt: new Date(now) } });
    return grantXp(
      tx,
      body.data.userId,
      "COLLECT",
      { animals: herd.size },
      // Le volume compte autant que le nombre de bêtes : trois vaches bien
      // menées ne valent pas trois vaches affamées, et rien ne le mesurait.
      { animalsCollected: herd.size, hlCollected: hectolitres },
    );
  });
  res.json({
    hectolitres,
    litres: Math.round(litres),
    cycles: Math.round(cycles * 100) / 100,
    gain,
  });
});

/** Ramassage : les œufs s'accumulent entre deux passages, et se perdent s'ils attendent. */
app.post("/herds/:id/collect-eggs", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  if (herd.kind !== "HEN") {
    res.status(409).json({ error: "Seules les poules pondent" });
    return;
  }
  if (herd.size <= 0) {
    res.status(409).json({ error: "Poulailler vide" });
    return;
  }

  const now = Date.now();
  const since = herd.lastMilkedAt?.getTime() ?? herd.bornAt.getTime();
  // La cuve tient un jour réel, plus trente minutes : au-delà de deux cycles,
  // tout ce que les bêtes produisaient disparaissait sans un mot.
  const cycles = Math.min(collectCapCycles(), (now - since) / LIVESTOCK_CYCLE_MS);
  if (cycles < 0.15) {
    const wait = Math.ceil(((0.15 - cycles) * LIVESTOCK_CYCLE_MS) / 1000);
    res.status(409).json({ error: `Les œufs viennent d'être ramassés — ${wait} s` });
    return;
  }

  const avicole = await getSkillBonuses(body.data.userId);
  const perCycle =
    eggYield({
      herdSize: herd.size,
      happiness: herd.happiness,
      barnLevel: herd.building.level,
      feedQuality: herd.feedQuality,
    }) * (1 + avicole.EGG_YIELD);
  const crates = Math.round(perCycle * cycles * 100) / 100;
  if (crates <= 0) {
    res.status(409).json({ error: "Rien à ramasser : le lot ne pond pas" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, "EGGS", crates, 0, 3);
    await tx.herd.update({ where: { id: herd.id }, data: { lastMilkedAt: new Date(now) } });
  });
  res.json({ crates, cycles: Math.round(cycles * 100) / 100 });
});

/** Tonte : la laine s'accumule entre deux passages. Elle ne se gâte pas. */
app.post("/herds/:id/shear", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  if (herd.kind !== "SHEEP") {
    res.status(409).json({ error: "Seuls les moutons se tondent" });
    return;
  }
  if (herd.size <= 0) {
    res.status(409).json({ error: "Bergerie vide" });
    return;
  }

  const now = Date.now();
  const since = herd.lastMilkedAt?.getTime() ?? herd.bornAt.getTime();
  // La cuve tient un jour réel, plus trente minutes : au-delà de deux cycles,
  // tout ce que les bêtes produisaient disparaissait sans un mot.
  const cycles = Math.min(collectCapCycles(), (now - since) / LIVESTOCK_CYCLE_MS);
  if (cycles < 0.15) {
    const wait = Math.ceil(((0.15 - cycles) * LIVESTOCK_CYCLE_MS) / 1000);
    res.status(409).json({ error: `Les moutons viennent d'être tondus — ${wait} s` });
    return;
  }

  const ovin = await getSkillBonuses(body.data.userId);
  const perCycle =
    woolYield({
      herdSize: herd.size,
      happiness: herd.happiness,
      barnLevel: herd.building.level,
      feedQuality: herd.feedQuality,
    }) * (1 + ovin.WOOL_YIELD);
  const tons = Math.round(perCycle * cycles * 1000) / 1000;
  if (tons <= 0) {
    res.status(409).json({ error: "Rien à tondre : le lot ne produit pas" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, "WOOL", tons, 0, 3);
    await tx.herd.update({ where: { id: herd.id }, data: { lastMilkedAt: new Date(now) } });
  });
  res.json({ tons, cycles: Math.round(cycles * 100) / 100 });
});

/** Abattage : on convertit des bêtes en viande, définitivement. */
app.post("/herds/:id/slaughter", async (req, res) => {
  const body = z
    .object({ userId: z.string(), count: z.number().int().min(1) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  if (body.data.count > herd.size) {
    res.status(409).json({ error: `Seulement ${herd.size} bête(s) au troupeau` });
    return;
  }

  const now = Date.now();
  const ageMs = herd.avgAgeMs;
  const kgTotal = meatYield({
    herdSize: body.data.count,
    happiness: herd.happiness,
    averageAgeMs: ageMs,
    barnLevel: herd.building.level,
    kind: herd.kind as AnimalKind,
  });
  const tons = Math.round((kgTotal / 1000) * 1000) / 1000;
  const maturity = Math.min(1, ageMs / MEAT_MATURITY_MS);

  await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, "MEAT", tons, 0, herd.happiness > 0.7 ? 4 : 3);
    const left = herd.size - body.data.count;
    if (left <= 0) await tx.herd.delete({ where: { id: herd.id } });
    else await tx.herd.update({ where: { id: herd.id }, data: { size: left } });
  });
  res.json({
    slaughtered: body.data.count,
    tons,
    kg: Math.round(kgTotal),
    maturity: Math.round(maturity * 100),
    remaining: herd.size - body.data.count,
  });
});

/** Achat d'intrants au négociant — le fourrage, pour l'instant. */
/**
 * Le temps de route, réglable pour les tests.
 *
 * Douze secondes est le bon délai pour un joueur ; c'est une éternité dans une
 * suite d'intégration, où deux tests achètent puis se servent aussitôt. La
 * couture est explicite et ne sert qu'à cela : le comportement testé reste le
 * même — on paie, la caisse arrive, il faut la rentrer —, seul le compte à
 * rebours est raccourci.
 */
const TRAVEL_MS = Number(process.env.FARMSIM_DELIVERY_MS ?? DELIVERY_TRAVEL_MS);

/**
 * Où poser une caisse de livraison.
 *
 * Sur une des dix places de la cour, qui est **hors** de la grille : `x` et `y`
 * ne désignent plus une case de champ mais une place de dépôt. Une caisse ne
 * peut donc plus tomber au milieu du blé, et cultiver toute sa terre ne bloque
 * plus les achats.
 *
 * On évite les places déjà prises : deux commandes passées coup sur coup se
 * superposeraient, et il n'y aurait qu'un objet à cliquer pour deux caisses.
 */
async function placeDelivery(
  farmId: string,
): Promise<{ parcelId: string; x: number; y: number } | null> {
  const parcel = await prisma.parcel.findFirst({ where: { farmId } });
  if (!parcel) return null;
  const prises = await prisma.supplyOrder.findMany({ where: { farmId } });
  const place = freeYardSlot(prises.map((d) => ({ x: d.x, y: d.y })));
  return place ? { parcelId: parcel.id, x: place.x, y: place.y } : null;
}

/**
 * Rentrer une caisse : la marchandise passe enfin au stock.
 *
 * Un seul chemin pour les deux cas — le geste du joueur et le filet
 * automatique —, faute de quoi les deux finiraient par diverger sur ce qui
 * compte : ce qui entre au silo.
 */
async function collectDelivery(d: {
  id: string;
  farmId: string;
  commodity: string;
  tons: number;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await addToStock(tx, d.farmId, d.commodity as TradeGood, d.tons, 0, 3);
    await tx.supplyOrder.delete({ where: { id: d.id } });
  });
}

/** Les commandes en route ou posées dans la cour, pour une ferme. */
app.get("/farms/:id/supplies", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Jeton requis" });
    return;
  }
  const farm = await prisma.farm.findUnique({ where: { id: req.params.id } });
  if (!farm || farm.userId !== auth.user.id) {
    res.status(403).json({ error: "Ferme non possédée" });
    return;
  }
  const list = await prisma.supplyOrder.findMany({
    where: { farmId: farm.id },
    orderBy: { arrivesAt: "asc" },
  });
  res.json({
    supplies: list.map((d) => ({
      id: d.id,
      commodity: d.commodity,
      tons: d.tons,
      arrivesAt: d.arrivesAt.getTime(),
      parcelId: d.parcelId,
      x: d.x,
      y: d.y,
    })),
  });
});

/** Rentrer une caisse : c'est le geste, et c'est lui qui verse au stock. */
app.post("/supplies/:id/collect", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Jeton requis" });
    return;
  }
  const d = await prisma.supplyOrder.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!d || d.farm.userId !== auth.user.id) {
    res.status(403).json({ error: "Livraison inconnue" });
    return;
  }
  if (d.arrivesAt.getTime() > Date.now()) {
    res.status(409).json({ error: "Le camion n'est pas encore arrivé" });
    return;
  }
  await collectDelivery(d);
  res.json({ collected: d.commodity, tons: d.tons });
});

app.post("/market/buy", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: z.enum(PURCHASABLE_GOODS as unknown as [TradeGood, ...TradeGood[]]),
      tons: z.number().positive().max(100_000),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: true },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  const base = market?.price ?? GOOD_DEFS[body.data.commodity].basePrice;
  const cost = Math.round(dealerAskPrice(base) * body.data.tons);
  if (!peutPayer(user, cost)) {
    res.status(402).json({ error: `€ insuffisants — ${cost} requis` });
    return;
  }
  /**
   * On paie tout de suite, on reçoit après.
   *
   * La marchandise n'entre pas au silo ici : elle part en camion. Tant que la
   * caisse n'est pas rentrée, elle n'existe pas au stock — c'est ce qui donne
   * son poids au geste, et ce qui rend la commande visible sur la ferme au
   * lieu d'être un chiffre qui change quelque part.
   */
  const pose = await placeDelivery(user.farm.id);
  if (!pose) {
    res.status(409).json({ error: YARD_FULL });
    return;
  }
  const maintenant = Date.now();
  const commande = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, cost, "INTRANTS", `Achat au négociant — ${body.data.commodity}, ${body.data.tons} t`);
    return tx.supplyOrder.create({
      data: {
        farmId: user.farm!.id,
        commodity: body.data.commodity,
        tons: body.data.tons,
        arrivesAt: new Date(maintenant + TRAVEL_MS),
        autoAt: new Date(maintenant + TRAVEL_MS + DELIVERY_AUTO_MS),
        parcelId: pose.parcelId,
        x: pose.x,
        y: pose.y,
      },
    });
  });
  res.json({
    bought: body.data.tons,
    cost,
    pricePerTon: dealerAskPrice(base),
    delivery: { id: commande.id, arrivesAt: commande.arrivesAt.getTime() },
  });
});

/** Reprise d'une machine — l'état conditionne le prix. */
app.post("/machines/:id/sell", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!machine?.farm || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  if (machine.busyUntil && machine.busyUntil.getTime() > Date.now()) {
    res.status(409).json({ error: "Cet engin est au champ — attendez la fin du chantier." });
    return;
  }
  // Reprise immédiate : le concessionnaire paie moins que la cote entre
  // joueurs, et c'est le prix de ne pas attendre.
  const value = machineDealerValue(machine.type as MachineType, {
    condition: machine.condition,
    hours: machine.hours,
    tier: asTier(machine.tier),
  });
  const nom = machineVariant(machine.type as MachineType, asTier(machine.tier)).label;
  await prisma.$transaction(async (tx) => {
    // Libérer la case si l'engin était stationné sur la parcelle.
    await tx.parcelCell.updateMany({
      where: { machineId: machine.id },
      data: { kind: "EMPTY", machineId: null },
    });
    await tx.machine.delete({ where: { id: machine.id } });
    await crediter(tx, body.data.userId, value, "MACHINES", `Reprise concessionnaire — ${nom}`);
  });
  res.json({ sold: machine.type, value });
});

/* ------------------------------------------------------------------ */
/* Marché de l'occasion                                                 */
/* ------------------------------------------------------------------ */

/**
 * Pose une machine sur une ferme et la gare si une case est libre.
 *
 * Partagé par l'achat d'occasion et le retrait d'annonce : les deux font
 * exactement la même chose, et les avoir écrits deux fois aurait garanti
 * qu'ils divergent.
 */
async function installMachine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  farmId: string,
  etat: {
    type: string;
    tier: number;
    hours: number;
    condition: number;
    grease: number;
    dirt: number;
    breakdown: string | null;
  },
) {
  const machine = await tx.machine.create({
    data: {
      farmId,
      type: etat.type,
      tier: etat.tier,
      hours: etat.hours,
      condition: etat.condition,
      grease: etat.grease,
      greased: etat.grease > 0,
      dirt: etat.dirt,
      breakdown: etat.breakdown,
    },
  });
  // `Parcel` n'a pas de `createdAt` : trier dessus renvoyait un 500 muet.
  const parcel = await tx.parcel.findFirst({ where: { farmId }, orderBy: { id: "asc" } });
  if (parcel) {
    // La cour de stationnement est hors grille : plus besoin de chercher une
    // case libre, et un achat ne peut plus être bloqué par une ferme pleine.
    await tx.machine.update({ where: { id: machine.id }, data: { parkedParcelId: parcel.id } });
  }
  return machine;
}

/** Les annonces périmées rendent l'engin à son vendeur. */
async function expireMachineListings() {
  const perimees = await prisma.machineListing.findMany({
    where: { status: "OPEN", expiresAt: { lte: new Date() } },
    include: { seller: { include: { farm: true } } },
  });
  for (const a of perimees) {
    await prisma.$transaction(async (tx) => {
      await tx.machineListing.update({ where: { id: a.id }, data: { status: "EXPIRED" } });
      if (a.seller?.farm) await installMachine(tx, a.seller.farm.id, a);
    });
  }
}

/** Le marché de l'occasion, cote comprise pour que le prix se juge. */
app.get("/machines/listings", async (_req, res) => {
  await expireMachineListings();
  const listings = await prisma.machineListing.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { seller: { select: { id: true, displayName: true } } },
  });
  res.json({
    listings: listings.map((l) => ({
      ...l,
      // La cote voyage avec l'annonce : sans elle, « 900 € » ne se juge pas.
      quote: machineResaleValue(l.type as MachineType, {
        condition: l.condition,
        hours: l.hours,
        tier: asTier(l.tier),
      }),
      name: MACHINE_DEFS[l.type as MachineType]
        ? machineVariant(l.type as MachineType, asTier(l.tier)).label
        : l.type,
    })),
  });
});

/** Mettre une de ses machines en vente. L'engin quitte la ferme sur-le-champ. */
app.post("/machines/:id/list", async (req, res) => {
  const body = z
    .object({ userId: z.string(), priceCrd: z.number().positive().max(1_000_000) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!machine?.farm || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const def = MACHINE_DEFS[machine.type as MachineType];
  if (!def) {
    res.status(400).json({ error: "Type de machine inconnu" });
    return;
  }
  if (machine.busyUntil && machine.busyUntil.getTime() > Date.now()) {
    res.status(409).json({ error: "Cet engin est au champ — attendez la fin du chantier." });
    return;
  }
  const cote = machineResaleValue(machine.type as MachineType, {
    condition: machine.condition,
    hours: machine.hours,
    tier: asTier(machine.tier),
  });
  // Un prix libre, mais pas n'importe lequel : sans bornes, la criée sert à
  // se transférer de l'argent entre comptes plutôt qu'à vendre du matériel.
  const min = Math.round(cote * MACHINE_LISTING_MIN_RATE);
  const max = Math.round(cote * MACHINE_LISTING_MAX_RATE);
  if (body.data.priceCrd < min || body.data.priceCrd > max) {
    res.status(409).json({ error: `Prix hors bornes — entre ${min} et ${max} € (cote ${cote})` });
    return;
  }
  const listing = await prisma.$transaction(async (tx) => {
    await tx.parcelCell.updateMany({
      where: { machineId: machine.id },
      data: { kind: "EMPTY", machineId: null },
    });
    await tx.machine.delete({ where: { id: machine.id } });
    return tx.machineListing.create({
      data: {
        sellerId: body.data.userId,
        type: machine.type,
        tier: machine.tier,
        hours: machine.hours,
        condition: machine.condition,
        grease: machine.grease,
        dirt: machine.dirt,
        breakdown: machine.breakdown,
        priceCrd: body.data.priceCrd,
        expiresAt: new Date(Date.now() + MACHINE_LISTING_TTL_MS),
      },
    });
  });
  res.status(201).json({ listing, quote: cote });
});

/** Retirer son annonce — l'engin revient à la ferme. */
app.post("/machines/listings/:id/cancel", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const listing = await prisma.machineListing.findUnique({
    where: { id: req.params.id },
    include: { seller: { include: { farm: { include: { machines: true } } } } },
  });
  if (!listing || listing.sellerId !== body.data.userId) {
    res.status(403).json({ error: "Annonce non possédée" });
    return;
  }
  if (listing.status !== "OPEN") {
    res.status(409).json({ error: "Annonce déjà close" });
    return;
  }
  const farm = listing.seller?.farm;
  if (!farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const bonuses = await getFarmBonuses(farm.id);
  if (farm.machines.length >= bonuses.machineSlots) {
    res.status(409).json({ error: await garagePleinMessage(farm.id, bonuses.machineSlots) });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.machineListing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } });
    await installMachine(tx, farm.id, listing);
  });
  res.json({ cancelled: listing.id });
});

/** Acheter une machine d'occasion. */
app.post("/machines/listings/:id/buy", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  await expireMachineListings();
  const listing = await prisma.machineListing.findUnique({ where: { id: req.params.id } });
  if (!listing || listing.status !== "OPEN") {
    res.status(404).json({ error: "Annonce introuvable ou déjà vendue" });
    return;
  }
  if (listing.sellerId === body.data.userId) {
    res.status(409).json({ error: "On n'achète pas sa propre annonce" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  if (user.farm.machines.length >= bonuses.machineSlots) {
    res.status(409).json({
      error: await garagePleinMessage(user.farm.id, bonuses.machineSlots),
    });
    return;
  }
  if (!peutPayer(user, listing.priceCrd)) {
    res.status(402).json({ error: "€ insuffisants" });
    return;
  }
  const nom = MACHINE_DEFS[listing.type as MachineType]
    ? machineVariant(listing.type as MachineType, asTier(listing.tier)).label
    : listing.type;
  const machine = await prisma.$transaction(async (tx) => {
    // La vente se clôt dans la même écriture que le débit : deux acheteurs
    // simultanés ne peuvent pas repartir chacun avec le même tracteur.
    const prise = await tx.machineListing.updateMany({
      where: { id: listing.id, status: "OPEN" },
      data: { status: "SOLD", buyerId: user.id, soldAt: new Date() },
    });
    if (prise.count === 0) throw new Error("ANNONCE_DEJA_VENDUE");
    await debit(tx, user.id, listing.priceCrd, "MACHINES", `Achat d'occasion — ${nom}`);
    await crediter(tx, listing.sellerId, listing.priceCrd, "MACHINES", `Vente d'occasion — ${nom}`);
    return installMachine(tx, user.farm!.id, listing);
  }).catch((e) => {
    if (e instanceof Error && e.message === "ANNONCE_DEJA_VENDUE") return null;
    throw e;
  });
  if (!machine) {
    res.status(409).json({ error: "Annonce déjà vendue" });
    return;
  }
  res.status(201).json({ machine });
});

/** Démolition d'un bâtiment — les niveaux payés se récupèrent en partie. */
app.post("/buildings/:id/sell", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } }, storedMachines: true },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  // Fenêtre de regret : une construction toute fraîche se démolit intégralement
  // remboursée. Passé ce délai, c'est un choix d'exploitation, pas une erreur
  // de clic — et le taux de revente ordinaire s'applique.
  const value = buildingResaleValue(
    building.type as SharedBuildingType,
    building.level,
    Date.now() - building.createdAt.getTime(),
  );
  await prisma.$transaction(async (tx) => {
    // Les engins rangés à l'intérieur ressortent, ils ne disparaissent pas
    // avec le hangar.
    await tx.machine.updateMany({
      where: { storedInBuildingId: building.id },
      data: { storedInBuildingId: null },
    });
    await tx.parcelCell.updateMany({
      where: { buildingId: building.id },
      data: { kind: "EMPTY", buildingId: null },
    });
    await tx.building.delete({ where: { id: building.id } });
    await crediter(tx, body.data.userId, value, "BATIMENTS", `Démolition — ${BUILDING_DEFS[building.type as SharedBuildingType]?.name ?? building.type}`);
  });
  const bonuses = await getFarmBonuses(building.parcel.farm.id);
  res.json({ sold: building.type, level: building.level, value, bonuses });
});

/**
 * Ce qu'on répond à qui n'a plus de place au garage.
 *
 * « Construisez un hangar matériel » était le conseil dans tous les cas, y
 * compris à qui en a déjà un — et qui ne pouvait donc rien en faire. Le geste
 * utile dépend de ce que la ferme possède déjà.
 */
async function garagePleinMessage(farmId: string, slots: number): Promise<string> {
  const hangars = await prisma.building.count({
    where: { parcel: { farmId }, type: "MACHINE_SHED" },
  });
  const geste = hangars
    ? "agrandissez votre hangar matériel, bâtissez-en un second, ou revendez un engin"
    : "bâtissez un hangar matériel, ou revendez un engin";
  return `Garage plein — ${slots} emplacements. Pour en avoir plus, ${geste}.`;
}

app.post("/machines/buy", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      // Dérivé du catalogue : une liste écrite à la main ici serait une
      // deuxième source de vérité, et c'est exactement ce qui avait rendu
      // trois bâtiments inachetables après leur ajout.
      type: z.enum(Object.keys(MACHINE_DEFS) as [MachineType, ...MachineType[]]),
      tier: z.number().int().min(1).max(5).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const def = MACHINE_DEFS[body.data.type];
  const tier = asTier(body.data.tier);
  const prix = machineCost(def.type, tier);
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true, parcels: { include: { buildings: true } } } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  if (!peutPayer(user, prix)) {
    res.status(402).json({ error: "€ insuffisants" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  const owned = user.farm.machines.length;
  if (owned >= bonuses.machineSlots) {
    res.status(409).json({
      error: await garagePleinMessage(user.farm.id, bonuses.machineSlots),
    });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    await debit(tx, user.id, prix, "MACHINES", `Achat — ${machineVariant(def.type, tier).label}`);
    const machine = await tx.machine.create({
      data: { farmId: user.farm!.id, type: def.type, tier, condition: 100 },
    });
    const firstParcel = user.farm!.parcels[0];
    if (firstParcel) {
      await tx.machine.update({
        where: { id: machine.id },
        data: { parkedParcelId: firstParcel.id },
      });
    }
    return machine;
  });
  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    include: { farm: { include: farmInclude() } },
  });
  res.status(201).json({ machine: result, player: refreshed });
});

/**
 * Passage au palier suivant, sur place.
 *
 * On n'achète pas un deuxième exemplaire : l'engin est repris, le suivant
 * arrive neuf, et on paie la différence de catalogue. C'est le même geste
 * qu'agrandir un hangar — et c'est ce qui rend les cinq paliers visibles
 * une fois le parc déjà constitué, pas seulement au moment de l'achat.
 */
app.post("/machines/:id/upgrade", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { user: true } } },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  if (machine.busyUntil && machine.busyUntil.getTime() > Date.now()) {
    res.status(409).json({ error: "Cet engin est au champ — attendez la fin du chantier." });
    return;
  }
  const type = machine.type as MachineType;
  if (!MACHINE_DEFS[type]) {
    res.status(400).json({ error: "Type machine inconnu" });
    return;
  }
  const current = asTier(machine.tier);
  const next = nextMachineTier(current);
  const cost = machineUpgradeCost(type, current);
  if (!next || cost === null) {
    res.status(409).json({ error: "Niveau maximum atteint" });
    return;
  }
  if (!peutPayer(machine.farm.user, cost)) {
    res.status(402).json({ error: `€ insuffisants — ${cost} requis` });
    return;
  }
  const fiche = machineVariant(type, next);
  const updated = await prisma.$transaction(async (tx) => {
    await debit(tx, body.data.userId, cost, "MACHINES", `Amélioration — ${fiche.label}`);
    await grantXp(tx, body.data.userId, "MACHINE_BUY", { cost });
    return tx.machine.update({
      where: { id: machine.id },
      data: {
        tier: next,
        condition: 100,
        hours: 0,
        grease: GREASE_FULL,
        greased: true,
        dirt: 0,
        greaseSkipStreak: 0,
        breakdown: null,
      },
    });
  });
  res.json({
    machine: updated,
    cost,
    tier: next,
    label: fiche.label,
  });
});

app.post("/machines/:id/repair", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      extent: z.enum(["half", "full"]).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const extent = body.data.extent ?? "full";
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { user: true } } },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const def = MACHINE_DEFS[machine.type as MachineType];
  if (!def) {
    res.status(400).json({ error: "Type machine inconnu" });
    return;
  }
  if (machine.condition >= 99.5) {
    res.status(409).json({ error: "Déjà en parfait état" });
    return;
  }
  const target =
    extent === "half" ? repairHalfwayTarget(machine.condition) : 100;
  if (target <= machine.condition + 0.05) {
    res.status(409).json({ error: "Rien à gagner" });
    return;
  }
  const bonuses = await getFarmBonuses(machine.farmId);
  const quote = repairMachineCost({
    condition: machine.condition,
    repairCostPerPoint: machineRepairPerPoint(def.type, asTier(machine.tier)),
    targetCondition: target,
    workshopDiscount: bonuses.repairDiscount,
  });
  if (!peutPayer(machine.farm.user, quote.cost)) {
    res.status(402).json({
      error: `Réparation ${quote.cost} € — fonds insuffisants. Rafistoler coûte moins.`,
    });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await debit(tx, body.data.userId, quote.cost, "MACHINES", "Réparation");
    await tx.machine.update({
      where: { id: machine.id },
      data: {
        condition: quote.nextCondition,
        greased: true,
        grease: GREASE_FULL,
        dirt: 0,
        greaseSkipStreak: 0,
        breakdown: null,
      },
    });
  });
  res.json({
    machineId: machine.id,
    condition: quote.nextCondition,
    cost: quote.cost,
    extent,
    discount: bonuses.repairDiscount,
  });
});

async function loadOwnedMachine(id: string, userId: string) {
  const machine = await prisma.machine.findUnique({
    where: { id },
    include: { farm: { include: { user: true } } },
  });
  if (!machine || machine.farm.userId !== userId) return null;
  return machine;
}

/**
 * Ce que coûte un entretien, panneaux solaires déduits.
 *
 * Un seul endroit pour la remise : trois routes facturent l'entretien —
 * graissage, nettoyage, révision — et trois calculs séparés finiraient par
 * diverger sur ce qui compte, le prix payé.
 */
async function careCost(farmId: string, base: number): Promise<number> {
  const b = await getFarmBonuses(farmId);
  // Deux remises qui se cumulent sans se confondre : l'atelier et le tour de
  // main. Le prix ne descend jamais sous un € — un entretien gratuit ferait
  // disparaître la décision qu'il représente.
  const remise = Math.min(0.75, b.careDiscount + b.skills.REPAIR_COST);
  return Math.max(1, Math.round(base * (1 - remise)));
}

app.post("/machines/:id/grease", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await loadOwnedMachine(req.params.id, body.data.userId);
  if (!machine) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  if ((machine.grease ?? GREASE_FULL) >= GREASE_FULL - 0.5) {
    res.status(409).json({ error: "Déjà plein de graisse" });
    return;
  }
  const prixGraissage = await careCost(machine.farmId, GREASE_COST_CRD);
  if (!peutPayer(machine.farm.user, prixGraissage)) {
    res.status(402).json({ error: `Graissage ${prixGraissage} € — fonds insuffisants` });
    return;
  }
  const gain = await prisma.$transaction(async (tx) => {
    await debit(tx, body.data.userId, prixGraissage, "MACHINES", "Graissage");
    await tx.machine.update({
      where: { id: machine.id },
      data: { greased: true, grease: GREASE_FULL, greaseSkipStreak: 0 },
    });
    return grantXp(
      tx,
      body.data.userId,
      "MACHINE_CARE",
      { cost: GREASE_COST_CRD },
      { machinesServiced: 1 },
    );
  });
  res.json({
    machineId: machine.id,
    greased: true,
    grease: GREASE_FULL,
    cost: GREASE_COST_CRD,
    gain,
  });
});

app.post("/machines/:id/clean", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await loadOwnedMachine(req.params.id, body.data.userId);
  if (!machine) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  if (machine.dirt < 8) {
    res.status(409).json({ error: "Déjà propre" });
    return;
  }
  const prixLavage = await careCost(machine.farmId, CLEAN_COST_CRD);
  if (!peutPayer(machine.farm.user, prixLavage)) {
    res.status(402).json({ error: `Nettoyage ${prixLavage} € — fonds insuffisants` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await debit(tx, body.data.userId, prixLavage, "MACHINES", "Lavage");
    await tx.machine.update({
      where: { id: machine.id },
      data: { dirt: 0 },
    });
  });
  res.json({ machineId: machine.id, dirt: 0, cost: prixLavage });
});

app.post("/machines/:id/service", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      kind: z.enum(["BELT", "HYDRAULIC", "ENGINE"]),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await loadOwnedMachine(req.params.id, body.data.userId);
  if (!machine) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const def = MACHINE_DEFS[machine.type as MachineType];
  if (!def) {
    res.status(400).json({ error: "Type machine inconnu" });
    return;
  }
  const kind = body.data.kind as BreakdownKind;
  const expected = machine.breakdown
    ? isBreakdownKind(machine.breakdown)
      ? machine.breakdown
      : pickBreakdownKind(machine.condition)
    : pickBreakdownKind(machine.condition);
  if (kind !== expected && machine.breakdown) {
    res.status(409).json({ error: "Ce n'est pas cette panne." });
    return;
  }
  const target = repairTargetCondition(kind, machine.condition);
  if (target <= machine.condition + 0.05 && !machine.breakdown) {
    res.status(409).json({ error: "Rien à réparer" });
    return;
  }
  const bonuses = await getFarmBonuses(machine.farmId);
  const quote = repairMachineCost({
    condition: machine.condition,
    repairCostPerPoint: machineRepairPerPoint(def.type, asTier(machine.tier)),
    targetCondition: target,
    workshopDiscount: bonuses.repairDiscount,
  });
  /**
   * Atelier et panneaux se cumulent, mais sur des choses différentes :
   * l'atelier négocie la pièce, les panneaux paient le courant. Les deux
   * remises s'appliquent donc l'une après l'autre, et non l'une ou l'autre.
   */
  const prixRevision = Math.max(1, Math.round(quote.cost * (1 - bonuses.careDiscount)));
  if (!peutPayer(machine.farm.user, prixRevision)) {
    res.status(402).json({ error: `Réparation ${prixRevision} € — fonds insuffisants` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await debit(tx, body.data.userId, prixRevision, "MACHINES", "Révision");
    await tx.machine.update({
      where: { id: machine.id },
      data: {
        condition: target,
        breakdown: null,
        greased: true,
        grease: GREASE_FULL,
        greaseSkipStreak: 0,
      },
    });
  });
  res.json({
    machineId: machine.id,
    condition: target,
    cost: prixRevision,
    kind,
    breakdown: null,
  });
});

app.post("/machines/:id/park", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      parcelId: z.string(),
      // La cour de stationnement est hors grille : la case n'a plus de sens.
      // On tolère encore `x` et `y` pour ne pas casser un client ouvert avant
      // la mise à jour, mais on ne s'en sert plus.
      x: z.number().int().optional(),
      y: z.number().int().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true, cell: true },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: body.data.parcelId },
    include: { farm: true, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    // Une machine rangée jusqu'ici sur une case rend sa terre au champ.
    if (machine.cell) {
      await tx.parcelCell.updateMany({
        where: { machineId: machine.id },
        data: { kind: "EMPTY", machineId: null },
      });
    }
    await tx.machine.update({
      where: { id: machine.id },
      data: {
        parkedParcelId: parcel.id,
        storedInBuildingId: null,
      },
    });
  });

  res.json({ ok: true });
});

app.post("/machines/:id/store", async (req, res) => {
  const body = z
    .object({ userId: z.string(), buildingId: z.string() })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: body.data.buildingId },
    include: { parcel: true, storedMachines: true },
  });
  if (!building || building.parcel.farmId !== machine.farmId) {
    res.status(403).json({ error: "Hangar invalide" });
    return;
  }
  if (building.type !== "MACHINE_SHED") {
    res.status(400).json({ error: "Ce bâtiment ne range pas le matériel" });
    return;
  }
  const slots = BUILDING_DEFS.MACHINE_SHED.machineSlots ?? 0;
  if (building.storedMachines.length >= slots) {
    res.status(409).json({ error: "Hangar plein" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.parcelCell.updateMany({
      where: { machineId: machine.id },
      data: { kind: "EMPTY", machineId: null },
    });
    await tx.machine.update({
      where: { id: machine.id },
      data: {
        parkedParcelId: null,
        storedInBuildingId: building.id,
      },
    });
  });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Commerce : négociant, cours mondial, criée entre joueurs            */
/* ------------------------------------------------------------------ */

/** Retire des tonnes du stock d'une ferme, en supprimant le lot s'il est vidé. */
async function drawFromStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  item: { id: string; qty: number },
  tons: number,
) {
  const left = item.qty - tons;
  if (left <= 0.0001) await tx.inventoryItem.delete({ where: { id: item.id } });
  else await tx.inventoryItem.update({ where: { id: item.id }, data: { qty: left } });
}

/**
 * Passage des courtiers : ils raflent les lots raisonnablement prix.
 *
 * Sans eux, la criée resterait déserte tant que la population est faible, et
 * le canal le mieux payé des trois serait décoratif.
 */
async function runNpcBuyers() {
  const open = await prisma.marketListing.findMany({
    where: { status: "OPEN", expiresAt: { gt: new Date() } },
    include: { seller: true },
  });
  if (!open.length) return;
  const prices = await prisma.marketPrice.findMany();
  const now = Date.now();

  for (const listing of open) {
    const market = prices.find((p) => p.commodity === listing.commodity);
    if (!market) continue;
    const willBuy = npcWouldBuy({
      pricePerTon: listing.pricePerTon,
      marketPrice: market.price,
      ageMs: now - listing.createdAt.getTime(),
      roll: Math.random(),
    });
    if (!willBuy) continue;

    const proceeds = listingProceeds(listing.pricePerTon, listing.tons);
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.marketListing.findUnique({ where: { id: listing.id } });
      if (!fresh || fresh.status !== "OPEN") return;
      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "SOLD", soldAt: new Date(now) },
      });
      await crediter(tx, listing.sellerId, proceeds, posteDeVente(listing.commodity), `Vente au carnet — ${listing.commodity}, ${listing.tons} t`);
      // Le courtier remet la marchandise en circulation : le carnet s'épaissit.
      await tx.marketPrice.update({
        where: { commodity: listing.commodity },
        data: { stockTons: { increment: listing.tons } },
      });
    });
  }
}

/** Ferme les annonces expirées et rend la marchandise à leurs vendeurs. */
async function expireListings() {
  const stale = await prisma.marketListing.findMany({
    where: { status: "OPEN", expiresAt: { lt: new Date() } },
    include: { seller: { include: { farm: true } } },
  });
  for (const listing of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "EXPIRED" },
      });
      const farmId = listing.seller.farm?.id;
      if (!farmId) return;
      // Un lot périssable a vieilli en vitrine : déposer à la criée ne doit
      // pas être une façon d'échapper à la péremption.
      const back = afterSpoilage({
        good: listing.commodity as TradeGood,
        qty: listing.tons,
        elapsedMs: Date.now() - listing.createdAt.getTime(),
        cycleMs: LIVESTOCK_CYCLE_MS,
      });
      if (back <= 0) return;
      const existing = await tx.inventoryItem.findFirst({
        where: { farmId, itemCode: listing.commodity },
      });
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: {
            qty: existing.qty + back,
            moisture: mergeMoisture(
              existing.qty,
              existing.moisture,
              back,
              listing.moisture,
            ),
          },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            farmId,
            itemCode: listing.commodity,
            qty: back,
            quality: listing.quality,
            moisture: listing.moisture,
          },
        });
      }
    });
  }
}

/** Devis comparé des trois canaux, pour un lot donné. */
app.get("/market/quote", async (req, res) => {
  const parsed = z
    .object({
      commodity: sellableGood,
      tons: z.coerce.number().positive(),
      moisture: z.coerce.number().min(0).max(1).optional(),
      ask: z.coerce.number().positive().optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: parsed.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  res.json({
    marketPrice: market.price,
    stockTons: market.stockTons,
    channels: quoteAllChannels({
      commodity: parsed.data.commodity,
      tons: parsed.data.tons,
      marketPrice: market.price,
      stockTons: market.stockTons,
      moisturePenalty: moistureSellPenalty(parsed.data.moisture ?? 0.12),
      askPricePerTon: parsed.data.ask,
    }),
  });
});

/** Rachat par le négociant : immédiat, garanti, à prix bas. */
app.post("/market/dealer", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: sellableGood,
      tons: z.number().positive().max(100_000),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  if (body.data.tons < DEALER_MIN_TONS) {
    res.status(409).json({ error: `Lot trop petit — ${DEALER_MIN_TONS} t minimum` });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { inventory: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const inv = user.farm.inventory.find((i) => i.itemCode === body.data.commodity);
  const tons = settleSaleTons(body.data.tons, inv?.qty ?? 0);
  if (!inv || tons === null) {
    res.status(409).json({ error: "Stock insuffisant" });
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const keep = 1 - moistureSellPenalty(inv.moisture);
  // Le négociant paie moins, mais il paie aussi le tour de main : sans cela,
  // vendre au négociant contournerait la compétence au lieu de la subir.
  const marchand = await getSkillBonuses(body.data.userId);
  const pricePerTon = dealerPricePerTon(market.price) * keep * (1 + marchand.SALE_PRICE);
  const revenue = Math.round(pricePerTon * tons);

  await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv, tons);
    await crediter(tx, user.id, revenue, posteDeVente(body.data.commodity), `Vente au négociant — ${body.data.commodity}, ${tons} t`);
    // Le négociant revend au marché : le stock mondial monte, le cours cède.
    await tx.marketPrice.update({
      where: { commodity: body.data.commodity },
      data: { stockTons: { increment: tons } },
    });
  });
  res.json({
    revenue,
    tons,
    pricePerTon: Math.round(pricePerTon * 100) / 100,
    channel: "DEALER",
  });
});

/** Annonces ouvertes, les plus avantageuses d'abord. */
app.get("/market/listings", async (req, res) => {
  await expireListings();
  const mine = typeof req.query.userId === "string" ? req.query.userId : null;
  const listings = await prisma.marketListing.findMany({
    where: { status: "OPEN" },
    include: { seller: { select: { id: true, displayName: true } } },
    orderBy: [{ pricePerTon: "asc" }],
    take: 60,
  });
  res.json({
    listings: listings.map((l) => ({
      id: l.id,
      commodity: l.commodity,
      tons: l.tons,
      pricePerTon: l.pricePerTon,
      total: Math.round(l.pricePerTon * l.tons),
      moisture: l.moisture,
      quality: l.quality,
      sellerName: l.seller.displayName,
      mine: mine === l.sellerId,
      expiresInMs: Math.max(0, l.expiresAt.getTime() - Date.now()),
    })),
  });
});

/** Dépôt d'une annonce : la marchandise quitte le silo, les frais sont dus. */
app.post("/market/listings", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: sellableGood,
      tons: z.number().positive().max(100_000),
      pricePerTon: z.number().positive().max(1_000_000),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { inventory: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const inv = user.farm.inventory.find((i) => i.itemCode === body.data.commodity);
  // Mettre en criée la totalité d'un lot achoppait sur les mêmes centièmes que
  // la vente directe : on règle le tonnage sur ce qui est réellement en stock.
  const tons = settleSaleTons(body.data.tons, inv?.qty ?? 0) ?? body.data.tons;
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const openListings = await prisma.marketListing.count({
    where: { sellerId: user.id, status: "OPEN" },
  });
  const verdict = canList({
    pricePerTon: body.data.pricePerTon,
    tons,
    marketPrice: market.price,
    openListings,
    stockTons: inv?.qty ?? 0,
    crd: estArgentIllimite(user.email) ? DEV_DISPLAY_CRD : user.crd,
  });
  if (!verdict.ok) {
    res.status(409).json({ error: LISTING_REFUSAL_LABELS[verdict.reason!] });
    return;
  }

  const fee = listingFee(body.data.pricePerTon, tons);
  const listing = await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv!, tons);
    await debit(tx, user.id, fee);
    return tx.marketListing.create({
      data: {
        sellerId: user.id,
        commodity: body.data.commodity,
        tons: tons,
        pricePerTon: body.data.pricePerTon,
        moisture: inv!.moisture,
        quality: inv!.quality,
        expiresAt: new Date(Date.now() + LISTING_TTL_MS),
      },
    });
  });
  res.status(201).json({ listing, fee, expiresInMs: LISTING_TTL_MS });
});

/** Retrait d'une annonce : la marchandise revient, les frais restent dus. */
app.post("/market/listings/:id/cancel", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const listing = await prisma.marketListing.findUnique({
    where: { id: req.params.id },
    include: { seller: { include: { farm: true } } },
  });
  if (!listing || listing.sellerId !== body.data.userId) {
    res.status(403).json({ error: "Annonce introuvable" });
    return;
  }
  if (listing.status !== "OPEN") {
    res.status(409).json({ error: "Cette annonce n'est plus ouverte" });
    return;
  }
  const farmId = listing.seller.farm?.id;
  await prisma.$transaction(async (tx) => {
    await tx.marketListing.update({
      where: { id: listing.id },
      data: { status: "CANCELLED" },
    });
    if (!farmId) return;
    const existing = await tx.inventoryItem.findFirst({
      where: { farmId, itemCode: listing.commodity },
    });
    if (existing) {
      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          qty: existing.qty + listing.tons,
          moisture: mergeMoisture(
            existing.qty,
            existing.moisture,
            listing.tons,
            listing.moisture,
          ),
        },
      });
    } else {
      await tx.inventoryItem.create({
        data: {
          farmId,
          itemCode: listing.commodity,
          qty: listing.tons,
          quality: listing.quality,
          moisture: listing.moisture,
        },
      });
    }
  });
  res.json({ returned: listing.tons, commodity: listing.commodity });
});

/** Achat d'une annonce : les € passent au vendeur, la marchandise à l'acheteur. */
app.post("/market/listings/:id/buy", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  await expireListings();
  const listing = await prisma.marketListing.findUnique({ where: { id: req.params.id } });
  if (!listing || listing.status !== "OPEN") {
    res.status(409).json({ error: "Ce lot vient d'être vendu ou retiré" });
    return;
  }
  if (listing.sellerId === body.data.userId) {
    res.status(409).json({ error: "Vous ne pouvez pas acheter votre propre lot" });
    return;
  }
  const buyer = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: true },
  });
  if (!buyer?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const total = Math.round(listing.pricePerTon * listing.tons);
  if (!peutPayer(buyer, total)) {
    res.status(402).json({ error: `€ insuffisants — ${total} requis` });
    return;
  }
  const proceeds = listingProceeds(listing.pricePerTon, listing.tons);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.marketListing.findUnique({ where: { id: listing.id } });
    if (!fresh || fresh.status !== "OPEN") throw new Error("LISTING_GONE");
    await tx.marketListing.update({
      where: { id: listing.id },
      data: { status: "SOLD", buyerId: buyer.id, soldAt: new Date() },
    });
    await debit(tx, buyer.id, total, "INTRANTS", `Achat au carnet — ${listing.commodity}, ${listing.tons} t`);
    await crediter(tx, listing.sellerId, proceeds, posteDeVente(listing.commodity), `Vente au carnet — ${listing.commodity}, ${listing.tons} t`);
    // L'argent change de main tout de suite. Le stock, non : quelqu'un doit livrer.
    await tx.delivery.create({
      data: {
        sellerId: listing.sellerId,
        buyerId: buyer.id,
        buyerFarmId: buyer.farm!.id,
        listingId: listing.id,
        commodity: listing.commodity,
        tons: listing.tons,
        moisture: listing.moisture,
        quality: listing.quality,
        status: "PENDING",
        dueAt: new Date(Date.now() + DELIVERY_TTL_MS),
        autoFee: deliveryAutoFee(listing.tons),
      },
    });
  });
  res.json({
    bought: listing.tons,
    commodity: listing.commodity,
    paid: total,
    proceeds,
    pendingDelivery: true,
  });
});

async function fulfillDelivery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  delivery: { id: string; buyerFarmId: string; commodity: string; tons: number; moisture: number; quality: number },
) {
  await addToStock(
    tx,
    delivery.buyerFarmId,
    delivery.commodity,
    delivery.tons,
    delivery.moisture,
    delivery.quality,
  );
  await tx.delivery.update({
    where: { id: delivery.id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}

/** TTL écoulé : un voisin auto livre, et facture l'acheteur. */
async function settleOverdueDeliveries() {
  const stale = await prisma.delivery.findMany({
    where: { status: "PENDING", dueAt: { lt: new Date() } },
    include: { buyer: true },
  });
  for (const d of stale) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.delivery.findUnique({ where: { id: d.id } });
      if (!fresh || fresh.status !== "PENDING") return;
      const fee = estArgentIllimite(d.buyer.email) ? 0 : Math.min(d.buyer.crd, d.autoFee);
      if (fee > 0) {
        await debit(tx, d.buyerId, fee);
      }
      await fulfillDelivery(tx, fresh);
    });
  }
}

app.get("/deliveries", async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  if (!userId) {
    res.status(400).json({ error: "userId requis" });
    return;
  }
  await settleOverdueDeliveries();
  const rows = await prisma.delivery.findMany({
    where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
    include: {
      seller: { select: { displayName: true } },
      buyer: { select: { displayName: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 40,
  });
  res.json({
    deliveries: rows.map((d) => ({
      id: d.id,
      commodity: d.commodity,
      tons: d.tons,
      moisture: d.moisture,
      quality: d.quality,
      status: d.status,
      role: d.sellerId === userId ? "SELLER" : "BUYER",
      counterparty: d.sellerId === userId ? d.buyer.displayName : d.seller.displayName,
      dueInMs: Math.max(0, d.dueAt.getTime() - Date.now()),
      autoFee: d.autoFee,
    })),
  });
});

/** Le vendeur livre lui-même : gratuit, le stock arrive chez l'acheteur. */
app.post("/deliveries/:id/deliver", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const delivery = await prisma.delivery.findUnique({ where: { id: req.params.id } });
  if (!delivery || delivery.status !== "PENDING") {
    res.status(409).json({ error: "Livraison introuvable ou déjà faite" });
    return;
  }
  if (delivery.sellerId !== body.data.userId) {
    res.status(403).json({ error: "Seul le vendeur peut livrer" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.delivery.findUnique({ where: { id: delivery.id } });
    if (!fresh || fresh.status !== "PENDING") throw new Error("DELIVERY_GONE");
    await fulfillDelivery(tx, fresh);
  });
  res.json({ delivered: delivery.tons, commodity: delivery.commodity });
});

/** L'acheteur paie un voisin auto pour faire livrer tout de suite. */
app.post("/deliveries/:id/auto", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const delivery = await prisma.delivery.findUnique({
    where: { id: req.params.id },
    include: { buyer: true },
  });
  if (!delivery || delivery.status !== "PENDING") {
    res.status(409).json({ error: "Livraison introuvable ou déjà faite" });
    return;
  }
  if (delivery.buyerId !== body.data.userId) {
    res.status(403).json({ error: "Seul l'acheteur peut faire livrer" });
    return;
  }
  if (!peutPayer(delivery.buyer, delivery.autoFee)) {
    res.status(402).json({ error: `€ insuffisants — ${delivery.autoFee} requis` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.delivery.findUnique({ where: { id: delivery.id } });
    if (!fresh || fresh.status !== "PENDING") throw new Error("DELIVERY_GONE");
    await debit(tx, delivery.buyerId, delivery.autoFee);
    await fulfillDelivery(tx, fresh);
  });
  res.json({
    delivered: delivery.tons,
    commodity: delivery.commodity,
    autoFee: delivery.autoFee,
  });
});

app.post("/market/sell", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: sellableGood,
      tons: z.number().positive().max(100_000),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { inventory: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const inv = user.farm.inventory.find((i) => i.itemCode === body.data.commodity);
  const tons = settleSaleTons(body.data.tons, inv?.qty ?? 0);
  if (!inv || tons === null) {
    res.status(409).json({ error: "Stock insuffisant" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  if (inv.qty > bonuses.storageGrain && tons > 0) {
    // soft warning only — allow sell
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const moisturePenalty = moistureSellPenalty(inv.moisture);
  // Écouler un gros lot d'un coup fait plonger le cours obtenu : c'est ce qui
  // rend l'étalement des ventes — ou la criée — réellement plus rentable.
  const slippage = volumeSlippage(tons, market.stockTons);
  /*
   * Le négoce se paie sur le prix obtenu, pas sur le cours.
   *
   * La compétence agit **après** la décote de volume et celle d'humidité :
   * savoir vendre ne répare pas un lot mouillé ni une remorque écoulée d'un
   * coup. Elle récompense la conduite du marché, pas l'étourderie.
   */
  const negoce = await getSkillBonuses(body.data.userId);
  const sale = sellToMarket({
    tons: tons,
    price: marketPricePerTon(market.price, tons, market.stockTons) * (1 + negoce.SALE_PRICE),
    moisturePenalty,
  });
  const tick = tickMarket({
    commodity: body.data.commodity,
    price: market.price,
    supplyTons: tons,
    demandTons: tons * 0.9,
    stockTons: market.stockTons,
  });
  // Le forfait de dix points payait pareil un sac et une remorque : c'est
  // exactement ce qui donnait l'impression de gagner de l'XP sans rien faire.
  const xpGain = Math.round(xpFor("SELL", { tons }) * (1 + bonuses.xpBonus));
  const { user: updated, gain } = await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv, tons);
    // Le bonus de la maison d'exploitation s'applique en amont ; le helper
    // reste le seul à écrire l'expérience, faute de quoi le niveau ne se
    // recalculerait pas — c'était le défaut d'origine.
    const g = await grantXp(tx, user.id, "SELL", { tons }, { tonsSold: tons });
    const bonusXp = Math.max(0, xpGain - g.xp);
    const u = await tx.user.update({
      where: { id: user.id },
      data: { crd: { increment: sale.revenue }, xp: { increment: bonusXp } },
    });
    await ecrireJournal(tx, user.id, sale.revenue, posteDeVente(body.data.commodity), `Vente au marché — ${body.data.commodity}, ${tons} t`);
    await tx.marketPrice.update({
      where: { commodity: body.data.commodity },
      data: { price: tick.price, stockTons: tick.stockTons },
    });
    return { user: u, gain: { ...g, xp: g.xp + bonusXp } };
  });
  res.json({
    revenue: sale.revenue,
    tons,
    effectivePrice: sale.effectivePrice,
    slippage,
    moisturePenalty,
    moisture: inv.moisture,
    crd: updated.crd,
    market: tick,
    bonuses,
    channel: "MARKET",
    gain,
  });
});

app.post("/inventory/dry", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      itemId: z.string(),
      tons: z.number().positive().max(100_000).optional(),
      passes: z.number().int().min(1).max(5).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { inventory: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const inv = user.farm.inventory.find((i) => i.id === body.data.itemId);
  if (!inv) {
    res.status(404).json({ error: "Stock introuvable" });
    return;
  }
  if (inv.qty <= 0) {
    res.status(409).json({ error: "Stock vide" });
    return;
  }
  const tons = Math.min(inv.qty, body.data.tons ?? inv.qty);
  if (tons <= 0) {
    res.status(409).json({ error: "Quantité invalide" });
    return;
  }
  if (inv.moisture <= DRYING.moistureFloor + 0.0005) {
    res.status(409).json({ error: "Déjà sec" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  const passes = body.data.passes ?? 1;
  const brut = dryInventory({
    moisture: inv.moisture,
    tons,
    passes,
    barnBonus: bonuses.softDryer,
  });
  /**
   * Le courant produit sur la ferme paie le séchoir.
   *
   * C'est la seule dépense électrique du jeu — tout le reste brûle du gazole —
   * et donc le seul poste que produire du courant peut alléger. Les panneaux
   * en prennent la moitié, ils ne donnent rien la nuit ; l'éolienne le prend
   * en entier, le vent souffle aussi à trois heures du matin.
   *
   * Ni l'un ni l'autre ne touche à la quantité séchée ou au temps : ils
   * enlèvent le coût. L'humidité ampute la vente, sécher la rattrape, et ces
   * ouvrages rendent le rattrapage bon marché — ce qui vaut d'autant plus
   * qu'on moissonne humide.
   */
  const dried = bonuses.freeDrying
    ? { ...brut, cost: 0 }
    : { ...brut, cost: Math.round(brut.cost * (1 - bonuses.dryingDiscount)) };
  if (dried.cost > user.crd) {
    res.status(409).json({ error: "€ insuffisants pour sécher" });
    return;
  }
  if (dried.reduction <= 0) {
    res.status(409).json({ error: "Aucune réduction possible" });
    return;
  }

  // Partial dry: blend dried tons back into remaining stock moisture
  const remaining = inv.qty - tons;
  const nextMoisture =
    remaining > 0
      ? mergeMoisture(remaining, inv.moisture, tons, dried.moisture)
      : dried.moisture;

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.update({
      where: { id: inv.id },
      data: {
        moisture: nextMoisture,
        quality: nextMoisture <= DRYING.sellThreshold ? Math.max(inv.quality, 3) : inv.quality,
      },
    });
    await debit(tx, user.id, dried.cost);
    const u = await tx.user.findUnique({ where: { id: user.id }, select: { crd: true } });
    return { item, crd: u?.crd ?? 0 };
  });

  res.json({
    cost: dried.cost,
    reduction: dried.reduction,
    moisture: updated.item.moisture,
    driedTons: tons,
    passes,
    barnBonus: bonuses.softDryer,
    crd: updated.crd,
    item: updated.item,
  });
});

app.post("/contracts/:id/accept", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  if (!user.farm) {
    res.status(409).json({ error: "Ferme requise (machines) pour les contrats" });
    return;
  }
  const already = await hasActiveMission(user.id);
  if (already) {
    res.status(409).json({ error: "Une mission à la fois — finissez d’abord celle en cours." });
    return;
  }
  const contract = await prisma.npcContract.findUnique({ where: { id: req.params.id } });
  if (!contract || contract.status !== "OPEN") {
    res.status(409).json({ error: "Contrat indisponible" });
    return;
  }
  const work = CONTRACT_WORK[contract.jobType as ContractJobType];
  const picked = pickMachineForWork(user.farm.machines, work);
  if (!picked) {
    res.status(409).json({
      error: explainNoMachine(user.farm.machines, work),
    });
    return;
  }
  const cells = clampMissionCells(contract.cells || 16);
  const reward = missionPayout(work, cells, "NPC");
  const updated = await prisma.npcContract.update({
    where: { id: contract.id },
    data: { status: "ACCEPTED", providerId: user.id, cells, rewardCrd: reward },
  });
  res.json({
    contract: {
      ...updated,
      work,
      machineType: picked.def.type,
    },
  });
});

app.post("/contracts/:id/complete", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const contract = await prisma.npcContract.findUnique({ where: { id: req.params.id } });
  if (!contract || contract.status !== "ACCEPTED" || contract.providerId !== user.id) {
    res.status(409).json({ error: "Ce n’est pas votre demande" });
    return;
  }
  const work = CONTRACT_WORK[contract.jobType as ContractJobType];
  const picked = pickMachineForWork(user.farm.machines, work);
  if (!picked) {
    res.status(409).json({ error: explainNoMachine(user.farm.machines, work) });
    return;
  }
  const cells = clampMissionCells(contract.cells || 16);
  const reward = missionPayout(work, cells, "NPC");
  const result = await prisma.$transaction(async (tx) => {
    const wear = await applyWearToMachine(tx, {
      rig: picked,
      cells,
      work,
      specialization: user.specialization,
    });
    await tx.npcContract.update({
      where: { id: contract.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await grantXp(tx, user.id, "CONTRACT", { cells: contract.cells }, { contracts: 1 });
    const u = await tx.user.update({
      where: { id: user.id },
      data: { crd: { increment: reward } },
    });
    await ecrireJournal(tx, user.id, reward, "PROGRESSION", `Contrat — ${contract.title}`);
    return { user: u, reward, machine: { id: picked.machine.id, type: picked.machine.type, ...wear } };
  });
  res.json(result);
});

app.post("/contracts/:id/abandon", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const contract = await prisma.npcContract.findUnique({ where: { id: req.params.id } });
  if (!contract || contract.status !== "ACCEPTED" || contract.providerId !== body.data.userId) {
    res.status(409).json({ error: "Ce n’est pas votre demande" });
    return;
  }
  await prisma.npcContract.update({
    where: { id: contract.id },
    data: { status: "OPEN", providerId: null },
  });
  res.json({ ok: true });
});

// Sert le front construit (apps/web/dist, recopié à côté de ce fichier compilé
// — voir le Dockerfile) et retombe sur son index.html pour toute route qui
// n'est ni un fichier statique existant ni une des routes API ci-dessus.
// L'appli n'a pas de routeur côté client aujourd'hui, mais ça garde un lien
// direct utilisable pour n'importe quelle URL du jeu.
const webDist = process.env.WEB_DIST_DIR ?? path.join(__dirname, "web");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

/**
 * Dernier filet : toute erreur qui remonte d'une route répond quelque chose.
 *
 * Déclaré après les routes, comme l'exige Express, et avec quatre paramètres —
 * c'est à cela qu'il reconnaît un gestionnaire d'erreurs.
 */
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof InsufficientFunds) {
      res.status(402).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("route failed:", msg);
    res.status(500).json({ error: "Le serveur n'a pas pu traiter cette action" });
  },
);

async function main() {
  await ensureSeed();
  await runWorldTick();
  setInterval(() => {
    runWorldTick().catch((e) => console.error("sim tick failed", e));
  }, SIM_TICK_MS);
  app.listen(PORT, () => {
    console.log(`API Farming Navigateur sur http://localhost:${PORT}`);
    console.log(`Sim tick toutes les ${SIM_TICK_MS / 1000}s`);
    if (DEV_TOOLS) {
      console.warn(
        "OUTILS DE TEST ACTIFS — /dev/grant distribue argent, niveau et stock. " +
          "Retirez FARMSIM_DEV_TOOLS de l'environnement en production.",
      );
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
