# RPChess Approved Player-Facing Visual Contract

Status: canonical for every player-facing browser screen.

## Non-negotiable presentation rules

1. Player-facing screens use the approved fantasy prototype shell and assets from `game/generated_assets/` together with the canonical Register assets.
2. Technical presenter layouts, raw content IDs, raw status IDs, sprite sheets and glyph-only chess pieces are diagnostic output and must never be the final player interface.
3. The root route opens the complete game shell: title screen, profiles, commander progression, settings, codices and the playable campaign.
4. A chess piece is presented as its warrior illustration on the square. A smaller technical chess symbol is centered along the lower edge to reinforce recognition.
5. Event and campaign screens use authored scene and node art. Environment sprite sheets are source atlases for board objects, never decorative side-panel images.
6. The campaign map itself communicates available routes. A duplicate “available routes” panel is forbidden.
7. Hero details show portrait, stars directly below the portrait, then vertically stacked mechanic cards. Active abilities and active relics come first; passive relics and current passive effects come below.
8. Relics use inventory-slot framing and always show their image, localized name and human-readable effect.
9. Objectives, defeat conditions, statuses and effects use natural language. Raw identifiers such as `effect.*`, `failure.*`, `ward` or `piece_lost` are not displayed.
10. Movement, capture, abilities, danger, defeat and victory have audio feedback. The supplied fanfare is played after tactical victory.
11. Text wraps and expands containers instead of being clipped. Controls are comfortable for mouse and touch.
12. New named commanders are not all available at the start. Only the first commander is initially open; later commanders are unlocked through campaign discoveries, services, shops and victories.

## Review gate

A player-facing change is incomplete until it has been checked against this document and the production build tests assert the relevant contract points.
