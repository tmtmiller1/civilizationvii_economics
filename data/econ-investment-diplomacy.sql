-- Economics: Military Aid's initiator pays what its target gets (DESIGN 4.12; data/econ-investment-gameeffects.xml),
-- with the Foreign investment setup option on (economics.modinfo, criteria investment-on). Selected through the
-- stage and the modifier, so a game or a mod without Military Aid's completion stage skips the row instead of
-- stopping game creation. A mod that removes or renames the stage turns this off by itself.
INSERT OR IGNORE INTO EnterStageModifiers (StageType, ModifierId)
  SELECT s.StageType, m.ModifierId FROM DiplomaticActionStages s, Modifiers m
  WHERE s.DiplomacyActionType = 'DIPLOMACY_ACTION_MILITARY_AID' AND s.StageType = 'DIPLOMACY_MILITARY_AID_COMPLETE'
    AND m.ModifierId = 'MOD_ECONOMICS_MILAID_INITIATOR_PAYS';
