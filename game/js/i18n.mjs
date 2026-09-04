import { LANGUAGES, UI_MESSAGES } from '../localization/ui.mjs';
import { EN_EXACT as LEGACY_EN_EXACT, legacyTranslate } from '../localization/legacy-ui.mjs';
import { GAMEPLAY_EN_EXACT } from '../localization/legacy-gameplay.mjs';
import { EXTRA_EN_EXACT, EXTRA_EN_PATTERNS } from '../localization/legacy-ui-extra.mjs';
import { ROSTER_CONTENT_EN_EXACT } from '../localization/roster-content-en.mjs';
import { EVENT_NARRATIVE_EN_EXACT } from '../localization/event-narrative-en.mjs';
import { RUNTIME_STATUS_EN_EXACT } from '../localization/runtime-status-en.mjs';
import { RUNTIME_COMPOSED_EN_EXACT } from '../localization/runtime-composed-en.mjs';
import { EVENT_EN_EXACT } from '../localization/events/en.mjs';
import { EVENT_EN_V5_NAMES } from '../localization/events/en-v5-names.mjs';

const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
const DEFAULT_LANGUAGE = 'ru';
const LANGUAGE_CODES = new Set(LANGUAGES.map(({ code }) => code));
const listeners = new Set();
const textSources = new WeakMap();
const attributeSources = new WeakMap();
let observer = null;
let applyingLegacyLocalization = false;

function normalizeLanguage(code) { return LANGUAGE_CODES.has(code) ? code : DEFAULT_LANGUAGE; }
function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
function readPersistedLanguage() {
  try { return normalizeLanguage(JSON.parse(storage()?.getItem(SETTINGS_KEY) || '{}')?.language); }
  catch { return DEFAULT_LANGUAGE; }
}
function persistLanguage(language) {
  const target = storage();
  if (!target) return;
  try {
    const parsed = JSON.parse(target.getItem(SETTINGS_KEY) || '{}');
    const settings = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    target.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, language }));
  } catch { target.setItem(SETTINGS_KEY, JSON.stringify({ language })); }
}

let activeLanguage = readPersistedLanguage();
function updateDocumentLanguage() { if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = activeLanguage; }
function interpolate(message, params = {}) {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}

function applyPatterns(source, patterns) {
  for (const [pattern, replacer] of patterns) {
    if (pattern.test(source)) return source.replace(pattern, replacer);
  }
  return source;
}

const UPPERCASE_EN_EXACT = Object.freeze(Object.entries({
  ...LEGACY_EN_EXACT,
  ...GAMEPLAY_EN_EXACT,
  ...EXTRA_EN_EXACT,
  ...ROSTER_CONTENT_EN_EXACT,
  ...RUNTIME_STATUS_EN_EXACT,
  ...RUNTIME_COMPOSED_EN_EXACT,
  ...EVENT_EN_V5_NAMES
}).reduce((acc, [source, translation]) => {
  if (!/[А-Яа-яЁё]/u.test(source)) return acc;
  const upper = source.toLocaleUpperCase('ru-RU');
  if (upper !== source) acc[upper] = String(translation).toUpperCase();
  return acc;
}, {}));

function translateKnownToken(value) {
  const source = String(value ?? '');
  const direct = EVENT_EN_V5_NAMES[source]
    || EVENT_EN_EXACT[source]
    || EVENT_NARRATIVE_EN_EXACT[source]
    || RUNTIME_STATUS_EN_EXACT[source]
    || RUNTIME_COMPOSED_EN_EXACT[source]
    || ROSTER_CONTENT_EN_EXACT[source]
    || GAMEPLAY_EN_EXACT[source]
    || EXTRA_EN_EXACT[source]
    || LEGACY_EN_EXACT[source]
    || UPPERCASE_EN_EXACT[source];
  if (direct) return direct;
  const legacy = legacyTranslate(source, 'en');
  return legacy !== source ? legacy : source;
}

const COMPOSABLE_EN_ENTRIES = Object.freeze(Object.entries({
  ...LEGACY_EN_EXACT,
  ...GAMEPLAY_EN_EXACT,
  ...EXTRA_EN_EXACT,
  ...ROSTER_CONTENT_EN_EXACT,
  ...RUNTIME_STATUS_EN_EXACT,
  ...RUNTIME_COMPOSED_EN_EXACT
}).filter(([source, translation]) => source && translation && source.trim() === source)
  .sort(([a], [b]) => b.length - a.length));

function translateKnownSequence(value) {
  const source = String(value ?? '');
  let remaining = source;
  const parts = [];
  while (remaining) {
    const entry = COMPOSABLE_EN_ENTRIES.find(([token]) => remaining === token || remaining.startsWith(`${token} `));
    if (!entry) return source;
    const [token, translation] = entry;
    parts.push(translation);
    if (remaining === token) return parts.join(' ');
    remaining = remaining.slice(token.length + 1);
  }
  return source;
}

function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const EVENT_TEMPLATE_PATTERNS = Object.freeze(Object.entries(EVENT_EN_EXACT)
  .filter(([source]) => /\{[a-zA-Z0-9_]+\}/.test(source))
  .map(([source, translation]) => {
    const names = [];
    const token = /\{([a-zA-Z0-9_]+)\}/g;
    let pattern = '^';
    let cursor = 0;
    let match = token.exec(source);
    while (match) {
      pattern += escapeRegex(source.slice(cursor, match.index));
      pattern += '(.+?)';
      names.push(match[1]);
      cursor = match.index + match[0].length;
      match = token.exec(source);
    }
    pattern += `${escapeRegex(source.slice(cursor))}$`;
    return Object.freeze({ pattern: new RegExp(pattern, 'u'), names: Object.freeze(names), translation });
  }));

function translateEventPresentation(source) {
  const direct = EVENT_EN_EXACT[source];
  if (direct) return direct;

  let match = source.match(/^«([\s\S]+)»$/u);
  if (match) {
    const translated = translateEventPresentation(match[1]);
    if (translated !== match[1]) return `“${translated}”`;
  }

  match = source.match(/^(🔒\s*)?(.+?) — (НЕТ В ОТРЯДЕ|ПОГИБ|РАНЕН)$/u);
  if (match) {
    const status = { 'НЕТ В ОТРЯДЕ':'NOT IN ROSTER', 'ПОГИБ':'DEAD', 'РАНЕН':'WOUNDED' }[match[3]];
    return `${match[1] || ''}${translateKnownToken(match[2])} — ${status}`;
  }

  match = source.match(/^(\S+)\s+(.+)$/u);
  if (match) {
    const label = translateKnownToken(match[2]);
    if (label !== match[2]) return `${match[1]} ${label}`;
  }

  for (const template of EVENT_TEMPLATE_PATTERNS) {
    const rendered = source.match(template.pattern);
    if (!rendered) continue;
    const params = {};
    template.names.forEach((name, index) => { params[name] = translateKnownToken(rendered[index + 1]); });
    return interpolate(template.translation, params);
  }
  return source;
}

function translatedSide(value) {
  return ({ 'белых':'White', 'чёрных':'Black', 'Белые':'White', 'Чёрные':'Black' })[value] || value;
}

function translateGeneratedGameplay(value) {
  const source = String(value ?? '');
  const direct = EVENT_NARRATIVE_EN_EXACT[source] || RUNTIME_STATUS_EN_EXACT[source] || RUNTIME_COMPOSED_EN_EXACT[source] || ROSTER_CONTENT_EN_EXACT[source] || GAMEPLAY_EN_EXACT[source] || EXTRA_EN_EXACT[source] || UPPERCASE_EN_EXACT[source];
  if (direct) return direct;

  const sequence = translateKnownSequence(source);
  if (sequence !== source) return sequence;

  let match = source.match(/^(.+) присоединяется к отряду$/u);
  if (match) return `${translateKnownToken(match[1])} joins the roster`;
  match = source.match(/^(.+): (погиб|тяжело ранен)$/u);
  if (match) return `${translateKnownToken(match[1])}: ${match[2] === 'погиб' ? 'dead' : 'severely wounded'}`;
  match = source.match(/^(.+) — ТЯЖЕЛО РАНЕН$/u);
  if (match) return `${translateKnownToken(match[1])} — SEVERELY WOUNDED`;

  match = source.match(/^(.+) пал во время перехода без припасов\. Путешествие этого отряда завершено\.$/u);
  if (match) return `${translateKnownToken(match[1])} fell while travelling without supplies. This roster’s journey is over.`;
  match = source.match(/^Ваш соратник (.+) умер от голода\. Похоронив его и водрузив на могилу памятный камень, отряд отправляется дальше с тяжелым сердцем\.$/u);
  if (match) return `Your companion ${translateKnownToken(match[1])} died of starvation. After burying them and raising a memorial stone, the roster continues with heavy hearts.`;
  match = source.match(/^(.+) пал в битве\. Забег завершён\.$/u);
  if (match) return `${translateKnownToken(match[1])} fell in battle. The run is over.`;
  match = source.match(/^(.+) пал в стычке\. Путешествие этого отряда завершено\.$/u);
  if (match) return `${translateKnownToken(match[1])} fell in the skirmish. This roster’s journey is over.`;

  match = source.match(/^(.+?)\. (.+)$/u);
  if (match) {
    const first = translateKnownToken(match[1]);
    const rest = translateKnownToken(match[2]);
    if (first !== match[1] && rest !== match[2]) return `${first}. ${rest}`;
  }

  match = source.match(/^ВСЕ (\d+) СЛОТА · (.+) ЗАНЯТЫ$/u);
  if (match) return `ALL ${match[1]} SLOTS · ${translateKnownToken(match[2])} FULL`;
  match = source.match(/^слот (Пешка|Конь|Слон|Ладья|Ферзь|Король): (\d+)$/u);
  if (match) return `slot ${translateKnownToken(match[1])}: ${match[2]}`;
  match = source.match(/^(.+), король обязателен$/u);
  if (match) return `${translateKnownToken(match[1])}, King required`;
  match = source.match(/^Убрать (.+) из боевого отряда$/u);
  if (match) return `Remove ${translateKnownToken(match[1])} from the battle roster`;

  match = source.match(/^([a-h][1-8]): (.+), (белых|чёрных)$/u);
  if (match) return `${match[1]}: ${translateKnownToken(match[2])}, ${translatedSide(match[3])}`;
  match = source.match(/^([a-h][1-8]): (.+), (Пешка|Конь|Слон|Ладья|Ферзь|Король)$/u);
  if (match) return `${match[1]}: ${translateKnownToken(match[2])}, ${translateKnownToken(match[3])}`;
  match = source.match(/^([a-h][1-8]): (пешка|конь|слон|ладья|ферзь|король)$/u);
  if (match) return `${match[1]}: ${translateKnownToken(match[2])}`;
  match = source.match(/^(.+), (Пешка|Конь|Слон|Ладья|Ферзь|Король), (ЗДОРОВ|ТЯЖЕЛО РАНЕН|ПОГИБ)$/u);
  if (match) return `${translateKnownToken(match[1])}, ${translateKnownToken(match[2])}, ${translateKnownToken(match[3])}`;
  match = source.match(/^(\S+)\s+(Пешка|Конь|Слон|Ладья|Ферзь|Король)\s+(\d+)\s*\/\s*(\d+)$/u);
  if (match) return `${match[1]} ${translateKnownToken(match[2])} ${match[3]} / ${match[4]}`;

  match = source.match(/^Мат — победа (белых|чёрных)$/u);
  if (match) return `Checkmate — ${translatedSide(match[1])} wins`;
  match = source.match(/^(Белые|Чёрные) победили\.$/u);
  if (match) return `${translatedSide(match[1])} won.`;
  match = source.match(/^(Белые|Чёрные) выбирают ход\.$/u);
  if (match) return `${translatedSide(match[1])} are choosing a move.`;
  match = source.match(/^(Белые|Чёрные) под шахом\. Нужно защитить короля\.$/u);
  if (match) return `${translatedSide(match[1])} are in check. The King must be defended.`;
  match = source.match(/^(Белые|Чёрные) делают ход\.$/u);
  if (match) return `${translatedSide(match[1])} to move.`;

  match = source.match(/^Сила:\s*примерно\s*(.+)$/u);
  if (match) return `Strength: about ${translateKnownToken(match[1])}`;
  match = source.match(/^Сила:\s*(.+)$/u);
  if (match) return `Strength: ${translateKnownToken(match[1])}`;
  match = source.match(/^Тактика противника:\s*(.+)$/u);
  if (match) return `Enemy tactic: ${translateKnownToken(match[1])}`;
  match = source.match(/^(ВСЕ|ЗДОРОВЫ|РАНЕНЫ|ПОГИБШИЕ)\s+(\d+)$/u);
  if (match) return `${translateKnownToken(match[1])} ${match[2]}`;
  match = source.match(/^УГРОЗА\s+(★+)$/u);
  if (match) return `THREAT ${match[1]}`;
  match = source.match(/^([+-]?\d+) золота$/u);
  if (match) return `${match[1]} gold`;
  match = source.match(/^([+-]?\d+) припас(?:а|ов)?$/u);
  if (match) return `${match[1]} ${Math.abs(Number(match[1])) === 1 ? 'supply' : 'supplies'}`;

  const extra = applyPatterns(source, EXTRA_EN_PATTERNS);
  if (extra !== source) return extra;
  match = source.match(/^(.+) · дорожный отряд$/u);
  if (match) return `${translateKnownToken(match[1])} · road force`;
  match = source.match(/^(.+) · полевая армия$/u);
  if (match) return `${translateKnownToken(match[1])} · field army`;
  match = source.match(/^СЛОЖНОСТЬ (★+)$/u);
  if (match) return `DIFFICULTY ${match[1]}`;
  match = source.match(/^Наёмник · (.+)$/u);
  if (match) return `Mercenary · ${translateKnownToken(match[1])}`;
  return source;
}

export function currentLanguage() { return activeLanguage; }
export function translateLegacy(value, language = activeLanguage) {
  const normalized = normalizeLanguage(language);
  const source = String(value ?? '');
  if (normalized !== 'en') return source;
  const eventTranslation = translateEventPresentation(source);
  if (eventTranslation !== source) return eventTranslation;
  const generated = translateGeneratedGameplay(source);
  if (generated !== source) return generated;
  const legacy = legacyTranslate(source, normalized);
  if (legacy !== source) return legacy;
  if (source.includes(' · ')) {
    const parts = source.split(' · ');
    const translated = parts.map((part) => translateLegacy(part, normalized));
    if (translated.some((part, index) => part !== parts[index])) return translated.join(' · ');
  }
  return source;
}
export function setLanguage(code) {
  const language = normalizeLanguage(code);
  const changed = language !== activeLanguage;
  activeLanguage = language;
  persistLanguage(language);
  updateDocumentLanguage();
  refreshLocalization();
  if (changed) {
    for (const listener of [...listeners]) listener(language);
    if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent(new CustomEvent('rpchess:language-changed', { detail: { language } }));
    }
  }
  return language;
}
export function t(key, params = {}) {
  const message = UI_MESSAGES[activeLanguage]?.[key] ?? UI_MESSAGES[DEFAULT_LANGUAGE]?.[key];
  return message === undefined ? `[missing:${key}]` : interpolate(message, params);
}
export function has(key, language = activeLanguage) {
  return Object.prototype.hasOwnProperty.call(UI_MESSAGES[normalizeLanguage(language)] || {}, key);
}
export function availableLanguages() { return LANGUAGES.map(({ code, label }) => ({ code, label })); }
export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function localizeDocument(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const selectors = [
    ['[data-i18n]', 'data-i18n', 'textContent'],
    ['[data-i18n-aria-label]', 'data-i18n-aria-label', 'aria-label'],
    ['[data-i18n-placeholder]', 'data-i18n-placeholder', 'placeholder'],
    ['[data-i18n-title]', 'data-i18n-title', 'title']
  ];
  for (const [selector, attribute, target] of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      const key = element.getAttribute(attribute);
      if (!key || !has(key)) continue;
      if (target === 'textContent') element.textContent = t(key);
      else element.setAttribute(target, t(key));
    }
  }
}

function ignoredElement(element) { return ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element?.tagName); }
function sourceForText(node) {
  const current = node.nodeValue || '';
  if (!textSources.has(node)) { textSources.set(node, current); return current; }
  const source = textSources.get(node) || '';
  const rendered = translateLegacy(source);
  if (current !== source && current !== rendered) { textSources.set(node, current); return current; }
  return source;
}
function sourceForAttribute(element, attribute) {
  let sources = attributeSources.get(element);
  if (!sources) { sources = new Map(); attributeSources.set(element, sources); }
  const current = element.getAttribute(attribute) || '';
  if (!sources.has(attribute)) { sources.set(attribute, current); return current; }
  const source = sources.get(attribute) || '';
  const rendered = translateLegacy(source);
  if (current !== source && current !== rendered) { sources.set(attribute, current); return current; }
  return source;
}
function localizeTextNode(node) {
  if (!node || node.nodeType !== 3 || ignoredElement(node.parentElement)) return;
  const translated = translateLegacy(sourceForText(node));
  if (node.nodeValue !== translated) node.nodeValue = translated;
}
function localizeLegacyElement(element) {
  if (!element || element.nodeType !== 1 || ignoredElement(element)) return;
  const walker = globalThis.document?.createTreeWalker?.(element, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
  if (walker) {
    let node = walker.nextNode();
    while (node) { localizeTextNode(node); node = walker.nextNode(); }
  }
  for (const target of [element, ...(element.querySelectorAll?.('[aria-label],[title],[placeholder],[alt]') || [])]) {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (!target.hasAttribute?.(attribute)) continue;
      const translated = translateLegacy(sourceForAttribute(target, attribute));
      if (target.getAttribute(attribute) !== translated) target.setAttribute(attribute, translated);
    }
  }
}
export function localizeLegacyDocument(root = globalThis.document) {
  if (!root || applyingLegacyLocalization) return;
  applyingLegacyLocalization = true;
  try {
    if (root.nodeType === 3) localizeTextNode(root);
    else if (root.nodeType === 1) localizeLegacyElement(root);
    else if (root.documentElement) localizeLegacyElement(root.documentElement);
  } finally { applyingLegacyLocalization = false; }
}
export function refreshLocalization(root = globalThis.document) { localizeDocument(root); localizeLegacyDocument(root); }
function installLegacyObserver() {
  const document = globalThis.document;
  if (!document?.documentElement || typeof globalThis.MutationObserver !== 'function' || observer) return;
  observer = new MutationObserver((mutations) => {
    if (applyingLegacyLocalization) return;
    const targets = new Set();
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') targets.add(mutation.target);
      for (const node of mutation.addedNodes || []) targets.add(node);
      if (mutation.type === 'attributes') targets.add(mutation.target);
    }
    if (!targets.size) return;
    queueMicrotask(() => { for (const target of targets) localizeLegacyDocument(target); });
  });
  observer.observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-label','title','placeholder','alt'] });
}

updateDocumentLanguage();
queueMicrotask(() => { refreshLocalization(); installLegacyObserver(); });
globalThis.RPChessI18n = Object.freeze({ currentLanguage, setLanguage, t, has, availableLanguages, subscribe, translateLegacy, refreshLocalization });