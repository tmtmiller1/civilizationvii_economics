-- Variant C of the Probe Pact (lab only): variant A with RequiresUnlock 1, granted to every major at game start the
-- way leader attributes grant Local Festivals. Variants A and B started with no target and never moved.
-- Lab-only probe: one Modern-age endeavor a major can start on another major. When it runs to the end,
-- a stage modifier grants a favor under a new favor/grievance event type with its own breakdown text.
--
-- Modelled on DIPLOMACY_ACTION_LOCAL_FESTIVALS (base-standard/data/diplomacy-actions.xml + the age-modern
-- cost/response rows), with the start/complete staging of DIPLOMACY_ACTION_GRANT_POLICY_SLOT (an endeavor with
-- NO_YIELD, stage at 0 and a COMPLETE stage at ProgressRequirement = BaseDuration; TRADE_MAP does the same at 15).
--
-- Age gating: the base game gates per-age costs and responses by loading them from the age module
-- (age-modern/data/diplomacy-actions.xml). The mod equivalent is an ActionCriteria with
-- <AgeInUse>AGE_MODERN</AgeInUse> on the UpdateDatabase/UpdateText actions in the .modinfo.
--
-- Availability: RequiresUnlock = 0 (as OPEN_BORDERS / DENOUNCE), so every player has it without a grant.
-- LOCAL_FESTIVALS itself has RequiresUnlock = 1 and is granted by leader attribute nodes through
-- EFFECT_DIPLOMACY_GRANT_DIPLOMATIC_ACTION (attributes-gameeffects.xml); that route isn't needed here.
--
-- Every row that points at another table selects through the parent, so a missing parent skips the row.

-- ---------------------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'DIPLOMACY_ACTION_ECONPROBE_PACT3', Kind FROM Kinds WHERE Kind = 'KIND_DIPLOMACY_ACTION';

INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'DIPLOMACY_ECONPROBE_PACT3_STARTED', Kind FROM Kinds WHERE Kind = 'KIND_DIPLOMACY_ACTION_STAGE';

INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'DIPLOMACY_ECONPROBE_PACT3_COMPLETE', Kind FROM Kinds WHERE Kind = 'KIND_DIPLOMACY_ACTION_STAGE';

-- Favor event types carry their own Kind (FAVOR_FROM_ENDEAVOR etc. are KIND_DIPLOMACY_FAVOR_GRIEVANCE_EVENT).
INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'FAVOR_FROM_ECONPROBE_PACT3', Kind FROM Kinds WHERE Kind = 'KIND_DIPLOMACY_FAVOR_GRIEVANCE_EVENT';

-- XML GameEffects makes a <id>_TYPE ModifierType per modifier; SQL has to add it by hand.
INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'ECONPROBE_PACT3_COMPLETE_FAVOR_TYPE', Kind FROM Kinds WHERE Kind = 'KIND_MODIFIER';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomacyActions (mirrors LOCAL_FESTIVALS except RequiresUnlock and duration)
-- BaseDuration 5 (Local Festivals uses 15) so a lab run reaches the end quickly; keep the COMPLETE stage's
-- ProgressRequirement equal to it.
-- TargetFavors 1000 every 3 turns still adds the stock "From an Endeavor..." line (FAVOR_FROM_ENDEAVOR) while
-- the action runs; set TargetFavors = 0 to leave only the probe's own line in the breakdown.
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomacyActions (
    DiplomacyActionType, Name, Description, BaseTokenCost, BaseDuration, Symmetrical, IsMutualSupport,
    SupportFavors, TargetFavors, TargetFavorsFreq, RequestString, UIIconPath, RequiresUnlock,
    RejectionRefundsInfluence)
SELECT Type, 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_NAME', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_NO_DATA', 1, 5, 1, 1,
    1500, 1000, 3, 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_REQUEST', 'blp:dipaction_festival', 1,
    1
FROM Types WHERE Type = 'DIPLOMACY_ACTION_ECONPROBE_PACT3';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomaticActionValidTokens
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomaticActionValidTokens (DiplomacyActionType, TokenType)
SELECT a.DiplomacyActionType, t.Type
FROM DiplomacyActions a, Types t
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3' AND t.Type = 'DIPLOMACY_TOKEN_GLOBAL';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomaticActionStages: one at the start (no modifier, as GRANT_POLICY_SLOT_STARTED) and one at the end
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomaticActionStages (StageType, DiplomacyActionType, ProgressRequirement)
SELECT t.Type, a.DiplomacyActionType, 0
FROM Types t, DiplomacyActions a
WHERE t.Type = 'DIPLOMACY_ECONPROBE_PACT3_STARTED' AND a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3';

INSERT OR IGNORE INTO DiplomaticActionStages (StageType, DiplomacyActionType, ProgressRequirement)
SELECT t.Type, a.DiplomacyActionType, 5
FROM Types t, DiplomacyActions a
WHERE t.Type = 'DIPLOMACY_ECONPROBE_PACT3_COMPLETE' AND a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomacyFavorsGrievancesEventsData: the named favor line
-- Name = shown to the player who started it; AltName = shown to the other side (LOC_FAVOR_FROM_ENDEAVOR /
-- LOC_FAVOR_FROM_ENDEAVOR_ALT read "you started with them" / "they started with you").
-- Amount left at 0 as FAVOR_FROM_ENDEAVOR does; the modifier below carries the amount.
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomacyFavorsGrievancesEventsData (
    DiplomacyFavorGrievanceEventType, Name, AltName, DiplomacyFavorGrievanceEventGroup)
SELECT t.Type, 'LOC_FAVOR_FROM_ECONPROBE_PACT3', 'LOC_FAVOR_FROM_ECONPROBE_PACT3_ALT', g.Type
FROM Types t, Types g
WHERE t.Type = 'FAVOR_FROM_ECONPROBE_PACT3'
  AND g.Type = 'DIPLOMACY_FAVOR'
  AND EXISTS (SELECT 1 FROM DiplomacyFavorGrievanceEventGroups
              WHERE DiplomacyFavorGrievanceEventGroupType = 'DIPLOMACY_FAVOR');

-- ---------------------------------------------------------------------------------------------------------
-- Completion modifier: EFFECT_DAE_COMPLETE_GRANT_FAVORS_GRIEVANCES (same effect the base game uses for
-- PLAYER_DIPLOMACY_GRIEVANCES_FOR_ACTION_REJECTION and DIPLOMACY_MACHINATIONS_START, with GrievancesAmount +
-- EventType). Binary arg strings for this effect: FavorsAmount, GrievancesAmount, TargetFavorsAmount,
-- TargetGrievancesAmount, EventType ("The event to show in the relationship record").
-- Base game note on DiplomaticActionResponseModifiers: relationship changes apply to both sides, so only
-- FavorsAmount is set here (no TargetFavorsAmount) to avoid doubling.
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
SELECT m.Type, c.Type, e.Type
FROM Types m, Types c, Types e
WHERE m.Type = 'ECONPROBE_PACT3_COMPLETE_FAVOR_TYPE'
  AND c.Type = 'COLLECTION_OWNER'
  AND e.Type = 'EFFECT_DAE_COMPLETE_GRANT_FAVORS_GRIEVANCES';

INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, Permanent)
SELECT 'ECONPROBE_PACT3_COMPLETE_FAVOR', ModifierType, 1
FROM DynamicModifiers WHERE ModifierType = 'ECONPROBE_PACT3_COMPLETE_FAVOR_TYPE';

INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT ModifierId, 'FavorsAmount', '20'
FROM Modifiers WHERE ModifierId = 'ECONPROBE_PACT3_COMPLETE_FAVOR';

INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT m.ModifierId, 'EventType', e.DiplomacyFavorGrievanceEventType
FROM Modifiers m, DiplomacyFavorsGrievancesEventsData e
WHERE m.ModifierId = 'ECONPROBE_PACT3_COMPLETE_FAVOR'
  AND e.DiplomacyFavorGrievanceEventType = 'FAVOR_FROM_ECONPROBE_PACT3';

-- Name string, as PLAYER_DIPLOMACY_LOCAL_FESTIVALS_COMPLETE carries one.
INSERT OR IGNORE INTO ModifierStrings (ModifierId, Context, Text)
SELECT ModifierId, 'Name', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_NAME'
FROM Modifiers WHERE ModifierId = 'ECONPROBE_PACT3_COMPLETE_FAVOR';

INSERT OR IGNORE INTO EnterStageModifiers (StageType, ModifierId)
SELECT s.StageType, m.ModifierId
FROM DiplomaticActionStages s, Modifiers m
WHERE s.StageType = 'DIPLOMACY_ECONPROBE_PACT3_COMPLETE' AND m.ModifierId = 'ECONPROBE_PACT3_COMPLETE_FAVOR';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomaticProjects_UI_Data (mirrors LOCAL_FESTIVALS; NO_YIELD as GRANT_POLICY_SLOT / TRADE_MAP)
-- PlayerOperationType is what the UI passes to Game.PlayerOperations.sendRequest as projectData.operationType.
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomaticProjects_UI_Data (
    DiplomacyActionType, DiplomacyActionGroup, PlayerOperationType, Target1Type, Target2Type,
    MaxNumEnvoys, MinNumVirtEnvoys, MaxNumVirtEnvoys, MaxNumSupportEnvoys, MaxNumOpposeEnvoys,
    Description, ActiveDescription)
SELECT a.DiplomacyActionType, g.DiplomacyActionGroupType, 'COOPERATIVE_YIELDS_DIPLOMATIC_ACTION',
    'DIPLOMACY_TARGET_PLAYER', 'DIPLOMACY_TARGET_NONE',
    1, 1, 2, 0, 0,
    'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_INITIAL', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_ACTIVE'
FROM DiplomacyActions a, DiplomacyActionGroups g
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3'
  AND g.DiplomacyActionGroupType = 'DIPLOMACY_ACTION_GROUP_ENDEAVOR'
  AND EXISTS (SELECT 1 FROM Types WHERE Type = 'DIPLOMACY_ACTION_GROUP_SUBTYPE_NORMAL');

-- ---------------------------------------------------------------------------------------------------------
-- DiplomacyBonusEnvoyData (all zero, as every base endeavor)
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomacyBonusEnvoyData (DiplomacyActionType)
SELECT DiplomacyActionType FROM DiplomacyActions WHERE DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomaticActionInfluenceCosts (Modern values of LOCAL_FESTIVALS; Hostile / NoRelationship stay -1 = can't)
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomaticActionInfluenceCosts (
    DiplomacyActionType, InfCostUnfriendly, InfCostNeutral, InfCostFriendly, InfCostHelpful)
SELECT Type, 195, 180, 165, 150
FROM Types WHERE Type = 'DIPLOMACY_ACTION_ECONPROBE_PACT3'
  AND EXISTS (SELECT 1 FROM DiplomacyActions WHERE DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3');

-- ---------------------------------------------------------------------------------------------------------
-- DiplomaticActionResponses (Modern values of LOCAL_FESTIVALS: Support 180, Accept 0, Reject 60)
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomaticActionResponses (DiplomacyActionType, DiplomaticResponseType, InfCost, Name, Description)
SELECT a.DiplomacyActionType, r.Type, 180, 'LOC_DIPLOMACY_RESPONSE_SUPPORT', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_SUPPORT'
FROM DiplomacyActions a, Types r
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3' AND r.Type = 'DIPLOMACY_RESPONSE_SUPPORT';

INSERT OR IGNORE INTO DiplomaticActionResponses (DiplomacyActionType, DiplomaticResponseType, InfCost, Name, Description)
SELECT a.DiplomacyActionType, r.Type, 0, 'LOC_DIPLOMACY_RESPONSE_ACCEPT', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_ACCEPT'
FROM DiplomacyActions a, Types r
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3' AND r.Type = 'DIPLOMACY_RESPONSE_ACCEPT';

INSERT OR IGNORE INTO DiplomaticActionResponses (DiplomacyActionType, DiplomaticResponseType, InfCost, Name, Description)
SELECT a.DiplomacyActionType, r.Type, 60, 'LOC_DIPLOMACY_RESPONSE_REJECT', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT3_REJECT'
FROM DiplomacyActions a, Types r
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3' AND r.Type = 'DIPLOMACY_RESPONSE_REJECT';

-- ---------------------------------------------------------------------------------------------------------
-- DiplomaticActionResponseModifiers (reject: block endeavors 10 turns both sides + the stock rejection
-- grievance on the initiator, as every base endeavor)
-- ---------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO DiplomaticActionResponseModifiers (
    DiplomacyActionType, DiplomaticResponseType, ModifierId, ModifierType, ModifierTarget)
SELECT a.DiplomacyActionType, r.Type, m.ModifierId, 'DIPLOMACY_MODIFIER_TYPE_ACTION', 'DIPLOMACY_MODIFIER_TARGET_BOTH'
FROM DiplomacyActions a, Types r, Modifiers m
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3'
  AND r.Type = 'DIPLOMACY_RESPONSE_REJECT'
  AND m.ModifierId = 'PLAYER_DIPLOMACY_BLOCK_ENDEAVORS_10';

INSERT OR IGNORE INTO DiplomaticActionResponseModifiers (
    DiplomacyActionType, DiplomaticResponseType, ModifierId, ModifierType, ModifierTarget)
SELECT a.DiplomacyActionType, r.Type, m.ModifierId, 'DIPLOMACY_MODIFIER_TYPE_ACTION', 'DIPLOMACY_MODIFIER_TARGET_INITIAL'
FROM DiplomacyActions a, Types r, Modifiers m
WHERE a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3'
  AND r.Type = 'DIPLOMACY_RESPONSE_REJECT'
  AND m.ModifierId = 'PLAYER_DIPLOMACY_GRIEVANCES_FOR_ACTION_REJECTION';
INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'ECONPROBE_PACT3_GRANT_TYPE', Kind FROM Kinds WHERE Kind = 'KIND_MODIFIER';
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
SELECT m.Type, c.Type, e.Type FROM Types m, Types c, Types e
WHERE m.Type = 'ECONPROBE_PACT3_GRANT_TYPE' AND c.Type = 'COLLECTION_MAJOR_PLAYERS' AND e.Type = 'EFFECT_DIPLOMACY_GRANT_DIPLOMATIC_ACTION';
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
SELECT 'ECONPROBE_REQ_GAME_STARTED', Type FROM Types WHERE Type = 'REQUIREMENT_GAME_IS_STARTED';
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType)
SELECT 'ECONPROBE_REQS_GAME_STARTED', 'REQUIREMENTSET_TEST_ALL' WHERE EXISTS (SELECT 1 FROM Requirements WHERE RequirementId = 'ECONPROBE_REQ_GAME_STARTED');
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
SELECT 'ECONPROBE_REQS_GAME_STARTED', RequirementId FROM Requirements WHERE RequirementId = 'ECONPROBE_REQ_GAME_STARTED';
INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, OwnerRequirementSetId)
SELECT 'ECONPROBE_PACT3_GRANT', ModifierType, (SELECT RequirementSetId FROM RequirementSets WHERE RequirementSetId = 'ECONPROBE_REQS_GAME_STARTED')
FROM DynamicModifiers WHERE ModifierType = 'ECONPROBE_PACT3_GRANT_TYPE';
INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT m.ModifierId, 'ActionType', a.DiplomacyActionType FROM Modifiers m, DiplomacyActions a
WHERE m.ModifierId = 'ECONPROBE_PACT3_GRANT' AND a.DiplomacyActionType = 'DIPLOMACY_ACTION_ECONPROBE_PACT3';
INSERT OR IGNORE INTO GameModifiers (ModifierId) SELECT ModifierId FROM Modifiers WHERE ModifierId = 'ECONPROBE_PACT3_GRANT';
