# Portrait UX acceptance — PR (October 2026)

Dedicated phone and tablet portrait layout, independently activated only under `(orientation:portrait) and (max-width:1100px)`. Existing landscape UI and rules remain unchanged.

- Compact (<600 CSS px): one-column cards, board maximized to available width, touch controls >=48px where appropriate, route and market actions directly next to content.
- Medium (600–839): centered board with readable surrounding panels, formation and Chronicle below, two-column recruit cards as space permits.
- Expanded portrait (840–1100): uses centered content width to avoid stretching interactive boards.
- Main menu/Chronicle, Roster/formation, Travel routes, Training, Battle and Arena chess boards, settlement, event/outcome, combat preparation/aftermath, journey result and overlays included.
- Portrait is not a rotation error anymore. The previous lock's presentation and JS creation are disabled only after new layout stylesheet is installed.
- Context: Android Window Size Classes use <600px compact and 600–839px medium; Chess.com keeps board interaction adjacent to move controls. No external screenshots/art assets copied.
- Screenshots: real Playwright Chromium at 390x844 phone and 768x1024 tablet, captured after assets finish loading. No image generation.
- QA acceptance: no horizontal overflow; square 8x8 game and formation boards; all primary controls accessible; no orientation overlay; input touch targets; content scroll allowed only for lists/long copy.

Sources: https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes and https://support.chess.com/en/articles/10473022-how-do-i-use-game-analysis-on-the-app
