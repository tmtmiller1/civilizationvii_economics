-- M1: two script-placed buildings: BUILDING_ECONPROBE_DEBT with a -10 Gold yield line, BUILDING_ECONPROBE_UPKEEP with
-- 5,000 Gold maintenance (P2's question: is an AI charged upkeep at all; a charge that size shows in the balance).
-- M2: BUILDING_ECONPROBE_PRICE: -2 Happiness on the building, and a city purchase-efficiency modifier (-25%) switched
-- on while the city holds it. BUILDING_ECONPROBE_GLOOM: -40 Happiness, to push an AI city unhappy. All four: free, no population, city centre only, owned by a trait no civ has.
INSERT OR IGNORE INTO Types (Type, Kind) VALUES ('TRAIT_ECONPROBE_NONE', 'KIND_TRAIT');
INSERT OR IGNORE INTO Traits (TraitType, InternalOnly) SELECT 'TRAIT_ECONPROBE_NONE', 1
WHERE EXISTS (SELECT 1 FROM Types WHERE Type = 'TRAIT_ECONPROBE_NONE');
CREATE TEMP TABLE econprobe_b (B TEXT);
INSERT INTO econprobe_b VALUES ('BUILDING_ECONPROBE_DEBT'), ('BUILDING_ECONPROBE_UPKEEP'), ('BUILDING_ECONPROBE_PRICE'), ('BUILDING_ECONPROBE_GLOOM');
INSERT OR IGNORE INTO Types (Type, Kind) SELECT B, 'KIND_CONSTRUCTIBLE' FROM econprobe_b;
INSERT OR IGNORE INTO Constructibles (ConstructibleType, Name, Description, Tooltip, ConstructibleClass, Cost, Population, ExistingDistrictOnly)
SELECT B, 'LOC_' || B || '_NAME', 'LOC_' || B || '_NAME', 'LOC_' || B || '_NAME', 'BUILDING', 1, 0, 1 FROM econprobe_b;
INSERT OR IGNORE INTO Buildings (ConstructibleType, Movable, Purchasable, Town, TraitType)
SELECT B, 0, 0, 1, 'TRAIT_ECONPROBE_NONE' FROM econprobe_b WHERE B IN (SELECT ConstructibleType FROM Constructibles);
INSERT OR IGNORE INTO TypeTags (Type, Tag) SELECT B, 'IGNORE_DISTRICT_PLACEMENT_CAP' FROM econprobe_b;
INSERT OR IGNORE INTO Constructible_ValidDistricts (ConstructibleType, DistrictType)
SELECT B, 'DISTRICT_CITY_CENTER' FROM econprobe_b WHERE EXISTS (SELECT 1 FROM Districts WHERE DistrictType = 'DISTRICT_CITY_CENTER');
DROP TABLE econprobe_b;
INSERT OR IGNORE INTO Constructible_YieldChanges (ConstructibleType, YieldType, YieldChange) VALUES
  ('BUILDING_ECONPROBE_DEBT', 'YIELD_GOLD', -10), ('BUILDING_ECONPROBE_PRICE', 'YIELD_HAPPINESS', -2),
  ('BUILDING_ECONPROBE_GLOOM', 'YIELD_HAPPINESS', -40);
INSERT OR IGNORE INTO Constructible_Maintenances (ConstructibleType, YieldType, Amount) VALUES
  ('BUILDING_ECONPROBE_UPKEEP', 'YIELD_GOLD', 5000);

INSERT OR IGNORE INTO Types (Type, Kind)
SELECT 'ECONPROBE_M2_PRICE_TYPE', 'KIND_MODIFIER'
WHERE EXISTS (SELECT 1 FROM GameEffects WHERE Type = 'EFFECT_ADJUST_PLAYER_OR_CITY_ALL_PURCHASE_EFFICIENCY');
INSERT OR IGNORE INTO DynamicModifiers (ModifierType, CollectionType, EffectType)
SELECT 'ECONPROBE_M2_PRICE_TYPE', 'COLLECTION_ALL_CITIES', 'EFFECT_ADJUST_PLAYER_OR_CITY_ALL_PURCHASE_EFFICIENCY'
WHERE EXISTS (SELECT 1 FROM Types WHERE Type = 'ECONPROBE_M2_PRICE_TYPE');
INSERT OR IGNORE INTO Requirements (RequirementId, RequirementType) VALUES ('ECONPROBE_REQ_HAS_PRICE', 'REQUIREMENT_CITY_HAS_BUILDING');
INSERT OR IGNORE INTO RequirementArguments (RequirementId, Name, Value) VALUES ('ECONPROBE_REQ_HAS_PRICE', 'BuildingType', 'BUILDING_ECONPROBE_PRICE');
INSERT OR IGNORE INTO RequirementSets (RequirementSetId, RequirementSetType) VALUES ('ECONPROBE_REQS_HAS_PRICE', 'REQUIREMENTSET_TEST_ALL');
INSERT OR IGNORE INTO RequirementSetRequirements (RequirementSetId, RequirementId) VALUES ('ECONPROBE_REQS_HAS_PRICE', 'ECONPROBE_REQ_HAS_PRICE');
INSERT OR IGNORE INTO Modifiers (ModifierId, ModifierType, SubjectRequirementSetId)
SELECT 'ECONPROBE_M2_PRICE', 'ECONPROBE_M2_PRICE_TYPE', 'ECONPROBE_REQS_HAS_PRICE'
WHERE EXISTS (SELECT 1 FROM DynamicModifiers WHERE ModifierType = 'ECONPROBE_M2_PRICE_TYPE');
INSERT OR IGNORE INTO ModifierArguments (ModifierId, Name, Value)
SELECT 'ECONPROBE_M2_PRICE', 'Percent', '-25' WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_M2_PRICE');
INSERT OR IGNORE INTO GameModifiers (ModifierId)
SELECT 'ECONPROBE_M2_PRICE' WHERE EXISTS (SELECT 1 FROM Modifiers WHERE ModifierId = 'ECONPROBE_M2_PRICE');
