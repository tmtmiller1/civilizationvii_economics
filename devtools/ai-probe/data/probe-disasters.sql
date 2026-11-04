-- econ-probe-12-run-disasters.sql (Economics probe 1.2, P11 and DESIGN 4.11): floods and eruptions 300 times an age
-- at every disaster intensity (base 0.5 to 4), the frequency the Dams probes used to get 12 floods in 17 turns
-- (engine-closed.md, 2026-09-28). Damage stays as the game has it, so any population a city loses is the game's own.
--
-- 1.5.0's RandomEventDamages only has CONSTRUCTIBLE_DAMAGED and UNIT_DAMAGED rows, so the data doesn't predict
-- population loss; the probe reads each hit settlement's population before the event, on it, 3 s later and next turn.
--
-- The events are picked by class from RandomEvents, the table that carries it, so a mod's added flood or eruption
-- comes along and a removed one is skipped. An UPDATE that matches nothing is harmless.
UPDATE RandomEventFrequencies SET OccurrencesPerAge = 300
  WHERE RandomEventType IN (
    SELECT RandomEventType FROM RandomEvents WHERE EventClass IN ('CLASS_FLOOD', 'CLASS_VOLCANO'));
