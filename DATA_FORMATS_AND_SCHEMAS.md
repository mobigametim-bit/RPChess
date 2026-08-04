# DATA_FORMATS_AND_SCHEMAS.md

**Status:** Proposed schema architecture v1  
**Format recommendation:** authored JSON or YAML validated against JSON Schema; compiled to optimized JSON bundles for runtime.

## 1. Global conventions

Every authored record includes:

```json
{
  "id": "namespace.stable_id",
  "schemaVersion": 1,
  "contentVersion": "0.1.0",
  "tags": [],
  "localization": {},
  "assets": {},
  "enabled": true
}
```

Rules:

- IDs are lowercase ASCII using `namespace.snake_case`.
- IDs never change after public release; aliases handle renames.
- Display text is referenced by localization key.
- Runtime effects use a closed effect vocabulary, never arbitrary script.
- Every reference is validated at build time.
- Numeric values have explicit units and bounds.
- Random selection uses named deterministic streams.

## 2. Version envelope

```json
{
  "format": "rpchess-content-bundle",
  "schemaVersion": 1,
  "contentVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "generatedAt": "build-time-only",
  "records": {}
}
```

`generatedAt` is excluded from deterministic content hashes.

## 3. Localization catalog

```json
{
  "locale": "ru",
  "schemaVersion": 1,
  "entries": {
    "ui.reward.choose_title": "Выберите награду",
    "event.ashen_bridge.title": "Пепельный мост",
    "event.ashen_bridge.choice.cross": "Перейти мост"
  }
}
```

Support:

- variables;
- plural/select forms;
- fallback locale;
- missing-key diagnostics;
- length annotations for UI stress testing.

## 4. Unit definition

```json
{
  "id": "unit.pawn",
  "schemaVersion": 1,
  "category": "standard",
  "movementProfile": "movement.pawn.standard",
  "baseCommandCost": 1,
  "promotionOptions": ["unit.queen", "unit.rook", "unit.bishop", "unit.knight"],
  "localization": {
    "name": "unit.pawn.name",
    "description": "unit.pawn.description"
  },
  "assets": {
    "player": "piece/pawn/player_default",
    "enemy": "piece/pawn/enemy_default"
  }
}
```

## 5. King definition

```json
{
  "id": "king.oathkeeper",
  "schemaVersion": 1,
  "unlock": {"type": "default"},
  "passiveEffect": "effect.king.oathkeeper_passive",
  "orderAbility": "ability.king.oathkeeper_command",
  "limitation": "rule.king.oathkeeper_cost",
  "startModifiers": [],
  "eventTags": ["law", "oath"],
  "endingTags": ["ordered_realm"],
  "localization": {
    "name": "king.oathkeeper.name",
    "description": "king.oathkeeper.description"
  },
  "assets": {"portrait": "king/oathkeeper/portrait", "piece": "king/oathkeeper/piece"}
}
```

## 6. Doctrine definition

```json
{
  "id": "doctrine.fortress",
  "schemaVersion": 1,
  "startingRoster": ["unit.king", "unit.rook", "unit.rook", "unit.pawn", "unit.pawn"],
  "startingRelic": "relic.mason_seal",
  "passiveEffect": "effect.doctrine.fortress_passive",
  "reserveRule": "reserve.fortress",
  "rewardTags": ["rook", "guard", "wall"],
  "tree": ["doctrine_node.fortress.1a", "doctrine_node.fortress.1b"]
}
```

## 7. Named hero definition

```json
{
  "id": "hero.ser_calder",
  "schemaVersion": 1,
  "pieceType": "unit.knight",
  "uniqueAbility": "ability.hero.ser_calder_charge",
  "passiveTalentPool": ["talent.flank_guard", "talent.rescue_path"],
  "personalityTags": ["loyal", "impulsive"],
  "eventTags": ["cavalry", "borderlands"],
  "persistence": {"named": true, "returnsToKingdom": true},
  "assets": {"portrait": "hero/ser_calder/portrait", "piece": "hero/ser_calder/piece"}
}
```

## 8. Relic definition

```json
{
  "id": "relic.echo_shield",
  "schemaVersion": 1,
  "rarity": "common",
  "recipientFilter": {
    "pieceTypes": ["unit.rook", "unit.king"],
    "excludedTags": []
  },
  "slotType": "figure_relic",
  "action": null,
  "passiveEffect": "effect.relic.echo_shield",
  "replacementCompensation": {"gold": 8, "supplies": 0},
  "localization": {"name": "relic.echo_shield.name", "description": "relic.echo_shield.description"},
  "assets": {"icon": "relic/echo_shield"}
}
```

## 9. Talent definition

```json
{
  "id": "talent.knight.afterimage",
  "schemaVersion": 1,
  "eligiblePieceTypes": ["unit.knight"],
  "category": "passive",
  "effect": "effect.talent.knight.afterimage",
  "incompatibilities": ["talent.knight.anchored"],
  "localization": {"name": "talent.knight.afterimage.name", "description": "talent.knight.afterimage.description"}
}
```

## 10. Event definition

```json
{
  "id": "event.broken_gate",
  "schemaVersion": 1,
  "regionTags": ["any"],
  "actRange": [1, 3],
  "weight": 10,
  "repeatPolicy": {"perRun": 1, "perProfile": null},
  "conditions": [],
  "incompatibilities": [],
  "participants": [],
  "sceneAsset": "event/broken_gate",
  "choices": [
    {
      "id": "force_entry",
      "textKey": "event.broken_gate.choice.force_entry",
      "costs": [],
      "effects": [
        {"type": "grant_gold", "amount": 45},
        {"type": "injure_random_roster_member", "severity": "light"}
      ],
      "setFlags": ["broken_gate.forced"]
    }
  ]
}
```

## 11. Encounter module

```json
{
  "id": "encounter.border_ambush_01",
  "schemaVersion": 1,
  "board": "board.standard_8x8",
  "ruleset": "rules.standard_with_environment",
  "objective": "objective.checkmate_enemy",
  "failure": "failure.own_king_checkmated",
  "deployment": "deployment.south_two_ranks",
  "enemyRosterProfile": "enemy.border_ambush",
  "environment": ["object.crate_line"],
  "difficulty": {"base": 3, "scaling": "encounter.standard"},
  "compatibility": {"acts": [1,2], "regions": ["region.borderlands"]}
}
```

## 12. Boss definition

```json
{
  "id": "boss.iron_regent",
  "schemaVersion": 1,
  "region": "region.iron_marches",
  "phases": [
    {
      "id": "phase.sealed_throne",
      "board": "board.iron_throne",
      "objective": "objective.break_three_seals",
      "transition": "transition.keep_survivors_reset_positions"
    },
    {
      "id": "phase.regent_unbound",
      "objective": "objective.checkmate_enemy",
      "transition": null
    }
  ]
}
```

## 13. Campaign graph and node

```json
{
  "id": "act_instance_01",
  "seed": 123456,
  "regionId": "region.iron_marches",
  "nodes": [
    {
      "id": "node_0001",
      "type": "battle",
      "contentId": "encounter.border_ambush_01",
      "revealed": true,
      "edges": ["node_0002", "node_0003"]
    }
  ]
}
```

## 14. Profile save

```json
{
  "format": "rpchess-profile",
  "schemaVersion": 1,
  "gameVersion": "1.0.0",
  "profileId": "profile_01",
  "displayName": "Северная Корона",
  "kingdomName": "Эйрвальд",
  "createdAt": "2026-08-04T00:00:00Z",
  "lastSavedAt": "2026-08-04T00:00:00Z",
  "playtimeSeconds": 0,
  "metaCurrency": 0,
  "unlocks": {},
  "kingdom": {},
  "heroes": {},
  "chronicle": {},
  "statistics": {},
  "activeRunRef": "run_current",
  "checksum": "sha256:..."
}
```

## 15. Run save

```json
{
  "format": "rpchess-run",
  "schemaVersion": 1,
  "gameVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "contentVersion": "1.0.0",
  "runId": "run_...",
  "seed": 123456,
  "rngStreams": {},
  "difficulty": {},
  "kingId": "king.oathkeeper",
  "doctrineId": "doctrine.fortress",
  "act": 1,
  "regionState": {},
  "campaignGraph": {},
  "roster": [],
  "gold": 0,
  "supplies": 0,
  "flags": {},
  "pendingDecision": null,
  "battleCheckpointRef": null,
  "decisionHash": "sha256:...",
  "checksum": "sha256:..."
}
```

## 16. Battle checkpoint

```json
{
  "format": "rpchess-battle",
  "schemaVersion": 1,
  "battleId": "battle_...",
  "scenarioId": "encounter.border_ambush_01",
  "rulesVersion": "1.0.0",
  "turnIndex": 12,
  "sideToAct": "player",
  "position": {},
  "deployment": {},
  "orderPoints": {},
  "reserve": {},
  "objectives": {},
  "phase": {},
  "commandLog": [],
  "stateHash": "...",
  "checksum": "sha256:..."
}
```

## 17. Replay format

```json
{
  "format": "rpchess-replay",
  "schemaVersion": 1,
  "gameVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "contentVersion": "1.0.0",
  "initialState": {},
  "seed": 123456,
  "commands": [],
  "checkpoints": [{"turn": 20, "stateHash": "..."}],
  "finalStateHash": "...",
  "signature": null
}
```

## 18. Achievement definition

```json
{
  "id": "achievement.first_victory",
  "schemaVersion": 1,
  "criteria": {
    "event": "RunCompleted",
    "where": [{"field": "victory", "equals": true}]
  },
  "steamId": "ACH_FIRST_VICTORY",
  "reward": {"type": "cosmetic", "id": "banner.first_victory"},
  "localization": {"name": "achievement.first_victory.name", "description": "achievement.first_victory.description"}
}
```

## 19. Workshop package

```json
{
  "format": "rpchess-workshop-challenge",
  "schemaVersion": 1,
  "challengeId": "uuid",
  "revision": 3,
  "title": {"ru": "...", "en": "..."},
  "scenario": {},
  "allowedOfficialContent": [],
  "decorativeImages": [],
  "authorVerificationReplay": "verification.rpr",
  "validationReport": {},
  "contentHash": "sha256:..."
}
```

No executable script fields are allowed.

## 20. Validation outputs

The content compiler produces:

- `content.bundle.json`;
- `content.manifest.json`;
- `asset.manifest.json`;
- `localization.report.json`;
- `reference-errors.json`;
- `balance-summary.json`;
- `content-hash.txt`.

A release build fails on any unresolved P0/P1 reference, missing required localization or invalid schema.
