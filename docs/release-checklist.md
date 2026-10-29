# Release checklist

Economics hasn't shipped: the repo has no GitHub remote and no Workshop item. The first release is 1.0.0, after
prompts 4 to 6 of `tools/plans/economics/` (mechanics watched in game, presentation, the standards audit) and the
owner's word (prompt 7). Until then this is the shape of the steps, in Partisans' form.

## The first release, 1.0.0

1. **Gates.** `npm run release:gate` passes. The any-DLC check passes: load every shipped SQL file into a copy of a
   freshly compiled `gameplay-copy.sqlite` with every DLC-only `Leaders`, `Civilizations`, `Units`, `Constructibles`
   and `Resources` row removed, and `PRAGMA foreign_key_check` lists the same rows as before. `tower-bench check
   tower_mods_in_dev/economics` and `release-check` pass; `tower-bench l10n` passes on every locale.
2. **Date the changelog.** Rename `## [Unreleased]` in `CHANGELOG.md` to `## [1.0.0] - YYYY-MM-DD`, then run
   `node scripts/steam-changelog.mjs sync`, which adds the 1.0.0 block to `CHANGELOG.steam.txt`. `<Version>` in
   `economics.modinfo` and `version` in `package.json` say 1.0.0 (`tests/modinfo.test.mjs` checks they match).
3. **Move the project.** `tower_mods_in_dev/economics/` becomes `tower_mods/economics/`; the carrier list in
   Civilopedia History Corrections' `scripts/sync-to-mods.mjs` finds it there without a change. Update
   `WORKSPACE_MAP.md` and the plan README's names table.
4. **Create the GitHub repo.** Public under `tmtmiller1` as `civilizationvii_economics`, empty, without a README or
   license, since this repo has its own. Then:

   ```sh
   git remote add origin https://github.com/tmtmiller1/civilizationvii_economics.git
   git push -u origin main
   git tag v1.0.0 && git push origin v1.0.0
   ```

   With the remote set, run `node scripts/steam-changelog.mjs sync` again: long notes link the full changelog through
   it.
5. **Build.** `./release.sh` wipes `dist/` and builds it again. With no `steam_workshop_id.txt` it builds in new-item
   mode, and the change note is "1.0.0: first release."
6. **Upload.** The owner runs steamcmd with the no-preview manifest (`dist/workshop_item.vdf`); the preview image
   and the description go up through the browser. Then `echo <publishedfileid> > steam_workshop_id.txt` and commit
   it. Tags: `tower-bench workshop-tags tower_mods/economics --yes` from `docs/steam-workshop-tags.txt`.
7. **GitHub release.** `gh release create v1.0.0 dist/economics-v1.0.0.zip` with the changelog section as the notes.

## Every release after

Steps 1, 2, 5, 6 and 7, with the version bumped in the modinfo and `package.json`, and `steam_workshop_id.txt` in
place so `release.sh` builds in update mode.
