const CHRONICLE_NAMES_KEY = 'rpchess.chronicle.names.v1';
const ROMAN_NUMERALS = Object.freeze(['I', 'II', 'III']);

function safeStorage(explicit = undefined) {
  if (explicit !== undefined) return explicit;
  try { return globalThis.localStorage || null; } catch (_error) { return null; }
}

function readChronicleNames(storage = safeStorage()) {
  try {
    const value = storage?.getItem?.(CHRONICLE_NAMES_KEY);
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
  } catch (_error) {
    return {};
  }
}

function writeChronicleNames(names, storage = safeStorage()) {
  try {
    storage?.setItem?.(CHRONICLE_NAMES_KEY, JSON.stringify(names || {}));
    return true;
  } catch (_error) {
    return false;
  }
}

function romanChronicleNumber(index) {
  return ROMAN_NUMERALS[index] || String(index + 1);
}

function compactLabel(language, key) {
  const english = language === 'en';
  const labels = english
    ? {
        title: 'Choose a campaign chronicle',
        subtitle: 'Three independent stories. Continue an existing campaign or begin a new one.',
        empty: 'Empty slot',
        emptyCopy: 'Begin a new campaign by choosing a king, doctrine and starting army.',
        continue: 'Continue',
        create: 'Create',
        rename: 'Rename',
        newRun: 'Start over',
        remove: 'Delete',
        more: 'More chronicle actions',
        renamePrompt: 'Chronicle name',
        fallback: 'Chronicle'
      }
    : {
        title: 'Выберите хронику похода',
        subtitle: 'Три независимые истории. Продолжите существующий поход или начните новый.',
        empty: 'Пустой слот',
        emptyCopy: 'Начните новый поход с выбором короля, доктрины и стартового отряда.',
        continue: 'Продолжить',
        create: 'Создать',
        rename: 'Переименовать',
        newRun: 'Начать заново',
        remove: 'Удалить',
        more: 'Дополнительные действия с хроникой',
        renamePrompt: 'Название хроники',
        fallback: 'Хроника'
      };
  return labels[key] || key;
}

function buttonWithText(button, text) {
  if (!button) return null;
  button.textContent = text;
  button.classList.add('rpprofile__approved-button');
  return button;
}

function commanderPortrait(card) {
  return card.querySelector('.rpprofile__command-card img')?.getAttribute('src') || '';
}

function createVisual(document, card, available, title, language) {
  const visual = document.createElement('div');
  visual.className = `rpprofile__approved-visual${available ? '' : ' rpprofile__approved-visual--empty'}`;
  const image = document.createElement('img');
  image.alt = available ? title : '';
  image.src = available ? commanderPortrait(card) || 'generated_assets/logo_main.png' : 'generated_assets/logo_main.png';
  visual.append(image);
  if (!available) {
    const label = document.createElement('span');
    label.textContent = compactLabel(language, 'empty');
    visual.append(label);
  }
  return visual;
}

function createContent(document, card, available, title, language) {
  const content = document.createElement('div');
  content.className = 'rpprofile__approved-content';

  const heading = document.createElement('h2');
  heading.className = 'rpprofile__approved-title';
  heading.textContent = title;
  content.append(heading);

  const originalStatus = card.querySelector('.rpprofile__summary > strong');
  const status = document.createElement('strong');
  status.className = 'rpprofile__approved-status';
  status.textContent = available ? originalStatus?.textContent?.trim() || '' : compactLabel(language, 'empty');
  content.append(status);

  if (available) {
    const originalFacts = [...card.querySelectorAll('.rpprofile__facts span')];
    if (originalFacts.length) {
      const chips = document.createElement('div');
      chips.className = 'rpprofile__approved-chips';
      originalFacts.forEach((fact) => {
        const chip = document.createElement('span');
        chip.textContent = fact.textContent.trim();
        chips.append(chip);
      });
      content.append(chips);
    }
  } else {
    const copy = document.createElement('p');
    copy.textContent = compactLabel(language, 'emptyCopy');
    content.append(copy);
  }
  return content;
}

function createMoreMenu(document, newButton, deleteButton, language) {
  if (!newButton && !deleteButton) return null;
  const host = document.createElement('div');
  host.className = 'rpprofile__approved-more';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'rpprofile__approved-more-toggle';
  toggle.setAttribute('aria-label', compactLabel(language, 'more'));
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = '•••';

  const menu = document.createElement('div');
  menu.className = 'rpprofile__approved-more-menu';
  menu.hidden = true;
  if (newButton) menu.append(buttonWithText(newButton, compactLabel(language, 'newRun')));
  if (deleteButton) menu.append(buttonWithText(deleteButton, compactLabel(language, 'remove')));

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });
  host.append(toggle, menu);
  return host;
}

function enhanceProfileCard(card, index, options = {}) {
  if (!card || card.dataset.approvedChronicleCard === 'true') return false;
  const document = options.document || card.ownerDocument;
  const storage = safeStorage(options.storage);
  const language = options.language || document.documentElement?.lang || 'ru';
  const names = readChronicleNames(storage);
  const profileId = card.dataset.profileId || `profile-${index + 1}`;
  const available = card.dataset.profilePrimary === 'continue';
  const defaultTitle = `${compactLabel(language, 'fallback')} ${romanChronicleNumber(index)}`;
  const title = String(names[profileId] || defaultTitle).trim() || defaultTitle;

  const actions = card.querySelector('.rpprofile__actions');
  const primary = card.querySelector('[data-profile-action="continue"], [data-profile-action="start"]');
  const newButton = card.querySelector('[data-profile-action="new"]');
  const deleteButton = card.querySelector('[data-profile-action="delete"]');
  if (!actions || !primary) return false;

  buttonWithText(primary, compactLabel(language, available ? 'continue' : 'create'));
  primary.classList.add('rpa-button--primary');

  const approvedActions = document.createElement('div');
  approvedActions.className = 'rpprofile__approved-actions';
  approvedActions.append(primary);

  if (available) {
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'rpa-button rpprofile__approved-button rpprofile__approved-rename';
    rename.textContent = compactLabel(language, 'rename');
    rename.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const next = globalThis.prompt?.(compactLabel(language, 'renamePrompt'), title);
      if (next == null) return;
      const normalized = String(next).trim().slice(0, 42);
      const updated = readChronicleNames(storage);
      if (normalized && normalized !== defaultTitle) updated[profileId] = normalized;
      else delete updated[profileId];
      writeChronicleNames(updated, storage);
      const heading = card.querySelector('.rpprofile__approved-title');
      if (heading) heading.textContent = normalized || defaultTitle;
      card.setAttribute('aria-label', `${normalized || defaultTitle}: ${card.querySelector('.rpprofile__approved-status')?.textContent || ''}`);
    });
    approvedActions.append(rename);
  }

  const more = createMoreMenu(document, newButton, deleteButton, language);
  const visual = createVisual(document, card, available, title, language);
  const content = createContent(document, card, available, title, language);

  card.replaceChildren(visual, content, approvedActions);
  if (more) card.append(more);
  card.classList.add('rpa-profile-card--approved');
  card.dataset.approvedChronicleCard = 'true';
  card.setAttribute('aria-label', `${title}: ${content.querySelector('.rpprofile__approved-status')?.textContent || ''}`);
  return true;
}

function enhanceChronicleSelection(root = globalThis.document, options = {}) {
  if (!root?.querySelectorAll) return 0;
  const document = options.document || root.ownerDocument || root;
  const language = options.language || document.documentElement?.lang || 'ru';
  const screen = root.querySelector('.rpprofile');
  if (!screen) return 0;
  screen.classList.add('rpprofile--approved-cards');
  const heading = screen.querySelector('.rpa-screen-header h1');
  const subtitle = screen.querySelector('.rpa-screen-header p');
  const titleCopy = compactLabel(language, 'title');
  const subtitleCopy = compactLabel(language, 'subtitle');
  if (heading && heading.textContent !== titleCopy) heading.textContent = titleCopy;
  if (subtitle && subtitle.textContent !== subtitleCopy) subtitle.textContent = subtitleCopy;
  const cards = [...screen.querySelectorAll('.rpa-profile-card')];
  return cards.reduce((count, card, index) => count + Number(enhanceProfileCard(card, index, { ...options, document, language })), 0);
}

function installChronicleProfileCards(options = {}) {
  const document = options.document || globalThis.document;
  const app = options.root || document?.getElementById?.('app');
  if (!document || !app) return null;
  const apply = () => enhanceChronicleSelection(app, { ...options, document });
  apply();
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(() => queueMicrotask(apply))
    : null;
  observer?.observe(app, { childList: true, subtree: true });

  document.addEventListener('click', (event) => {
    const deleteButton = event.target.closest?.('[data-profile-action="delete"]');
    if (deleteButton) {
      const names = readChronicleNames(options.storage);
      delete names[deleteButton.dataset.profileId];
      writeChronicleNames(names, options.storage);
    }
    document.querySelectorAll('.rpprofile__approved-more-menu:not([hidden])').forEach((menu) => {
      if (!menu.parentElement?.contains(event.target)) {
        menu.hidden = true;
        menu.parentElement?.querySelector('.rpprofile__approved-more-toggle')?.setAttribute('aria-expanded', 'false');
      }
    });
  });

  return Object.freeze({ observer, apply, destroy: () => observer?.disconnect() });
}

if (typeof document !== 'undefined') {
  const boot = () => installChronicleProfileCards();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export {
  CHRONICLE_NAMES_KEY,
  ROMAN_NUMERALS,
  safeStorage,
  readChronicleNames,
  writeChronicleNames,
  romanChronicleNumber,
  compactLabel,
  enhanceProfileCard,
  enhanceChronicleSelection,
  installChronicleProfileCards
};
