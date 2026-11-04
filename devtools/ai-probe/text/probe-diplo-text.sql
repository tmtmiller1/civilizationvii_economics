-- probe-diplo-text.sql  (TEXT rows; load with UpdateText)
-- Pairs with probe-diplo.sql. Base endeavors keep _INITIAL / _ACCEPT / _SUPPORT in the age module's text and
-- _NAME / _NO_DATA / _REQUEST / _REJECT in base-standard; one file covers all of them here.

INSERT OR REPLACE INTO LocalizedText (Language, Tag, Text) VALUES
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_NAME', 'Probe Pact'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_NO_DATA', 'Sign a Probe Pact with another Leader.'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_INITIAL', 'Sign a Probe Pact with another Leader.[n]When it ends, your relationship improves and the breakdown shows "From a Probe Pact".'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_ACTIVE', 'Probe Pact in progress. When it ends, your relationship improves.'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_REQUEST', '{1_leaderName} is inviting you to sign a Probe Pact.'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_ACCEPT', 'Your relationship with {1_initialName} improves when the pact ends.'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_SUPPORT', 'Your relationship with {1_initialName} improves when the pact ends.'),
('en_US', 'LOC_DIPLOMACY_PROJECT_ECONPROBE_PACT_REJECT', 'Blocked from future projects for {2_cooldown} turns.[n][icon:RELATIONSHIP] Relationships worsen.'),
('en_US', 'LOC_FAVOR_FROM_ECONPROBE_PACT', 'From a Probe Pact you signed with them'),
('en_US', 'LOC_FAVOR_FROM_ECONPROBE_PACT_ALT', 'From a Probe Pact they signed with you');
