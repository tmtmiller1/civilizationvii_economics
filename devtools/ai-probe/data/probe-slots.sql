-- Slot probe (2026-11-04, the owner's go): can a standing Gold line ride a script-placed City Center marker without
-- costing the city anything? Every marker is free, Population 0, ExistingDistrictOnly, City Center only, tagged
-- IGNORE_DISTRICT_PLACEMENT_CAP (the walls' tag), CanBeHidden, and owned by a trait no civ has, as M1's were.
--   L1..L6   a ladder, -1 -2 -4 -8 -16 -32 Gold on the building itself (Constructible_YieldChanges): do six land in one
--            centre, does any push a building or a population point out, and how much does each charge after the
--            city's multipliers?
--   PGOLD    no yield of its own; switches a player-wide -10 Gold (EFFECT_PLAYER_ADJUST_YIELD, COLLECTION_ALL_PLAYERS,
--            REQUIREMENT_PLAYER_HAS_CONSTRUCTIBLE): is a player line scaled, and does the AI's income read see it?
--   CGOLD    no yield of its own; switches a city -10 Gold (EFFECT_CITY_ADJUST_YIELD, REQUIREMENT_CITY_HAS_BUILDING).
-- Sentinel: +1 Culture in every city whose buildings are all from this age (REQUIREMENT_CITY_HAS_ONLY_BUILDINGS_FROM_
-- THIS_AGE, a narrative gate), so the line shows whether a marker with no age breaks the game's own building counts.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('TRAIT_ECONPROBE_NONE', 'KIND_TRAIT');
INSERT OR IGNORE INTO Traits (TraitType, InternalOnly) SELECT 'TRAIT_ECONPROBE_NONE', 1
WHERE EXISTS (SELECT 1 FROM Types WHERE Type = 'TRAIT_ECONPROBE_NONE');
CREATE TEMP TABLE econprobe_s (B TEXT);
INSERT INTO econprobe_s VALUES ('BUILDING_ECONPROBE_L1'), ('BUILDING_ECONPROBE_L2'), ('BUILDING_ECONPROBE_L3'),
  ('BUILDING_ECONPROBE_L4'), ('BUILDING_ECONPROBE_L5'), ('BUILDING_ECONPROBE_L6'), ('BUILDING_ECONPROBE_PGOLD'),
  ('BUILDING_ECONPROBE_CGOLD');
INSERT OR IGNORE INTO Types (Type, Kind) SELECT B, 'KIND_CONSTRUCTIBLE' FROM econprobe_s;
INSERT OR IGNORE INTO Constructibles (ConstructibleType, Name, Description, Tooltip, ConstructibleClass, Cost,
  Population, ExistingDistrictOnly, CanBeHidden)
SELECT B, 'LOC_' || B || '_NAME', 'LOC_' || B || '_NAME', 'LOC_' || B || '_NAME', 'BUILDING', 1, 0, 1, 1
FROM econprobe_s;
INSERT OR IGNORE INTO Buildings (ConstructibleType, Movable, Purchasable, Town, TraitType)
SELECT B, 0, 0, 1, 'TRAIT_ECONPROBE_NONE' FROM econprobe_s WHERE B IN (SELECT ConstructibleType FROM Constructibles);
INSERT OR IGNORE INTO TypeTags (Type, Tag) SELECT B, 'IGNORE_DISTRICT_PLACEMENT_CAP' FROM econprobe_s
WHERE B IN (SELECT Type FROM Types);
INSERT OR IGNORE INTO Tags (Tag, Category) VALUES ('TOWER_MARKER', 'CONSTRUCTIBLE_TAG');
INSERT OR IGNORE INTO TypeTags (Type, Tag) SELECT B, 'TOWER_MARKER' FROM econprobe_s WHERE B IN (SELECT Type FROM Types);
INSERT OR IGNORE INTO Constructible_ValidDistricts (ConstructibleType, DistrictType)
SELECT B, 'DISTRICT_CITY_CENTER' FROM econprobe_s
WHERE EXISTS (SELECT 1 FROM Districts WHERE DistrictType = 'DISTRICT_CITY_CENTER');
DROP TABLE econprobe_s;
INSERT OR IGNORE INTO Constructible_YieldChanges (ConstructibleType, YieldType, YieldChange) VALUES
  ('BUILDING_ECONPROBE_L1', 'YIELD_GOLD', -1), ('BUILDING_ECONPROBE_L2', 'YIELD_GOLD', -2),
  ('BUILDING_ECONPROBE_L3', 'YIELD_GOLD', -4), ('BUILDING_ECONPROBE_L4', 'YIELD_GOLD', -8),
  ('BUILDING_ECONPROBE_L5', 'YIELD_GOLD', -16), ('BUILDING_ECONPROBE_L6', 'YIELD_GOLD', -32);

-- PGOLD: a player-wide -10 Gold while the player holds the marker anywhere.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('ECONPROBE_PGOLD_TYPE', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
SELECT 'ECONPROBE_PGOLD_TYPE', 'COLLECTION_ALL_PLAYERS', 'EFFECT_PLAYER_ADJUST_YIELD'
WHERE EXISTS (SELECT 1 FROM GameEffects WHERE Type = 'EFFECT_PLAYER_ADJUST_YIELD');
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
VALUES ('ECONPROBE_REQ_HAS_PGOLD', 'REQUIREMENT_PLAYER_HAS_CONSTRUCTIBLE');
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
VALUES ('ECONPROBE_REQ_HAS_PGOLD', 'ConstructibleType', 'BUILDING_ECONPROBE_PGOLD');
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType)
VALUES ('ECONPROBE_REQS_HAS_PGOLD', 'REQUIREMENTSET_TEST_ALL');
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
VALUES ('ECONPROBE_REQS_HAS_PGOLD', 'ECONPROBE_REQ_HAS_PGOLD');
INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
SELECT 'ECONPROBE_PGOLD', 'ECONPROBE_PGOLD_TYPE', 'ECONPROBE_REQS_HAS_PGOLD'
WHERE EXISTS (SELECT 1 FROM DynamicModifiers WHERE ModifierType = 'ECONPROBE_PGOLD_TYPE');
INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT 'ECONPROBE_PGOLD', N, V FROM (SELECT 'YieldType' N, 'YIELD_GOLD' V UNION ALL SELECT 'Amount', '-10'
  UNION ALL SELECT 'Tooltip', 'LOC_ECONPROBE_PGOLD_TIP')
WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_PGOLD');
INSERT OR IGNORE INTO GameModifiers (ModifierId)
SELECT 'ECONPROBE_PGOLD' WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_PGOLD');

-- CGOLD: a city -10 Gold in the city that holds the marker.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('ECONPROBE_CGOLD_TYPE', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
SELECT 'ECONPROBE_CGOLD_TYPE', 'COLLECTION_ALL_CITIES', 'EFFECT_CITY_ADJUST_YIELD'
WHERE EXISTS (SELECT 1 FROM GameEffects WHERE Type = 'EFFECT_CITY_ADJUST_YIELD');
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
VALUES ('ECONPROBE_REQ_HAS_CGOLD', 'REQUIREMENT_CITY_HAS_BUILDING');
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value)
VALUES ('ECONPROBE_REQ_HAS_CGOLD', 'BuildingType', 'BUILDING_ECONPROBE_CGOLD');
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType)
VALUES ('ECONPROBE_REQS_HAS_CGOLD', 'REQUIREMENTSET_TEST_ALL');
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
VALUES ('ECONPROBE_REQS_HAS_CGOLD', 'ECONPROBE_REQ_HAS_CGOLD');
INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
SELECT 'ECONPROBE_CGOLD', 'ECONPROBE_CGOLD_TYPE', 'ECONPROBE_REQS_HAS_CGOLD'
WHERE EXISTS (SELECT 1 FROM DynamicModifiers WHERE ModifierType = 'ECONPROBE_CGOLD_TYPE');
INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT 'ECONPROBE_CGOLD', N, V FROM (SELECT 'YieldType' N, 'YIELD_GOLD' V UNION ALL SELECT 'Amount', '-10'
  UNION ALL SELECT 'Tooltip', 'LOC_ECONPROBE_CGOLD_TIP')
WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_CGOLD');
INSERT OR IGNORE INTO GameModifiers (ModifierId)
SELECT 'ECONPROBE_CGOLD' WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_CGOLD');

-- Sentinel: +1 Culture in a city whose buildings are all from this age.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('ECONPROBE_ONLYAGE_TYPE', 'KIND_MODIFIER');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
SELECT 'ECONPROBE_ONLYAGE_TYPE', 'COLLECTION_ALL_CITIES', 'EFFECT_CITY_ADJUST_YIELD'
WHERE EXISTS (SELECT 1 FROM GameEffects WHERE Type = 'EFFECT_CITY_ADJUST_YIELD');
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType)
VALUES ('ECONPROBE_REQ_ONLYAGE', 'REQUIREMENT_CITY_HAS_ONLY_BUILDINGS_FROM_THIS_AGE');
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType)
VALUES ('ECONPROBE_REQS_ONLYAGE', 'REQUIREMENTSET_TEST_ALL');
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId)
VALUES ('ECONPROBE_REQS_ONLYAGE', 'ECONPROBE_REQ_ONLYAGE');
INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
SELECT 'ECONPROBE_ONLYAGE', 'ECONPROBE_ONLYAGE_TYPE', 'ECONPROBE_REQS_ONLYAGE'
WHERE EXISTS (SELECT 1 FROM DynamicModifiers WHERE ModifierType = 'ECONPROBE_ONLYAGE_TYPE');
INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT 'ECONPROBE_ONLYAGE', N, V FROM (SELECT 'YieldType' N, 'YIELD_CULTURE' V UNION ALL SELECT 'Amount', '1'
  UNION ALL SELECT 'Tooltip', 'LOC_ECONPROBE_ONLYAGE_TIP')
WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_ONLYAGE');
INSERT OR IGNORE INTO GameModifiers (ModifierId)
SELECT 'ECONPROBE_ONLYAGE' WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_ONLYAGE');

-- Overbuild follow-up (2026-11-04): a marker with no Age read as overbuildable (a City Park bought on a full centre
-- took out L1). Two variants, -1 Gold each like L1: AGEM has Age = AGE_MODERN (the current age in this group), AGEL
-- has no Age and the AGELESS tag. Does either keep the full centre closed, and does AGEM pass "Only this age"?
CREATE TEMP TABLE econprobe_v (B TEXT, A TEXT);
INSERT INTO econprobe_v VALUES ('BUILDING_ECONPROBE_AGEM', 'AGE_MODERN'), ('BUILDING_ECONPROBE_AGEL', NULL);
INSERT OR IGNORE INTO Types (Type, Kind) SELECT B, 'KIND_CONSTRUCTIBLE' FROM econprobe_v;
INSERT OR IGNORE INTO Constructibles (ConstructibleType, Name, Description, Tooltip, ConstructibleClass, Cost,
  Population, ExistingDistrictOnly, CanBeHidden, Age)
SELECT B, 'LOC_' || B || '_NAME', 'LOC_' || B || '_NAME', 'LOC_' || B || '_NAME', 'BUILDING', 1, 0, 1, 1, A
FROM econprobe_v WHERE A IS NULL OR A IN (SELECT AgeType FROM Ages);
INSERT OR IGNORE INTO Buildings (ConstructibleType, Movable, Purchasable, Town, TraitType)
SELECT B, 0, 0, 1, 'TRAIT_ECONPROBE_NONE' FROM econprobe_v WHERE B IN (SELECT ConstructibleType FROM Constructibles);
INSERT OR IGNORE INTO TypeTags (Type, Tag) SELECT B, 'IGNORE_DISTRICT_PLACEMENT_CAP' FROM econprobe_v
WHERE B IN (SELECT Type FROM Types);
INSERT OR IGNORE INTO TypeTags (Type, Tag) SELECT B, 'TOWER_MARKER' FROM econprobe_v WHERE B IN (SELECT Type FROM Types);
INSERT OR IGNORE INTO TypeTags (Type, Tag) SELECT 'BUILDING_ECONPROBE_AGEL', 'AGELESS'
WHERE EXISTS (SELECT 1 FROM Types WHERE Type = 'BUILDING_ECONPROBE_AGEL')
  AND EXISTS (SELECT 1 FROM Tags WHERE Tag = 'AGELESS');
INSERT OR IGNORE INTO Constructible_ValidDistricts (ConstructibleType, DistrictType)
SELECT B, 'DISTRICT_CITY_CENTER' FROM econprobe_v WHERE B IN (SELECT ConstructibleType FROM Constructibles);
INSERT OR IGNORE INTO Constructible_YieldChanges (ConstructibleType, YieldType, YieldChange)
SELECT B, 'YIELD_GOLD', -1 FROM econprobe_v WHERE B IN (SELECT ConstructibleType FROM Constructibles);
DROP TABLE econprobe_v;
