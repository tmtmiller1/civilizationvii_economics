# Crisis paths, phase 0: the probes (2026-11-02, lab run `2026-11-03T03-29-52`)

One lab game, Antiquity seed 4242, every other mod off, 70 turns; the scripts and the drive log are under
`mod_ideas_tested/economics/devtools/probe-runs/2026-11-02-crisis-phase0/`. Each probe is the sixth draft's
(section 3 and the fifth draft's section 6), with what was seen.

| Probe | Seen | Verdict |
| --- | --- | --- |
| Influence stock | `Players.get(p).DiplomacyTreasury.diplomacyBalance` read 120, 50, 150 and moved each turn by the civ's Influence income | passes: the gate on Influence prices is open |
| A charge against it | `grantYield(YIELD_DIPLOMACY, -5)` and `changeDiplomacyBalance(-3)` both landed at the turn's end, not the same turn (seat 50 then 52 with +10 income) | passes; a charge shows on the next batch's read |
| A charge past the stock | AI 2 charged its balance plus 50 sat at -50 for a turn, then 0 | the game lets it go negative: eligibility refuses a price above the stock |
| Production | `Stats.getNetYield(YIELD_PRODUCTION)` equals the cities' sum (8 = 8) | passes |
| War with an independent | no major reads at war with any independent (players 6 to 23) through `isAtWarWith`; an AI's `forceDeclareWar` on one does nothing | fails: Foreign adventure asks for a war with a major; independents' settlements still count as captures |
| A script war against an ordinary one | an AI's `forceDeclareWar` on a major makes the game's own `DIPLOMACY_ACTION_DECLARE_WAR` event (war support -4), the nine-turn bar on peace, and peace on its own after 22 and 25 turns; Goryeo's own war at turn 69 is the same action (support -1); a second argument doesn't make it formal | passes: a script war is the game's surprise war. Formal-war requirements (War Levy's at-war line) don't count surprise wars, the AI's own included |
| A capture against a founding | cities carry `originalOwner` and `isJustConqueredFrom`; nine foundings read owner = original owner; no settlement changed hands in 70 turns | the read is there, the capture unwatched (WATCH_LIST) |
| The military build | the current build's hash resolves in `GameInfo.Units` with `CoreClass` (`CORE_CLASS_MILITARY`, `_SUPPORT`, `_CIVILIAN`) | passes |

What the build takes from this:

- Influence prices go in, read from `diplomacyBalance` each batch; a card whose price passes the stock is refused.
- The AI may declare Foreign adventure's war (a surprise war, like its own), and the human declares through the
  game. The card says "a surprise war"; War Levy's at-war line still needs a formal war.
- Foreign adventure's war is with a major. A settlement taken while mobilised counts from anyone, independents
  included.
- The bond-rate surcharge of "+0.5" in the drafts was written as if rates were yearly. The mod's rates are per turn
  (1.0% to 2.5% in the runs), so +0.5 points is +25% to +50% of the rate. The build uses factors instead: a
  Programme's own rates x1.25, Bank regulation's x0.8 net of that.
