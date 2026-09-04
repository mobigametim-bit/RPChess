import { LANGUAGES, UI_MESSAGES } from '../localization/ui.mjs';

const SETTINGS_KEY = 'rpchess.reboot.v1.settings';
const DEFAULT_LANGUAGE = 'ru';
const LANGUAGE_CODES = new Set(LANGUAGES.map(({ code }) => code));
const listeners = new Set();

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

export function currentLanguage() {
  return activeLanguage;
}

export function setLanguage(code) {
  const language = normalizeLanguage(code);
  const changed = language !== activeLanguage;
  activeLanguage = language;
  persistLanguage(language);
  updateDocumentLanguage();
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

updateDocumentLanguage();

globalThis.RPChessI18n = Object.freeze({
  currentLanguage,
  setLanguage,
  t,
  has,
  availableLanguages,
  subscribe
});
