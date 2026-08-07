# REGISTER 03 — FIGURE-BOUND RELICS

Part of `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## Shared production specification

Every relic requires:

- `assets/relics/<slug>.png`, 512×512 PNG RGBA, 12% safe area;
- stable data ID `relic.<slug>`;
- RU/EN name, description, compatibility and replacement-compensation text;
- explicit compatible piece filter;
- passive or active effect using the closed effect vocabulary;
- deterministic tests and one interaction test with save/replay.

**Ready-to-use prompt template:** “Single RPChess relic icon for **[RUSSIAN NAME]**: a magical medieval object symbolizing **[MECHANIC]**. Centered, transparent background, premium gold/silver/sapphire fantasy craftsmanship with a controlled faction accent, one clear object, readable at 64 px, no frame, no text, no hands, no extra props, no copied franchise symbols.”

**Acceptance:** correct 512×512 RGBA; clean alpha; readable at 64 px; icon represents mechanic; compatibility leaves at least one valid recipient; active effect replaces a normal action unless explicitly approved; no hidden random result; in-game tooltip and assignment/replacement/refusal flow pass; commercial rights recorded.

### Supplied visual asset status

All 72 relic icons have been supplied, normalized and imported. Their canonical data manifest is `content/manifests/register-03-relics.json`; technical image audit is `content/audits/register_03_relic_assets.json`; browser/runtime resolution is provided by `game/js/register-03-relic-assets.mjs`. Therefore every art row below is `REVIEW`, not `MISSING`. Final `APPROVED` still requires provenance and in-game acceptance.

## 72 release relic records

| ID / filename | Compatible | Priority | Name — mechanical brief | Status |
|---|---|---|---|---|
| RELIC-01 `echo_shield.png` | rook/king | P0 | **Щит эха** — negate the first otherwise legal capture once, then break. | REVIEW |
| RELIC-02 `phantom_spurs.png` | knight | P0 | **Призрачные шпоры** — after a non-capture, gain visible evasion rather than hidden position. | REVIEW |
| RELIC-03 `circle_warding.png` | bishop/king | P0 | **Круг защиты** — place a one-use ward on an adjacent ally. | REVIEW |
| RELIC-04 `twin_command.png` | king/hero | P0 | **Двойной приказ** — first active ability each battle costs one fewer order point. | REVIEW |
| RELIC-05 `royal_decree.png` | pawn | P0 | **Королевский указ** — one early promotion route under a strict visible condition. | REVIEW |
| RELIC-06 `oath_fallen.png` | any | P0 | **Клятва павших** — one order point after a voluntary sacrifice, once per round. | REVIEW |
| RELIC-07 `second_wind.png` | named hero | P0 | **Второе дыхание** — one extra action every second round with visible cooldown. | REVIEW |
| RELIC-08 `royal_exchange.png` | king | P0 | **Королевская рокировка** — swap with an ally once if resulting position is legal. | REVIEW |
| RELIC-09 `cursed_trail.png` | rook | P0 | **Проклятый след** — origin cell becomes a visible hostile hazard for one round. | REVIEW |
| RELIC-10 `phoenix_seal.png` | any | P0 | **Печать феникса** — replace one run defeat with a restart of that battle. | REVIEW |
| RELIC-11 `glass_crown.png` | queen | P0 | **Стеклянная корона** — bounded extra tempo but cannot receive wards. | REVIEW |
| RELIC-12 `hearth_blessing.png` | any | P0 | **Благословение очага** — recover one light injury after battle. | REVIEW |
| RELIC-13 `mason_compass.png` | rook | P1 | **Компас каменщика** — rotate one blocking object before battle. | REVIEW |
| RELIC-14 `silver_liturgy.png` | bishop | P1 | **Серебряная литургия** — cleanse one status along a clear diagonal. | REVIEW |
| RELIC-15 `spur_of_dawn.png` | knight | P1 | **Шпора рассвета** — reserve deployment onto one additional marked cell. | REVIEW |
| RELIC-16 `banner_nine.png` | pawn | P1 | **Знамя Девятого дома** — pawn formation earns one order point on objective progress. | REVIEW |
| RELIC-17 `merchants_scale.png` | any | P1 | **Весы купца** — rejected relic converts into a gold-or-supplies choice. | REVIEW |
| RELIC-18 `thorn_key.png` | knight/bishop | P1 | **Терновый ключ** — activate one visible portal without moving through it. | REVIEW |
| RELIC-19 `ash_hourglass.png` | any | P1 | **Пепельные часы** — delay injury recovery for immediate supplies. | REVIEW |
| RELIC-20 `lens_true_line.png` | bishop/rook | P1 | **Линза истинной линии** — reveal an attack line and protect one objective interaction. | REVIEW |
| RELIC-21 `crownless_ring.png` | pawn/knight | P1 | **Кольцо без короны** — stronger while no queen is deployed. | REVIEW |
| RELIC-22 `regents_chain.png` | king | P1 | **Цепь регента** — command gains power but raises its next cost. | REVIEW |
| RELIC-23 `star_map.png` | knight | P1 | **Звёздная карта** — show extra scouting detail on one route. | REVIEW |
| RELIC-24 `quiet_bell.png` | bishop | P1 | **Тихий колокол** — silence one enemy active ability for a visible duration. | REVIEW |
| RELIC-25 `bridge_nail.png` | rook | P1 | **Гвоздь моста** — anchor against forced movement and portals. | REVIEW |
| RELIC-26 `pilgrim_cup.png` | any | P1 | **Чаша паломника** — convert one post-battle gold reward into a healing choice. | REVIEW |
| RELIC-27 `mirror_shard.png` | any | P1 | **Осколок зеркала** — copy one compatible passive for one battle, chosen beforehand. | REVIEW |
| RELIC-28 `black_contract.png` | queen/hero | P1 | **Чёрный контракт** — gain an order action now and a visible event-debt flag. | REVIEW |
| RELIC-29 `saint_thread.png` | pawn | P1 | **Нить святой** — retain one chosen talent through promotion. | REVIEW |
| RELIC-30 `wolf_token.png` | knight | P1 | **Жетон волка** — rescuing an ally resets one reserve cooldown. | REVIEW |
| RELIC-31 `citadel_seed.png` | rook | P1 | **Семя цитадели** — create one temporary blocker in the deployment zone. | REVIEW |
| RELIC-32 `open_book.png` | bishop | P1 | **Открытая книга** — first new environment rule gets expanded preview and a small benefit. | REVIEW |
| RELIC-33 `queen_s_lace.png` | queen | P1 | **Кружево ферзя** — move through one allied square once without changing capture rules. | REVIEW |
| RELIC-34 `last_coin.png` | any | P1 | **Последняя монета** — at zero gold gain one supply, then destroy relic. | REVIEW |
| RELIC-35 `red_wax.png` | king/hero | P1 | **Красный воск** — seal one event consequence from repeating this run. | REVIEW |
| RELIC-36 `feather_court.png` | named hero | P1 | **Перо двора** — personal-event choices create Chronicle memory. | REVIEW |
| RELIC-37 `iron_rosary.png` | bishop | P1 | **Железные чётки** — legal king-check evasions advance a once-per-battle effect. | REVIEW |
| RELIC-38 `broken_lance.png` | knight | P1 | **Сломанное копьё** — after a capture, next move cannot capture but costs no order action. | REVIEW |
| RELIC-39 `foundry_heart.png` | rook | P1 | **Сердце кузни** — ward restores after holding the same file for two rounds. | REVIEW |
| RELIC-40 `diplomat_seal.png` | queen/king | P1 | **Печать дипломата** — unlock one nonviolent event choice per act. | REVIEW |
| RELIC-41 `grave_lantern.png` | pawn/bishop | P1 | **Могильный фонарь** — visibly mark where a fallen ally may return. | REVIEW |
| RELIC-42 `salt_crown.png` | king | P1 | **Соляная корона** — ignore one curse but lose one scouting option. | REVIEW |
| RELIC-43 `wind_knot.png` | knight | P1 | **Узел ветра** — one reserve piece may enter from a side edge. | REVIEW |
| RELIC-44 `amber_eye.png` | rook/bishop | P1 | **Янтарный глаз** — mark one visible enemy at battle start. | REVIEW |
| RELIC-45 `copper_hymn.png` | pawn | P1 | **Медный гимн** — visible formation promotion meter accelerated once. | REVIEW |
| RELIC-46 `veil_cut.png` | queen | P1 | **Разрез завесы** — remove one portal pair or magical-terrain rule before battle. | REVIEW |
| RELIC-47 `stone_debt.png` | any | P1 | **Каменный долг** — repair a heavy injury at the next service node for fixed cost. | REVIEW |
| RELIC-48 `three_keys.png` | any | P1 | **Три ключа** — three optional objectives earn one relic reroll. | REVIEW |
| RELIC-49 `hollow_crown.png` | king | P1 | **Пустая корона** — secret high-risk order with all possible outcomes shown. | REVIEW |
| RELIC-50 `moon_saddle.png` | knight | P1 | **Лунное седло** — landing on a marked cell grants guard until next action. | REVIEW |
| RELIC-51 `scribe_knife.png` | bishop/hero | P1 | **Нож писца** — rewrite one event variable, not the whole result. | REVIEW |
| RELIC-52 `golden_pawn.png` | pawn | P1 | **Золотая пешка** — special scenarios may trade promotion for supplies. | REVIEW |
| RELIC-53 `harbor_chain.png` | rook | P1 | **Портовая цепь** — connect two edge cells as a visible line obstacle. | REVIEW |
| RELIC-54 `oracle_ash.png` | bishop | P1 | **Пепел оракула** — preview one boss-phase rule before entering its node. | REVIEW |
| RELIC-55 `kingmaker_pin.png` | queen/hero | P1 | **Булавка коронатора** — supporting a claimant alters one faction reward pool. | REVIEW |
| RELIC-56 `winter_standard.png` | pawn/rook | P1 | **Зимний штандарт** — hold a zone two turns to create sanctified cells. | REVIEW |
| RELIC-57 `sunken_gem.png` | any | P1 | **Утопленный самоцвет** — spend one supply for an event from a visible shortlist. | REVIEW |
| RELIC-58 `thorn_diadem.png` | king/queen | P1 | **Терновая диадема** — power on corrupted cells with explicit injury risk. | REVIEW |
| RELIC-59 `atlas_fold.png` | any | P1 | **Складка атласа** — reveal one hidden route and lock another. | REVIEW |
| RELIC-60 `bell_founder.png` | rook | P1 | **Колокол основателя** — declare a protected line for one round. | REVIEW |
| RELIC-61 `saint_splinter.png` | bishop | P1 | **Щепа святого** — convert one cursed cell into a sanctified cell. | REVIEW |
| RELIC-62 `horsehair_oath.png` | knight | P1 | **Клятва конского волоса** — after reserve, return with one visible status. | REVIEW |
| RELIC-63 `widow_crown.png` | queen | P1 | **Вдовья корона** — changes after the king command is spent; no raw damage bonus. | REVIEW |
| RELIC-64 `black_seed.png` | pawn | P1 | **Чёрное семя** — unlock one deterministic alternative promotion. | REVIEW |
| RELIC-65 `parliament_key.png` | hero/queen | P1 | **Ключ парламента** — political choices expose one extra consequence clue. | REVIEW |
| RELIC-66 `furnace_map.png` | rook | P1 | **Карта горнов** — reduce service cost after Iron Marches victories. | REVIEW |
| RELIC-67 `sky_braid.png` | knight | P1 | **Небесная коса** — chain one non-capture move with a bounded reserve call. | REVIEW |
| RELIC-68 `choir_mask.png` | any | P1 | **Маска хора** — changes event voice, never hidden rules. | REVIEW |
| RELIC-69 `mirror_weight.png` | rook/queen | P1 | **Зеркальная гиря** — reflect one forced displacement if destination is legal. | REVIEW |
| RELIC-70 `first_crown.png` | king | P1 | **Первая корона** — final-act relic opening one ending option at meaningful cost. | REVIEW |
| RELIC-71 `world_stitch.png` | any | P1 | **Шов мира** — repair one reality-fracture objective and consume relic permanently. | REVIEW |
| RELIC-72 `last_archive.png` | hero | P1 | **Последний архив** — preserve one hero memory and unlock a Chronicle cosmetic. | REVIEW |

## Release gate

- exactly one relic is assigned to a compatible figure immediately on acquisition, or replaced/refused with compensation;
- no shared in-run relic inventory;
- current twelve prototype global artifacts must be redesigned or retired, not silently counted twice;
- every effect has deterministic command/event tests and clear UI preview;
- all 72 visual records are present at `REVIEW`; gameplay/mechanics approval remains independent;
- all 72 records reach `APPROVED` for the recommended release target; at minimum 50 must be approved before the content minimum is met.
