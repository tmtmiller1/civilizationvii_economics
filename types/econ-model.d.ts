// Dev-only ambient types for the loan model's plain data (DESIGN 4.1 to 4.6, 4.14, 9). The modules in ui/ name
// these in JSDoc; nothing here is shipped. Cents and parts per million are integers throughout.

export {};

declare global {
  /** A civ by player id, or one of the world accounts (DESIGN 4.14): the bond market, temple treasuries, tax. */
  type Party = number | "bond" | "temple" | "tax";
  type LoanState = "active" | "default" | "closed" | "repudiated";
  /** `project` and `general` are 1.1's investment records; 1.0 only writes `loan`. */
  type LoanKind = "loan" | "project" | "general";
  /** Who opened the record: a player's borrow or lend request, the guard, or an AI rule. */
  type LoanSource = "borrow" | "lend" | "guard" | "ai-shortfall";
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
  }

  /** The turn a civ reached each stage (DESIGN 4.15); null or missing while it hasn't. */
  interface StageTurns { moneylending?: number | null; publicDebt?: number | null }

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
  }

  interface Relation { a: number; b: number; level: RelationLevel }

  interface PlanOptions {
    loans: boolean;
    guard: boolean;
    ai: boolean;
    rates: string;
    stages: boolean;
    taxFallback: boolean;
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
  }

  interface Violation { id: string; detail: string }
}
