const REGISTER_04_EVENT_ROOT = 'assets/events/register-04';
const REGISTER_04_UNIQUE_ASSET_COUNT = 74;

const EVENT_FILE_BY_ID = Object.freeze({
  "event.abandoned_chess_hall": "generic/abandoned_chess_hall.png",
  "event.aldrics_unfinished_wall": "heroes/aldrics_unfinished_wall.png",
  "event.auction_of_a_crown": "auction_of_a_crown.png",
  "event.banner_of_surrender": "political/banner_of_surrender.png",
  "event.board_beyond_board": "secret/board_beyond_board.png",
  "event.board_beyond_the_board": "secret/board_beyond_board.png",
  "event.broken_crownsmith": "generic/broken_crownsmith.png",
  "event.broken_reliquary": "broken_reliquary.png",
  "event.choirs_equation": "choirs_equation.png",
  "event.city_requests_protection": "political/city_requests_protection.png",
  "event.cliff_parliament": "sky_khanate/cliff_parliament.png",
  "event.contract_in_three_seals": "contract_three_seals.png",
  "event.contract_three_seals": "contract_three_seals.png",
  "event.council_of_six_empty_chairs": "political/council_six_empty_chairs.png",
  "event.council_six_empty_chairs": "political/council_six_empty_chairs.png",
  "event.counterfeit_hero": "counterfeit_hero.png",
  "event.cracked_bell": "cracked_bell.png",
  "event.crown_in_escrow": "political/crown_in_escrow.png",
  "event.disputed_standard": "disputed_standard.png",
  "event.divided_army": "political/divided_army.png",
  "event.door_behind_the_victory": "secret/door_behind_victory.png",
  "event.door_behind_victory": "secret/door_behind_victory.png",
  "event.duel_masons": "duel_of_masons.png",
  "event.duel_of_masons": "duel_of_masons.png",
  "event.emperors_empty_urn": "ashen_dominion/emperors_empty_urn.png",
  "event.empty_armory": "empty_armory.png",
  "event.failed_assassination": "political/failed_assassination.png",
  "event.fallen_sky_banner": "sky_khanate/fallen_sky_banner.png",
  "event.funeral_without_a_body": "political/funeral_without_body.png",
  "event.funeral_without_body": "political/funeral_without_body.png",
  "event.furnace_oath": "furnace_oath.png",
  "event.general_refuses_death": "ashen_dominion/general_refuses_death.png",
  "event.general_who_refuses_death": "ashen_dominion/general_refuses_death.png",
  "event.heretics_margin": "heretics_margin.png",
  "event.hollow_choir_rehearses": "secret/hollow_choir_rehearses.png",
  "event.honest_bandit": "generic/honest_bandit.png",
  "event.horse_without_a_rider": "sky_khanate/horse_without_rider.png",
  "event.horse_without_rider": "sky_khanate/horse_without_rider.png",
  "event.hostage_exchange": "political/hostage_exchange.png",
  "event.hungry_company": "generic/hungry_company.png",
  "event.ivar_breaks_the_lens": "heroes/ivar_breaks_the_lens.png",
  "event.knight_between_gates": "thorn_covenant/knight_between_gates.png",
  "event.knight_lost_between_gates": "thorn_covenant/knight_between_gates.png",
  "event.last_honest_oracle": "last_honest_oracle.png",
  "event.lyras_forbidden_hymn": "heroes/lyras_forbidden_hymn.png",
  "event.mara_names_the_dead": "heroes/mara_names_the_dead.png",
  "event.miners_on_strike": "miners_on_strike.png",
  "event.mirror_speaks_first": "secret/mirror_speaks_first.png",
  "event.missing_star_chart": "missing_star_chart.png",
  "event.moss_tribunal": "thorn_covenant/moss_tribunal.png",
  "event.move_never_happened": "secret/move_never_happened.png",
  "event.move_that_never_happened": "secret/move_never_happened.png",
  "event.nahlas_private_debt": "heroes/nahlas_private_debt.png",
  "event.neutral_ambassador": "political/neutral_ambassador.png",
  "event.pawn_with_your_face": "secret/pawn_with_your_face.png",
  "event.peoples_petition": "political/peoples_petition.png",
  "event.price_of_recognition": "political/price_of_recognition.png",
  "event.prisoners_of_the_pass": "prisoners_of_the_pass.png",
  "event.prisoners_pass": "prisoners_of_the_pass.png",
  "event.rebels_amnesty": "political/rebels_amnesty.png",
  "event.red_succession": "ashen_dominion/red_succession.png",
  "event.refugee_council": "generic/refugee_council.png",
  "event.roan_returns_to_the_grove": "heroes/roan_returns_to_the_grove.png",
  "event.seed_dead_king": "thorn_covenant/seed_dead_king.png",
  "event.seed_of_a_dead_king": "thorn_covenant/seed_dead_king.png",
  "event.seventh_throne": "secret/seventh_throne.png",
  "event.ship_of_empty_names": "ship_of_empty_names.png",
  "event.shrine_to_no_king": "generic/shrine_to_no_king.png",
  "event.sleeping_observatory": "sleeping_observatory.png",
  "event.storm_over_caravan": "sky_khanate/storm_over_caravan.png",
  "event.storm_over_the_caravan": "sky_khanate/storm_over_caravan.png",
  "event.temurs_last_race": "heroes/temurs_last_race.png",
  "event.tessas_smuggled_passenger": "heroes/tessas_smuggled_passenger.png",
  "event.thorn_wedding": "thorn_covenant/thorn_wedding.png",
  "event.three_roads_at_dawn": "generic/three_roads_at_dawn.png",
  "event.treaty_written_in_ash": "political/treaty_written_in_ash.png",
  "event.tree_that_remembers": "thorn_covenant/tree_that_remembers.png",
  "event.trial_blue_glass": "trial_blue_glass.png",
  "event.trial_of_treason": "political/trial_of_treason.png",
  "event.unburned_letter": "ashen_dominion/unburned_letter.png",
  "event.unlit_altar": "unlit_altar.png",
  "event.velka_opens_the_urn": "heroes/velka_opens_the_urn.png",
  "event.veterans_map": "generic/veterans_map.png",
  "event.village_under_check": "generic/village_under_check.png",
  "event.viola_removes_the_mask": "heroes/viola_removes_the_mask.png",
  "event.votes_at_midnight": "votes_at_midnight.png",
  "event.worlds_missing_square": "secret/worlds_missing_square.png",
});

function normalizeEventId(value) {
  const raw = String(value || '');
  if (!raw) return null;
  return raw.startsWith('event.') ? raw : `event.${raw.replace(/\.png$/i, '')}`;
}

function register04EventAsset(eventId, fallback = 'generated_assets/scene_event.jpg') {
  const normalized = normalizeEventId(eventId);
  const file = normalized ? EVENT_FILE_BY_ID[normalized] : null;
  return file ? `${REGISTER_04_EVENT_ROOT}/${file}` : fallback;
}

function hasRegister04EventAsset(eventId) {
  const normalized = normalizeEventId(eventId);
  return Boolean(normalized && EVENT_FILE_BY_ID[normalized]);
}

export {
  REGISTER_04_EVENT_ROOT,
  REGISTER_04_UNIQUE_ASSET_COUNT,
  EVENT_FILE_BY_ID,
  normalizeEventId,
  register04EventAsset,
  hasRegister04EventAsset
};
