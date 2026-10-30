# Economics

A Civilization VII mod. In development: version 0.2.0 carries the 1.0 Finance mechanics, built and checked offline;
none of it has been watched in a game yet ([docs/verification-runs.md](docs/verification-runs.md) lists what's owed).
The design is [docs/DESIGN.md](docs/DESIGN.md).

## What it does

Gold gets a market. You can borrow from other civilizations or from a bond market and pay it back from what the Gold
brings in, lend to a neighbour who's short and collect the interest, and set a tax level as a policy card. A missed
payment costs you; three in a row is default; and you can always repudiate a debt outright, keep the Gold, and pay in
reputation instead. The computer players borrow, lend, restructure and repudiate under the same rules, and pick the
tax cards the way they pick any card.

## Loans

Open the Economics screen from its dock button. The Loans tab shows what each lender offers you today: the rate per
turn, the payment it would take and the interest over the term. Pick a principal and a term of 10, 20 or 30 turns and
the Gold lands at the start of your next turn. Each turn after that the payment goes out by itself, interest plus a
slice of the principal.

Your credit limit is set by your income (twelve turns of it, more with Commerce and Banking buildings), and the
payments on all your loans together can't pass 35 percent of your income, so you can't borrow your way into a hole on
paper headroom. If a payment comes due and the Gold isn't there, it's missed: the interest joins the debt, the rate
rises a step, you lose 5 Influence, and your standing with every lender slips for 20 turns. Pay once and the count
resets; miss three in a row and the loan is in default: the lender takes what it can from you each turn and won't
lend again this age.

An overdue loan can be restructured once: what's left spreads over ten new turns at the rate it has. Repudiation is
the other way out: you keep the Gold and stop paying, that lender closes to you for this age and the next, the civ you
stiffed books a grudge against you in the game's own grievances, every civilization you've met thinks a little less
of you, and credit is dearer and scarcer for 40 turns. The screen shows all of that before you confirm.

You can lend too. Pick a computer player that's short of Gold, your rate and term; it accepts if the rate is within a
fifth of what the bond market would charge it, its income is positive and the payments fit its limits. If it defaults
or repudiates, the loss is yours, so the form shows how close it is to doing that.

## The auto-loan guard

On by default. When your balance would go below 0 while your income is at or below 0, which is when the game starts
disbanding units, the guard takes an emergency loan for the shortfall plus one turn of upkeep and tells you. Before
Moneylending it borrows from temple treasuries, later from the cheapest civilization or the bond market. It stops at
a cap of ten turns of your income and says so once; past that the game's own penalties apply. A dip while your income
is positive costs nothing in the base game, so the guard leaves it alone. You can switch it off and on from the Loans
tab.

## Taxes

Three policy cards, one of each per age: Light Taxation (-2 Gold, +4 Happiness in each settlement), Heavy Taxation
(+4 Gold, -2 Happiness) and War Levy (+8 Gold, -4 Happiness, only while you're at war). The first
civic of each age unlocks Light and Heavy and grants one extra policy slot so a tax card doesn't push out a card you
already hold; War Levy comes with Currency in Antiquity and with the first civic later. They show in the policy menu
like any card, and the Fiscal tab slots or clears one for you. Under each card it shows how much your Gold and
Happiness a turn would change and when your next celebration would come; a card you haven't unlocked yet names the
civic or tech that opens it.

## Economic stages

Each part opens when a civilization reaches the civic or tech that historically brought it in: loans between
civilizations with Commerce (Moneylending), the bond market and 20- and 30-turn terms with the Economics civic (Public
debt), War Levy with Currency (Coinage). Until then the Loans tab greys the part and names what opens it. A later age
opens the stages of the ages before it. With the Economic stages option off, everything is open from the start.

## Setup options

| Option | Default | What it does |
| --- | --- | --- |
| Loans | On | Off turns the whole loan system off; the screen shows balances only |
| Auto-loan guard | On | Emergency loans before the game's penalties, up to the cap |
| AI borrowing and lending | On | Whether the computer players borrow, lend, restructure and repudiate |
| Rates | Standard | Low (three quarters), Standard, High (a quarter more) on every rate |
| Taxes | On | Adds the three tax cards and their slot |
| Economic stages | On | Parts open with their civic or tech; Off opens everything at the age's start |

## Compatibility

Single-player. In a hotseat or network game the mod says once in the log that it's off and does nothing. Building
roles, stages and the cards are read from the game's compiled data with every mod applied, so a mod that changes a
building's tags or moves a civic is followed. [docs/compatibility.md](docs/compatibility.md) has the details.

## Installing

Copy the `economics` folder into your `Mods` folder (on macOS,
`~/Library/Application Support/Civilization VII/Mods/`), start the game once so it registers, and enable it under
Additional Content. The setup options appear under Game Options when you create a game.

## Credits

## License

Tower Mod License 1.0, in [LICENSE](LICENSE). You're welcome to play it and read it; reuploading it, reusing the code
elsewhere and using it for AI training need my written permission. `ui/settings-keeper.js` is MIT.
