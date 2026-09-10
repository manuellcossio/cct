---
name: CCT i18n (EN/ES) convention
description: How localization works in the CCT artifact — what to wrap, what to leave, and how AI content language is selected.
---

# CCT EN/ES localization convention

The CCT tool supports an EN/ES language selector. Dictionary + provider live in `artifacts/cct/src/lib/i18n.tsx` (`I18nProvider`, `useI18n` → `{ t, lang, setLang }`). Default lang `"es"`, persisted in localStorage key `"cct-lang"`. Selector UI is in `components/layout.tsx`.

## Rules (follow for any new CCT UI/content)
- **Only wrap Spanish strings in `t()`.** Strings that were already English in the original UI stay as plain literals — do NOT route them through the dictionary (even though es==en would render identically, it violates the convention and adds noise).
- **The `es` dictionary must equal the original UI verbatim** — it is the source of truth for what the Spanish app showed.
- **Language-picker labels are native names** (`"Español"` / `"English"`) and are intentionally NOT translated — they must not change with the active UI language.
- **AI-generated content language is driven by `lang`**, threaded from the component into every generate mutation body (twitter posts/threads/market, instagram auto/from-url, adgen, slideshow-mkt, engine from-url). Backend reads it via a `parseLang` helper defaulting to `es` and switches prompts accordingly. Any new generation endpoint must accept and honor `lang`.

**Why:** keeps ES (the primary product language) untouched while layering EN on top; prevents accidental "translation" of brand/English terms and keeps generated content consistent with the chosen UI language.

## Gotcha
- `engine.tsx` has a pre-existing typecheck error (`useGetEngineNews` options missing `queryKey`, ~line 141) unrelated to i18n. The CCT typecheck is otherwise clean; don't mistake it for an i18n regression.
