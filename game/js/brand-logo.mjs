import { currentLanguage, subscribe } from './i18n.mjs';

const BRAND_LOGO_BY_LANGUAGE = Object.freeze({
  ru: 'generated_assets/logo_ru.png',
  en: 'generated_assets/logo_en.png'
});

export function brandLogoSrc(language = currentLanguage()) {
  return BRAND_LOGO_BY_LANGUAGE[language] || BRAND_LOGO_BY_LANGUAGE.ru;
}

export function localizeBrandLogos(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  const src = brandLogoSrc();
  for (const logo of root.querySelectorAll('[data-brand-logo]')) {
    if (logo.getAttribute('src') !== src) logo.setAttribute('src', src);
  }
}

let installed = false;
export function installBrandLogos() {
  if (installed) return;
  installed = true;
  localizeBrandLogos();
  subscribe(() => localizeBrandLogos());
}

export { BRAND_LOGO_BY_LANGUAGE };
