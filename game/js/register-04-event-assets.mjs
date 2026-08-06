const REGISTER_04_EVENT_ROOT = 'assets/events/register-04';

const EVENT_FILE_BY_ID = Object.freeze({
  'event.ship_of_empty_names': 'ship_of_empty_names.png',
  'event.votes_at_midnight': 'votes_at_midnight.png',
  'event.counterfeit_hero': 'counterfeit_hero.png',
  'event.contract_three_seals': 'contract_three_seals.png',
  'event.last_honest_oracle': 'last_honest_oracle.png',
  'event.auction_of_a_crown': 'auction_of_a_crown.png',
  'event.unlit_altar': 'unlit_altar.png',
  'event.choirs_equation': 'choirs_equation.png',
  'event.broken_reliquary': 'broken_reliquary.png',
  'event.sleeping_observatory': 'sleeping_observatory.png',
  'event.missing_star_chart': 'missing_star_chart.png',
  'event.trial_blue_glass': 'trial_blue_glass.png',
  'event.heretics_margin': 'heretics_margin.png',
  'event.disputed_standard': 'disputed_standard.png',
  'event.furnace_oath': 'furnace_oath.png',
  'event.duel_masons': 'duel_of_masons.png',
  'event.duel_of_masons': 'duel_of_masons.png',
  'event.prisoners_pass': 'prisoners_of_the_pass.png',
  'event.prisoners_of_the_pass': 'prisoners_of_the_pass.png',
  'event.empty_armory': 'empty_armory.png',
  'event.cracked_bell': 'cracked_bell.png',
  'event.miners_on_strike': 'miners_on_strike.png'
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
  EVENT_FILE_BY_ID,
  normalizeEventId,
  register04EventAsset,
  hasRegister04EventAsset
};
