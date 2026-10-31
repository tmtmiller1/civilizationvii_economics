# Changelog

All notable changes to the Economics mod for Civilization VII. The format follows
[Keep a Changelog](https://keepachangelog.com/) and Semantic Versioning. The Steam Workshop change note for each
release is generated from the matching section below by `scripts/steam-changelog.mjs`.

## [Unreleased]

### Added
- The turn batch: every living civilization's balance, income, upkeep, buildings, stages and relationships are read
  once at the start of each turn, the loan model plans the turn, the ledger is written to the save, and each
  civilization gets one Gold, Influence and celebration grant. A save that falls before the grants land is caught on
  reload and the grants are sent again, and a save from before the turn's batch runs it once when you load it.
- The tax policy cards: Light Taxation, Heavy Taxation and War Levy in each age, in the game's own policy slots, with
  one extra slot granted by each age's first civic, unlocked through the civics tree, and two AI strategies that
  steer the computer players toward them. The game's AI picks them like any card.
- The Economics screen (Treasury, Loans and Fiscal tabs) from its own dock button, with a debt pill in the
  resource bar after the settlement limit. Borrow, repay, restructure, repudiate and lend from the Loans tab. Each loan offer shows its payment, the
  interest in all and how much of your income your payments would take with it, and a repudiation or a restructure
  shows what it costs before you confirm. Slot or clear a tax card from the Fiscal tab, which shows each card's
  change to your Gold and Happiness and when your next celebration would come.
- One notification per turn with the mod's changes to your Gold, Influence and celebration meter, the loans that
  opened, missed or defaulted, and any request that was refused and why. A click opens the screen.
- Economic stages: loans between civilizations open with Moneylending, the bond market and longer terms with Public
  debt, War Levy with Coinage; each closed part is greyed with the civic or tech that opens it.
- World prices: every resource gets a price from its class, how many copies the civilizations hold and who needs
  it, and the Markets tab lists them with the last 30 turns.
- Trade bills: each pair of civilizations settles the net value of what they import from each other every turn. The
  side that owes more pays, never more than a tenth of its income, and anything over that is waived. Trade buildings
  at either end move the bill. The Trade tab shows each partner's bill, the cap and what a new route would add.
- Tariffs, from Imperialism: Low or High holds back 10 or 25 percent of what you owe the civilizations you import
  from. A High tariff costs 1 relationship with each of them every five turns, and the computer players answer one
  in kind. Set it on the Fiscal tab, once every five turns.
- With Foreign investment on, a civilization that sends Military Aid pays the 2 Gold a turn its target gets (scaled
  by age), so the computer players' own aid moves Gold between them instead of making it.
- Foreign investment and aid from the Trade tab: a development loan puts Gold into the build a city is working on now
  (from Guilds) and is repaid with interest over 25 turns, more on an economic building; general investment (from
  Colonialism) goes into the treasury and its return follows the host's income; aid of either kind is a gift.
  Each raises the relationship. Computer players invest in and aid their friends, and offer to invest in you; you
  accept or decline on the Trade tab.
- The Trade, Warehouse and Industry building roles beside Commerce and Banking, read from the game's data with other
  mods applied; the Treasury tab counts them.
- Three setup options for these: Markets and trade bills, Tariffs, and Foreign investment, all on by default.
- The project: the engine-free loan model (loans, credit, lenders and rates, payments and misses, default and
  garnish, repudiation, the auto-loan guard, AI rules, the saved ledger) with its tests, the six 1.0 setup options,
  the 12 text folders, the gates and the release script.
- The business cycle: a world economic index that wars, captures, razes, disasters, the age's crisis, defaults,
  repudiations, peace, trade routes and the world's income move, and drifts back between them, with each
  civilization's own economy on top. A boom pays a little Gold each turn and makes bonds cheaper; a slump takes a
  little and makes them dearer. Warehouses and old economic buildings soften a slump. From Banking, a boom built on
  too much borrowing can turn into a five-turn Panic. The turn notification names what changed your phase.
- Inflation, off by default: civilizations with Public debt lose a little of the Gold they hold above twenty turns
  of income when they owe the bond market a lot beside it, and bond loans cost more.
- Economic systems: each civilization's government, or its ideology in the Modern age, sets its system (palace
  economy, civic market, merchant oligarchy, manorial, mercantile, usury law, corporatist, market, planned or mixed),
  which changes its rates, credit, trade bills, investment and how hard booms and slumps swing it. The tax-card
  changes are policy-card yields the game shows on each city's breakdown. A new system blends in over ten turns.
- With Economic systems on, each civilization leans toward one government in its own age, so the computer players
  spread across the systems instead of most of them taking the same two or three. The game reads these leanings when
  a game is created, so they reach new games only. `docs/government-biases.md` lists each civilization's pick.
- Citizen loans for a Classical Republic: borrow from your own citizens from the start of the game, and the
  interest comes back as celebration. The computer players take them too.
- The plan for a Communist civilization: a fifth of its Gold income goes into its cities' builds each turn.
- A Theocracy lends as a partnership: what it's paid follows the borrower's income.
- Old buildings fade across the ages instead of switching off, role by role, and what they lose becomes a slump
  cushion. The Treasury tab lists each with its weight and what moves it.
- The Banking stage (Urban Planning) and the Capitalism stage, with a deeper credit market, Panics, wider returns on
  investment and computer players investing in each other.
- The World tab: the index, your phase, what moved it, its last 30 turns, inflation and its cause, world debt and your
  legacy. The Fiscal tab names your economic system and what it changes.
- Three setup options for these: Inflation (Off), Business cycle (Off, Mild, Standard, Strong; Standard) and
  Economic systems (On).
- The Spoil Guard, under Options, Mods, Economics, on by default: civilizations you haven't met are left off the
  Trade tab, the aid list and the list you can lend to, and a line that would name one says "an unmet
  civilization". With Demographics installed, the stricter of the two guards wins.

### Changed
- Booms and slumps can be big. A new setup option, Economic swings, sets how far they run: on Volatile, the default, a
  downturn feeds on itself and a boom overshoots when it turns, so a depression can take a third to half of your
  income for a few turns, about what an age's crisis takes, and a boom can add a quarter. Each game finds its own highs
  and lows. Gentle keeps the old cycle, where a slump cost a few percent; Extreme runs wilder still. A Panic now hits
  half as hard on Mild and half again as hard on Strong.
- The Economics screen grows with your economy. In Antiquity it opens with the Treasury and Fiscal tabs; Markets and
  World appear with Currency, Trade with Code of Laws, and Loans with Commerce, or sooner if you take an emergency or
  temple loan or your citizens would lend to you. Until the Loans tab appears, the auto-loan guard and your loans sit
  on the Treasury tab, along with this turn's business cycle Gold until the World tab opens. Parts you haven't reached
  are left out instead of greyed, and each tab ends with one line naming what opens next and the civic or tech that
  opens it. The turn a tab or part opens, the turn notification says so, and the dock button shows a small gold dot
  until you look. With Economic stages off, every tab is there from the start.
- The Economics screen has a new look. A strip above the tabs shows your treasury, income, what Economics moved last
  turn, your debt with this turn's payments, your economy's phase and anything waiting for next turn, and your
  economic system and phase sit under the title. Gold and Happiness show with the game's icons and their signs. The
  business cycle reads on a dial, and loan payments and inflation on slim scales with the lenders' limit and the
  inflation cap marked. The 20-turn projection, the world index and each resource's prices are line charts with a
  scale, turn labels and a readout for the turn you point at. What Economics moved last turn opens to its parts, and
  the Treasury tab says what changed since last turn.
- Borrowing, repaying, restructuring, repudiating, lending and investing open a confirmation right under the button,
  with your treasury, debt and payments now and after, and the line saying it was sent appears beside it. The borrow
  form starts at the most your limits allow over the shortest term. A button you can't use says why beside it.
- Buttons, choices and steppers are the game's own activatable controls, so a controller's accept presses them, and
  Escape closes the screen.
- The turn notice shows Gold in whole numbers, like the top bar, and only speaks up when Economics moved 2 Gold or
  more that turn.
- The debt pill sits in the top resource bar, after the settlement limit.
- Heavy Taxation opens in Antiquity at Code of Laws, after Priesthood's civic, so Priesthood is the first Gold card
  you can pick. Light still opens at Chiefdom.
- The Rates setup option is now called Base Interest Rate, and its tooltip says what it sets: the rate every loan
  starts from in each age, which each loan's payment record, relationship, banking buildings and the world economy
  then move.
- The business cycle no longer leans to Boom. A trade route that stands and income that grows at its usual pace don't
  move the world any more; only growth faster or slower than usual does, and a long boom wears itself out, so a
  growing world still has slumps.
- At an age change the turn notice says how much of your Gold the game let you keep ("the age change kept 6,000 of
  your 11,432 Gold"), and the Treasury history records it for every civilization.
- The turn notice reads as a sentence: "from trade bills and the business cycle", and two wars declared in one turn
  read "after 2 wars declared" instead of the same cause twice. The Fiscal tab says "next turn" instead of "in 1
  turns".
- Trade bills follow what's traded: 2.5 percent of each copy's price a turn instead of half, so the tenth-of-income
  cap only bites on the biggest deficits and a tariff changes what you pay.
- The computer players set tariffs of their own: Low against a big partner they pay more than they're paid and aren't
  friends with, High against a big partner they're Unfriendly with. They answer your Low with Low and your High with
  High two turns later, and drop back when you do.
- The computer players' tariffs come back down. After 20 turns at peace with a civilization, or straight away once
  they're friends, a computer player lets go of its tariff against it, and the other side still holding one isn't
  enough to raise it again. A war, or a new raise from the other side, starts it up again. In a test game five
  computer players answered each other's High tariffs for 130 turns, each waiting for the other to lower first.
- General investment turned down because the other civilization is in default now says a development loan on one of
  its builds is still open, and the Trade tab shows the refusal before you ask, with a button that opens that loan
  with the same Gold. Nothing is sent until you pick a build.
- Citizen loans' interest comes back as 6 celebration for each Gold, up from 2, the same as Light Taxation now buys.
- The computer players borrow to build: while their credit is cheap, each takes a loan now and then and puts it
  straight into the building it's working on, within the same limits you have. Easy credit in a boom now leads to
  more borrowing, and from Banking a boom carried on too much debt can end in a Panic. World leverage is now counted in
  turns of the world's income, and the World tab shows it against the line where a Panic can start.
- Interest rates are half what they were: 1.5 percent a turn in Antiquity, 1 in Exploration and 0.75 in Modern, so a
  Market, Bazaar or Bank bought with a loan pays its own interest within ten turns. Your payments can take up to half
  your income instead of 35 percent, and 20-turn loans from other civilizations open with Moneylending; 30-turn loans
  and the bond market still wait for Public debt.
- A loan refused for your limits tells you the most that lender will lend over that term, and the Loans tab has a
  "Borrow that instead" button.
- The plan buys its production at the game's own Gold price, read from the game's data (4 Gold a point unless
  another mod changes it), instead of 3. What's left after whole points goes into the biggest cities.
- The mod's description in Additional Content covers the whole mod: loans, taxes and the guard, markets, trade bills,
  tariffs and investment, and the business cycle, inflation, old buildings and economic systems. The Fiscal tab's
  line for a mixed economy says what it gets, and the Economic systems option says the computer players lean toward a
  government that suits their civilization.
- The tax cards add flat amounts in each settlement instead of percentages: Light Taxation -1 Gold and +6 Happiness,
  Heavy Taxation +4 Gold and -2 Happiness, War Levy +2 Gold and -1 Happiness in peace and +8 Gold and -4 Happiness
  while you're at war. The computer players took flat cards in test games where they passed over the percentage ones.
  The two AI strategies that steer them are stronger.
- Light Taxation is cheaper and calms more: -1 Gold and +6 Happiness in each settlement, up from -2 and +4. In test
  games the computer players never took the old one; now a grown civilization whose cities are getting unhappy takes
  it, while young ones still go for Heavy Taxation. Under a Civic market Light gives +2 Happiness more, up from +1.
- Light Taxation gives less Happiness in the later ages: +6 in Antiquity, +4 in Exploration and +3 in Modern, still
  for 1 Gold in each settlement. In a test game every computer player slotted the +6 card early in Exploration and
  Modern and kept it all age, with Happiness to spare. The card's text and the Fiscal tab show the age's amount.
- War Levy pays a little in peace: +2 Gold and -1 Happiness in each settlement, rising to +8 Gold and -4 Happiness
  while you're at war. The computer players often keep it slotted in peacetime, and before this it gave them nothing
  there. The Fiscal tab shows both amounts. Under Corporatist it still pays the full wartime amount in peace.
- Loans Off now turns off the loans alone; trade bills and investment keep their own options.
- The auto-loan guard only borrows while your income is at or below 0: with positive income the game wipes a
  negative balance to 0 at the turn roll without charging you, so a loan there would be Gold the game gives for free.
- The Treasury tab keeps loans out of sight until they're a thing for you: what you owe (and the Debt figure at the
  top of the screen), the payments due, the debt-service scale and the projection with and without loans appear when
  the Loans tab does (Moneylending, an open loan, or your citizens offering to lend). Until then the 20-turn chart
  shows your balance alone. With Economic stages Off everything shows from the start, as before.
- The Loans tab gives one answer to how much you can borrow: the most you can actually take over the term you've
  picked, the same figure the borrow form opens on. When your loan payments are what holds it back, it says a bigger
  loan would push them past half your income.
- The Economics screen's text is larger, in step with the game's own panels, and the screen is only as tall as the
  open tab needs, up to nearly the whole screen, so an early-game tab isn't a tall empty frame.
- Aid is on the Treasury tab until the Trade tab opens, since it needs no stage; then it lives on the Trade tab.
  Civilizations you haven't met are left out there too.
- The citizens' loan offer reads "Your citizens" as its title, and the bond market's and temple treasuries' titles
  start with a capital too.

### Fixed
- Payments under one Gold never reached anyone's treasury, because the game pays grants in whole Gold. That was most
  of the business cycle's effect in a steady economy. Each civilization is now paid in whole Gold and the rest carries
  to its next turn, so a few tenths a turn add up to a Gold every few turns. Reloading in the middle of a turn no
  longer re-sends those payments, and a payment that has landed is never sent twice.
- War Levy's yields: the card had kept its old +30 Gold and -40 Happiness and asked for eight wars at once before it
  paid, so slotting it cost Happiness in every settlement and didn't pay any Gold. It now pays +8 Gold and -4 Happiness
  while you're at war with anyone.
- From the first turn of a new age the mod stopped working until that age's turn count passed the old age's last
  turn. Turns now count on across the ages.
