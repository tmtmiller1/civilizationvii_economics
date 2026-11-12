# Changelog

All notable changes to the Economics mod for Civilization VII. The format follows
[Keep a Changelog](https://keepachangelog.com/) and Semantic Versioning. The Steam Workshop change note for each
release is generated from the matching section below by `scripts/steam-changelog.mjs`.

## [1.0.0] - Unreleased

The first release. Economics gives Gold an economy, and the computer players use it too.

### Loans and debt
- Borrow from other civilizations or the bond market over 10, 20 or 30 turns, at 1.5 percent a turn in Antiquity, 1
  in Exploration and 0.75 in Modern. Your payments can take up to half your income.
- Miss three payments in a row and a loan is in default. An overdue loan can be restructured once.
- Repudiate a loan to keep the Gold; every civilization holds it against you and credit costs more for 40 turns. Ten
  turns later you can make amends.
- Lend to a computer player that's short. If it defaults, the loss is yours.
- A Classical Republic can borrow from its own citizens, and the interest comes back as celebration.
- The auto-loan guard takes an emergency loan when your treasury would go below zero while your income is zero or less.

### Below zero and bankruptcy
- When your Gold runs out, payments come from an overdraft of 100 Gold or 10 turns of income, whichever is more.
- Its interest is capped at half your income, so while you're earning Gold you pay it down.
- Below zero, settlements lose Happiness, purchases cost more and your credit rating drops each turn.
- After two turns of warning your costliest unit is disbanded, and from the eighth turn a settlement's buildings shut.
- Bankruptcy, from the Treasury tab, puts your treasury back to 0 and repudiates every loan, once every 30 turns.

### Taxes
- Light Taxation, Heavy Taxation and War Levy are policy cards in each age, with an extra slot to hold them.
- Light Taxation: -1 Gold and +6 Happiness a settlement in Antiquity, +4 in Exploration, +3 in Modern.
- Heavy Taxation: +4 Gold and -2 Happiness a settlement.
- War Levy: +2 Gold and -1 Happiness in peace, +8 Gold and -4 Happiness at war.

### Markets and trade
- Each resource has a world price from its class, how many copies exist and who needs it.
- Trade partners settle the difference in what they import from each other, capped at a tenth of income.
- Tariffs from Imperialism hold back 10 or 25 percent of what you owe, at a relationship cost.
- Loan payments, trade bills and the business cycle show as named lines in your capital's Gold per turn.

### Investment and aid
- A development loan funds a city's build and is repaid over 25 turns; general investment follows the host's income.
- Aid is a gift that raises the relationship, up to 20 from one gift.

### The world's economy
- Wars, disasters and defaults pull the world into slumps; peace and growing income lift it into booms.
- Economic swings sets how far: on Volatile, the default, a depression can take a third to half of your income.
- From Banking, a boom built on too much borrowing can turn into a Panic.
- A crisis opens shared responses and answers only some governments can take, such as a Democracy's New Deal.
- Inflation, off by default, raises the prices of civilizations deep in bond debt.
- With Partisans, hard times add to the risk of a rising.

### Economic systems
- Your government sets your economic system, from a palace economy to a planned one.
- Each system changes rates, credit, trade bills, investment and how hard booms and slumps swing you.
- Old buildings fade across the ages, and what they lose cushions a slump.
- Each civilization leans toward a government that suits it, so the computer players spread across the systems.

### The computer players
- They borrow, lend, repay, restructure, repudiate, invest, aid, set tariffs and take crisis responses.
- They pay the same overdraft, prices and penalties you do.

### The Economics screen
- Opens from its dock button. Tabs appear as you reach the civics and techs that bring them in.
- A strip shows your treasury, income, debt and phase, with a dial for the cycle and charts for prices.
- Each action shows your treasury and payments before and after, and a button you can't use says why.
- One notification a turn sums up what Economics changed.

### Options
- A setup option for each part, and a Spoil Guard under Options, Mods, Economics that hides unmet civilizations.

### Limits
- Single-player only; in hotseat and network games it switches itself off.
- A save made with the mod needs it to load.
