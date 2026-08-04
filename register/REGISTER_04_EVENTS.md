# REGISTER 04 — AUTHORED EVENTS

Part of `CONTENT_AND_ASSET_PRODUCTION_REGISTER.md`.

## Event production profile

Each listed event is a distinct authored record, not a numerical/color variation.

**File:** exact path shown by series pattern. UTF-8 YAML/JSON validated by the event schema.  
**Required fields:** stable ID, schema version, RU/EN title/body/choices, 3–4 choices, conditions, weights, repeat limits, incompatibilities, deterministic variables, costs, validated effects, flags, scene-art reference, Chronicle consequence hooks and test cases.  
**Art:** use an approved regional/generic 1600×900 scene; create a unique illustration only where the story cannot be represented by an existing approved scene.  
**Ready-to-use writing prompt:** “Write the RPChess event **[TITLE]** ([CATEGORY], scope [SCOPE]) in heroic dark fantasy. Create a morally meaningful dilemma tied to kingdom, army, faction politics or hero memory. Supply 3–4 choices with clear immediate wording while not revealing every long-term consequence. Use only validated deterministic effects, include conditions, weights, repeat/incompatibility rules, flags, RU/EN localization keys and a concise scene-art brief. No runtime LLM, false choice, number-only variant, hidden rule change or deliberately misleading wording.”  
**Acceptance:** schema and references pass; all choices reachable and meaningful; costs visible; no invalid roster/economy state; deterministic fixed-seed test; RU/EN editorial review; no more than declared repetition; consequences represented in Chronicle where relevant.

## Exact release register — 140 events

### Iron Marches — `EVENT-001`…`012`

Files `content/events/iron_marches_01.yaml`…`iron_marches_12.yaml`. P0 vertical slice: all 12.

1. The Silent Foundry
2. The Wall Without a Gate
3. Miners on Strike
4. The Regent’s Tax
5. A Cracked Bell
6. The Ninth Bastion
7. Prisoners of the Pass
8. The Empty Armory
9. A Duel of Masons
10. The Furnace Oath
11. Snow over Black Iron
12. The Disputed Standard

### Luminous Synod — `EVENT-013`…`024`

Files `content/events/azure_synod_01.yaml`…`azure_synod_12.yaml`. `013–016` P0; remainder P1.

1. The Missing Star Chart
2. Trial of the Blue Glass
3. A Heretic’s Margin
4. The Sleeping Observatory
5. Pilgrims at the Diagonal
6. The Broken Reliquary
7. The Choir’s Equation
8. Mercy for the Excommunicated
9. The Astronomer’s Debt
10. The Unlit Altar
11. Ink in the Holy Water
12. The Last Honest Oracle

### Free Cities — `EVENT-025`…`036`

Files `content/events/veyra_free_cities_01.yaml`…`veyra_free_cities_12.yaml`, P1.

1. Auction of a Crown
2. The Canal Blockade
3. A Contract in Three Seals
4. The Counterfeit Hero
5. Harbor Without Tides
6. The Guild Widow
7. Votes at Midnight
8. The Price of Neutrality
9. The Silk Riot
10. A Ship of Empty Names
11. The Banker’s Hostage
12. The Bridge Toll

### Thorn Covenant — `EVENT-037`…`048`

Files `content/events/thorn_covenant_01.yaml`…`thorn_covenant_12.yaml`, P1.

1. The Tree That Remembers
2. A Knight Lost Between Gates
3. The Thorn Wedding
4. The Huntsman’s Apology
5. Roots under the Road
6. The Fae Hostage
7. A Crown of Antlers
8. The Burned Grove
9. The Moss Tribunal
10. The Door in the Oak
11. Wolves at the Shrine
12. The Seed of a Dead King

### Ashen Dominion — `EVENT-049`…`060`

Files `content/events/ashen_dominion_01.yaml`…`ashen_dominion_12.yaml`, P1.

1. Ashes of the First Legion
2. The Funeral Tax
3. A Child of the Pyre
4. The Emperor’s Empty Urn
5. Bread for the Cinder Guard
6. The Volcanic Pilgrims
7. A General Who Refuses Death
8. The Red Succession
9. The Unburned Letter
10. The Debt of Sacrifice
11. Rain on the Ash Road
12. The Last Coal

### Sky Khanate — `EVENT-061`…`072`

Files `content/events/sky_khanate_01.yaml`…`sky_khanate_12.yaml`, P1.

1. The Fallen Sky Banner
2. A Horse Without a Rider
3. The Cliff Parliament
4. Storm over the Caravan
5. The Bronze Eagle
6. A Marriage of Winds
7. The Lost Summer Camp
8. The Khan’s Younger Sister
9. The Broken Saddle Oath
10. The Road Above Clouds
11. An Envoy in Chains
12. The Star Herd

### Generic travel/kingdom events — `EVENT-073`…`092`

Files `content/events/generic_01.yaml`…`generic_20.yaml`, P1.

1. The Abandoned Chess Hall
2. Three Roads at Dawn
3. The Veteran’s Map
4. A Shrine to No King
5. The Hungry Company
6. The Honest Bandit
7. A Village under Check
8. The Unfinished Monument
9. The Traveling Infirmary
10. A Merchant of Scars
11. The Empty Throne Cart
12. The Rain Collector
13. A Child’s Wooden Queen
14. The Bridge of Names
15. The Last Good Horse
16. The Refugee Council
17. The Broken Crownsmith
18. A Feast before Battle
19. The Silent Deserters
20. The Cartographer’s Gamble

### Cross-faction political events — `EVENT-093`…`122`

Files `content/events/political_01.yaml`…`political_30.yaml`, P1.

1. Council of Six Empty Chairs
2. The Pretender’s Envoy
3. A Treaty Written in Ash
4. The Hostage Exchange
5. The Uncrowned Vote
6. A General Requests Immunity
7. The Temple Demands a King
8. The Merchants Demand Peace
9. The Border Lord Defects
10. The Heir’s Secret Letter
11. A Trial of Treason
12. The Regent’s Last Offer
13. A Marriage Proposal
14. A City Requests Protection
15. The Price of Recognition
16. A Crown in Escrow
17. The Neutral Ambassador
18. A Funeral without a Body
19. The Rebel’s Amnesty
20. The Oath before Witnesses
21. The Failed Assassination
22. The Refugee Claimant
23. The Divided Army
24. The People’s Petition
25. The Usurper’s Evidence
26. The Closed Embassy
27. The Broken Alliance
28. A Seat at the Final Council
29. The Old King’s Testament
30. The Banner of Surrender

### Named-hero personal events — `EVENT-123`…`132`

Files `content/events/hero_01.yaml`…`hero_10.yaml`, P1; each requires the named hero and must create persistent hero/Chronicle consequences.

1. Aldric’s Unfinished Wall
2. Lyra’s Forbidden Hymn
3. Viola Removes the Mask
4. Roan Returns to the Grove
5. Nahla’s Private Debt
6. Temur’s Last Race
7. Mara Names the Dead
8. Ivar Breaks the Lens
9. Tessa’s Smuggled Passenger
10. Velka Opens the Urn

### Rare/secret events — `EVENT-133`…`140`

Files `content/events/secret_01.yaml`…`secret_08.yaml`, P1; strict unlock conditions, maximum once per run, no mandatory online service.

1. The Mirror Speaks First
2. The Board Beyond the Board
3. A Seventh Throne
4. The Hollow Choir Rehearses
5. The Move That Never Happened
6. A Pawn with Your Face
7. The Door behind the Victory
8. The World’s Missing Square

## Distribution and quality gates

- 72 regional events: twelve per main region;
- 20 generic events;
- 30 political events;
- 10 hero events;
- 8 secret events;
- at least 100 complete records are mandatory; all 140 are the recommended release target;
- no event counts as complete from a title alone;
- each event receives content ID, exact file, RU/EN copy, validated effects, automated condition/reference tests and editorial sign-off;
- current four prototype events are treated as rewrite candidates and may replace four matching records only after full schema/editorial acceptance.
