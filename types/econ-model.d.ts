// Dev-only ambient types for the loan model's plain data (DESIGN 4.1 to 4.6, 4.14, 9). The modules in ui/ name
// these in JSDoc; nothing here is shipped. Cents and parts per million are integers throughout.

export {};

declare global {
  /** A civ by player id, or one of the world accounts (DESIGN 4.14): the bond market, temple treasuries, tax. */
  type Party = number | "bond" | "temple" | "tax" | "progress" | "citizens" | "inflation" | "cycle" | "plan";
  type LoanState = "active" | "default" | "closed" | "repudiated";
  /** `project` and `general` are 1.1's investment records; 1.0 only writes `loan`. */
  type LoanKind = "loan" | "project" | "general";
  /** Who opened the record: a player's borrow or lend request, the guard, or an AI rule. */
  type LoanSource = "borrow" | "lend" | "guard" | "ai-shortfall" | "ai-citizens";
  type RelationLevel = "war" | "unfriendly" | "neutral" | "friendly";
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
  interface RepudiationRow { pid: number; lender: Party; turn: number; cents: number; atWar: boolean }
  interface TurnRow { pid: number; turn: number }
  interface LowIncomeRow { pid: number; turns: number }
  interface TaxRow { pid: number; level: string; changedTurn: number }

  /** One line of the event log; the glue and the screens read `kind` and the fields each kind carries. */
  interface LedgerEvent {
    turn: number;
    kind: string;
    [field: string]: string | number | boolean | null | undefined;
  }

  interface BatchRow { pid: number; snapshot: number; net: number; influence: number; celebration: number }
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
    capHits: TurnRow[];
    lowIncome: LowIncomeRow[];
    taxes: TaxRow[];
    events: LedgerEvent[];
    lastBatch: BatchRecord | null;
    investments: Investment[];
    offers: InvestOffer[];
    nextInvestId: number;
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
  }

  /** What the glue saw between batches that the cycle weighs (DESIGN 4.11): `pid` is the civ that took part. */
  interface CycleInputEvent { kind: "capture" | "raze" | "disaster"; pid: number; populationLost?: boolean;
    foodWarehouse?: boolean }

  interface Relation { a: number; b: number; level: RelationLevel }

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
    systems: boolean;
  }

  /** The engine's negative-balance lines, in cents; null when the GlobalParameters row couldn't be read. */
  interface EngineParams { amenityLineCents?: number | null; disbandLineCents?: number | null }

  interface PlanRequest { kind: string; [field: string]: unknown }

  interface PlanInput {
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
  }

  /** One grantYield call the glue makes; `key` is the transfer it came from. */
  interface Grant { pid: Party; cents: number; key: string }
  interface YieldRow { pid: number; amount: number; reason: string; loanId?: string }
  interface GrievanceRow { from: number; against: Party; amount: number }
  interface RelationshipRow { a: number; b: number; delta: number }
  interface Notice { pid: number; kind: string; [field: string]: unknown }

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
  }

  /** The turn's Gold bookkeeping (DESIGN 4.14), each Map keyed by player id. */
  interface Batch {
    snapshot: Map<number, number>;
    income: Map<number, number>;
    worldIn: Map<number, number>;
    civIn: Map<number, number>;
    out: Map<number, number>;
    committed: Map<number, number>;
    influence: Map<number, number>;
    celebration: Map<number, number>;
  }

  interface Offer { lender: Party; ratePpm: number }

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
    /** A Civic market civ's citizens, with what they'd lend and at what rate (DESIGN 4.17). */
    citizens?: { ratePpm: number; roomCents: number } | null;
  }

  /** What the plan's passes share for one turn (ui/econ-turn.js). */
  interface TurnContext {
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
    /** Each resource's class price (DESIGN 4.9's base_c), for a Planned importer's fixed prices (4.17). */
    basePrices: Record<string, number>;
  }

  interface TradeRow { payer: number; payee: number; owed: number; cents: number; waived: number; paid: number }

  interface Violation { id: string; detail: string }
}
