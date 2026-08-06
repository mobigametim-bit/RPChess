import { heroAssets } from './register-02-assets.mjs';

const PIECE_GLYPHS = Object.freeze({ k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' });
const COMMAND_COSTS = Object.freeze({ k: 0, q: 5, r: 3, b: 2, n: 2, p: 1 });
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
  const listedCost = Number(button.querySelector('p')?.textContent?.match(/\d+/)?.[0] || 0);
  const commandCost = kind === 'hero' ? (COMMAND_COSTS[type] ?? 1) : (listedCost || COMMAND_COSTS[type] || 1);
  const heroId = button.dataset.draftHero || null;
  const heroArt = heroId ? heroAssets(heroId)?.portrait : null;
  const regular = REGULAR_COPY[type] || REGULAR_COPY.p;

  button.classList.add('rpb-draft-card', `rpb-draft-card--${kind}`);
  button.dataset.commandCost = String(commandCost);
  button.setAttribute('aria-label', `${kind === 'hero' ? 'Именной герой' : 'Пополнение'}: ${kind === 'hero' ? originalName : regular.title}. Командование ${commandCost}`);
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
  body.append(element(document, 'span', 'rpb-draft-card__cost', `Командование ${commandCost}`));
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

function removeRelicResourceChips(root = document) {
  const resources = root.querySelectorAll?.('.rpvs__resources .rpvs__chip, .rpvs__resources .rp03-codex-launch, .rpvs__resources [data-rp03-codex-launch]') || [];
  for (const chip of resources) {
    const isCodexLaunch = chip.matches?.('[data-rp03-codex-launch], .rp03-codex-launch');
    const label = `${chip.getAttribute('aria-label') || ''} ${chip.textContent || ''}`.toLowerCase();
    if (isCodexLaunch) {
      chip.hidden = true;
      chip.setAttribute('aria-hidden', 'true');
      chip.tabIndex = -1;
      chip.style.display = 'none';
    } else if (label.includes('реликв')) {
      chip.remove();
    }
  }
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

function commandTotalFromBadge(stage) {
  const value = stage.querySelector('.rpb-stage__header .rpb-badge')?.textContent?.match(/\d+/)?.[0];
  return Math.max(1, Number(value || 1));
}

function updateCommandCounter(stage) {
  const counter = stage.querySelector('[data-draft-command-counter]');
  if (!counter) return;
  const total = Math.max(1, Number(stage.dataset.commandLimit || 1));
  const selected = [...stage.querySelectorAll('[data-draft-hero][aria-pressed="true"], [data-draft-regular][aria-pressed="true"]')];
  const used = selected.reduce((sum, card) => sum + Math.max(0, Number(card.dataset.commandCost || 0)), 0);
  counter.textContent = `${used}/${total}`;
  counter.setAttribute('aria-label', `Использовано очков командования: ${used} из ${total}`);
  counter.classList.toggle('rpb-command-counter--over', used > total);
}

function prepareDraftHeader(stage) {
  const document = stage.ownerDocument;
  const header = stage.querySelector('.rpb-stage__header');
  const heading = header?.querySelector('h1');
  if (!header || !heading) return;

  const total = commandTotalFromBadge(stage);
  stage.dataset.commandLimit = String(total);

  const headingRow = element(document, 'div', 'rpb-draft-heading-row');
  heading.before(headingRow);
  headingRow.append(heading);
  const counter = element(document, 'span', 'rpb-command-counter');
  counter.dataset.draftCommandCounter = '';
  headingRow.append(counter);

  header.querySelector('.rpb-badge')?.remove();
  const confirm = stage.querySelector('[data-confirm-draft]');
  if (confirm) {
    confirm.classList.add('rpb-draft-confirm');
    header.append(confirm);
  }

  stage.querySelector('.rpb-warning')?.remove();
  const actions = stage.querySelector('.rpb-actions');
  if (actions && !actions.children.length) actions.remove();
  updateCommandCounter(stage);
}

function upgradeDraft(root = document) {
  removeRelicResourceChips(root);
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
    prepareDraftHeader(stage);
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

export {
  PIECE_GLYPHS,
  COMMAND_COSTS,
  REGULAR_COPY,
  roman,
  pieceType,
  rebuildCard,
  removeRelicResourceChips,
  rebuildTopbar,
  updateCommandCounter,
  prepareDraftHeader,
  upgradeDraft,
  installArmyFoundationApproved
};
