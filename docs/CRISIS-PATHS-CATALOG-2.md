# Crisis paths: the rest of the catalog, checked against the sixth draft (2026-11-03, nothing built)

The second draft's 7b and 7c cards outside the slice's twelve, one row each, for the owner to pick from. Cites: BR AQ,
EX, MO = the build report's first lab games; BR R2, R3 = its second and third rounds; P0 = `CRISIS-PATHS-PHASE0.md`.

## Cards

| Card (owner, age) | What the player sees | Engine lever | Watched in the slice's runs | v6 section 0 | Verdict |
| --- | --- | --- | --- | --- | --- |
| The king's granaries (Despotism, AQ) | "My settlements pay Gold into the treasury now, and support for the government drops for a while." | Gold a settlement granted in the batch; negative celebration grants | Gold grants every run; negative support from Liturgies and The assembly turning (BR AQ) | Public support, not Happiness; Influence through readInfluence; no war, no trade | buildable now (goldPerSettlement run as a grant, a sign the slice hasn't used) |
| Conscript labour (Despotism, AQ) | "My capital's build jumps ahead, and support drops in every settlement." | `addProgress` on the capital's current build; negative celebration grants | `addProgress` via Merchant charter (BR EX) and New Deal works (BR R2); negative support (BR AQ) | Public support, not Happiness; Influence through readInfluence | buildable now (eligible only while the capital has a build) |
| Royal gifts (Despotism, AQ) | "I send Gold to a neighbour and they like me more; each gift costs more than the last." | the `aid` effect (Gold out, `changeRelationshipLevel`); a rising price kept in the ledger | aid bought +2 and +6 relationship under Lend-lease (BR R2, R3) | the court's rising price is Gold, not tax netting; Influence through readInfluence | buildable now |
| Tax farming (Oligarchy, AQ) | "Tax farmers pay me a lump of Gold now and take a share of my income for years after." | v2's "tax Gold sold off" is tax-card netting; as a grant plus a standing share of income (the shares-claim pattern) | the company's claim stood after Debt into shares (BR R2) | fails as written (v6 s1 drops netting); passes as a share of income | redesign: Gold now, a share of income for N turns |
| Guild cartel (Oligarchy, AQ) | "Partners pay more for my exports, so their bills to me rise, and they resent it." | the mod's class prices and trade bills; `partnersResent` | bills and `partnersResent` under Self-sufficiency (BR MO); Antiquity bill sizes never cited | bills, not route income | needs probe: Antiquity bills a partner (Modern's were 0.1 to 0.8 Gold, v5 s1); if that small, redesign onto credit |
| Bread and circuses (Oligarchy, AQ) | "Relief for my settlements is paid out of my borrowing room, not my treasury." | `responses` Relief at 0 Gold; `capTurns` down | responses at a cost factor under New Deal and `capTurns` under Bank regulation (BR R2) | Relief gives Public support (v6 s2); the price is credit room, not tax | buildable now |
| Corvee (Feudal Monarchy, EX) | "Public works build for free, and support falls while the labour lasts." | `responses` Public works at 0 Gold; negative celebration grants | responses (BR R2); negative support (BR AQ) | Public support, not Happiness | buildable now |
| Scutage (Feudal Monarchy, EX) | "My lords pay Gold instead of serving, so I pay my army's upkeep twice while it lasts." | v2's "War Levy silenced" has no lever (the mod can't change a game card or an AI's slots); Gold now plus a charge from `readUpkeepCents` | upkeep read under borrowed upkeep (BR MO, R3) | after the change, Gold and upkeep only; no war | redesign: Gold now, unit upkeep charged a second time for N turns |
| The lord's table (Feudal Monarchy, EX) | "I spend Gold feasting my lords: support rises and my prices hold in a price shock." | positive celebration grants; the civ's own `pricePct` term (as Debase and Bullion use) | support under Land reform (BR R2); `pricePct` outside the slice's runs | Public support, not Happiness; prices are the mod's | buildable now (price term tested offline) |
| Indulgences (Theocracy, EX) | "The faithful buy pardons: Gold now, support falls, and civs of other faiths like me less." | support spent for Gold (v6 s2); other faiths need a religion read the mod doesn't have | no religion read in any run | Public support, not Happiness | waits: on a religion read (v5 s2, s9) |
| The tithe (Theocracy, EX) | "Each settlement pays a Gold tithe a turn, and support slips while it's collected." | Gold a settlement granted; negative celebration grants | as The king's granaries | Public support, not Happiness | buildable now (close to The king's granaries; tier set on the benchmark) |
| Jubilee (Theocracy, EX) | "My debts to the temples and the citizens are cancelled, and the temples won't lend to me for a while." | the ledger's `writeOff` widened to temple and citizens' loans; a lender block like repudiation's | `writeOff` under Debt into shares (BR R2, amount unreadable); temple lender and blocks outside the slice's runs | ledger only | buildable now (offline tests) |
| Requisition (Revolutionary Authoritarianism, EX) | "I seize goods for Gold now; support falls and my prices climb." | Gold grant; negative celebration grants; `pricePct` up | Gold and negative support (BR AQ); `pricePct` outside the slice's runs | v6 s2 names it: support spent for Gold | buildable now |
| The Maximum (Revolutionary Authoritarianism, EX) | "My bills are frozen at ten turns ago, and the treasury pays or pockets the difference." | the mod's bills; the route-income half has no lever (`getTradeYields` reads 0) | bills under Self-sufficiency (BR MO) | fails as written (route income); passes on bills alone | redesign: bills only, sized as Guild cartel's probe finds |
| Confiscation (Revolutionary Authoritarianism, EX) | "I seize the nobles' estates for Gold, and the monarchies hold it against me." | Gold grant; `changeNumGrievances` on civs whose `getGovernmentType` is a monarchy | grievances under Diversionary war taken (BR R3), not itemised; v5 s2 lists them watched | no war declared; Governments has no monarchy tag, so the set is our own named list | buildable now |
| Forced conversion (Authoritarianism, MO) | "My bonds are rewritten onto a longer, cheaper schedule, and the bond market charges me more for years." | the ledger rescheduling bond loans; a `bondPct` legacy | bond loans and legacies (BR EX, R2) | ledger only | buildable now |
| Work battalions (Authoritarianism, MO) | "Public works at half price, and support falls while the battalions work." | `responses` Public works at 50%; negative celebration grants | responses (BR R2); negative support (BR AQ) | Public support, not Happiness | buildable now |
| Wage discipline (Authoritarianism, MO) | "My producers' margins rise and my people's support falls." | route income +10% has no lever; bills -10% of 0.1 to 0.8 Gold a partner moves nothing (v5 s1) | bills (BR MO) | fails as written (route income) | redesign: onto production or Gold a settlement against support |
| Crown monopoly (Bureaucratic Monarchy, MO) | "The crown owns one class of goods: my bills for it are halved and its world price rises." | the mod's world class price, pushed by one civ's card; bills | class prices never pushed by a card in any run | bills, not route income | needs probe: one civ pushing a class's world price |
| Ever-normal granary (Bureaucratic Monarchy, MO) | "Relief costs me less, and my trade slows while it runs." | `responses` Relief at a cost factor; route speed has no lever | responses (BR R2) | route speed isn't a lever | redesign: keep cheaper Relief, price it on bills or credit |
| Sale of offices (Bureaucratic Monarchy, MO) | "I sell offices for Gold now and pay their holders a salary every turn after." | tax-card prices can't change (game data, no AI slots); an administration charge a turn | the administration charge, 25 Gold under Liturgies (BR AQ) | an administration charge, not tax cards (v6 s1) | redesign: Gold now, an administration charge for N turns |
| Public bonds (Elective Republic MO, Constitutional Monarchy EX) | "My citizens lend me Gold cheaply over 30 turns." | the citizens' loan, its rate as a factor (P0: rates are per turn) | citizens' loan under Liturgies (BR AQ) | ledger only | buildable now (v2's "0.5%" reset as a factor) |
| Emergency tariff (Elective Republic MO, Constitutional Monarchy EX) | "High tariffs now; my partners resent it at once and keep their own tariffs up longer." | `highTariff`, `partnersResent`, `tradeWarDouble`; partners' tariff length as a new term | Self-sufficiency ran its full length (BR MO) | tariffs and bills, not route income | buildable now (tariff length tested offline) |
| Reconstruction finance (Elective Republic MO, Constitutional Monarchy EX) | "I lend to a civ in a Depression, and if it defaults I carry the loss." | the ledger's civ lenders (Lend to the crown's path), a loan with its default | civ lenders outside the slice's runs | ledger only | buildable now (offline tests) |
| Five-Year Plan (Communism, MO) | "My builds get twice the production at 3 Gold a point, the goods the plan starves cost me more, and I can't stop early." | `addProgress` paid in Gold; a per-civ, per-class price (today's `pricePct` moves the whole level) | `addProgress` (BR EX, R2); per-class price nowhere | prices are the mod's; a Programme carries the administration charge | needs probe: one class dearer for one civ |
| Collective farms (Communism, MO) | "The countryside pays Gold now, support falls, and food goods cost me more." | Gold a settlement granted; negative celebration grants; a per-civ, per-class price | as Five-Year Plan | Public support, not Happiness | needs probe: as Five-Year Plan |
| Repudiate the old regime (Communism, MO) | "I repudiate my debts at half the usual cost, and the bond market won't lend to me for the rest of the age." | the ledger's repudiation (AI-PLAN 4.4) and its bond block | outside the slice's runs | ledger only | buildable now |
| Rome: Bread and circuses at no credit cost (civ layer, AQ) | "As Rome, my Relief costs neither Gold nor borrowing room." | a civilization read, absent from v5 s2's lever table | none | rows select through Civilizations (DLC rule) | needs probe: civilization read |
| Persia: Royal gifts from tribute (civ layer, AQ) | "As Persia, my gifts are paid out of tribute." | civilization read; the Tribute response | AIs took Tribute (BR EX) | v2 says "at no Happiness cost", but Royal gifts carries none | needs probe: civilization read |
| Great Britain: Bank regulation keeping the bond market open (civ layer, MO) | "As Britain, regulation doesn't cost me my borrowing." | civilization read; v6's Bank regulation cuts the credit limit and never closes the bond market | none | as written there's nothing to keep open | redesign: e.g. Bank regulation without the credit-limit cut |
| Han: Crown monopoly across two classes (civ layer) | "As China, the crown's monopoly covers two classes of goods." | civilization read; Han is an Antiquity civ and Crown monopoly a Modern card, so they never meet | none | rows select through Civilizations (DLC rule) | redesign: move to Qing (Modern), after Crown monopoly's probe |
| Civilization affinities (civ layer table, any age) | "As my civilization, my government's path costs a step less Influence." | civilization read; Influence through readInfluence | readInfluence (P0, BR MO) | Influence only through readInfluence | needs probe: civilization read |

## Probes

| Probe | Cards | Age | Mods on | Map situation | The capture must show | Modern game |
| --- | --- | --- | --- | --- | --- | --- |
| Civilization read | Rome, Persia, Great Britain, Han or Qing, the affinities | any; rides the Modern run | Economics working copy, every other mod off | any seed; Great Britain or Qing in play if the setup allows | a log line of each player's `civilizationType` beside the diplomacy ribbon naming the same civs | yes |
| One class dearer for one civ | Five-Year Plan, Collective farms | Modern | Economics working copy, every other mod off | a Communist AI in play (seed 4242 had one); the probe raises one class's price for that civ | the Markets tab for that civ with the class dearer than for another civ, and its bills moved; if the tab shows world prices only, the player can't see this price | yes |
| One civ pushes a class's world price | Crown monopoly (and Han or Qing) | Modern | Economics working copy, every other mod off | a civ with routes trading that class; the probe pushes the class's world price from that civ | the Markets tab with the class's world price up for two civs, and the pushing civ's bill on that class halved | yes |
| Religion read | Indulgences | Exploration | Economics working copy, every other mod off | mid-Exploration, a religion founded and a second faith among the neighbours | a log of each civ's religion and each settlement's majority faith beside the game's religion screen | no |
| Antiquity and Exploration bill sizes | Guild cartel, The Maximum | none: read the logs of run `2026-11-03T10-56-09` | none | none | Gold a partner a turn; under about 1 Gold, both cards redesign onto credit | no |

### Lab run 2026-11-04T00-30-10, 2026-11-03

Modern seed 4242, the Economics working copy and Partisans, every other mod off. Captures are
`working_screenshots/catalog-*.png`.

- Civilization read, watched: each player's `civilizationType` logged at turn 45 (Heian Japan, Achaemenid Persia,
  Ottomans, Hawai'i, Goryeo, Dai Viet, all met) beside the diplomacy ribbon's six leaders.
- One class dearer for one civ: the Markets tab shows one world price per resource and no column per civ, so the
  player can't see a price set for one civ. Hawai'i was the Communist AI. Nothing in the code sets a per-civ class
  price yet, so no bills moved for one civ.
- One civ pushes a class's world price: doubling the Bonus class's prices by script showed on the Markets tab after
  the batch as Clay, Dates, Dyes and the rest at 8.0, up 3.1 from 4.7, the same for every civ; bills on routes trading
  Bonus goods moved by cents (Ottomans to Hawai'i 0.03 to 0.08 Gold). The pushing civ's halved bill has no code yet.

### Lab run 2026-11-04T02-58-40, 2026-11-03

Exploration seed 4242, the Economics and Partisans working copies, every other mod off, 40 turns on Autoplay. The
sample (`ex-sample.js` in the run folder) logged each civ's faith and each settlement's faith whenever one changed.

- Religion read, watched: a script can read which faith each settlement follows. `Players.get(p).Religion` gives
  `hasCreatedReligion()` and `getReligionType()`; each city's `Religion` gives `majorityReligion`, `urbanReligion`,
  `ruralReligion` (hashes that `GameInfo.Religions.lookup` names, -1 for none) and `isHolyCity`. There are no follower
  counts per settlement, only the urban and rural faiths and the majority.
- Three faiths were founded by turn 20 (Hinduism, Shinto, Judaism) and all six civs had one by 30 (the seat's
  Protestantism, Zoroastrianism, Sikhism). Conversions showed up in the log: by 34 the Zoroastrian holy city followed
  Judaism (at 32 its urban faith was still Zoroastrianism, its rural one Judaism and it had no majority), a Sikh civ's
  settlement followed Zoroastrianism and a Hindu civ's settlement followed Shinto.
- The game's religion screen at turn 34 (`working_screenshots/explo-religion-screen-t34.png`) names the six faiths
  with their world shares (3, 10, 7, 17, 3 and 10 percent) and the seat's "Protestantism, 3% Following, Founder:
  Himiko, High Shaman, Holy City: Heian-Kyo". It gives each faith's share, not each settlement's faith; the player
  sees a settlement's faith on its banner.

## The owner's decisions (2026-11-04)

- **Han and Qing:** Crown monopoly's two-class variant moves to Qing (Modern). Han gets the same idea in Antiquity:
  as Han, Guild cartel raises the price of two classes of exports instead of one (the salt and iron monopoly). Only
  reachable while Han governs as an Oligarchy. Both wait on the class-price probe. Rows select through Civilizations,
  so a game without Han or Qing has no variant.
- **Great Britain:** as Britain, Bank regulation runs without cutting the credit limit.
- **Persia:** the Gold Persia takes as Tribute in a crisis goes into a fund; Royal gifts draw on it first, and the gift
  price doesn't rise while the fund pays. Once it's spent, gifts cost treasury Gold and rise as usual.
- **Confiscation's monarchies:** Economics adds its own `ECON_MONARCHY` tag to the base monarchies through SQL that
  selects through Types, so a missing government is skipped, and reads the tag from `GameInfo.TypeTags` at runtime;
  another mod can tag its own governments. The AI has to see and answer it: the AI's choice of Confiscation weighs the
  grievances from the tagged civs, and the angered civs answer through the game's own grievances, which the game's AI
  diplomacy already acts on.
- **AI-declared wars (v6 section 3):** Phase 0 showed a script war matching an ordinary one in war support, the
  nine-turn bar on peace and peace on its own; the diplomacy screen during a script war was never captured. The Modern
  lab game after this decision captures it. If it matches, v6 section 3's gate is recorded as passed and the slice's
  AI-declared war stands; if not, the AI takes Diversionary war only when it's already at war.
