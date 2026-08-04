# RELEASE_ACCEPTANCE_CHECKLIST.md

This checklist is authoritative. RPChess must not be described as release-ready while any required item is unchecked.

## 1. Source and build

- [ ] Repository contains the actual source tree, not a source ZIP plus deployment mutations.
- [ ] Clean clone builds web version without manual steps.
- [ ] Release build requires no Google Drive or other runtime network download.
- [ ] Dependency lockfile committed.
- [ ] Asset/content manifests generated and validated.
- [ ] Reproducible build instructions verified on a clean Windows machine.
- [ ] Rollback artifact retained.

## 2. Core chess

- [ ] Standard 8×8 board is default for ordinary battles.
- [ ] All standard piece movement tested.
- [ ] Check detection tested.
- [ ] Self-check moves rejected.
- [ ] Checkmate tested.
- [ ] Stalemate tested.
- [ ] Castling tested.
- [ ] En passant tested.
- [ ] Promotion tested.
- [ ] No ordinary piece HP, armor or random damage.
- [ ] Ordinary capture is deterministic and immediate.
- [ ] Special scenarios explicitly declare rule differences.

## 3. Combat systems

- [ ] One player action / one enemy action loop works.
- [ ] Extra action/reaction chains bounded.
- [ ] Order points reset after battle.
- [ ] Reserve and deployment work.
- [ ] Command limit and roster size are separate.
- [ ] Alternative objectives display before battle.
- [ ] Environment is visible and readable.
- [ ] No hidden tactical information affecting legal moves.
- [ ] Boss phases preserve/transform state according to displayed rules.
- [ ] Pre-battle arrangement works where allowed.

## 4. AI

- [ ] AI selects only legal actions.
- [ ] AI cannot access hidden information.
- [ ] AI receives no hidden resources or numeric bonuses.
- [ ] Apprentice profile behaves plausibly.
- [ ] Warlord profile is the authored baseline.
- [ ] Grandmaster profile uses deeper/better reasoning rather than cheating.
- [ ] Objective-aware scenarios validated.
- [ ] AI deterministic for fixed state/profile/seed.

## 5. Campaign and procedural generation

- [ ] Three complete acts.
- [ ] Six complete main regions.
- [ ] Two rare faction/secret branches.
- [ ] 9–12-node target structure per act.
- [ ] Route visibility and scouting work.
- [ ] Route consequences affect later acts.
- [ ] No meaningless dead ends.
- [ ] No unavoidable invalid encounter chains.
- [ ] 10,000-seed release report passes.
- [ ] Same version/seed/settings/decisions reproduce results.

## 6. Content minimums

- [ ] At least 100 full events.
- [ ] At least 50 relics.
- [ ] At least 30 named heroes.
- [ ] At least 70 distinct combat scenario modules.
- [ ] Seven kings complete.
- [ ] Six release doctrines complete.
- [ ] Six main factions complete.
- [ ] Two rare factions complete.
- [ ] 15–18 central political figures complete.
- [ ] Primary and alternative boss for each main region.
- [ ] Four major ending models and consequence epilogues.
- [ ] No P0/P1 placeholders.

## 7. Army and progression

- [ ] King and doctrine selected independently.
- [ ] Starting roster fits command budget.
- [ ] Active army and roster limits enforced.
- [ ] Overflow replacement/decline/compensation works.
- [ ] Named hero returns to kingdom when dismissed.
- [ ] Stars and talent choices work.
- [ ] Relics are assigned to specific figures.
- [ ] Relic replacement/decline compensation works.
- [ ] Promotion retains identity/history/progression.
- [ ] Injuries have severity and visible recovery rules.
- [ ] Permanent death only occurs under explicit conditions.

## 8. Economy

- [ ] Gold implemented.
- [ ] Supplies implemented as strategic act resource.
- [ ] Meta currency named and implemented without grind dependence.
- [ ] Reward choice always offers exactly three valid options after battle.
- [ ] Shops have limited typed stock.
- [ ] Rerolls bounded and escalating where available.
- [ ] Economy tested across all difficulty presets.

## 9. Kingdom and profiles

- [ ] Three kingdom profiles.
- [ ] Rename/create/delete/export profile.
- [ ] Throne Hall.
- [ ] Training Hall.
- [ ] Barracks.
- [ ] Forge/relic catalog.
- [ ] Infirmary.
- [ ] Archive.
- [ ] Embassy.
- [ ] Hall of Trials.
- [ ] Chronicle reflects major decisions and hero history.
- [ ] No timers/mobile-farm mechanics.

## 10. Modes

- [ ] Main campaign.
- [ ] Authored permanent challenges.
- [ ] Weekly shared act.
- [ ] Endless mode.
- [ ] Workshop challenges.
- [ ] Custom difficulty.
- [ ] Old weekly acts archived without blocking rewards.

## 11. Replays and leaderboards

- [ ] Replay stores commands/seed/version/initial state.
- [ ] Replay state hashes verify.
- [ ] Pause/speed/step/seek works.
- [ ] Replay cannot be resumed as a save.
- [ ] Ranked runs auto-save replay.
- [ ] Leaderboards limited to fixed/shared rules.
- [ ] Score formula visible.
- [ ] Version-separated rankings.

## 12. Editor and Workshop

- [ ] Visual challenge editor.
- [ ] Progressive disclosure UI.
- [ ] Official safe modules only.
- [ ] No executable user scripts.
- [ ] Test play and automatic validation.
- [ ] Author completion replay required.
- [ ] Verification resets after relevant edits.
- [ ] Versioned Workshop items.
- [ ] Search/tags/filters/ratings/favorites/subscriptions/reports.
- [ ] External image limits and validation.

## 13. Saves

- [ ] Autosave at all required checkpoints.
- [ ] Exit mid-battle and continue exact state.
- [ ] No reload of old move for undo.
- [ ] Atomic write.
- [ ] Backup generation.
- [ ] Checksum/integrity validation.
- [ ] Corruption recovery.
- [ ] Version migration fixtures.
- [ ] Future-version warning.
- [ ] Export/import backup.

## 14. Steam

- [ ] Desktop wrapper decision documented and implemented.
- [ ] Steam app starts through client.
- [ ] Game works with Steam unavailable/offline.
- [ ] Steam achievements.
- [ ] Steam Cloud.
- [ ] Safe Cloud conflict UI.
- [ ] Steam leaderboards.
- [ ] Steam Workshop.
- [ ] Overlay behavior tested.
- [ ] Clean shutdown.
- [ ] Correct user-data paths.

## 15. Localization

- [ ] Russian complete.
- [ ] English complete.
- [ ] No gameplay/UI text embedded in images.
- [ ] All strings externalized.
- [ ] Variables and plural forms tested.
- [ ] Missing-key report empty.
- [ ] Font fallback complete.
- [ ] No clipped strings at target layouts/scales.
- [ ] Steam store materials localized.

## 16. Input and Steam Deck

- [ ] Mouse support.
- [ ] Keyboard support.
- [ ] Controller support across all main game screens.
- [ ] Visible focus.
- [ ] Full remapping.
- [ ] Automatic input glyph switching.
- [ ] Touch usable as supplementary input.
- [ ] Full campaign completable on Steam Deck without mouse.
- [ ] 1280×800 UI verified.
- [ ] Proton install/suspend/resume verified.

## 17. Accessibility

- [ ] UI scale.
- [ ] Text scale.
- [ ] Color-vision modes.
- [ ] Shape/icon redundancy for color cues.
- [ ] Board contrast control.
- [ ] Reduced flashes.
- [ ] Disable shake.
- [ ] VFX intensity.
- [ ] Animation speed.
- [ ] Skip repeated animation.
- [ ] Independent master/music/UI/ambience/gameplay volumes.

## 18. Performance and quality

- [ ] Stable 60 FPS in ordinary battle.
- [ ] 1920×1080 verified.
- [ ] 1280×800 verified.
- [ ] 16:9 and 16:10 verified.
- [ ] Windowed/borderless/fullscreen.
- [ ] No blurry Canvas/UI.
- [ ] No known memory leak in long session.
- [ ] Save/load responsiveness acceptable.
- [ ] All automated tests pass.
- [ ] All serious bugs have regression tests.
- [ ] No critical/high blockers.

## 19. Store and publication

- [ ] Steam capsules complete.
- [ ] Screenshots complete and truthful.
- [ ] RU/EN store descriptions complete.
- [ ] System requirements verified.
- [ ] Achievement list prepared.
- [ ] Workshop policy prepared.
- [ ] Privacy/data behavior documented.
- [ ] Update/rollback policy prepared.
- [ ] Release notes prepared.
- [ ] Final signed/hash-recorded release candidate installed from Steam branch.
