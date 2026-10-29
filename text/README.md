# Translating Economics (`text/`)

Every string a player sees in Economics is a `LOC_*` tag defined here and looked up by the game at run time. The
scripts don't carry display text of their own, so a translation is a text change only.

## Files

| File | Contents |
| --- | --- |
| `en_us/ModText.xml` | The source of truth for the game text: the mod's name and description, the setup options, the tax cards, the screen, the notification lines and the refusal reasons. |

All eleven other languages ship as translations that use the game's own words for its terms. Until the translation
pass (prompt 5 of the plan) they hold the English text as placeholders. To correct one, edit its `<Text>`; to change
the English, edit the English and run `node scripts/sync-locales.mjs`. It adds a placeholder row for each new tag in
every language, keeps the rows whose English is unchanged, and puts the new English over any row whose English changed
since the last run, so an old translation doesn't ship under a new meaning (`scripts/locale-baseline.json` holds the
English each row was synced from). `tests/i18n.test.mjs` checks that every language holds the same tags as English,
under the right `Language`, with the same `{placeholders}`.

The tax cards' percentages in their descriptions come from `ui/econ-tax-cards.js`: `node scripts/sync-tax-cards.mjs`
writes them into the English rows and the placeholders, and into the cards' modifiers.

## Two file shapes

English uses an `EnglishText` block with `Row`:

```xml
<Database>
    <EnglishText>
        <Row Tag="LOC_ECONOMICS_SETUP_LOANS_NAME"><Text>Loans</Text></Row>
    </EnglishText>
</Database>
```

Every other language uses a `LocalizedText` block with `Replace` and a `Language` attribute:

```xml
<Database>
    <LocalizedText>
        <Replace Tag="LOC_ECONOMICS_SETUP_LOANS_NAME" Language="de_DE"><Text>Darlehen</Text></Replace>
    </LocalizedText>
</Database>
```

**The `Language` value is not the folder name.** Use these values (note `zh_cn`):

| Folder | `Language=` | Folder | `Language=` |
| --- | --- | --- | --- |
| `de_de` | `de_DE` | `pl_pl` | `pl_PL` |
| `es_es` | `es_ES` | `pt_br` | `pt_BR` |
| `fr_fr` | `fr_FR` | `ru_ru` | `ru_RU` |
| `it_it` | `it_IT` | `zh_cn` | `zh_Hans_CN` |
| `ja_jp` | `ja_JP` | `ko_kr` | `ko_KR` |
| `zh_hk` | `zh_Hant_HK` (Traditional Chinese) | | |

Each file is listed in `economics.modinfo` with a `locale` attribute, in both the shell group (the setup screen) and
the game group.

## Placeholders

Placeholders such as `{1_Amount}` are filled by the game and must stay as written, in whatever order the language
needs. `[N]` is a line break inside a notification. Some keys are built in code from a stem (`LOC_ECONOMICS_REASON_`
plus the model's refusal code, `LOC_ECONOMICS_REQUEST_` plus the request kind, `LOC_ECONOMICS_FISCAL_VERDICT_` plus
the swap's result); `tests/econ-notice-text.test.mjs` checks each one the code can produce has a row.
