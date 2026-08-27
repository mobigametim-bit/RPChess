const PIECE_VALUES = Object.freeze({ pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 });
const PIECE_LABELS = Object.freeze({ pawn: 'Пешка', knight: 'Конь', bishop: 'Слон', rook: 'Ладья', queen: 'Ферзь', king: 'Король' });
const PIECE_GLYPHS = Object.freeze({ pawn: '♙', knight: '♘', bishop: '♗', rook: '♖', queen: '♕', king: '♔' });
const STATUS_LABELS = Object.freeze({ healthy: 'ЗДОРОВ', wounded: 'ТЯЖЕЛО РАНЕН', dead: 'ПОГИБ' });

const STARTER_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'king.oathkeeper',
    name: 'Хранитель Клятвы',
    pieceType: 'king',
    origin: 'Железные Марши',
    portrait: 'assets/kings/oathkeeper/portrait.png',
    pieceArt: 'assets/kings/oathkeeper/piece.png',
    description: 'Последний хранитель древней присяги Железных Маршей. После падения родовой крепости он покинул её стены и собрал вокруг себя тех, кто ещё верит, что данное слово важнее трона.',
    isRunKing: true
  }),
  Object.freeze({
    id: 'hero.aldric_wall',
    name: 'Альдрик Стена',
    pieceType: 'rook',
    origin: 'Железные Марши',
    portrait: 'assets/heroes/aldric_wall/portrait.png',
    pieceArt: 'assets/heroes/aldric_wall/piece_badge.png',
    description: 'Ветеран пограничных гарнизонов, привыкший держать линию до последнего.'
  }),
  Object.freeze({
    id: 'hero.mara_chain',
    name: 'Мара Цепь',
    pieceType: 'pawn',
    origin: 'Железные Марши',
    portrait: 'assets/heroes/mara_chain/portrait.png',
    pieceArt: 'assets/heroes/mara_chain/piece_badge.png',
    description: 'Упрямая воительница из низших рядов, для которой каждый шаг вперёд имеет цену.'
  }),
  Object.freeze({
    id: 'hero.nemea_quill',
    name: 'Немея Перо',
    pieceType: 'pawn',
    origin: 'Светлый Синод',
    portrait: 'assets/heroes/nemea_quill/portrait.png',
    pieceArt: 'assets/heroes/nemea_quill/piece_badge.png',
    description: 'Учёная-путешественница, присоединившаяся к отряду ради истории, которую ещё предстоит написать.'
  }),
  Object.freeze({
    id: 'hero.brother_orell',
    name: 'Брат Орелл',
    pieceType: 'bishop',
    origin: 'Железные Марши',
    portrait: 'assets/heroes/brother_orell/portrait.png',
    pieceArt: 'assets/heroes/brother_orell/piece_badge.png',
    description: 'Жрец-кузнец, читающий поле боя так же внимательно, как линии на раскалённом металле.'
  }),
  Object.freeze({
    id: 'hero.vael_hammer',
    name: 'Ваэль Молот',
    pieceType: 'knight',
    origin: 'Железные Марши',
    portrait: 'assets/heroes/vael_hammer/portrait.png',
    pieceArt: 'assets/heroes/vael_hammer/piece_badge.png',
    description: 'Тяжёлый всадник, предпочитающий решительный манёвр долгому ожиданию.'
  })
]);

function normalizeCharacter(template) {
  return {
    id: template.id,
    name: template.name,
    pieceType: template.pieceType,
    origin: template.origin,
    portrait: template.portrait,
    pieceArt: template.pieceArt,
    description: template.description,
    isRunKing: Boolean(template.isRunKing),
    commandCost: PIECE_VALUES[template.pieceType] ?? 0,
    status: 'healthy'
  };
}

function createStarterRoster() {
  return STARTER_TEMPLATES.map(normalizeCharacter);
}

function rosterMaterialTotal(roster) {
  return (roster || []).reduce((sum, character) => sum + (PIECE_VALUES[character.pieceType] ?? 0), 0);
}

export { PIECE_VALUES, PIECE_LABELS, PIECE_GLYPHS, STATUS_LABELS, STARTER_TEMPLATES, createStarterRoster, rosterMaterialTotal };
