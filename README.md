# Economics

A Civilization VII mod. In development: version 0.4.0 carries the 1.0 Finance, 1.1 Commerce and 1.2 Macro mechanics,
built and checked offline; none of it has been watched in a game yet
([docs/verification-runs.md](docs/verification-runs.md) lists what's owed). The design is
[docs/DESIGN.md](docs/DESIGN.md).

## What it does

Gold gets a market. You can borrow from other civilizations or from a bond market and pay it back from what the Gold
brings in, lend to a neighbour who's short and collect the interest, and set a tax level as a policy card. A missed
payment costs you; three in a row is default; and you can always repudiate a debt outright, keep the Gold, and pay in
reputation instead. Resources get a world price, and the civilizations you trade with settle the difference in what
you import from each other every turn; you can tariff a partner, or put Gold into a neighbour's build or treasury and
collect a return. Wars, disasters, defaults and trade move the world's economy through booms and slumps, your
government sets how your own economy runs, and the markets and banks of an earlier age fade as newer ones take over.
The computer players borrow, lend, restructure, repudiate, tariff and invest under the same rules, and pick the tax
cards the way they pick any card.

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

## Markets, trade bills and tariffs

Every resource has a world price, set by its class, how many copies the civilizations hold, and whether this age's
units need it (more so in wartime). The Markets tab lists the prices and their last 30 turns. Each pair of
civilizations that trade then settles the difference between what they import from each other: half the price of
each copy, up 10 percent for each Trade building in the exporting city and down 10 percent for each in the importing
one. Only the side that owes more pays, and never more than a tenth of its income; anything over that is waived.

From Imperialism you can set a tariff on the Fiscal tab: Low or High holds back 10 or 25 percent of what you owe the
civilizations you import from. A High tariff costs 1 relationship with each of them every five turns, and a computer
player you tariff High answers in kind two turns later.

## Foreign investment and aid

From the Trade tab you can put Gold into another civilization. A development loan (from Guilds) goes into the build a
city is working on right now, 3 Gold for each point of production, and comes back at 5 percent a turn for 25 turns,
6 percent on an economic building. General investment (from Colonialism) goes into the treasury and its return
follows the host's income. Aid of either kind asks nothing back. Each raises the relationship, in proportion to the
host's income. Computer players invest in and aid their friends, and their offers to you wait on the Trade tab for an
answer. With this option on, a civilization that sends Military Aid pays the 2 Gold a turn its target gets.

## The business cycle

The world has an economic index that starts at 1.00 and drifts back toward it between events. A war declared, a
settlement captured or razed, a disaster, the age's crisis, a default or a repudiated debt pulls it down; peace, new
trade routes and the world's rising income lift it. Your own economy is the world's index plus how the events you took
part in moved you, so the two sides of a war feel it most. Below 0.95 is a slump and below 0.80 a depression; above
1.05 is a boom. A boom pays you a little Gold each turn and makes bond loans cheaper; a slump takes a little and makes
them dearer. Warehouses and old economic buildings soften a slump for you. Once a civilization reaches Banking, a boom
built on too much borrowing can turn into a Panic: for five turns civilizations stop lending to each other and bond
rates jump, and a slump usually follows. The World tab shows the index, your phase, what moved it lately and its last
30 turns, and the turn notification names the causes when your phase changes.

## Inflation

Off by default. When it's on, civilizations with Public debt share the bond market, and the more they owe it beside
the Gold they hold, the more their idle Gold loses value: anything above a reserve of twenty turns of your income
shrinks a little each turn, and bond loans cost more. Spending, paying bond debt down, lending or investing abroad all
help. The Treasury tab shows your reserve and what you'd lose next turn, and the World tab names the cause.

## Economic systems

Your government sets how your economy runs, and in the Modern age your ideology does. Despotism runs a palace economy:
Heavy Taxation and War Levy bring more Gold and your aid buys twice the goodwill, but you borrow only from other
civilizations. A Classical Republic runs a civic market: you can borrow from your own citizens, and the interest you
pay them comes back as celebration. Oligarchy is a merchant oligarchy with cheaper credit and bigger swings; Feudal
Monarchy is manorial, sheltered from the world's swings with taxes paid in kind; Plutocracy is mercantile and earns
more on its exports; Theocracy's usury law turns its loans into partnerships that follow the borrower's income;
Authoritarian governments and Fascism are corporatist, and War Levy pays them in peace too; Democracy is a market
economy with the cheapest bonds; and Communism plans: a fifth of your Gold income goes into your cities' builds each
turn and the world's booms and slumps pass you by. Other governments run a mixed economy. The tax changes show on your
cities' yields under the system's name, and the Fiscal tab names your system and what it changes. A new system blends
in over ten turns.

## Old buildings across the ages

The game lets you build over an earlier age's buildings. Here they fade instead of switching off. A Market keeps its
full weight until you reach the stage that replaces it (Guild patronage for its trade, Public debt for its commerce),
then fades to half, and to a quarter in the age after; a newer building of the same kind in the same city drops it to
its floor at once. What it loses becomes a cushion against slumps, 1 percent a point and 10 percent at most. The
Treasury tab lists each old building with its weight and what moves it.

## Economic stages

Each part opens when a civilization reaches the civic or tech that historically brought it in: loans between
civilizations with Commerce (Moneylending), the bond market and 20- and 30-turn terms with the Economics civic (Public
debt), War Levy with Currency (Coinage), trade bills with Code of Laws (Trade), development loans with Guilds (Guild
patronage), general investment with Colonialism (Chartered companies), tariffs with Imperialism, Panics and a deeper
credit market with Urban Planning (Banking), and wider returns on investment with Capitalism. Until then the Loans
tab greys the part and names what opens it. A later age opens the stages of the ages before it. With the Economic stages
option off, everything is open from the start.

## Setup options

| Option | Default | What it does |
| --- | --- | --- |
| Loans | On | Off turns the loans and the guard off |
| Auto-loan guard | On | Emergency loans before the game's penalties, up to the cap |
| AI borrowing and lending | On | Whether the computer players borrow, lend, restructure and repudiate |
| Rates | Standard | Low (three quarters), Standard, High (a quarter more) on every rate |
| Taxes | On | Adds the three tax cards and their slot |
| Economic stages | On | Parts open with their civic or tech; Off opens everything at the age's start |
| Markets and trade bills | On | World prices and the trade bills between partners |
| Tariffs | On | The tariff setting; needs Markets and trade bills |
| Foreign investment | On | Development loans, general investment and aid |
| Inflation | Off | Bond debt erodes idle Gold above the reserve and raises bond rates |
| Business cycle | Standard | Off, Mild (half), Standard or Strong (half again): how far events move the economy |
| Economic systems | On | Government and ideology set each civilization's economic system; Off runs everyone mixed |

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
