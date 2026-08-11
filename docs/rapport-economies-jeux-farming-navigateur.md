# Rapport : économies complexes de jeux vidéo — inspiration pour Farming Navigateur

**Date :** 11 août 2026  
**Objet :** Analyse comparative d’économies MMO/F2P et proposition de modèle pour un MMO agricole navigateur persistant  
**Méthode :** Synthèse WebSearch + WebFetch de sources officielles, wikis, analyses de design et papers académiques  

**Légende :**  
- **[F]** = Fait documenté (source citée)  
- **[H]** = Hypothèse / interprétation  
- **[P]** = Proposition de design pour Farming Navigateur  

---

## Synthèse exécutive

Les économies MMO robustes partagent cinq invariants :

1. **Séparer monnaies soft / premium** avec un pont régulé (Dofus BaK, EVE PLEX, Albion Gold Exchange).  
2. **Équilibrer faucets et sinks** et mesurer la balance en continu (EVE MER).  
3. **Détruire objets et monnaie** (taxes, réparation, consommation, corruption/item sink).  
4. **Lier production et demande** via des boucles fermées (Albion Black Market, OSRS item sink).  
5. **Monétiser convenience / identité**, pas la puissance brute — ou accepter un P2W assumé avec plafond clair.

Pour un MMO agricole navigateur, le risque majeur à 6–12 mois est la **définition des prix** (surproduction de récoltes + faucet monétaire) plutôt que l’inflation « pure » : trop de biens, trop peu de sinks d’items. Les jeux agricoles casual (Hay Day) échappent à ce piège via prix plafonnés NPC et absence de marché libre global ; un MMO persistant ne peut pas.

---

## 1. Dofus (Ankama)

### Monnaie(s)
| Monnaie | Rôle | [F] Source |
|--------|------|------------|
| **Kamas** | Soft currency : craft, HDV, quêtes, progression | Guides communauté / Ankama |
| **Ogrines** | Premium : abo, services (nom, couleurs, slots), BaK | PDF officiel Ankama « Understanding Ogrines » |

### Faucets (sources)
- Combats, quêtes, drops, vente de ressources/crafts, commerce joueur.  
- Ogrines : achat réel, promotions, échanges BaK. **[F]**

### Sinks (destruction)
- Taxe hôtel des ventes (~**2 %**). **[F]** dafous.app  
- Brisage (forgemagie), consommables, frais de zaap / services. **[F]**  
- Ogrines liées au compte après BaK (anti-spéculation) + expiration historique des ogrines. **[F]** PDF Ankama  

### Marketplace / taxes
- HDV joueur-joueur (kamas).  
- **Bourse aux Kamas (BaK)** : échange kamas ↔ ogrines, cours libre par offre/demande, **sans taxe Ankama** sur l’échange. **[F]** Millenium, leblogdewilly  
- Accès BaK parfois conditionné à un premier achat réel (mesure anti-RMT / anti-farm). **[F]** guides 2024–2025  

### Inflation & solutions historiques
- Inflation structurelle quand farm (surtout multi-compte) > sinks. **[H]**  
- Solutions : sinks (brisage, taxes), serveurs **mono-compte**, fusions de serveurs (Dofus Rétro), cycles Temporis / contenu neuf qui crée demande. **[F]** Ankama support mono-compte ; analyses Beez/Dafous  
- Cycle classique post-patch : pics de prix 1–2 semaines puis chute. **[F]** dafous.app  

### Arbitrage / spéculation
- Flipping HDV (acheter matin / vendre soir-week-end). **[F]**  
- Anticipation d’événements et crafts.  
- Spéculation BaK (cours kamas/ogrine variable ; pics avant Unity cités ~1300 kamas/ogrine). **[F]** Millenium  

### Pay-to-win vs cosmétique
- Abo + services ; BaK permet **play-to-sub** (kamas → ogrines → abo). **[F]** Ankama  
- Équipement via kamas → argent réel peut accélérer le gear via BaK / RMT illégal. **[H]** perception P2W partielle  

### Conversion temps ↔ argent
- Farm intensif → kamas → ogrines → abo.  
- Inverse : euros → ogrines → kamas. Pont officiel = anti-RMT *officiel*. **[F]**  

### Leçons pour Farming Navigateur
- **[P]** Pont soft↔premium régulé (comme BaK) pour capturer le RMT.  
- **[P]** Taxe marketplace non nulle.  
- **[P]** Limiter multi-comptes / bots dès le lancement (leçon mono-compte).  
- **[P]** Contenu cyclique pour relancer la demande (ne pas compter uniquement sur les sinks).  

---

## 2. EVE Online (CCP)

### Monnaie(s)
| Monnaie / quasi-devise | Rôle |
|------------------------|------|
| **ISK** | Soft currency universelle |
| **PLEX** | Utility item premium (Omega, store, services), tradable ISK |
| **LP** | Loyalty Points (agents) |
| Skill Points / MCT | Progression / extraction |

**[F]** Support EVE « ISK and PLEX » ; blog Global PLEX Market (2025)

### Faucets ISK
- Bounties NPC, missions, incursions, insurance (net), commodities, etc. **[F]** forums MER / Adam4EVE  

### Sinks ISK
- Broker fees, transaction tax, réparations, offices, sovereignty, PI taxes, NPC stores, etc. **[F]**  
- **Important :** PLEX n’est **ni faucet ni sink** d’ISK — transfert joueur→joueur (+ petites fees). **[F]** forums CCP archives  

### Marketplace
- Marché regional (ordres buy/sell), taxes broker + sales tax.  
- **Global PLEX Market** : liquidité PLEX sans friction régionale (réduction arbitrage géographique). **[F]** eveonline.com 2025  

### Inflation & gestion
- **Monthly Economic Report (MER)** : transparence faucets/sinks, indices (MPI), destruction/production. **[F]** MER officiels  
- Auto-régulation partielle : si prix crafts ↑, joueurs migrent vers industrie → moins de bounties → moins d’ISK. **[F/H]** forums  
- Interventions : nerfs anomalies, hausse taxes, destruction PvP comme sink d’**items**.  

### Arbitrage / spéculation
- Arbitrage régional, station trading, speculation PLEX (CCP a explicitement voulu réduire le PLEX « asset de thésaurisation »). **[F]** Global PLEX Market  

### Pay-to-win vs cosmétique
- Modèle : Omega (puissance/confort), SKINs/identité, expert systems.  
- PLEX → ISK = **pay for convenience / time**, pas lootbox gear direct. **[H]** largement accepté comme « soft P2W »  

### Conversion temps ↔ argent
- ISK farm → PLEX → Omega.  
- € → PLEX → ISK. **[F]**  

### Leçons
- **[P]** Publier un mini-MER (dashboard interne/public) : faucets vs sinks hebdo.  
- **[P]** Destruction d’actifs (pertes, usure) plus efficace que seule taxe monétaire.  
- **[P]** Distinguer biens joueur-fabriqués / utility goods / cosmétique (taxonomie CCP).  
- **[P]** Limiter la thésaurisation pure de la devise premium (soulbound partiel, friction contrôlée).  

---

## 3. Albion Online (Sandbox Interactive)

### Monnaie(s)
| Monnaie | Rôle |
|---------|------|
| **Silver** | Soft : gear, réparations, taxes craft, îles |
| **Gold** | Premium : Premium status, vanity ; échangeable ↔ silver |

**[F]** wiki Albion Silver / Gold Exchange / Premium  

### Faucets
- Drops silver mobs/donjons/chests, vente marché, Black Market payouts (redistribution, pas création nette — voir ci-dessous), farming île. **[F]**  

### Sinks
- Taxes marché, craft/refine station, réparations, island upkeep, rerolls. **[F]**  
- **Black Market « corruption »** : destruction progressive d’items (surtout bas tiers). **[F]** annonce officielle 2017 + analyse Ata Kuyumcu  
- Plaintes communauté : sinks silver parfois insuffisants / contournables (îles, hideouts). **[F]** forum « Silver Inflation »  

### Black Market (mécanisme clé)
1. Mobs lootent du gear **crafté par joueurs** stocké au BM.  
2. Une **fraction du silver drop** finance les buy orders (ex. 20 % détournés) → **boucle silver fermée**. **[F]** albiononline.com  
3. Prix buy orders s’ajustent si non remplis (contrôleur type PID). **[H]** reconstruction communauté / blog  
4. Corruption : taux de destruction **progressif par tier**. **[F/H]**  

### Marketplace / taxes
- Marchés régionaux (arbitrage transport + risque PvP).  
- Premium : **-50 % market tax**, +focus, +yields. **[F]** wiki Premium  
- Gold Exchange : fee fixe 10 silver / ordre. **[F]** wiki  

### Inflation
- Silver inflation récurrente ; SBI ajuste (ex. −15 % silver BM, 2021). **[F]** wiki patch notes  
- Full-loot PvP = sink d’items majeur haut tier.  

### Arbitrage
- City craft bonuses, transport Caerleon, BM flipping. **[F]** guides  

### Pay-to-win
- Premium = avantages productifs clairs (fame, gather, focus) → **P2W soft assumé**. **[F]**  
- Gold↔Silver = temps ↔ argent.  

### Leçons agricoles
- **[P]** Inventer un équivalent Black Market agricole : un **acheteur système** qui convertit surplus récoltes en demandes craft/consommables sans imprimer de soft currency.  
- **[P]** Destruction différenciée par tier (bas = trash, haut = rare).  
- **[P]** Friction de transport / localisation = contenu économique.  
- **[P]** Focus/énergie quotidienne plafonnée (anti-bot + anti-inflation productive).  

---

## 4. Jeux de gestion agricole

### 4.1 FarmVille / social farms (Zynga et successeurs)
- Dual currency : soft (coins) + premium (cash/gems). **[F]** playbooks F2P  
- **Time-gates** : croissance réelle → monétisation skip.  
- Peu/pas de marché libre global ; économie **NPC-centrée**.  
- **[P]** Inspirer les boucles rétention, **pas** le modèle économique MMO libre.  

### 4.2 Hay Day (Supercell)
| Monnaie | Usage |
|---------|--------|
| Coins | Soft : bâtiments, expansions, achats shops |
| Diamonds | Premium : speed-up, slots machines, caisses shop, décor |

**[F]** Hay Day Wiki Currencies / Diamond / Roadside Shop  

- **Roadside Shop** : prix joueur plafonnés (**max ~3,6×** valeur défaut). **[F]**  
- Sinks coins : upgrades, expansions, custom Maggie.  
- Diamonds : convenience + slots permanents (meilleur ROI).  
- Monétisation : IAP + rewarded ads + Farm Pass. **[F]** Udonis Medium ; thèse « Farming or Harming? »  
- Offre/demande réelle entre joueurs mais **bornée** → pas d’hyperinflation de prix.  
- **[H]** Économie « safe » car le jeu peut toujours absorber via NPC orders (trucks/boats).  

### 4.3 Stardew Valley (ConcernedApe)
- Monnaie unique **Gold** ; prix de vente **statiques**. **[F]**  
- « Sink » principal = achats (bâtiments, seeds, upgrades) + artisanat.  
- Métas stables (starfruit, kegs…) → **pas d’économie MMO**.  
- Mods (Ferngill Supply & Demand, Stardew Economy) ajoutent offre/demande dynamique pour diversifier. **[F]** Nexus/GitHub  
- **[P]** Prix NPC dynamiques utiles en early game ; insuffisants seuls pour un MMO.  

### 4.4 Farming Simulator
- Prix marché simulés (vanilla + mods Market Dynamics : volatilité, events, futures). **[F]** FS25_MarketDynamics  
- Multi : pas d’économie serveur partagée type MMO par défaut.  
- **[P]** Volatilité météo/saison = levier de design sans imprimer de monnaie.  

### Tableau comparatif agricole

| Jeu | Marché libre | Inflation risque | Soft↔€ | Leçon clé |
|-----|--------------|------------------|--------|-----------|
| FarmVille | Non | Faible | Skip time | Time-gate |
| Hay Day | Borné | Faible | Diamonds | Plafond prix + NPC sink |
| Stardew | Non (NPC) | N/A | Non | Simplicité / meta |
| FS | Simulé | N/A | Non | Volatilité externe |

---

## 5. Autres MMO / trading games pertinents

### 5.1 Old School RuneScape (Jagex)
- Soft : GP. Bonds = premium tradable (proche PLEX/BaK).  
- **GE Tax** : 1 % (2021) puis **2 %** (mise à jour récente). **[F]** OSRS Wiki / news  
- **Item Sink** : fraction de la taxe achète et **détruit** des items ciblés (quotas journaliers). **[F]** Update Dec 2021 ; arXiv 2210.07970  
- Paper académique : taxe peu d’effet volume ; item sink gonfle prix luxes ; RMT peu impacté. **[F]** arXiv  
- **[P]** Taxe marketplace + coffre anti-surplus = combo éprouvé.  

### 5.2 Path of Exile
- Devises = **objets de craft** (Chaos, Divine…) — pas de gold classique. **[F]**  
- Ligues temporaires = **reset économique** périodique.  
- Risque d’hyperinflation si faucet craft/farm explose (cas cités Softcore). **[F/H]** analyses communauté  
- **[P]** Saisons / ligues optionnelles pour reset partiel sans wipe total.  

### 5.3 Entropia Universe
- **PED** peggé 10 PED = 1 USD, cash-in/out. **[F]**  
- Decay d’équipement = sink permanent.  
- **[H]** Trop risqué / réglementaire pour un navigateur F2P classique.  
- **[P]** Retenir le principe de **decay** sans cash-out réel.  

### 5.4 Principes transverses (littérature design)
- Concevoir **sinks avant faucets**. **[F]** GameGrowthAdvisor ; Leo Seguin  
- Surveiller **faucets d’items** autant que d’argent (Raph Koster « Faucets »). **[F]** GameDeveloper  
- Index de prix + feedback loop (taxes, drop rates). **[F]** revue « Virtual Inflation under Control » (2026)  

---

## 6. Proposition de modèle économique robuste — Farming Navigateur

> Tout ce qui suit est **[P]** sauf rappels de faits.

### 6.1 Architecture monétaire (3 couches)

| Couche | Nom suggéré | Entrée | Sortie | Notes |
|--------|-------------|--------|--------|-------|
| Soft | **Graines d’or / Crédits** | Récoltes vendues, quêtes, contrats | Taxes, upkeep, seeds, craft fees | Jamais achetable *directement* en € |
| Premium | **Sève / Gems** | €, rewards rares, pass | Cosmétiques, convenience, slots, boosts bornés | Soulbound après certains usages |
| Pont | **Bourse officielle** | Soft ↔ Premium (ordres joueurs) | Petite taxe + lim. KYC/achat | Style BaK / PLEX / Albion Gold |

**Règles dures :**
1. Soft **jamais** vendue par le studio en € (évite faucet monétaire payant).  
2. Premium n’achète **pas** de land rare compétitif ni de rendement permanent non plafonné.  
3. Boosts : **+temps / +confort / +cosmétique**, pas « ×10 yield illimité ».  

### 6.2 Sources (faucets) — soft

| Faucet | Contrôle |
|--------|----------|
| Vente NPC de surplus (prix dynamiques, demande élastique) | Courbe décroissante volume/jour |
| Contrats ville / guildes (commandes) | Quotas serveur |
| Événements saisonniers | Budget faucet plafonné |
| Récompenses tutoriel / daily | Caps durs |
| Vente joueur-joueur | **Pas un faucet** (transfert + taxe = sink net) |

**Cible :** soft/heure médiane calibrée ; whales de temps (no-life) plafonnés par **énergie / fatigue / slots machines**.

### 6.3 Sinks (destruction)

**Monnaie :**
- Taxe marketplace **2–5 %** (OSRS/Dofus).  
- Frais de listing non remboursables (petits).  
- Upkeep ferme (eau, outils, bâtiments).  
- Frais craft / transformation (meunerie, fromagerie).  
- Enchères studio (noms de lieux, statues) = sink 100 %.  

**Items :**
- Consommation (nourriture, engrais, carburant).  
- Usure outils / machines (Entropia-light).  
- **Silo spoil** : denrées périssables (sink naturel agricole).  
- **Office d’achat public** façon Black Market : achète surplus bas tier → détruit X % → redistribue Y % en contrats PNJ.  

### 6.4 Anti-inflation (politique monétaire live)

1. **Tableau de bord hebdo** (inspiré MER) :  
   - Soft créée / détruite  
   - Indice panier (blé, lait, fer, engrais)  
   - Velocity (volume marketplace)  
2. **Leviers automatiques** (bornés) :  
   - Si indice panier > +15 % / 30j → ↑ taxe 0,5 pt ou ↑ spoil rate  
   - Si panier < −15 % → ↑ quotas contrats ville / ↓ spoil  
3. **Pas de faucet « compensation »** après inflation (évite spirale).  
4. **Saisons de 8–12 semaines** avec nouveaux sinks (festivals, constructions communautaires).  

### 6.5 Anti-bots / anti-RMT

| Mesure | Inspiration |
|--------|-------------|
| Énergie / actions/heure serveur | Albion focus |
| Captcha / preuve humaine sur ventes gros volume | Standards F2P |
| Limites multi-comptes (device/IP/phone soft) | Dofus mono |
| BaK/pont réservé après 1er achat micro ou niveau + KYC light | Dofus BaK |
| Detection patterns harvest AFK | Telemetry |
| Decay de comptes inactifs (soft gelée, pas destruction brutale) | EVE discussion |
| Ban + retrait liquidité bot | CCP / Jagex |

**[H]** Les bots agricoles navigateur seront la menace nº1 ; l’économie doit **assumer** qu’ils existent et rendre le farming 24/7 **non rentable** vs joueur actif (énergie, spoil, risk events).

### 6.6 Marketplace

- **Ordres buy/sell** (pas seulement listing) — liquidité EVE-like.  
- Taxe vendeur 2–3 % + listing fee.  
- **Escrow serveur** (anti-scam).  
- Plafonds early-game (comme Hay Day) **optionnels** sur serveurs « casual » ; marché libre sur « hardcore ».  
- Catégories : denrées périssables / biens durables / utilitaires premium.  
- Transparence prix médians 7j (confiance).  
- Interdiction de lister la premium currency hors pont officiel.  

### 6.7 Progression sans casser l’économie

1. **Progression = skill / recettes / prestige**, pas « meilleur crop imprime +∞ soft ».  
2. Nouveaux crops : **demande** créée (recettes, festivals) **avant** ou avec l’offre.  
3. Land expansion : coût soft **exponentiel** + upkeep.  
4. Qualité / rare variants : sinks craft (échecs, fusion).  
5. Coop / guild farms : taxes de territoire (Albion upkeep).  
6. Éviter gear vertical permanent ; préférer **outils avec usure** et builds horizontaux.  

### 6.8 Éviter l’effondrement à 6–12 mois

**Scénarios de mort classique & parades :**

| Scénario | Symptômes | Parade |
|----------|-----------|--------|
| Hyper-offre crops | Prix → floor NPC | Spoil + office public + diversification recettes |
| Soft inflation | Tout devient cher en soft | ↑ taxes, upkeep, sinks prestige |
| Soft déflation / pauvreté newbies | Écart wealth | Vendor floors ciblés early ; gifts bornés ; pas de wipe |
| Domination bots | Marges → 0 pour humains | Énergie, ban, CAPTCHA ventes |
| Whale P2W | Churn F2P | Cap yields premium ; cosmétique first |
| Contenu dry | Velocity ↓ | Saisons, festivals, constructions globales |
| Thésaurisation | Velocity ↓ | Sinks prestige, taxes fortune soft (très douce), events |

**Plan opérationnel 12 mois :**
- Mois 0–1 : sinks > faucets volontairement (économie « tendue »).  
- Mois 2–3 : ouvrir marketplace libre + BaK limitée.  
- Mois 4–6 : premier ajustement data-driven (MER public).  
- Mois 6–9 : saison 2 + item sink ciblé (OSRS-style) sur surplus chroniques.  
- Mois 9–12 : audit bots, éventuelle fusion de shards économiques si fragmentation.  

### 6.9 Schéma de boucle (agriculture persistante)

```
[Récolte] → [Transformation] → [Marché J-J | Contrats Ville | Office Public]
                ↓                      ↓              ↓
            [Usure/Spoil]         [Taxe sink]   [Corruption %]
                ↓
        [Upkeep ferme / Expansion]
                ↓
        Soft retirée OU recyclée en demande PNJ
```

Pont parallèle : `€ → Premium ↔ Soft (taxé)` sans création nette de soft par le studio.

---

## 7. Matrice « ce qu’il faut emprunter »

| Inspiration | Emprunter | Éviter |
|-------------|-----------|--------|
| Dofus | BaK, taxe HDV, mono-compte | Multi-compte farm toxique |
| EVE | MER, destruction, taxonomie goods | Complexité UX spatiale |
| Albion | Black Market loop, focus, taxes | P2W Premium trop fort |
| Hay Day | Plafonds early, UX shop | Économie trop fermée NPC |
| Stardew | Lisibilité progression | Prix statiques late |
| OSRS | Taxe + item sink | Retard à introduire les sinks |
| PoE | Saisons | Hyperinflation faucet |
| Entropia | Decay | Cash-out réel |

---

## 8. Sources principales

1. Ankama — *Understanding Ogrines* (PDF) : https://staticns.ankama.com/comm/news/dofus/www/07_2010/understanding-ogrines.pdf  
2. Millenium — Bourse aux kamas Dofus 3.0 : https://www.millenium.org/guide/420165.html  
3. Dafous — Économie MMORPG Dofus : https://dafous.app/guides/economie-mmorpg.html  
4. EVE Support — ISK and PLEX : https://support.eveonline.com/hc/en-us/articles/14141550499612-ISK-and-PLEX  
5. EVE — Global PLEX Market (2025) : https://www.eveonline.com/news/view/global-plex-market-and-friction-free-trade  
6. EVE MER (ex. May 2026) : https://www.eveonline.com/news/view/monthly-economic-report-may-2026  
7. Adam4EVE — Sinks/Faucets history : https://www.adam4eve.eu/mer_sinks_faucets.php  
8. Albion — Black Market feature : https://albiononline.com/news/video-black-market-feature  
9. Ata Kuyumcu — Balancing an MMO economy with a black market : https://blog.lvmbdv.dev/posts/albions-black-market-as-a-balance-mechanism/  
10. Albion Wiki — Silver, Gold Exchange, Premium, Black Market  
11. Hay Day Wiki — Currencies, Diamond, Roadside Shop, Trade  
12. Udonis — Hay Day monetization : https://medium.com/udonis/hay-day-monetization-how-this-farming-game-got-to-1-15b-in-revenue-c3b6cd486c78  
13. OSRS Wiki — Grand Exchange Tax & Item Sink ; Economy  
14. Jagex news — GE tax 2 % / item sink  
15. arXiv:2210.07970 — *Market Interventions in a Large-Scale Virtual Economy*  
16. GameDeveloper — Raph Koster, *The F-Words Of MMOs: Faucets*  
17. GameGrowthAdvisor — Game Economy Design (2026)  
18. Entropia — PED economy explainers  
19. Path of Exile currency / league economy guides  
20. Ferngill / Stardew economy mods ; FS25 MarketDynamics  

---

## 9. Conclusion design (pour l’équipe)

**Verdict :** un MMO agricole navigateur survit s’il traite les récoltes comme de l’**équipement consommable** (spoil, transformation, demande PNJ), pas comme de l’or imprimé. La monnaie soft doit être **difficile à stocker sans friction** et **facile à brûler** dans l’upkeep et le prestige.

**Priorité d’implémentation :**  
1) Énergie + spoil + taxes  
2) Marketplace escrow + taxe  
3) Office public (Black Market agricole)  
4) Pont soft↔premium  
5) Dashboard MER  

Sans (1)–(3) avant le mois 3, l’effondrement des prix de denrées à 6–12 mois est le scénario le plus probable **[H]**.
