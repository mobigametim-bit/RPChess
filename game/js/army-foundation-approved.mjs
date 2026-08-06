import { heroAssets } from './register-02-assets.mjs';

const PIECE_GLYPHS = Object.freeze({ k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' });
const LABEL_TO_TYPE = Object.freeze({ Король: 'k', Ферзь: 'q', Ладья: 'r', Слон: 'b', Конь: 'n', Пешка: 'p' });
const FILE_TO_TYPE = Object.freeze({ king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' });
const REGULAR_COPY = Object.freeze({
  r: Object.freeze({ title: 'Щитоносец', description: 'Передовой боец для удержания клетки и прикрытия короля.' }),
  b: Object.freeze({ title: 'Рунный адепт', description: 'Гибкий поддерживающий воин, помогающий контролировать темп боя.' }),
  n: Object.freeze({ title: 'Берсерк прорыва', description: 'Рискованный, но сильный выбор для резкого давления по флангу.' }),
  p: Object.freeze({ title: 'Страж строя', description: 'Надёжная обычная фигура для укрепления линии и размена.' })
});
const HERO_COPY = Object.freeze({
  'hero.aldric_wall': 'Стартовый защитник с мощным удержанием линии и высоким запасом прочности.',
  'hero.brother_orell': 'Рунный мастер поддержки. Усиливает союзников и стабилизирует построение.',
  'hero.mara_chain': 'Маневренный лидер давления, открывающий агрессивные тактические линии.',
  'hero.vael_hammer': 'Тяжёлый всадник, заранее показывающий последствия решительного натиска.',
  'hero.lady_sorn': 'Политический тактик, связывающий противника обязательствами и последствиями.',
  'hero.tomas_gate': 'Командир прорыва, меняющий геометрию поля и направление линии фронта.'
});
const TYPE_COPY = Object.freeze({
  k: 'Королевская фигура, определяющая условия победы и поражения.',
  q: 'Универсальный герой с широким контролем поля.',
  r: 'Защитник линии с высокой устойчивостью.',
  b: 'Герой поддержки и контроля диагоналей.',
  n: 'Маневренный герой для неожиданных атак.',
  p: 'Лидер строя, усиливающий давление обычных фигур.'
});

function roman(value) {
  const number = Math.max(1, Number(value) || 1);
  const numerals = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let remaining = number;
  let result = '';
  for (const [unit, symbol] of numerals) while (remaining >= unit) { result += symbol; remaining -= unit; }
  return result;
}

function pieceType(button) {
  const label = button.querySelector('p')?.textContent?.trim();
  if (LABEL_TO_TYPE[label]) return LABEL_TO_TYPE[label];
  const regularMatch = button.dataset.draftRegular?.match(/:([pnbrqk]):/);
  if (regularMatch) return regularMatch[1];
  const imageMatch = button.querySelector('img')?.getAttribute('src')?.match(/unit_(pawn|knight|bishop|rook|queen|king)_player/i);
  return FILE_TO_TYPE[imageMatch?.[1]?.toLowerCase()] || 'p';
}

function element(document, tag, className, text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

function rebuildCard(button, kind) {
  const document = button.ownerDocument;
  const type = pieceType(button);
  const glyph = PIECE_GLYPHS[type] || '?';
  const originalName = button.querySelector('h3')?.textContent?.trim() || 'Неизвестная фигура';
  const originalImage = button.querySelector('img')?.getAttribute('src') || 'generated_assets/unit_pawn_player.png';
  const originalCost = Number(button.querySelector('p')?.textContent?.match(/\d+/)?.[0] || 0);
  const heroId = button.dataset.draftHero || null;
  const heroArt = heroId ? heroAssets(heroId)?.portrait : null;
  const regular = REGULAR_COPY[type] || REGULAR_COPY.p;

  button.classList.add('rpb-draft-card', `rpb-draft-card--${kind}`);
  button.setAttribute('aria-label', `${kind === 'hero' ? 'Именной герой' : 'Пополнение'}: ${kind === 'hero' ? originalName : regular.title}`);
  button.replaceChildren();

  const image = element(document, 'img', 'rpb-draft-card__art');
  image.src = kind === 'hero' && heroArt ? heroArt : originalImage;
  image.alt = '';
  image.loading = 'eager';
  button.append(image);

  const body = element(document, 'span', 'rpb-draft-card__body');
  body.append(element(document, 'small', 'rpb-draft-card__eyebrow', kind === 'hero' ? 'ИМЕННОЙ ГЕРОЙ' : 'ПОПОЛНЕНИЕ'));
  body.append(element(document, 'strong', 'rpb-draft-card__title', kind === 'hero' ? originalName : regular.title));

  const description = kind === 'hero' ? (HERO_COPY[heroId] || TYPE_COPY[type]) : regular.description;
  body.append(element(document, 'span', 'rpb-draft-card__description', description));
  if (kind === 'regular') body.append(element(document, 'span', 'rpb-draft-card__cost', `Командование ${originalCost}`));
  button.append(body);
  button.append(element(document, 'span', 'rpb-draft-card__glyph', glyph));
}

function resourceValue(chips, label) {
  const chip = chips.find((item) => item.textContent?.toLowerCase().includes(label));
  return chip?.textContent?.match(/-?\d+/)?.[0] || '0';
}

function resourceChip(document, icon, label, value) {
  const node = element(document, 'span', 'rpvs__chip rpb-resource-chip');
  node.setAttribute('aria-label', `${label}: ${value}`);
  const image = element(document, 'img');
  image.src = icon;
  image.alt = '';
  node.append(image, element(document, 'strong', null, value));
  return node;
}

function rebuildTopbar(stage) {
  const shell = stage.closest('.rpvs');
  const topbar = shell?.querySelector('.rpvs__top');
  if (!shell || !topbar || topbar.dataset.armyFoundationApproved === 'true') return;
  topbar.dataset.armyFoundationApproved = 'true';
  shell.classList.add('rpvs--army-foundation');

  const identity = topbar.querySelector('.rpvs__identity');
  const campaignText = identity?.querySelector('.rpvs__muted')?.textContent || 'Железные Марши · Акт 1';
  const act = campaignText.match(/Акт\s+(\d+)/i)?.[1] || '1';
  if (identity) {
    identity.replaceChildren();
    const wordmark = element(identity.ownerDocument, 'img', 'rpb-topbar__wordmark');
    wordmark.src = 'generated_assets/title_wordmark.png';
    wordmark.alt = 'RPChess';
    identity.append(wordmark, element(identity.ownerDocument, 'span', 'rpb-topbar__act', `Железные марши Акт ${roman(act)}`));
  }

  const resources = topbar.querySelector('.rpvs__resources');
  if (!resources) return;
  const document = resources.ownerDocument;
  const oldChips = [...resources.querySelectorAll('.rpvs__chip')];
  const gold = resourceValue(oldChips, 'золото');
  const supplies = resourceValue(oldChips, 'припас');
  const meta = resourceValue(oldChips, 'мета');
  const menu = element(document, 'button', 'rpvs__chip rpb-resource-chip rpb-resource-chip--menu');
  menu.type = 'button';
  menu.dataset.runtimeMenu = '';
  menu.setAttribute('aria-label', 'Главное меню');
  menu.append(element(document, 'span', 'rpb-menu-glyph', '☰'));
  resources.replaceChildren(
    resourceChip(document, 'generated_assets/reward_gold.png', 'Золото', gold),
    resourceChip(document, 'generated_assets/reward_heal.png', 'Припасы', supplies),
    resourceChip(document, 'generated_assets/reward_meta.png', 'Наследие', meta),
    menu
  );
}

function upgradeDraft(root = document) {
  const stages = root.querySelectorAll?.('.rpb-stage') || [];
  for (const stage of stages) {
    if (stage.dataset.armyFoundationApproved === 'true') continue;
    const heroButtons = [...stage.querySelectorAll('[data-draft-hero]')];
    const regularButtons = [...stage.querySelectorAll('[data-draft-regular]')];
    if (!heroButtons.length || !regularButtons.length) continue;
    stage.dataset.armyFoundationApproved = 'true';
    stage.classList.add('rpb-draft-approved');
    stage.querySelector('.rpa-eyebrow')?.remove();
    const headings = stage.querySelectorAll(':scope > h2');
    if (headings[0]) headings[0].textContent = 'Именной герой: выберите одного';
    if (headings[1]) headings[1].textContent = 'Пополнение: выберите одну фигуру';
    heroButtons.forEach((button) => rebuildCard(button, 'hero'));
    regularButtons.forEach((button) => rebuildCard(button, 'regular'));
    rebuildTopbar(stage);
  }
}

function installArmyFoundationApproved(root = document) {
  upgradeDraft(root);
  const target = root.querySelector?.('#app') || root.body;
  if (!target || typeof MutationObserver === 'undefined') return null;
  const observer = new MutationObserver(() => upgradeDraft(root));
  observer.observe(target, { childList: true, subtree: true });
  return observer;
}

if (typeof document !== 'undefined') installArmyFoundationApproved(document);

export { PIECE_GLYPHS, REGULAR_COPY, roman, pieceType, rebuildCard, rebuildTopbar, upgradeDraft, installArmyFoundationApproved };
