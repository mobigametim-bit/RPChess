import {
  readinessLabel,
  heroMechanicReadiness,
  relicMechanicReadiness
} from './iron-marches-mechanics-readiness.mjs';

const ENHANCED_ATTRIBUTE = 'data-rpmech-readiness';
const HERO_RELICS = Object.freeze({
  'hero.aldric_wall': 'relic.echo_shield',
  'hero.mara_chain': 'relic.royal_decree',
  'hero.brother_orell': 'relic.circle_warding',
  'hero.vael_hammer': 'relic.phantom_spurs',
  'hero.lady_sorn': 'relic.oath_fallen',
  'hero.tomas_gate': 'relic.twin_command'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function heroIdFromImageSource(source) {
  const match = String(source || '').match(/(?:^|\/)assets\/heroes\/([a-z0-9_-]+)\//i);
  return match ? `hero.${match[1]}` : null;
}

function statusClass(status) {
  return String(status || 'unknown').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function heroReadinessMarkup(heroId, options = {}) {
  const ability = heroMechanicReadiness(heroId);
  if (!ability) return '';
  const relicId = options.relicId || HERO_RELICS[heroId] || null;
  const relic = relicId ? relicMechanicReadiness(relicId) : null;
  const abilityDisabled = ability.status !== 'IMPLEMENTED';
  return `<section class="rpmech-summary" aria-label="Готовность механик героя">
    <div class="rpmech-record rpmech-record--${statusClass(ability.status)}"${abilityDisabled ? ' aria-disabled="true"' : ''}>
      <div><span>Способность</span><strong>${escapeHtml(ability.name)}</strong></div>
      <b>${escapeHtml(readinessLabel(ability.status))}</b>
      <p>${escapeHtml(ability.note)}</p>
    </div>
    ${relic ? `<div class="rpmech-record rpmech-record--${statusClass(relic.status)}">
      <div><span>Реликвия</span><strong>${escapeHtml(relic.name)}</strong></div>
      <b>${escapeHtml(readinessLabel(relic.status))}</b>
      <p>${escapeHtml(relic.note)}</p>
    </div>` : ''}
  </section>`;
}

function compactReadinessMarkup(heroId) {
  const ability = heroMechanicReadiness(heroId);
  if (!ability) return '';
  return `<span class="rpmech-compact rpmech-compact--${statusClass(ability.status)}" aria-label="Статус способности: ${escapeHtml(readinessLabel(ability.status))}">Способность: ${escapeHtml(readinessLabel(ability.status))}</span>`;
}

function installMechanicsReadinessStyles(document) {
  if (!document || document.getElementById('rpmech-readiness-styles')) return;
  const style = document.createElement('style');
  style.id = 'rpmech-readiness-styles';
  style.textContent = `
    .rpmech-summary{display:grid;gap:7px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(174,147,82,.25)}.rpmech-record{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 9px;padding:8px;border:1px solid #51627b;border-radius:9px;background:#0b1524}.rpmech-record>div{display:grid}.rpmech-record span{color:#9fadc1;font-size:11px;text-transform:uppercase;letter-spacing:.07em}.rpmech-record strong{color:#f4ead6}.rpmech-record>b{align-self:center;padding:3px 7px;border-radius:999px;font-size:10px;text-transform:uppercase}.rpmech-record>p{grid-column:1/-1;margin:2px 0 0;color:#aeb9ca;font-size:11px}.rpmech-record--partial{border-color:#a88742}.rpmech-record--partial>b{background:#5b4319;color:#ffe3a0}.rpmech-record--declarative,.rpmech-record--blocked_by_design{border-color:#76545c;opacity:.82}.rpmech-record--declarative>b,.rpmech-record--blocked_by_design>b{background:#40232a;color:#ffd4da}.rpmech-record--implemented{border-color:#56896a}.rpmech-record--implemented>b{background:#1c4a31;color:#cbf8da}.rpmech-compact{display:block;margin-top:5px;padding:4px 7px;border:1px solid #76545c;border-radius:7px;background:#301c23;color:#ffd4da;font-size:10px;font-weight:750;line-height:1.25}.rpmech-compact--partial{border-color:#a88742;background:#4c3716;color:#ffe3a0}.rpmech-compact--implemented{border-color:#56896a;background:#173d29;color:#cbf8da}.rpmech-ability-disabled{filter:grayscale(.8);opacity:.52}.rpmech-ability-disabled::after{content:'×';position:absolute;right:3px;top:1px;z-index:3;color:#ff9ca9;font-size:18px;font-weight:900;text-shadow:0 1px 3px #000}
  `;
  document.head.appendChild(style);
}

function decorateHeroPanel(panel) {
  const image = panel.querySelector('.rp02-media--portrait img');
  const heroId = heroIdFromImageSource(image?.getAttribute('src'));
  if (!heroId || panel.getAttribute(ENHANCED_ATTRIBUTE) === heroId) return false;
  panel.querySelector('.rpmech-summary')?.remove();
  const body = panel.querySelector('.rp02-hero-panel__body') || panel;
  body.insertAdjacentHTML('beforeend', heroReadinessMarkup(heroId));
  const ability = heroMechanicReadiness(heroId);
  const abilityIcon = panel.querySelector('.rp02-media--ability');
  if (abilityIcon && ability?.status !== 'IMPLEMENTED') {
    abilityIcon.classList.add('rpmech-ability-disabled');
    abilityIcon.setAttribute('aria-disabled', 'true');
    abilityIcon.setAttribute('title', `${ability.name}: ${readinessLabel(ability.status)}`);
  }
  panel.setAttribute(ENHANCED_ATTRIBUTE, heroId);
  return true;
}

function decorateSelectionCard(card) {
  const heroId = card?.dataset?.toggleHero;
  if (!heroId || card.querySelector('.rpmech-compact')) return false;
  card.insertAdjacentHTML('beforeend', compactReadinessMarkup(heroId));
  return true;
}

function decorateHeroCard(card) {
  if (card.querySelector('.rpmech-compact')) return false;
  const image = card.querySelector('img');
  const heroId = heroIdFromImageSource(image?.getAttribute('src'));
  if (!heroId) return false;
  const target = card.querySelector('div') || card;
  target.insertAdjacentHTML('beforeend', compactReadinessMarkup(heroId));
  return true;
}

function refreshMechanicsReadiness(root) {
  if (!root?.querySelectorAll) return 0;
  let changes = 0;
  for (const element of root.querySelectorAll('.rpmech-summary,.rpmech-compact')) { element.remove(); changes += 1; }
  for (const icon of root.querySelectorAll('.rpmech-ability-disabled')) { icon.classList.remove('rpmech-ability-disabled'); icon.removeAttribute('aria-disabled'); changes += 1; }
  return changes;
}

function startMechanicsReadinessEnhancer(options = {}) {
  const document = options.document || globalThis.document;
  const root = options.root || document?.getElementById('app');
  if (!document || !root) return null;
  installMechanicsReadinessStyles(document);
  const refresh = () => refreshMechanicsReadiness(root);
  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });
  const timer = setInterval(refresh, 350);
  refresh();
  return Object.freeze({
    refresh,
    stop() {
      observer.disconnect();
      clearInterval(timer);
    }
  });
}

if (typeof document !== 'undefined') startMechanicsReadinessEnhancer();

export {
  ENHANCED_ATTRIBUTE,
  HERO_RELICS,
  escapeHtml,
  heroIdFromImageSource,
  heroReadinessMarkup,
  compactReadinessMarkup,
  installMechanicsReadinessStyles,
  decorateHeroPanel,
  decorateSelectionCard,
  decorateHeroCard,
  refreshMechanicsReadiness,
  startMechanicsReadinessEnhancer
};
