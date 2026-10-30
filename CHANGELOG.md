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
- The Economics screen (Treasury, Loans and Fiscal tabs) from its own dock button, with a debt pill beside the
  button. Borrow, repay, restructure, repudiate and lend from the Loans tab. Each loan offer shows its payment, the
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
  side that owes more pays, never more than a tenth of its income, and anything over that is waived. Trade buildings at either end move the bill. The Trade tab shows
  each partner's bill, the cap and what a new route would add.
- Tariffs, from Imperialism: Low or High holds back 10 or 25 percent of what you owe the civilizations you import
  from. A High tariff costs 1 relationship with each of them every five turns, and the computer players answer one
  in kind. Set it on the Fiscal tab, once every five turns.
- With Foreign investment on, a civilization that sends Military Aid pays the 2 Gold a turn its target gets (scaled
  by age), so the computer players' own aid moves Gold between them instead of making it.
- Foreign investment and aid from the Trade tab: a development loan puts Gold into the build a city is working on now
  (from Guilds) and is repaid with interest over 25 turns, more on an economic building; general investment (from
  Colonialism) goes into the treasury and its return follows the host's income; aid of either kind asks nothing back.
  Each raises the relationship. Computer players invest in and aid their friends, and offer to invest in you; you
  accept or decline on the Trade tab.
- The Trade, Warehouse and Industry building roles beside Commerce and Banking, read from the game's data with other
  mods applied; the Treasury tab counts them.
- Three setup options for these: Markets and trade bills, Tariffs, and Foreign investment, all on by default.
- The project: the engine-free loan model (loans, credit, lenders and rates, payments and misses, default and
  garnish, repudiation, the auto-loan guard, AI rules, the saved ledger) with its tests, the six 1.0 setup options,
  the 12 text folders, the gates and the release script.

### Changed
- The tax cards add flat amounts in each settlement instead of percentages: Light Taxation -2 Gold and +4 Happiness,
  Heavy Taxation +4 Gold and -2 Happiness, War Levy +8 Gold and -4 Happiness while you're at war. The computer
  players took flat cards in test games where they passed over the percentage ones. The two AI strategies that steer
  them are stronger.
- Loans Off now turns off the loans alone; trade bills and investment keep their own options.
- The auto-loan guard only borrows while your income is at or below 0: with positive income the game wipes a
  negative balance to 0 at the turn roll and charges nothing, so a loan there would be Gold the game gives for free.
