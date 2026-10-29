# Translating Economics (`text/`)

Every string a player sees in Economics is a `LOC_*` tag defined here and looked up by the game at run time. The
scripts set no display text of their own, so a translation needs no code change.

## Files

| File | Contents |
| --- | --- |
| `en_us/ModText.xml` | The source of truth for the game text: the mod's name and description and the setup options. |

All eleven other languages ship as translations that use the game's own words for its terms. Until the translation
pass (prompt 5 of the plan) they hold the English text as placeholders. To correct one, edit its `<Text>`; to change
the English, edit the English and update every language. `tests/i18n.test.mjs` checks that every language holds
exactly the English tags, under the right `Language`, with the same `{placeholders}`.

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

**The `Language` value is not the folder name.** Use these exactly (note `zh_cn`):

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
needs. `[N]` is a line break inside a notification. The setup text has none yet.
