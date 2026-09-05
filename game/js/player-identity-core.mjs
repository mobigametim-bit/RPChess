const PLAYER_NAME_MAX_LENGTH = 24;
const LEGACY_PLAYER_NAME = 'Воин';

function normalizePlayerName(value, fallback = '') {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX_LENGTH);
  return normalized || fallback;
}

function playerNameForRun(run) {
  return normalizePlayerName(run?.playerName, LEGACY_PLAYER_NAME);
}

const DIRECT_OBJECT_PATTERNS = Object.freeze([
  /встречают Короля/g,
  /встретить Короля/g,
  /просит Короля/g,
  /просят Короля/g,
  /попросить Короля/g,
  /видит Короля/g,
  /видят Короля/g,
  /увидев Короля/g,
  /замечает Короля/g,
  /замечают Короля/g,
  /приветствует Короля/g,
  /приветствуют Короля/g,
  /останавливает Короля/g,
  /останавливают Короля/g,
  /окликает Короля/g,
  /окликают Короля/g,
  /зовёт Короля/g,
  /зовет Короля/g,
  /вызывает Короля/g,
  /вызывают Короля/g
]);

const OBJECT_FIRST_VERBS = 'встречают|встречает|просит|просят|видит|видят|замечает|замечают|приветствует|приветствуют|останавливает|останавливают|окликает|окликают|зовёт|зовет|зовут|вызывает|вызывают';
const DATIVE_PATTERNS = Object.freeze([
  /говорит Королю/g,
  /говорят Королю/g,
  /отвечает Королю/g,
  /отвечают Королю/g,
  /передаёт Королю/g,
  /передает Королю/g,
  /передают Королю/g,
  /показывает Королю/g,
  /показывают Королю/g,
  /предлагает Королю/g,
  /предлагают Королю/g,
  /советует Королю/g,
  /советуют Королю/g
]);

function personalizeEnglishKing(value, name) {
  return String(value)
    .replace(/\bthe King\b/g, name)
    .replace(/\bThe King\b/g, name)
    .replace(/\bKing\b/g, name);
}

function personalizePlayerNarrative(value, playerName) {
  const name = normalizePlayerName(playerName, LEGACY_PLAYER_NAME);
  if (typeof value !== 'string' || !value) return value;
  let text = value;

  // Russian Cyrillic does not participate in JavaScript's ASCII-oriented \b/\w boundary semantics,
  // so these intentionally use exact case-sensitive phrases rather than \b-based patterns.
  text = text
    .replace(/к Королю/g, 'к вам')
    .replace(/у Короля/g, 'у вас')
    .replace(/для Короля/g, 'для вас')
    .replace(/от Короля/g, 'от вас')
    .replace(/о Короле/g, 'о вас')
    .replace(/про Короля/g, 'про вас')
    .replace(/с Королём/g, 'с вами')
    .replace(/с Королем/g, 'с вами')
    .replace(/перед Королём/g, 'перед вами')
    .replace(/перед Королем/g, 'перед вами')
    .replace(/за Королём/g, 'за вами')
    .replace(/за Королем/g, 'за вами')
    .replace(new RegExp(`Короля (?=${OBJECT_FIRST_VERBS}(?:[\\s.,!?…]|$))`, 'g'), 'вас ');

  for (const pattern of DIRECT_OBJECT_PATTERNS) {
    text = text.replace(pattern, (match) => match.replace('Короля', 'вас'));
  }
  for (const pattern of DATIVE_PATTERNS) {
    text = text.replace(pattern, (match) => match.replace('Королю', 'вам'));
  }

  // Case-sensitive protagonist replacements intentionally leave uppercase system `КОРОЛЬ` intact.
  text = text.replace(/Король/g, name);
  return personalizeEnglishKing(text, name);
}

function personalizePlayerTitle(value, playerName) {
  const name = normalizePlayerName(playerName, LEGACY_PLAYER_NAME);
  if (typeof value !== 'string') return value;
  return personalizeEnglishKing(value.replace(/Король/g, name), name);
}

export {
  PLAYER_NAME_MAX_LENGTH,
  LEGACY_PLAYER_NAME,
  normalizePlayerName,
  playerNameForRun,
  personalizePlayerNarrative,
  personalizePlayerTitle
};
