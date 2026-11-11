// Dev-only ambient types for the loan model's plain data (DESIGN 4.1 to 4.6, 4.14, 9). The modules in ui/ name
// these in JSDoc; nothing here is shipped. Cents and parts per million are integers throughout.

export {};

declare global {
  /** A civ by player id, or one of the world accounts (DESIGN 4.14): the bond market, temple treasuries, tax. */
  type Party = number | "bond" | "temple" | "tax" | "progress" | "citizens" | "inflation" | "cycle" | "plan" | "escrow";
  type LoanState = "active" | "default" | "closed" | "repudiated";
  /** `project` and `general` are 1.1's investment records; 1.0 only writes `loan`. */
  type LoanKind = "loan" | "project" | "general";
  /** Who opened the record: a player's borrow or lend request, the guard, or an AI rule. */
  type LoanSource = "borrow" | "lend" | "guard" | "ai-shortfall" | "ai-citizens" | "ai-build" | "refinance" | "crisis"
    | "policy" | "amends";
  type RelationLevel = "war" | "unfriendly" | "neutral" | "friendly" | "unmet";
  type BlockReason = "default" | "repudiation";

  interface Loan {
    id: string;
    kind: LoanKind;
    lender: Party;
    borrower: number;
    principal: number;
    outstanding: number;
    ratePpm: number;
    term: number;
    paid: number;
    missed: number;
    state: LoanState;
    emergency: boolean;
    restructured: boolean;
    opened: number;
    closedTurn: number | null;
    writtenOff: number;
    source: LoanSource;
    /** A Religious lender's loan (DESIGN 4.17): its interest moves with the borrower's income since it opened. */
    partnership?: boolean;
    /** The borrower's income when a partnership opened. */
    baseIncome?: number;
    /** An amends loan (DESIGN 4.5): taken from a lender the borrower repudiated, the repudiation's turn. */
    amends?: number;
  }

  /** A lender refusing a borrower: for the rest of the age, for a number of ages, or until a turn. */
  interface Block {
    lender: Party;
    borrower: number;
    reason: BlockReason;
    agesLeft: number | null;
    untilTurn: number | null;
  }

  interface MissRow { pid: number; turn: number; n: number }
  interface RepudiationRow {
    pid: number; lender: Party; turn: number; cents: number; atWar: boolean;
    /** The lender's whole grudge and the witnesses' named note it booked (DESIGN 4.5), for making amends. */
    grudge?: number; note?: number;
    /** The turn an amends loan to that lender was repaid in full; from then it no longer counts against credit. */
    madeGood?: number | null;
    /** 1 when the row is a bankruptcy (econ-bankruptcy.js): the overdraft written off, booked on the bond market. */
    bankrupt?: number;
  }
  interface TurnRow { pid: number; turn: number }
  interface LowIncomeRow { pid: number; turns: number }
  /** What a civ holds in escrow for its next payments (AI-PLAN 4.2). */
  interface EscrowRow { pid: number; cents: number }
  /** A civ's credit reputation (AI-PLAN 4.4) in hundredths of a point, as of `turn`; it mends toward 100 from there. */
  interface CreditRepRow { pid: number; rep: number; turn: number }
  /** Favors booked on the game's own ledger: `from` did `to` a good turn (a loan repaid in full). */
  interface FavorRow { from: number; to: number; amount: number }
  /** One scaleAiPreference call the glue makes for an AI (AI-PLAN 4.2). */
  interface AiPreferenceRow { pid: number; system: string; item: string; factor: number }
  interface TaxRow { pid: number; level: string; changedTurn: number }

  /** One line of the event log; the glue and the screens read `kind` and the fields each kind carries. */
  interface LedgerEvent {
    turn: number;
    kind: string;
    [field: string]: string | number | boolean | null | undefined;
  }

  /** paid and celebrationPaid are what the game is sent, in whole Gold; the carries go to the next batch. */
  interface BatchRow {
    pid: number; snapshot: number; net: number; influence: number; celebration: number;
    paid?: number; carry?: number; celebrationPaid?: number; celebrationCarry?: number;
    /** What the standing lines moved the treasury by at the roll, counted into `snapshot` (econ-standing.js). */
    engine?: number;
    /** The civ's overdraft this turn (DESIGN 4.18), held at least while it stays below zero. */
    overdraft?: number;
    /** Turns below zero in a row, this one included (DESIGN 4.18). */
    below?: number;
  }
  interface BatchRecord { id: string; turn: number; civs: BatchRow[] }

  /** The saved envelope's body (DESIGN 9). */
  interface Ledger {
    age: string | null;
    nextId: number;
    lastTurn: number | null;
    batchSeq: number;
    loans: Loan[];
    blocks: Block[];
    misses: MissRow[];
    repudiations: RepudiationRow[];
    guardTurns: TurnRow[];
    /** The last turn each AI took a build loan (DESIGN 6). */
    /** Kept for saves written before 2026-10-31; the build loan no longer runs on a timer. */
    buildTurns: TurnRow[];
    capHits: TurnRow[];
    lowIncome: LowIncomeRow[];
    escrow: EscrowRow[];
    /** The last turn each civ's dues passed its funds (AI-PLAN 4.1); distress lasts that turn and the next. */
    distress: TurnRow[];
    creditRep: CreditRepRow[];
    taxes: TaxRow[];
    events: LedgerEvent[];
    lastBatch: BatchRecord | null;
    investments: Investment[];
    offers: InvestOffer[];
    nextInvestId: number;
    /** The crises open per civ (DESIGN 4.11c). */
    crises: CrisisRow[];
    /** The responses standing, with the turn each ends (null: when its crisis ends, plus a few turns). */
    responses: ResponseRow[];
    /** What the responses left; a world legacy has pid null; until null lasts the age. */
    legacies: LegacyRow[];
    /** The turn a response was taken (take:<id>) or a crisis ended (end:<kind>), for once-per and spacing. */
    crisisTurns: CrisisTurnRow[];
    /** The counters the conditions keep: turns of dues over income, of inflation at its cap, routes lately. */
    crisisCounters: CrisisCounterRow[];
    bubble: { since: number, burst: number | null } | null;
    /** The crisis paths (econ-policy.js): running cards, outcomes, drift, the activation counter. */
    policies: any[];
    pathResults: any[];
    affinity: { pid: number, steps: Record<string, number> }[];
    policySeq: number;
    /** Hard times for Partisans: each civ's Austerity strain and the turn its Depression began, as of `turn`. */
    hardTimes?: HardTimesRow[];
    /** Each AI's last six Influence stocks, newest last, for its Influence forecast (hard-times plan v2, Part 2). */
    influenceLog?: InfluenceLogRow[];
  }

  interface HardTimesRow { pid: number; strain: number; depSince: number | null; turn: number }

  interface InfluenceLogRow { pid: number; turn: number; stocks: number[] }

  /** What `__towerEconomics.hardTimes(pid)` returns (hard-times plan v2, Part 1). */
  interface HardTimes { depression: number; depressionTurns: number; austerityStrain: number;
    austerityRunning: boolean; arrearsPoints: number }

  type CrisisKind = "depression" | "credit-panic" | "price-shock" | "debt" | "inflation" | "trade-collapse";
  interface CrisisRow { pid: number; kind: CrisisKind; since: number }
  interface ResponseRow { pid: number; id: string; crisis: CrisisKind; since: number; until: number | null;
    costPct?: number; policy?: string }
  /** `civs` is the tribute legacy's list of the civs that paid, whose bills to the levier count double. */
  interface LegacyRow { pid: number | null; id: string; since: number; until: number | null; nextAge: boolean;
    civs?: number[] }
  interface CrisisTurnRow { pid: number; id: string; turn: number; age?: string }
  interface CrisisCounterRow { pid: number; dues: number; hot: number; routes: number[]; peace?: number }

  /** The crisis rules other steps read through the turn context, so no module has to import econ-crisis.js. */
  interface CrisisHooks {
    terms: (pid: number) => import("../ui/econ-crisis.js").CrisisTerms;
    weights: (events: import("../ui/econ-cycle.js").Weighted[]) => import("../ui/econ-cycle.js").Weighted[];
    adjustPrices: (prices: Record<string, number>) => Record<string, number>;
    holiday: (pid: unknown) => boolean;
  }

  /** The turn a civ reached each stage (DESIGN 4.15); null or missing while it hasn't. */
  interface StageTurns {
    moneylending?: number | null;
    publicDebt?: number | null;
    trade?: number | null;
    guildPatronage?: number | null;
    charteredCompanies?: number | null;
    tariffs?: number | null;
    banking?: number | null;
    capitalism?: number | null;
  }

  type InvestKind = "project" | "general";
  type TariffLevel = "none" | "low" | "high";

  /** A development loan (`project`) or general investment record (DESIGN 4.12), kept beside the loans. */
  interface Investment {
    id: string;
    kind: InvestKind;
    investor: number;
    host: number;
    principal: number;
    /** The return a turn in thousandths of the principal: 50, 60 or 45. */
    mille: number;
    term: number;
    paid: number;
    missed: number;
    state: LoanState;
    opened: number;
    closedTurn: number | null;
    writtenOff: number;
    /** What's still to come at the base return: (term - paid) * the base dividend. */
    outstanding: number;
    /** The city a development loan backs, as the glue's component id key; null for general. */
    cityId: string | null;
    /** The host's income when the investment was made, for general investment's growth. */
    baseIncome: number;
  }

  /** An AI's investment offered to the human, waiting for an answer (DESIGN 5, 6). */
  interface InvestOffer {
    id: string;
    investor: number;
    host: number;
    kind: InvestKind;
    cents: number;
    cityId: string | null;
    turn: number;
  }

  /** One settlement as the glue reads it for 1.1: its current build and its Trade buildings. */
  interface CityRead {
    id: string;
    /** The type at the head of the queue, or null when the queue is empty. */
    build: string | null;
    /** Production still needed to finish the current build. */
    neededProgress: number;
    /** The build is a building with a Commerce, Banking, Trade or Industry role (DESIGN 4.13). */
    roleBuilding?: boolean;
    tradeBuildings?: number;
    /** The game's Gold price for the current build, when it's a building and the read answers. */
    purchaseCents?: number | null;
    /** The settlement's population, for the plan's split (DESIGN 4.17). */
    population?: number;
    /** What a point of the current build costs to buy, in cents (its Gold price over its production cost). */
    pointCents?: number | null;
    /** Percent of a point sent by addProgress that lands in this city (NOTES finding L); 100 until it's read. */
    progressScalePct?: number;
    /** Turns the current build needs on the city's own production (`BuildQueue.currentTurnsLeft`); null unread. */
    turnsLeft?: number | null;
    /** The settlement's plot ("x,y"), its original owner and whether its build is a military unit (crisis paths). */
    loc?: string | null;
    orig?: number | null;
    military?: boolean;
    /** The settlement's net Gold a turn, in cents. */
    goldCents?: number;
    /** The current build's base Gold yield, for the build loan's "pays for itself" test (DESIGN 6). */
    buildGoldYield?: number;
  }

  /** One trade route between two major civs: the importer owns it (the merchant's civ). */
  interface RouteRead {
    importer: number;
    exporter: number;
    resources: string[];
    importerTradeBuildings?: number;
    exporterTradeBuildings?: number;
  }

  /** What the market step reads from GameInfo and the map once a turn (DESIGN 4.9). */
  interface MarketRead {
    resources: { type: string; class: string }[];
    /** Source copies of each resource on land a living major owns, counted at the origin. */
    copies: Record<string, number>;
    /** Resources a unit of this age names as its StrategicResource. */
    strategic: string[];
    /** Industry buildings standing in the world. */
    industry: number;
  }

  interface TariffRow { pid: number; level: TariffLevel; changedTurn: number }

  /** The markets envelope's body (DESIGN 9): prices, their history, tariffs and the income marks AI rules read. */
  interface MarketsState {
    lastTurn: number | null;
    prices: Record<string, number>;
    history: Record<string, number[]>;
    tariffs: TariffRow[];
    incomes: Record<string, number[]>;
    /** The age each AI last gave aid in, by player id. */
    aidAge: Record<string, string>;
    /** The turn each AI last invested or made an offer, by player id (once per 10 turns, DESIGN 6). */
    investTurn: Record<string, number>;
    /** By "<ai>-<other>": the turn the AI's count of turns at peace with a civ behind its tariff started (DESIGN 6). */
    tariffPeace: Record<string, number>;
    /** By "<ai>-<other>": a civ the AI has eased off, with the lowest tariff that civ has held since (DESIGN 6). */
    tariffEased: Record<string, TariffLevel>;
    /** By "<ai>-<host>": the turn the AI last gave that host aid (once per 15 turns, AI-PLAN 4.5). */
    aidTurns: Record<string, number>;
    /** By "<ai>-<host>": the turn the AI last offered the human host an investment (once per 10 turns). */
    offerTurns: Record<string, number>;
    /** Markets tab (Part 6): the target each resource's price moved toward, kept beside `history`. */
    targets: Record<string, number[]>;
    /** Markets tab (Part 6): what the last batch's targets were read from. */
    basis: MarketBasis | null;
    /** Markets tab (Part 6): the turns a cause moved a target, over the history's turns. */
    marks: MarketMark[];
  }
  /** What the last batch's prices were read from (Part 6), so the breakdown multiplies to the target it used. */
  interface MarketBasis {
    turn: number; civs: number; war: boolean; eBp: number; industry: number; smoothingPct: number; pricePct: number;
    copies: Record<string, number>; strategic: string[]; floored: string[];
  }
  /** A turn a cause moved targets: a war begun or ended, copies gained or lost, a cycle phase, Industry buildings. */
  interface MarketMark {
    t: number; k: "war" | "peace" | "gain" | "loss" | "phase" | "industry"; r?: string; d?: number; p?: string;
  }

  /** Build progress the glue lands with `addProgress` on the city's current build (DESIGN 4.12). */
  interface ProgressRow { host: number; cityId: string; amount: number; investmentId: string }

  /** One major civ as the glue reads it for the turn. */
  interface Civ {
    id: number;
    alive: boolean;
    human: boolean;
    balanceCents: number;
    incomeCents: number;
    upkeepCents?: number;
    stages?: StageTurns;
    depthTurns?: number;
    depthFactorPct?: number;
    happinessCents?: number;
    atWar?: boolean;
    cities?: CityRead[];
    /** The native Trade Income the civ's settlements earn a turn (TradeYields), for the Trade tab. */
    tradeIncomeCents?: number;
    /** The government type and ideology type the civ runs, or null before it has one (DESIGN 4.17). */
    government?: string | null;
    ideology?: string | null;
    /** Warehouse buildings, weighted (DESIGN 4.13), for the cut on a negative L (4.11). */
    warehouses?: number;
    /** The legacy cushion from old buildings (DESIGN 4.16), in basis points. */
    cushionBp?: number;
    /** Settlements with a Commerce building, for citizen_cap (DESIGN 4.17). */
    commerceSettlements?: number;
    /** The engine's military strength, or its combat units when that read fails; null when neither answers. */
    strength?: number | null;
    /** The Influence stock (whole Influence, null unread) and net production a turn, for the crisis paths. */
    influence?: number | null;
    production?: number;
    /** How many settlements the civ holds, for the bankruptcy weighing (econ-bankruptcy.js). */
    settlements?: number;
    /** How many units it has that cost upkeep, which the weighing can lose to disbanding. */
    units?: number;
    /** What the standing lines moved the treasury by at the last roll; the glue has added it back to the balance. */
    engineCents?: number;
    /** The local seat only: what its standing lines will move its treasury by at its roll, which comes after the
     * batch (its markers go up a moment into its turn, after its own roll). Its funds leave that out (econ-batch.js). */
    rollPendingCents?: number;
    /** How far below zero its dues can take it this turn, when a rule sets it; unset, the batch uses
     * overdraftLimitCents (DESIGN 4.18). The glue leaves it unset. */
    overdraftCents?: number;
  }

  /** What the glue saw between batches that the cycle weighs (DESIGN 4.11): `pid` is the civ that took part. */
  interface CycleInputEvent { kind: "capture" | "raze" | "disaster"; pid: number; populationLost?: boolean;
    foodWarehouse?: boolean }

  /**
   * One pair of majors as the glue reads it (AI-PLAN 4.5): the level number as a sees b, the routes both ways, an
   * alliance, the distance between capitals, and each side's own agenda rows toward the other (agendaAB is a's).
   */
  interface Relation {
    a: number; b: number; level: RelationLevel;
    levelNum?: number; routes?: number; allied?: boolean; distance?: number | null;
    agendaAB?: number; agendaBA?: number;
  }

  interface PlanOptions {
    loans: boolean;
    guard: boolean;
    ai: boolean;
    rates: string;
    stages: boolean;
    taxFallback: boolean;
    markets: boolean;
    tariffs: boolean;
    investment: boolean;
    inflation: boolean;
    cycle: string;
    /** The Swings option: gentle, volatile or extreme; absent reads volatile. */
    swings?: string;
    systems: boolean;
    /** Crises and responses (DESIGN 4.11c); absent reads off, the glue sends the setup option. */
    crises?: boolean;
  }

  /** What the glue reads from the game's GlobalParameters. */
  interface EngineParams {
    /** GOLD_PURCHASE_MULTIPLIER in cents: the game's Gold price of a point of production (DESIGN 4.17 the plan). */
    goldPerPointCents?: number | null;
    /** The game's Friendly line and the top of Hostile (relationshipBands); absent reads STAKE's numbers. */
    friendlyLevel?: number;
    hostileLevel?: number;
  }

  interface PlanRequest { kind: string; [field: string]: unknown }

  interface PlanInput {
    /** A Treasury-tab projection turn: the standing lines aren't worked out. */
    projection?: boolean;
    /** What each civ's price stack was measured to do to its purchase prices, by pid (econ-standing-read.js). */
    priceFactors?: Record<string, { stack: number, factorPpm: number }>;
    turn: number;
    age: string;
    ledger?: Ledger;
    civs: Civ[];
    relations?: Relation[];
    requests?: PlanRequest[];
    params?: EngineParams;
    options?: Partial<PlanOptions>;
    routes?: RouteRead[];
    market?: MarketRead;
    markets?: MarketsState;
    macro?: import("../ui/econ-macro-state.js").MacroState;
    cycleEvents?: CycleInputEvent[];
    /** The age crisis stage, Game.CrisisManager.getCurrentCrisisStage (P12): -1 before, 0 to 2 running, 3 ended. */
    crisisStage?: number;
  }

  /** One movement of Gold for one loan on one turn; at most one per (loan, turn). */
  interface Transfer {
    loanId: string;
    turn: number;
    from: Party;
    to: Party;
    cents: number;
    reason: string;
    parts: Record<string, number>;
    /** A stable text key naming the line in a ledger, with its arguments (text keys too), e.g. "Arrears: {card}". */
    label?: string;
    labelArgs?: string[];
  }

  /** One grantYield call the glue makes; `key` is the transfer it came from. */
  interface Grant { pid: Party; cents: number; key: string }
  interface YieldRow { pid: number; amount: number; reason: string; loanId?: string }
  interface GrievanceRow { from: number; against: Party; amount: number }
  interface RelationshipRow { a: number; b: number; delta: number }
  interface Notice { pid: number; kind: string; [field: string]: unknown }

  /**
   * A civ below zero at the batch (econ-overdrawn.js, DESIGN 4.18): how far in cents, its overdraft, the full quarters
   * of it used (0 to 4), whether it's past it, and what that costs: Happiness a settlement, a price premium in basis
   * points, units to disband this turn.
   */
  interface OverdrawnRow {
    cents: number; limitCents: number; quarters: number; past: boolean; gloom: number; premiumBp: number;
    disband: number;
    /** Turns below zero in a row, this one included, and the settlements whose buildings are shut down. */
    turns?: number; shut?: number;
  }

  interface PlanOutput {
    ledger: Ledger;
    transfers: Transfer[];
    influence: YieldRow[];
    celebration: YieldRow[];
    grievances: GrievanceRow[];
    relationships: RelationshipRow[];
    events: LedgerEvent[];
    notices: Notice[];
    batch: BatchRecord | null;
    skipped: string | null;
    markets: MarketsState;
    progress: ProgressRow[];
    trade: TradeRow[];
    macro: import("../ui/econ-macro-state.js").MacroState;
    /** The AI preference factors to send this turn, every AI's every turn (AI-PLAN 4.2). */
    aiPreferences: AiPreferenceRow[];
    /** Favors to book on the game's ledger (AI-PLAN 4.4). */
    favors: FavorRow[];
    /** Each AI's stake in each host the turn read, by "ai:host" (AI-PLAN 4.5), for the screens and the lab. */
    stakes: Record<string, number>;
    /** AI wars to declare for the crisis paths' Foreign adventure. */
    wars?: { a: number, b: number }[];
    /** One-shot markers to stand in a civ's capital for the next turn, such as a repudiation's named grievance from
     * every other major (econ-standing.js REPUDIATED). */
    notes?: { pid: number, line: "REPUDIATED" | "REPAID", amount: number }[];
    /** Each civ below zero at the batch, by pid (econ-overdrawn.js, DESIGN 4.18). */
    overdrawn?: Record<string, OverdrawnRow>;
    /** Each civ's standing Gold lines for the next roll (econ-standing.js). */
    standing?: import("../ui/econ-standing.js").StandingRow[];
    /** Each civ's hardship for Partisans, by pid (econ-policy.js hardshipRows). */
    hardship?: Record<string, number>;
    /** Each civ's hard times for Partisans, by pid (econ-policy.js hardTimesRows). */
    hardTimes?: Record<string, HardTimes>;
  }

  /** The turn's Gold bookkeeping (DESIGN 4.14), each Map keyed by player id. */
  interface Batch {
    snapshot: Map<number, number>;
    income: Map<number, number>;
    worldIn: Map<number, number>;
    civIn: Map<number, number>;
    /** Loan principal from a civ lender this turn, which counts in the borrower's funds at once (NOTES 120). */
    principalIn: Map<number, number>;
    out: Map<number, number>;
    committed: Map<number, number>;
    influence: Map<number, number>;
    celebration: Map<number, number>;
    /** How far below zero each civ's obligations can take it this turn (DESIGN 4.18). */
    overdraft: Map<number, number>;
    /** Turns below zero in a row, this one included (econ-overdrawn.js). */
    below?: Map<number, number>;
  }

  interface Offer { lender: Party; ratePpm: number; amends?: boolean }

  /** A civ as a would-be lender sees it: balance net of what it has already committed this turn. */
  interface LenderView { id: number; balanceCents: number; stages?: StageTurns; depthTurns?: number }

  interface OfferQuery {
    ledger: Ledger;
    borrower: number;
    borrowerCiv?: Civ;
    principal?: number;
    term?: number;
    age: string;
    turn: number;
    standing: number;
    rates?: number;
    lenders?: LenderView[];
    relations?: Relation[];
    options?: Partial<PlanOptions>;
    depthFactorPct?: number;
    /** The bond rate's multiplier for this borrower: its system, the cycle spread, inflation (DESIGN 4.17, 4.11, 4.8). */
    bondPct?: number;
    /** A civ lender's rate multiplier for this borrower: the lender's system and the borrower's. */
    civPct?: (lender: number) => number;
    /** During a Panic civ lenders stop offering (DESIGN 4.11). */
    civLendersClosed?: boolean;
    /** A "civ lenders only" system (DESIGN 4.17): no bond market, temple treasuries for emergencies. */
    noBond?: boolean;
    /** Whether the borrower hasn't met a civ, which then makes no offer. */
    unmet?: (lender: number) => boolean;
    /** An AI lender's own refusal by reputation and stake (AI-PLAN 4.5); a human lender never refuses by rule. */
    refuses?: (lender: number) => boolean;
    /** A Civic market civ's citizens, with what they'd lend and at what rate (DESIGN 4.17). */
    citizens?: { ratePpm: number; roomCents: number } | null;
  }

  /** What the plan's passes share for one turn (ui/econ-turn.js). */
  interface TurnContext {
    /** The civs that declared bankruptcy this turn (econ-bankruptcy.js). */
    bankrupt?: Set<number>;
    /** What each civ's price stack was measured to do (PlanInput.priceFactors), by pid. */
    priceFactors?: Record<string, { stack: number, factorPpm: number }>;
    /** The ledger is near its 64 KB envelope: the crisis paths refuse new cards (econ-plan.js). */
    ledgerNearlyFull?: boolean;
    projection?: boolean;
    /** The crisis paths' terms, set by the plan (econ-policy.js policyTerms). */
    policyTerms?: (ctx: TurnContext, pid: number, terms: Record<string, any>) => void;
    turn: number;
    age: string;
    civs: Civ[];
    relations: Relation[];
    requests: PlanRequest[];
    params: EngineParams;
    options: PlanOptions;
    out: PlanOutput;
    ledger: Ledger;
    rates: number;
    capPpm: number;
    civ: Map<number, Civ>;
    batch: Batch;
    routes: RouteRead[];
    markets: MarketsState;
    /** This turn's settlements, netted and capped (DESIGN 4.10), with what each payer actually paid. */
    trade: TradeRow[];
    /** What each importer owes each exporter this turn, before netting. */
    owed: { importer: number; exporter: number; gross: number; owed: number }[];
    macro: import("../ui/econ-macro-state.js").MacroState;
    readings: import("../ui/econ-macro-state.js").MacroReadings;
    /** The pairs that haven't met, as "a:b" with a < b; `relations` holds only the pairs that have. */
    unmet: Set<string>;
    /** Each resource's class price (DESIGN 4.9's base_c), for a Planned importer's fixed prices (4.17). */
    basePrices: Record<string, number>;
    /** The civs whose dues passed their funds this turn, before any refinancing (AI-PLAN 4.1, 4.2). */
    distressed: Set<number>;
    /** Each AI's stake in each host this turn, by "ai:host", read once (AI-PLAN 4.5). */
    stakes: Map<string, number>;
    /** This turn's market read, for the price-shock condition and the price floors (DESIGN 4.11c). */
    market: MarketRead | null;
    /** Each civ's crisis terms this turn, read once (econ-crisis.js crisisTerms). */
    crisisTerms?: Map<number, import("../ui/econ-crisis.js").CrisisTerms>;
    crisis: CrisisHooks | null;
  }

  interface TradeRow { payer: number; payee: number; owed: number; cents: number; waived: number; paid: number }

  interface Violation { id: string; detail: string }
}
