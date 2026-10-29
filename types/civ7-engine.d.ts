// Dev-only ambient typings for the Civilization VII UI runtime globals the mod calls. There is no official .d.ts;
// these are written from the Tower mods' own call sites and grow with the glue (prompt 4). Opaque engine returns are
// `any` on purpose: the engine boundary is untyped, and the mod's own data shapes are typed in types/econ-model.d.ts.
// Not shipped.

export {};

declare global {
  type EngineHandle = any;

  /** A table of the game database as the UI sees it: iterable rows plus lookup by type name, index or hash. */
  interface GameInfoTable<Row> extends Iterable<Row> {
    lookup(key: string | number): Row | null | undefined;
    find(predicate: (row: Row) => boolean): Row | undefined;
    filter(predicate: (row: Row) => boolean): Row[];
    forEach(callback: (row: Row) => void): void;
    [key: string]: any;
  }

  const GameInfo: {
    GlobalParameters: GameInfoTable<{ Name: string; Value: string }>;
    Constructibles: GameInfoTable<{ ConstructibleType: string; Age?: string; [key: string]: any }>;
    TypeTags: GameInfoTable<{ Type: string; Tag: string }>;
    ProgressionTreeNodeUnlocks: GameInfoTable<{ ProgressionTreeNodeType: string; TargetType: string;
      [key: string]: any }>;
    Traditions: GameInfoTable<{ TraditionType: string; [key: string]: any }>;
    Ages: GameInfoTable<{ AgeType: string; ChronologyIndex: number; [key: string]: any }>;
    Constructible_YieldChanges: GameInfoTable<{ ConstructibleType: string; YieldType: string; YieldChange: number }>;
    Constructible_Advisories: GameInfoTable<{ ConstructibleType: string; AdvisoryClassType: string }>;
    [key: string]: any;
  };

  const Players: {
    get(id: number): EngineHandle;
    getAlive(): EngineHandle[];
    getAliveMajors(): EngineHandle[];
    isAlive(id: number): boolean;
    [key: string]: any;
  };

  const Game: {
    turn: number;
    age: number;
    Diplomacy: EngineHandle;
    Notifications: EngineHandle;
    [key: string]: any;
  };

  const GameContext: {
    localPlayerID: number;
    localObserverID: number;
    [key: string]: any;
  };

  const Configuration: {
    getGame(): { isAnyMultiplayer: boolean; getValue(key: string): unknown; [key: string]: any };
    editGame(): { setValue(key: string, value: unknown): void; [key: string]: any } | null;
    [key: string]: any;
  };

  const Database: {
    makeHash(value: string): number;
    [key: string]: any;
  };

  const Locale: {
    compose(key: string, ...args: unknown[]): string;
    [key: string]: any;
  };

  const Network: {
    saveGame(options: object): boolean;
    [key: string]: any;
  };

  const engine: {
    on(event: string, handler: (...args: any[]) => void, context?: unknown): void;
    off(event: string, handler: (...args: any[]) => void, context?: unknown): void;
    call(name: string, ...args: unknown[]): unknown;
    whenReady: Promise<void>;
    [key: string]: any;
  };

  const Controls: {
    define(name: string, definition: object): void;
    decorate(name: string, factory: (component: any) => object): void;
    [key: string]: any;
  };

  const ContextManager: EngineHandle;
  const UI: EngineHandle;
  const YieldTypes: { YIELD_GOLD: number; YIELD_DIPLOMACY: number; YIELD_HAPPINESS: number; [key: string]: any };
  const DiplomacyPlayerRelationships: { [key: string]: any };
  const ProgressionTreeNodeState: { [key: string]: any };
  /** Unit instances by id (`player.Units.getUnitIds()` gives the ids). */
  const Units: { get(id: unknown): EngineHandle; [key: string]: any };
  /** Constructible instances by component id (`city.Constructibles.getIds()` gives the ids). */
  const Constructibles: { getByComponentID(id: unknown): EngineHandle; [key: string]: any };
  /** Player operations the local player can send (`Game.PlayerOperations.sendRequest`). */
  const PlayerOperationTypes: { CHANGE_TRADITION: number; [key: string]: any };
  const PlayerOperationParameters: { Activate: number; Deactivate: number; [key: string]: any };
  const CultureSlotTypes: { POLICY_CULTURE_SLOT: number; [key: string]: any };
}
