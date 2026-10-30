-- Economics: the tax cards' unlocks on the game's own civics and techs (DESIGN 4.7, 4.15), the tax slot, and the two
-- AI strategy rows that steer the AI's card pass. Runs in each age's database after that age's
-- econ-tax-cards-<age>.xml, with the Taxes setup option on (economics.modinfo, criteria taxes-on-*).
--
-- Every row is selected through its parent table (ProgressionTreeNodes, Traditions, AiListTypes, Strategies), so a
-- node a DLC or an update has renamed, or a card this age doesn't hold, skips the row instead of stopping game
-- creation (the any-DLC rule), and a mod that moves a civic moves the cards with it. Cards go in the game's own
-- policy slots, never a slot of the mod's, and a card never grants a slot (a card that did crashed the AI turn).
--
-- "Root civic" is a node of the age's main civics tree with no prerequisite. Antiquity has one (Chiefdom);
-- Exploration has two (Economics, Piety) and Modern three. Light and Heavy Taxation unlock on every root, so
-- whichever a civ researches first opens them, except Heavy in Antiquity: it waits for the civic after the one that
-- unlocks Priesthood (Code of Laws after Mysticism in 1.5.0), so Priesthood's +2 Gold comes first. The tax slot is granted once, by the first root in cost order and
-- then name order, so a civ never gets two slots from one age.
--
-- War Levy unlocks on the node that unlocks the Coinage anchor, BUILDING_MARKET (Currency, DESIGN 4.15), and on each
-- later age's roots.

-- Light and Heavy Taxation on every root civic of this age's main tree.
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT n.ProgressionTreeNodeType, 'KIND_TRADITION', tr.TraditionType, 1
  FROM ProgressionTreeNodes n
  JOIN ProgressionTrees t ON t.ProgressionTreeType = n.ProgressionTree
  JOIN Traditions tr ON tr.TraditionType IN (
      'TRADITION_ECONOMICS_LIGHT_AQ',
      'TRADITION_ECONOMICS_LIGHT_EX', 'TRADITION_ECONOMICS_HEAVY_EX',
      'TRADITION_ECONOMICS_LIGHT_MO', 'TRADITION_ECONOMICS_HEAVY_MO')
  WHERE t.SystemType = 'SYSTEM_CULTURE'
    AND t.ProgressionTreeType IN ('TREE_CIVICS_AQ_MAIN', 'TREE_CIVICS_EX_MAIN', 'TREE_CIVICS_MO_MAIN')
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);

-- Heavy Taxation in Antiquity: the cheapest civic that needs the node unlocking Priesthood, name order on a tie.
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT n.ProgressionTreeNodeType, 'KIND_TRADITION', tr.TraditionType, 1
  FROM ProgressionTreeNodes n
  JOIN ProgressionTreePrereqs p ON p.Node = n.ProgressionTreeNodeType
  JOIN ProgressionTreeNodeUnlocks u ON u.ProgressionTreeNodeType = p.PrereqNode
    AND u.TargetKind = 'KIND_TRADITION' AND u.TargetType = 'TRADITION_PRIESTHOOD'
  JOIN Traditions tr ON tr.TraditionType = 'TRADITION_ECONOMICS_HEAVY_AQ'
  ORDER BY n.Cost, n.ProgressionTreeNodeType
  LIMIT 1;

-- Without such a civic (Priesthood removed or moved to a last node), Heavy opens on the Antiquity root as before.
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT n.ProgressionTreeNodeType, 'KIND_TRADITION', tr.TraditionType, 1
  FROM ProgressionTreeNodes n
  JOIN ProgressionTrees t ON t.ProgressionTreeType = n.ProgressionTree
  JOIN Traditions tr ON tr.TraditionType = 'TRADITION_ECONOMICS_HEAVY_AQ'
  WHERE t.SystemType = 'SYSTEM_CULTURE' AND t.ProgressionTreeType = 'TREE_CIVICS_AQ_MAIN'
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs)
    AND NOT EXISTS (SELECT 1 FROM ProgressionTreeNodeUnlocks
      WHERE TargetKind = 'KIND_TRADITION' AND TargetType = 'TRADITION_ECONOMICS_HEAVY_AQ');

-- War Levy: Exploration and Modern roots.
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT n.ProgressionTreeNodeType, 'KIND_TRADITION', tr.TraditionType, 1
  FROM ProgressionTreeNodes n
  JOIN ProgressionTrees t ON t.ProgressionTreeType = n.ProgressionTree
  JOIN Traditions tr ON tr.TraditionType IN ('TRADITION_ECONOMICS_WAR_LEVY_EX', 'TRADITION_ECONOMICS_WAR_LEVY_MO')
  WHERE t.SystemType = 'SYSTEM_CULTURE'
    AND t.ProgressionTreeType IN ('TREE_CIVICS_AQ_MAIN', 'TREE_CIVICS_EX_MAIN', 'TREE_CIVICS_MO_MAIN')
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs);

-- War Levy in Antiquity: the node that unlocks the Market (Currency in 1.5.0).
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT u.ProgressionTreeNodeType, 'KIND_TRADITION', tr.TraditionType, 1
  FROM ProgressionTreeNodeUnlocks u
  JOIN Traditions tr ON tr.TraditionType = 'TRADITION_ECONOMICS_WAR_LEVY_AQ'
  WHERE u.TargetKind = 'KIND_CONSTRUCTIBLE' AND u.TargetType = 'BUILDING_MARKET';

-- The tax slot, once, on the first root civic of this age's main tree.
INSERT OR IGNORE INTO ProgressionTreeNodeUnlocks (ProgressionTreeNodeType, TargetKind, TargetType, UnlockDepth)
  SELECT n.ProgressionTreeNodeType, 'KIND_MODIFIER', 'MOD_ECONOMICS_TAX_SLOT', 1
  FROM ProgressionTreeNodes n
  JOIN ProgressionTrees t ON t.ProgressionTreeType = n.ProgressionTree
  WHERE t.SystemType = 'SYSTEM_CULTURE'
    AND t.ProgressionTreeType IN ('TREE_CIVICS_AQ_MAIN', 'TREE_CIVICS_EX_MAIN', 'TREE_CIVICS_MO_MAIN')
    AND n.ProgressionTreeNodeType NOT IN (SELECT Node FROM ProgressionTreePrereqs)
    AND EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'MOD_ECONOMICS_TAX_SLOT')
  ORDER BY n.Cost, n.ProgressionTreeNodeType
  LIMIT 1;

-- The two AI strategies of DESIGN 4.7, in the shape of Emigration's emigration-ai-strategy.sql. Strategy rows are
-- read at game creation, so they only reach new games.
-- "Short of Gold": the game's YieldIncome condition fires when income in StringValue's yield is at or above
-- ThresholdValue, and there is no "below" form, so the strategy carries a condition every civ meets (NumCities at
-- 1) and is disqualified once Gold income reaches 10 (P17 watched the disqualifier switch it off as income rose).
-- "Flush": Gold income at or above 40. Each raises one YieldBias, Gold for the short civ and Happiness for the flush
-- one, so Heavy Taxation looks better to the first and Light Taxation to the second.
INSERT OR IGNORE INTO AiListTypes (ListType) VALUES ('EconomicsShortOfGoldBias');
INSERT OR IGNORE INTO AiListTypes (ListType) VALUES ('EconomicsFlushBias');

INSERT OR IGNORE INTO AiLists (ListType, System)
  SELECT 'EconomicsShortOfGoldBias', 'YieldBiases' FROM AiListTypes WHERE ListType = 'EconomicsShortOfGoldBias';
INSERT OR IGNORE INTO AiLists (ListType, System)
  SELECT 'EconomicsFlushBias', 'YieldBiases' FROM AiListTypes WHERE ListType = 'EconomicsFlushBias';

INSERT OR IGNORE INTO AiFavoredItems (ListType, Item, Favored, Value)
  SELECT 'EconomicsShortOfGoldBias', 'YIELD_GOLD', 1, 300 FROM AiListTypes WHERE ListType = 'EconomicsShortOfGoldBias';
INSERT OR IGNORE INTO AiFavoredItems (ListType, Item, Favored, Value)
  SELECT 'EconomicsFlushBias', 'YIELD_HAPPINESS', 1, 300 FROM AiListTypes WHERE ListType = 'EconomicsFlushBias';

INSERT OR IGNORE INTO Strategies (StrategyType, CityStrategy, MaxNumConditionsNeeded, MinConditionPercentage, MinNumConditionsNeeded)
  VALUES ('STRATEGY_ECONOMICS_SHORT_OF_GOLD', 0, 1, 25, 1);
INSERT OR IGNORE INTO StrategyConditions (ConditionFunction, Exclusive, StrategyType, StringValue, Disqualifier, Forbidden, ThresholdValue)
  SELECT 'NumCities', 0, StrategyType, NULL, 0, 0, 1 FROM Strategies WHERE StrategyType = 'STRATEGY_ECONOMICS_SHORT_OF_GOLD';
INSERT OR IGNORE INTO StrategyConditions (ConditionFunction, Exclusive, StrategyType, StringValue, Disqualifier, Forbidden, ThresholdValue)
  SELECT 'YieldIncome', 0, StrategyType, 'YIELD_GOLD', 1, 0, 10 FROM Strategies WHERE StrategyType = 'STRATEGY_ECONOMICS_SHORT_OF_GOLD';

INSERT OR IGNORE INTO Strategies (StrategyType, CityStrategy, MaxNumConditionsNeeded, MinConditionPercentage, MinNumConditionsNeeded)
  VALUES ('STRATEGY_ECONOMICS_FLUSH', 0, 1, 25, 1);
INSERT OR IGNORE INTO StrategyConditions (ConditionFunction, Exclusive, StrategyType, StringValue, Disqualifier, Forbidden, ThresholdValue)
  SELECT 'YieldIncome', 0, StrategyType, 'YIELD_GOLD', 0, 0, 40 FROM Strategies WHERE StrategyType = 'STRATEGY_ECONOMICS_FLUSH';

INSERT OR IGNORE INTO Strategy_Priorities (ListType, StrategyType)
  SELECT l.ListType, s.StrategyType FROM AiListTypes l, Strategies s
  WHERE l.ListType = 'EconomicsShortOfGoldBias' AND s.StrategyType = 'STRATEGY_ECONOMICS_SHORT_OF_GOLD';
INSERT OR IGNORE INTO Strategy_Priorities (ListType, StrategyType)
  SELECT l.ListType, s.StrategyType FROM AiListTypes l, Strategies s
  WHERE l.ListType = 'EconomicsFlushBias' AND s.StrategyType = 'STRATEGY_ECONOMICS_FLUSH';
