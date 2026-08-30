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
  /\bвстречают Короля\b/g,
  /\bвстретить Короля\b/g,
  /\bпросит Короля\b/g,
  /\bпросят Короля\b/g,
  /\bпопросить Короля\b/g,
  /\bвидит Короля\b/g,
  /\bвидят Короля\b/g,
  /\bувидев Короля\b/g,
  /\bзамечает Короля\b/g,
  /\bзамечают Короля\b/g,
  /\bприветствует Короля\b/g,
  /\bприветствуют Короля\b/g,
  /\bостанавливает Короля\b/g,
  /\bостанавливают Короля\b/g,
  /\bокликает Короля\b/g,
  /\bокликают Короля\b/g,
  /\bзовёт Короля\b/g,
  /\bзовет Короля\b/g,
  /\bвызывает Короля\b/g,
  /\bвызывают Короля\b/g
]);

const DATIVE_PATTERNS = Object.freeze([
  /\bговорит Королю\b/g,
  /\bговорят Королю\b/g,
  /\bотвечает Королю\b/g,
  /\bотвечают Королю\b/g,
  /\bпередаёт Королю\b/g,
  /\bпередает Королю\b/g,
  /\bпередают Королю\b/g,
  /\bпоказывает Королю\b/g,
  /\bпоказывают Королю\b/g,
  /\bпредлагает Королю\b/g,
  /\bпредлагают Королю\b/g,
  /\bсоветует Королю\b/g,
  /\bсоветуют Королю\b/g
]);

function personalizePlayerNarrative(value, playerName) {
  const name = normalizePlayerName(playerName, LEGACY_PLAYER_NAME);
  if (typeof value !== 'string' || !value) return value;
  let text = value;

  // Oblique forms are only rewritten in grammatical contexts that stay correct for any player name.
  text = text
    .replace(/\bк Королю\b/g, 'к вам')
    .replace(/\bу Короля\b/g, 'у вас')
    .replace(/\bдля Короля\b/g, 'для вас')
    .replace(/\bот Короля\b/g, 'от вас')
    .replace(/\bо Короле\b/g, 'о вас')
    .replace(/\bпро Короля\b/g, 'про вас')
    .replace(/\bс Королём\b/g, 'с вами')
    .replace(/\bс Королем\b/g, 'с вами')
    .replace(/\bперед Королём\b/g, 'перед вами')
    .replace(/\bперед Королем\b/g, 'перед вами')
    .replace(/\bза Королём\b/g, 'за вами')
    .replace(/\bза Королем\b/g, 'за вами');

  for (const pattern of DIRECT_OBJECT_PATTERNS) {
    text = text.replace(pattern, (match) => match.replace('Короля', 'вас'));
  }
  for (const pattern of DATIVE_PATTERNS) {
    text = text.replace(pattern, (match) => match.replace('Королю', 'вам'));
  }

  // Nominative references identify the protagonist directly and can always use the entered name safely.
  return text.replace(/\bКороль\b/g, name);
}

function personalizePlayerTitle(value, playerName) {
  const name = normalizePlayerName(playerName, LEGACY_PLAYER_NAME);
  return typeof value === 'string' ? value.replace(/\bКороль\b/g, name) : value;
}

export {
  PLAYER_NAME_MAX_LENGTH,
  LEGACY_PLAYER_NAME,
  normalizePlayerName,
  playerNameForRun,
  personalizePlayerNarrative,
  personalizePlayerTitle
};
