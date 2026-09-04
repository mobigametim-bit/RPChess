import { LANGUAGES, UI_MESSAGES } from '../localization/ui.mjs';
import { legacyTranslate } from '../localization/legacy-ui.mjs';
import { GAMEPLAY_EN_EXACT } from '../localization/legacy-gameplay.mjs';

const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
const DEFAULT_LANGUAGE = 'ru';
const LANGUAGE_CODES = new Set(LANGUAGES.map(({ code }) => code));
const listeners = new Set();
const textSources = new WeakMap();
const attributeSources = new WeakMap();
let observer = null;
let applyingLegacyLocalization = false;

function normalizeLanguage(code) {
  return LANGUAGE_CODES.has(code) ? code : DEFAULT_LANGUAGE;
}

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readPersistedLanguage() {
  try {
    const value = JSON.parse(storage()?.getItem(SETTINGS_KEY) || '{}');
    return normalizeLanguage(value?.language);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function persistLanguage(language) {
  const target = storage();
  if (!target) return;
  try {
    const parsed = JSON.parse(target.getItem(SETTINGS_KEY) || '{}');
    const settings = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    target.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, language }));
  } catch {
    target.setItem(SETTINGS_KEY, JSON.stringify({ language }));
  }
}

let activeLanguage = readPersistedLanguage();

function updateDocumentLanguage() {
  if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = activeLanguage;
}

function interpolate(message, params = {}) {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

function translateGeneratedGameplay(value) {
  const source = String(value ?? '');
  const direct = GAMEPLAY_EN_EXACT[source];
  if (direct) return direct;
  let match = source.match(/^(.+) · дорожный отряд$/u);
  if (match) return `${GAMEPLAY_EN_EXACT[match[1]] || match[1]} · road force`;
  match = source.match(/^(.+) · полевая армия$/u);
  if (match) return `${GAMEPLAY_EN_EXACT[match[1]] || match[1]} · field army`;
  match = source.match(/^СЛОЖНОСТЬ (★+)$/u);
  if (match) return `DIFFICULTY ${match[1]}`;
  match = source.match(/^Наёмник · (.+)$/u);
  if (match) return `Mercenary · ${GAMEPLAY_EN_EXACT[match[1]] || legacyTranslate(match[1], 'en')}`;
  if (source === 'Вражеский король') return 'Enemy King';
  match = source.match(/^Вражеский (pawn|knight|bishop|rook|queen|king)$/u);
  if (match) return `Enemy ${match[1]}`;
  return source;
}

export function currentLanguage() {
  return activeLanguage;
}

export function translateLegacy(value, language = activeLanguage) {
  const normalized = normalizeLanguage(language);
  const source = String(value ?? '');
  if (normalized !== 'en') return source;
  const legacy = legacyTranslate(source, normalized);
  return legacy !== source ? legacy : translateGeneratedGameplay(source);
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
  const normalized = normalizeLanguage(language);
  return Object.prototype.hasOwnProperty.call(UI_MESSAGES[normalized] || {}, key);
}

export function availableLanguages() {
  return LANGUAGES.map(({ code, label }) => ({ code, label }));
}

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

function ignoredElement(element) {
  const tag = element?.tagName;
  return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT';
}

function sourceForText(node) {
  const current = node.nodeValue || '';
  if (!textSources.has(node)) {
    textSources.set(node, current);
    return current;
  }
  const source = textSources.get(node) || '';
  const rendered = translateLegacy(source);
  if (current !== source && current !== rendered) {
    textSources.set(node, current);
    return current;
  }
  return source;
}

function sourceForAttribute(element, attribute) {
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map();
    attributeSources.set(element, sources);
  }
  const current = element.getAttribute(attribute) || '';
  if (!sources.has(attribute)) {
    sources.set(attribute, current);
    return current;
  }
  const source = sources.get(attribute) || '';
  const rendered = translateLegacy(source);
  if (current !== source && current !== rendered) {
    sources.set(attribute, current);
    return current;
  }
  return source;
}

function localizeTextNode(node) {
  if (!node || node.nodeType !== 3 || ignoredElement(node.parentElement)) return;
  const source = sourceForText(node);
  const translated = translateLegacy(source);
  if (node.nodeValue !== translated) node.nodeValue = translated;
}

function localizeLegacyElement(element) {
  if (!element || element.nodeType !== 1 || ignoredElement(element)) return;
  const walker = globalThis.document?.createTreeWalker?.(element, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
  if (walker) {
    let node = walker.nextNode();
    while (node) {
      localizeTextNode(node);
      node = walker.nextNode();
    }
  }
  for (const target of [element, ...(element.querySelectorAll?.('[aria-label],[title],[placeholder]') || [])]) {
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
      if (!target.hasAttribute?.(attribute)) continue;
      const source = sourceForAttribute(target, attribute);
      const translated = translateLegacy(source);
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
  } finally {
    applyingLegacyLocalization = false;
  }
}

export function refreshLocalization(root = globalThis.document) {
  localizeDocument(root);
  localizeLegacyDocument(root);
}

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
    queueMicrotask(() => {
      for (const target of targets) localizeLegacyDocument(target);
    });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder']
  });
}

updateDocumentLanguage();
queueMicrotask(() => {
  refreshLocalization();
  installLegacyObserver();
});

globalThis.RPChessI18n = Object.freeze({
  currentLanguage,
  setLanguage,
  t,
  has,
  availableLanguages,
  subscribe,
  translateLegacy,
  refreshLocalization
});
