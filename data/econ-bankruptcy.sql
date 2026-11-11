-- DESIGN 4.18: Economics disbands units of a civ below zero itself (one a turn, the highest upkeep first, until it's
-- back above zero), so the game's own disbanding and Happiness lines move out of reach. Lab W11 (2026-11-10): at
-- -1000 the game disbanded no unit. An UPDATE on a row another mod changed or removed is harmless.
UPDATE GlobalParameters SET Value = '-1000000' WHERE Name IN ('GOLD_NEGATIVE_BALANCE_DISBAND_UNIT_LINE',
  'GOLD_NEGATIVE_BALANCE_AMENITY_LOSS_LINE', 'GOLD_NEGATIVE_BALANCE_SUBSEQUENT_DISBAND_UNIT',
  'GOLD_NEGATIVE_BALANCE_SUBSEQUENT_AMENITY_LOSS');
