# RPChess localization glossary

Canonical UI language codes: `ru` (default) and `en`. Language names are self-labels and are never translated: **Русский**, **English**.

## Product terms

| RU | EN | Context / rule |
| --- | --- | --- |
| Новая игра | New Game | Main-menu action that starts Player Identity and a new run. |
| Продолжить | Continue | Resume the existing run. |
| Настройки | Settings | Global audio, motion and language-independent preferences. |
| Язык | Language | Global UI language selector. |
| Музыка | Music | Music volume setting. |
| Звуки | Sound | Sound-effects volume setting. Use singular “Sound” in the settings label. |
| Уменьшить анимации | Reduce motion | Accessibility preference; do not translate as “Disable animations”. |
| Назад | Back | Close the current non-destructive modal and return to its parent surface. |
| Отряд | Roster | Canonical name for the run’s piece roster. Reserved for shell phase. |
| Путешествие | Journey | The run’s route progression. Reserved for shell phase. |
| Стычка | Skirmish | Smaller chess encounter. Reserved for gameplay phase. |
| Битва | Battle | Major chess encounter. Reserved for gameplay phase. |
| Событие | Event | Narrative route encounter. Reserved for content phase. |
| Головоломка | Puzzle | Chess puzzle encounter. Reserved for gameplay/content phase. |
| Мощь | Power | Player rating shown in the run UI. Reserved for shell/gameplay phase. |
| Угроза | Threat | Encounter rating/difficulty indicator. Reserved for shell/gameplay phase. |

## Style rules

- Preserve **RPChess** as written.
- Use title case for primary English actions: “New Game”, “Continue”, “Settings”, “Language”.
- Keep concise labels concise; explanatory prose belongs in body copy, not controls.
- Translate observable product meaning, not implementation terms.
- Do not concatenate translated fragments. Use complete keyed messages with named parameters.
- Missing translation keys must remain observable during development; do not silently replace them with arbitrary English copy.

## Current coverage boundary

On `feature/localisation-completion`, the English runtime layer now covers the shell/UI and legacy or dynamically rendered gameplay surfaces already routed through `game/js/i18n.mjs`.

Event presentation coverage is complete at the dictionary level for:

- the primary event catalog, **E001–E500**;
- **Events v3 E001–E100** narrative/content overlay;
- all **537 Events v5 hero-specific lines**.

Event localization remains presentation-only: event IDs, chances, costs, effects, warnings and state transitions stay sourced from the existing gameplay data.

This coverage statement is not a release/acceptance statement. Final acceptance still requires the localization regression gate, RU/EN browser and responsive regression, production build, preview deployment and Human Acceptance.
