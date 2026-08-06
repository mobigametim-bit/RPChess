'use strict';

const REGISTER_04_EVENT_ROOT = 'assets/events/register-04';
const EVENT_FILE_BY_ID = Object.freeze({
  'event.disputed_standard': 'disputed_standard.png',
  'event.furnace_oath': 'furnace_oath.png',
  'event.duel_masons': 'duel_of_masons.png',
  'event.prisoners_pass': 'prisoners_of_the_pass.png',
  'event.empty_armory': 'empty_armory.png',
  'event.cracked_bell': 'cracked_bell.png',
  'event.miners_on_strike': 'miners_on_strike.png'
});

function register04EventAsset(eventId, fallback = null) {
  const file = EVENT_FILE_BY_ID[eventId] || null;
  return file ? `${REGISTER_04_EVENT_ROOT}/${file}` : fallback;
}

function bindRegister04EventArt(packInput) {
  const pack = JSON.parse(JSON.stringify(packInput));
  pack.content.events = (pack.content?.events || []).map((event) => ({
    ...event,
    sceneArt: register04EventAsset(event.id, event.sceneArt || null)
  }));
  return Object.freeze(pack);
}

module.exports = {
  REGISTER_04_EVENT_ROOT,
  EVENT_FILE_BY_ID,
  register04EventAsset,
  bindRegister04EventArt
};
