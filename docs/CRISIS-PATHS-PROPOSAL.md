# Crisis paths: a proposal (2026-11-02, nothing built)

The owner's ask: the player should see which responses they've chosen for a crisis, and a crisis should have more
than one way through it depending on government, ideology and civilization.

## What's there now

- The Crisis section on the World tab lists the open crisis, then "What you can do" (the menu) and, once a response
  is taken, "What you're doing" with each running response and an End it button. The Fiscal tab lists "What your
  choices left" (the legacies). Both were watched 2026-10-31 and 2026-11-02. The World tab is the only place the
  chosen responses show; the top-bar phase pill says "Depression" and nothing about what's been chosen, and the
  Treasury's history only says a response was taken.
- The menu is one list per age, filtered by the crisis kind and the stage, with three system rules: Tribute only
  for a tribute economy, the gold standard never for a Planned one, Charter a company and Navigation acts behind
  their stages. The AI picks by a `prefer` list per system. A Theocracy and a Plutocracy in the same Depression see
  the same cards at the same prices.

## What the player would see

1. The pill and the header carry the choice. The phase pill reads "Depression · Public works" while a response runs,
   and the screen's header line under the title reads "Manorial economy · Depression · Public works, Relief". The
   turn notice says "You're running Public works (turn 3 of it)" each turn it runs. One place for the choice on
   every tab, not two tabs deep.
2. Each card says who it's for. A response the civ's government, ideology or civilization favours shows a short
   "Your way" tag and a cheaper price or a stronger effect; one that cuts against them shows "Against your grain"
   and a dearer price or a second cost. The menu stays the same length; what changes is which three or four
   cards stand out, so a Theocracy sees The temple lends and Relief marked, a Plutocracy Charter a company and
   Bullion fleets, a Communist Public works and the plan, a Fascist Rearmament and Austerity. The tag's tooltip
   says why in one sentence.
3. A path, not a pick. Two or three responses in a row that fit the same way earn a named legacy for the age
   ("the New Deal", "the company state", "the Plan") with a lasting effect the Fiscal tab lists;
   mixing ways earns nothing extra. That gives a Depression three or four distinct ways through it that the player
   can aim for and read on the screen.

## The levers

- The pill and header text are the mod's own (`econ-pills.js`, `econ-screen.js`); the running responses are in the
  ledger (`responses` rows), so 1 is UI only.
- The catalog already carries `prefer` per system and `system`/`notSystem` gates (`econ-crisis-catalog.js`). 2 adds a
  per-response `ways` table keyed by system, government and ideology (and a civilization override for the few with
  a story to tell: Rome's grain dole, Persia's tribute, Britain's gold standard) with a price factor and an effect
  factor; the refusal and cost code in `econ-crisis-respond.js` reads it. Governments and ideologies are already
  read each batch (`readIdeology`, the systems table), so no new engine read.
- 3 is a legacy row written when the ledger's response history for the crisis matches a path; the legacy list
  already draws on the Fiscal tab.

## Cost and order

1 is a day: three text keys, the pill's composer and the header line, tested with the fake DOM. 2 is two to three
days: the table, the price and effect factors, the AI's pick reading the same table (so the AIs follow their own
ways, which also makes their picks more varied than "all five take Rearmament"), the Civilopedia text, and a lab
run per age. 3 is a day on top of 2. The owner decides the ways table before 2 starts; a first draft follows the
systems in DESIGN 4.17 and the four Modern ideologies.

## Unique responses by government and ideology (the owner's direction, 2026-11-02: several each)

Each government and each ideology gets three responses only it can take: one quick Gold move, one that changes
how the civ runs for a while, and one that turns outward (its people or its neighbours). Taking two of the three in
one crisis earns the government's named legacy for the age. Every effect runs on levers the mod already drives
(Gold grants, the celebration meter for Happiness, the loan ledger, tariffs, prices, the index, build progress,
relationships and grievances, legacies). The card sits in "What you can do" under the shared cards, with "Only a
Theocracy can do this" under its name and its own history line; the AI with that government reaches for its own
cards first when the crisis kind fits.

| Government or ideology | Response | Tier | History line | Now | Price | It leaves |
| --- | --- | --- | --- | --- | --- | --- |
| Despotism | The king's granaries | measure | Joseph's storehouses | 3 turns of income now from your settlements | -3 Happiness a settlement for 5 turns | once per age |
| Despotism | Conscript labour | programme | the pyramid gangs | your capital's build gains 2 points a turn per settlement for 10 turns | -2 Happiness a settlement while it runs | the works; once per age |
| Despotism | Royal gifts | measure | the king's largesse to the satraps | 1 turn of income to each civilization you've met: relationship +5 with each and your index +0.01 | your own people watch the treasure leave: -2 Happiness a settlement for 10 turns | a court that expects gifts: the next crisis's Royal gifts cost 2 turns each |
| Classical Republic | Liturgies | measure | the Athenian liturgy: the rich pay for the fleet | your citizens lend 3 turns of income at 0% over 10 turns | the meter stops rising from their interest meanwhile | their later loans cost 0.25 points more for 20 turns |
| Classical Republic | Land reform | measure | the Gracchi, 133 BC | +4 Happiness a settlement for 10 turns | -2 Gold a settlement a turn for the 10 turns, and the great families answer: your citizens' loan cap halves for 20 turns | once per age |
| Classical Republic | The assembly speaks | gamble | the Pnyx | Confidence at double strength: 20 Influence for +0.02 on your index | the Influence, and a promise: if your index is still under 0.90 five turns on, the assembly turns on you, -4 Happiness a settlement for 5 turns | once per crisis |
| Oligarchy | Tax farming | measure | the Roman publicani | 4 turns of income now | your tax cards' Gold -25% for 20 turns | credit limit +2 turns of income for the age |
| Oligarchy | Guild cartel | measure | the Hanse closes its ports | your exporters' prices +15% for 10 turns | -1 relationship with each importer every 5 turns | once per age |
| Oligarchy | Bread and circuses | measure | Crassus feeds Rome | Relief at no Gold cost for 5 turns | your credit limit -2 turns of income for 20 turns | once per crisis |
| Feudal Monarchy | Corvee | programme | labour owed to the lord | Public works at no Gold cost for 5 turns | -2 Happiness a settlement while it runs | the builds; once per age |
| Feudal Monarchy | Scutage | measure | shield money instead of knight service | 2 turns of income now | the knights have paid their due: War Levy pays nothing for 20 turns and -1 Happiness a settlement for 10 | once per age |
| Feudal Monarchy | The lord's table | measure | the manor feeds its own | +2 Happiness a settlement for 10 turns and your warehouses' slump cushion doubled | -1 Gold a settlement a turn for the 10 turns | once per crisis |
| Theocracy | Indulgences | measure | Tetzel's chest, 1517 | 3 turns of income now | -1 relationship each 5 turns for 10 turns with civilizations of another religion | temple treasuries at 0.8x the rate for the age |
| Theocracy | The tithe | measure | a tenth to the church | +2 Gold a settlement a turn for 10 turns | -2 Happiness a settlement for the 10 turns | once per age |
| Theocracy | Jubilee | programme | the year of release | loans you owe the temple treasuries and your citizens written off; +4 Happiness a settlement for 5 turns | reputation -15 | the temples closed to you for the age |
| Plutocracy | Debt into shares | gamble | the South Sea Company, 1711 | a fifth of your bond debt written off | trade bills +10% to every partner for 20 turns | the bond market at 1.25x the rate for 20 turns; once per game |
| Plutocracy | Lottery loan | gamble | the Million Adventure, 1694 | borrow 4 turns of income from the bond market at half the rate, +1 Happiness a settlement while the draw runs | repaid over 5 turns, not 10: payments near your service limit, so a slump turn can mean a miss | once per age |
| Plutocracy | Merchant marine | programme | the Navigation bounty | your route income +25% for 20 turns | -1 Gold a settlement a turn for the 20 turns | once per age |
| Revolutionary Authoritarianism | Requisition | measure | the levee en masse | 2 turns of income now; prices rise 3% a turn for 5 turns | -3 Happiness a settlement for 5 turns; reputation -5 | inflation +0.25% a turn for the age (the assignat) |
| Revolutionary Authoritarianism | The Maximum | programme | the Law of the Maximum, 1793 | your bills and route income frozen at ten turns ago for 10 turns | -2 Happiness a settlement while it runs | once per age |
| Revolutionary Authoritarianism | Confiscation | measure | the estates of those who fled | 3 turns of income now | -3 relationship and 5 grievances with every monarchy | once per age |
| Authoritarianism | Forced conversion | programme | the state rewrites its own bonds, the 1920s | no bond payments for 5 turns, then the same payments at 0.5 points less | reputation -10; -2 relationship with each lender civ | the bond market closed to you for 10 turns after |
| Authoritarianism | Work battalions | measure | the unemployed put in uniform | Public works at half its Gold | -2 Happiness a settlement while it runs | once per age |
| Authoritarianism | Wage freeze | measure | the corporatist pact | your own index +0.02 now and +0.005 a turn for 10 turns | -3 Happiness a settlement for the 10 turns | once per crisis |
| Bureaucratic Monarchy | Crown monopoly | measure | the salt and iron of the Han | your dearest resource class billed at half for 10 turns, the difference to you | its price rises 2% a turn for 5 turns for everyone | once per age |
| Bureaucratic Monarchy | Ever-normal granary | measure | the Song granaries | Relief at half price and +1 Happiness more | the granary is filled first: your route income -25% while it runs | once per age |
| Bureaucratic Monarchy | Sale of offices | measure | the Qing's purchased ranks | 3 turns of income now | your tax cards cost 1 Happiness more for 20 turns | once per age |
| Elective Republic, Constitutional Monarchy | Public bonds | measure | the bond drives of 1917 | 4 turns of income now from your citizens at 0.5% over 30 turns | the meter pays 1 Gold a settlement a turn while they stand | citizens' loans open 20 turns longer |
| Elective Republic, Constitutional Monarchy | Emergency tariff | measure | Smoot-Hawley, 1930 | the High tariff on every partner for 10 turns at no relationship cost | the trade-war weight counts you double (the Hoover line) | partners that remember: their tariffs on you 10 turns longer |
| Elective Republic, Constitutional Monarchy | Reconstruction finance | programme | the RFC, 1932 | you lend 1 turn of income at 1% to each civilization in a Depression: relationship +3 with each | the Gold leaves now and comes back over 20 turns only if they pay; a default is yours to carry, and your own bond rate +0.25 points while the loans stand | once per crisis |
| Democracy | New Deal programmes | programme | the WPA and Social Security, 1935 | Public works and Relief both run at half their Gold | they run three turns past the crisis | +1 Happiness a settlement for the age and the next |
| Democracy | Bank regulation | programme | Glass-Steagall, 1933 | your bond rate -0.5 points for the age; a Panic can't start from your leverage | your credit limit -2 turns of income for the age | once per game |
| Democracy | Lend-lease | programme | 1941 | aid to civilizations at war with your enemies buys double goodwill and the bond market pays half of it | the half you pay, your bond rate +0.5 points for 20 turns, and -5 relationship with the civilizations they fight | once per crisis |
| Fascism | Self-sufficiency | measure | the closed economy, the 1930s | the High tariff on everyone at no relationship cost and your import bills halved for 20 turns | your route income halved for the 20 turns; the trade-war weight counts you double | trade buildings count a quarter less for the age |
| Fascism | Foreign adventure | programme | a crisis exported abroad, the 1930s | the war economy: declare war on an independent power or a civilization within 5 turns; while you're at war your index climbs +0.05 a turn and your builds gain 2 points a settlement a turn | if no war comes in 5 turns the Depression deepens, -0.03 a turn until you declare one; every peace made while it runs costs -0.05 at once; 10 grievances with every civilization you've met | a war economy for the age: your index falls -0.02 a turn in any 10-turn stretch of peace |
| Fascism | Grain campaign | measure | a nation that feeds itself, the 1920s | a floor under your farm prices at 100% of ten turns ago and +20% route income from Bonus resources for 10 turns | -1 Happiness a settlement for the 10 turns | once per age |
| Fascism | Off-book bills | gamble | arms paid in paper the bank quietly backs, the 1930s | borrow 4 turns of income from the bond market with no payment for 10 turns | the bills are redeemed by conquest: a settlement taken within the 10 turns pays them off; otherwise full payments at 1.5x the rate | inflation +0.5% a turn for the age |
| Communism | Five-Year Plan | programme | 1928 | the plan's take doubles for 10 turns and buys builds at 3 Gold a point | -2 Happiness a settlement for the 10 turns | your builds keep +10% from the take for the age |
| Communism | Collective farms | measure | the countryside brought under the plan, 1929 | 2 turns of income now from the countryside | -4 Happiness a settlement for 10 turns | -1 Happiness a settlement for the age |
| Communism | Repudiate the old regime | gamble | the new state disowns the old one's debts, 1918 | every loan you owe repudiated at half the usual relationship and reputation cost | the bond market closed to you for the age | once per game |

Named legacies for two of three in one crisis: Despotism "The king's hand", Classical Republic "The people's
republic", Oligarchy "The great families", Feudal Monarchy "The manor holds", Theocracy "The faith provides",
Plutocracy "The company state", Revolutionary Authoritarianism "Iron rule", Authoritarianism "The command
economy", Bureaucratic Monarchy "The mandarinate", Elective Republic "The recovery act", Democracy "The New Deal",
Fascism "Turned inward", Communism "The Plan". Each is one lasting line on the Fiscal tab for the age (the exact number is
the owner's; the proposal's default is +5% of the crisis's slump charge handed back each turn for the age).

## Tiers: how hard a card works on the crisis, and what it costs in political capital (2026-11-02)

Influence is the game's political capital and the mod already charges and pays it, so every unique card has an
Influence price beside its Gold and Happiness price, and the three tiers trade price for how fast they end the
crisis. The tier shows on the card ("Measure", "Programme", "Gamble") beside its price.

| Tier | What it does to your index | Influence | While it runs | The legacy |
| --- | --- | --- | --- | --- |
| Measure | +0.01 a turn while it runs, or +0.02 once for a one-act card | 10 up front | its Gold or Happiness price | small, as the table says |
| Programme | +0.03 a turn, and under 0.95 the world's +0.01 a turn with it; a Depression ends about three times sooner | 60 up front and 6 a turn | it takes your tax slot (the tax card comes out), your bond rate +0.5 points, and its own Gold price | the big one, and only if it runs to the crisis's end; ended early you keep nothing |
| Gamble | +0.05 a turn for its run | 20 up front | its own price | the upside stands if your index is at or above 0.90 when it ends; under that the gamble turns (its "turns" line) and the legacy is the bad one |

The turning lines for the gambles: The assembly speaks, -4 Happiness a settlement for 5 turns; Debt into shares,
the bond market at 1.5x the rate for the age; Lottery loan, the loan's rate doubles for what's left; Off-book bills,
inflation +1% a turn for the age; Repudiate the old regime, every met civilization -5 relationship and 10
grievances. The AI takes a Programme only with the Influence in hand and no war on, a Gamble only when its index
is under 0.70, so the AIs' picks spread by their means as well as their government.

## The ideologies aren't equal (2026-11-02)

The three ideologies get different trajectories, on purpose, and the tiers above bend to them:

- Democracy: slow, dear and sound. Its cards are Programmes or a careful Gamble; they cost the most Influence,
  take the longest to show, and every legacy is good and lasts into the next age. The New Deal is the model.
- Communism: strong on builds, hard on people, rigid. Its cards lift the index like Programmes but every one costs
  Happiness while it runs, the Plan can't be ended early once begun, and its legacies trade a lasting production
  bonus for a lasting Happiness debt. It works, and the people pay.
- Fascism: fast, cheap, bad, and it wants a war. Its cards lift the index like Gambles (+0.05 a turn) for half the
  Influence, with no 0.90 test: the bad legacy always lands. Two of them demand conflict: Foreign adventure needs a war
  declared on an independent power or a civilization within five turns or the Depression deepens by 0.03 a turn
  until one comes, and Off-book bills are paid off only by a settlement taken within ten turns. A Fascist AI that takes
  Foreign adventure declares that war itself (the engine's `forceDeclareWar`, which the lab watched working for AIs), on the
  nearest independent power first. Self-sufficiency's turned-inward trade, the Grain campaign's dearer
  food and the Off-book bills' inflation each stay for the age, and taking two of the three earns the "Turned inward" legacy
  for the rest of the game, not the age: route income -25% and the slump cushion halved from then on. A Fascist civ
  gets out of a Depression fastest and is poorer in every one after. Its AI takes them anyway, true to type, so a
  Fascist AI's economy is visibly worse by the late game than its neighbours', which the World tab's index history
  shows.

Naming: a card's name is plain words for what it does (Forced conversion, Work battalions, Foreign adventure); a
dictatorship's slogans and programme names stay out of the card names and history lines, which point at the era
and the idea instead. Programmes a democracy is remembered well for keep their names (the New Deal, Lend-lease,
Glass-Steagall); the Civilopedia page tells each history properly in its own voice.

The rule every card has to pass: it costs something the player feels within five turns (Happiness, relationships,
reputation, trade, or a payment schedule that can bite) and it leaves something that lasts the age, so no card is
free Gold and no card is a pure comfort; the quick Gold moves hurt the people, the structural ones hurt trade or
credit, the outward ones hurt neighbours or the treasury.

Rules: a unique card is open in the crisis kinds its text implies and always in a Depression and a debt crisis;
one running unique card at a time; the AI picks its own cards ahead of the shared ones when the kind fits;
changing government mid-crisis keeps a running card and closes the old government's others. The Civilopedia's
"Crises and responses" group gets one page per government and ideology.

The one engine read to probe before Foreign adventure is built: that the seat's war with an independent power reads from
`Diplomacy.isAtWarWith` the way wars with majors do (the glue's `readAtWar` counts majors only today), and that a
settlement captured from one shows in the capture events the cycle already reads. Both are reads, a short lab
check at the start of the build.

What the owner decides: the names and numbers above; whether Constitutional Monarchy shares the Elective Republic's
three or gets its own; whether an Antiquity government's cards stay open to a civ that keeps that government into
Exploration.
