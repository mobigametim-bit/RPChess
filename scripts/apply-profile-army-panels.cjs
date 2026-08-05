'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative, content) {
  fs.writeFileSync(path.join(root, relative), content);
}

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`patch anchor not found: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`patch anchor is not unique: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function patchProfilePersistence() {
  const file = 'src/browser/profile-persistence.cjs';
  let source = read(file);
  source = replaceOnce(source,
`function inspectBrowserProfile(store, profileIdInput, validationInput = null) {`,
`function profileArmySummary(state) {
  const army = state?.army;
  if (!army) return null;
  const heroes = Object.freeze((army.heroes || []).map((hero) => Object.freeze({
    heroId: hero.heroId,
    nameKey: hero.nameKey,
    contentPieceType: hero.contentPieceType,
    battlePieceType: hero.battlePieceType,
    pieceType: hero.pieceType,
    relicIds: Object.freeze([...(hero.relicIds || [])]),
    overrideReason: hero.overrideReason || null
  })));
  const heroIds = Object.freeze([...(army.heroIds || [])]);
  const relicIds = Object.freeze([...(army.relicIds || [])]);
  return Object.freeze({
    regionId: army.regionId || null,
    kingId: army.kingId || null,
    kingNameKey: army.kingNameKey || null,
    doctrineId: army.doctrineId || null,
    heroIds,
    relicIds,
    heroes,
    heroCount: heroIds.length,
    relicCount: relicIds.length
  });
}

function inspectBrowserProfile(store, profileIdInput, validationInput = null) {`,
  'profile army summary helper');
  source = replaceOnce(source,
`      currentNodeId: state?.campaign?.currentNodeId || null,
      rewardsClaimed: state?.rewardLog?.length || 0`,
`      currentNodeId: state?.campaign?.currentNodeId || null,
      rewardsClaimed: state?.rewardLog?.length || 0,
      army: profileArmySummary(state)`,
  'profile list army projection');
  source = replaceOnce(source,
`  runtimeValidationOptions,
  createBrowserProfileStore,`,
`  runtimeValidationOptions,
  profileArmySummary,
  createBrowserProfileStore,`,
  'profile army export');
  write(file, source);
}

function patchPresenterBridge() {
  const file = 'src/runtime/presenter-bridge.cjs';
  let source = read(file);
  source = replaceOnce(source,
`function eventSnapshot(state, dependencies = {}) {`,
`function armySnapshot(state, dependencies = {}) {
  const army = state.army;
  if (!army) return null;
  const registry = dependencies.contentRegistry;
  const localization = dependencies.localization || null;
  const king = registry?.get?.('king', army.kingId) || null;
  const doctrine = registry?.get?.('doctrine', army.doctrineId) || null;
  const heroes = (army.heroes || []).map((hero) => {
    const content = registry?.get?.('hero', hero.heroId) || null;
    const nameKey = content?.nameKey || hero.nameKey || null;
    return Object.freeze({
      heroId: hero.heroId,
      nameKey,
      name: localizationValue(localization, nameKey, hero.heroId),
      contentPieceType: hero.contentPieceType,
      battlePieceType: hero.battlePieceType,
      pieceType: hero.pieceType,
      relicIds: freezeArray(hero.relicIds || []),
      overrideReason: hero.overrideReason || null
    });
  });
  return Object.freeze({
    regionId: army.regionId,
    kingId: army.kingId,
    kingNameKey: king?.nameKey || army.kingNameKey || null,
    kingName: localizationValue(localization, king?.nameKey || army.kingNameKey, army.kingId),
    doctrineId: army.doctrineId,
    doctrineNameKey: doctrine?.nameKey || null,
    doctrineName: localizationValue(localization, doctrine?.nameKey, army.doctrineId),
    heroIds: freezeArray(army.heroIds || []),
    relicIds: freezeArray(army.relicIds || []),
    heroCount: heroes.length,
    relicCount: (army.relicIds || []).length,
    heroes: freezeArray(heroes)
  });
}

function eventSnapshot(state, dependencies = {}) {`,
  'presenter army snapshot helper');
  source = replaceOnce(source,
`  const campaign = campaignSnapshot(state, dependencies);
  const event = eventSnapshot(state, dependencies);`,
`  const campaign = campaignSnapshot(state, dependencies);
  const army = armySnapshot(state, dependencies);
  const event = eventSnapshot(state, dependencies);`,
  'presenter army snapshot creation');
  source = replaceOnce(source,
`    resources: Object.freeze({
      gold: state.resources.gold,
      supplies: state.campaign.supplies,
      meta: state.resources.meta
    }),
    flags:`,
`    resources: Object.freeze({
      gold: state.resources.gold,
      supplies: state.campaign.supplies,
      meta: state.resources.meta
    }),
    army,
    flags:`,
  'presenter root army field');
  source = replaceOnce(source,
`  recentBattleEvents,
  createPresenterSnapshot,`,
`  recentBattleEvents,
  armySnapshot,
  createPresenterSnapshot,`,
  'presenter army export');
  write(file, source);
}

function patchVerticalSliceApp() {
  const file = 'game/js/vertical-slice-app.mjs';
  let source = read(file);
  source = replaceOnce(source,
`import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';`,
`import { VerticalSlicePresenter } from './vertical-slice-presenter.mjs';
import { kingAssets, doctrineAssets } from './register-01-assets.mjs';
import { heroAssets } from './register-02-assets.mjs';`,
  'profile app asset imports');
  source = replaceOnce(source,
`function profileSelectionMarkup(profiles, options = {}) {`,
`function profileLocalizedValue(options, key, fallback) {
  if (!key) return fallback;
  const localization = options.localization || null;
  if (typeof localization === 'function') return localization(key) ?? fallback;
  if (localization && typeof localization.get === 'function') return localization.get(key) ?? fallback;
  return localization?.[key] ?? fallback;
}

function profileContentName(options, kind, id, explicitNameKey = null) {
  const record = options.registry?.get?.(kind, id) || null;
  const nameKey = record?.nameKey || explicitNameKey;
  return profileLocalizedValue(options, nameKey, id || '—');
}

function profileRuntimeStatus(status, language = 'ru') {
  const labels = language === 'en'
    ? { campaign: 'Campaign map', deployment: 'Deployment', event: 'Event', scenario: 'Battle', boss: 'Boss battle', boss_transition: 'Boss transition', reward: 'Reward', complete: 'Completed', failed: 'Defeated' }
    : { campaign: 'Карта похода', deployment: 'Расстановка', event: 'Событие', scenario: 'Бой', boss: 'Битва с боссом', boss_transition: 'Смена фазы босса', reward: 'Награда', complete: 'Поход завершён', failed: 'Поражение' };
  return labels[status] || status || labels.campaign;
}

function profileArmyMarkup(profile, options = {}) {
  const army = profile?.army;
  const language = options.language === 'en' ? 'en' : 'ru';
  if (!army) {
    const legacy = language === 'en'
      ? 'The roster will be restored when this legacy save is continued.'
      : 'Состав будет восстановлен при продолжении старого сохранения.';
    return `<p class="rpprofile__army-legacy">${legacy}</p>`;
  }
  const king = kingAssets(army.kingId);
  const doctrine = doctrineAssets(army.doctrineId);
  const kingName = profileContentName(options, 'king', army.kingId, army.kingNameKey);
  const doctrineName = profileContentName(options, 'doctrine', army.doctrineId);
  const copy = language === 'en'
    ? { army: 'Army', king: 'King', doctrine: 'Doctrine', heroes: 'Heroes', relics: 'Relics' }
    : { army: 'Армия', king: 'Король', doctrine: 'Доктрина', heroes: 'Герои', relics: 'Реликвии' };
  const heroes = (army.heroes || []).map((hero) => {
    const assets = heroAssets(hero.heroId);
    const name = profileContentName(options, 'hero', hero.heroId, hero.nameKey);
    const image = assets?.portrait
      ? `<img src="${escapeHtml(assets.portrait)}" alt="${escapeHtml(name)}">`
      : '<span class="rpprofile__hero-fallback">♟</span>';
    return `<figure class="rpprofile__hero" title="${escapeHtml(name)}">${image}<figcaption>${escapeHtml(name)}</figcaption></figure>`;
  }).join('');
  return `<section class="rpprofile__army" aria-label="${copy.army}">
    <div class="rpprofile__command">
      <div class="rpprofile__command-card">${king?.portrait ? `<img src="${escapeHtml(king.portrait)}" alt="${escapeHtml(kingName)}">` : ''}<span><small>${copy.king}</small><b>${escapeHtml(kingName)}</b></span></div>
      <div class="rpprofile__command-card">${doctrine?.emblem ? `<img src="${escapeHtml(doctrine.emblem)}" alt="${escapeHtml(doctrineName)}">` : ''}<span><small>${copy.doctrine}</small><b>${escapeHtml(doctrineName)}</b></span></div>
    </div>
    <div class="rpprofile__army-counts"><span>${copy.heroes}: ${army.heroCount}</span><span>${copy.relics}: ${army.relicCount}</span></div>
    <div class="rpprofile__heroes">${heroes}</div>
  </section>`;
}

function profileSelectionMarkup(profiles, options = {}) {`,
  'profile army markup helpers');
  source = replaceOnce(source,
`    const status = !storageAvailable ? copy.unavailable : available ? \`${'${copy.act} ${profile.act || 1}'}\` : copy.empty;
    const details = available
      ? \`<div class="rpprofile__facts"><span>${'${escapeHtml(profile.runtimeStatus || \'campaign\')}'}<\/span><span>${'${copy.rewards}: ${profile.rewardsClaimed}'}<\/span><span>${'${copy.revision}: ${profile.revision}'}<\/span>${'${date ? `<time>${escapeHtml(date)}</time>` : \'\'}'}<\/div>\`
      : \`<p class="rpprofile__muted">${'${escapeHtml(status)}'}<\/p>\`;`,
`    const status = !storageAvailable ? copy.unavailable : available ? \`${'${copy.act} ${profile.act || 1}'}\` : copy.empty;
    const army = available ? profileArmyMarkup(profile, options) : '';
    const details = available
      ? \`<div class="rpprofile__facts"><span>${'${escapeHtml(profileRuntimeStatus(profile.runtimeStatus, options.language))}'}<\/span><span>${'${copy.rewards}: ${profile.rewardsClaimed}'}<\/span><span>${'${copy.revision}: ${profile.revision}'}<\/span>${'${date ? `<time>${escapeHtml(date)}</time>` : \'\'}'}<\/div>${'${army}'}\`
      : \`<p class="rpprofile__muted">${'${escapeHtml(status)}'}<\/p>\`;`,
  'profile details include army');
  source = replaceOnce(source,
`    return \`<article class="rpprofile__card"><div class="rpprofile__number">${'${number}'}<\/div><div><h2>Profile ${'${number}'}<\/h2><strong>${'${escapeHtml(status)}'}<\/strong>${'${details}'}<\/div><div class="rpprofile__actions">${'${actions}'}<\/div><\/article>\`;`,
`    const profileLabel = options.language === 'en' ? 'Profile' : 'Профиль';
    return \`<article class="rpprofile__card"><div class="rpprofile__number">${'${number}'}<\/div><div><h2>${'${profileLabel} ${number}'}<\/h2><strong>${'${escapeHtml(status)}'}<\/strong>${'${details}'}<\/div><div class="rpprofile__actions">${'${actions}'}<\/div><\/article>\`;`,
  'localized profile card heading');
  source = replaceOnce(source,
`    @media(max-width:850px){.rpprofile__grid{grid-template-columns:1fr}.rpprofile__card{min-height:190px}}`,
`    .rpprofile__army{grid-column:1/-1;margin-top:13px;padding-top:12px;border-top:1px solid #384a65}.rpprofile__command{display:grid;grid-template-columns:1fr 1fr;gap:7px}.rpprofile__command-card{display:flex;align-items:center;gap:7px;min-width:0;padding:7px;border-radius:9px;background:#0b1525}.rpprofile__command-card img{width:38px;height:38px;object-fit:contain;flex:0 0 auto}.rpprofile__command-card span{display:grid;min-width:0}.rpprofile__command-card small{color:#9dafc7}.rpprofile__command-card b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.rpprofile__army-counts{display:flex;justify-content:space-between;gap:8px;margin:9px 0 7px;color:#d9bf79;font-size:12px}.rpprofile__heroes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.rpprofile__hero{min-width:0;margin:0;text-align:center}.rpprofile__hero img,.rpprofile__hero-fallback{display:grid;place-items:center;width:100%;aspect-ratio:1;object-fit:cover;border:1px solid #526885;border-radius:8px;background:#09111e}.rpprofile__hero figcaption{overflow:hidden;margin-top:3px;color:#aebbd0;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.rpprofile__army-legacy{grid-column:1/-1;margin:12px 0 0;color:#d8bd79;font-size:12px}
    @media(max-width:850px){.rpprofile__grid{grid-template-columns:1fr}.rpprofile__card{min-height:190px}.rpprofile__heroes{grid-template-columns:repeat(6,minmax(0,1fr))}}`,
  'profile army styles');
  source = replaceOnce(source,
`    const profiles = runtimeApi.listBrowserProfiles(store, bundle.registry);
    root.innerHTML = profileSelectionMarkup(profiles, { language: baseOptions.language, storageAvailable: Boolean(store) });`,
`    const validation = { contentRegistry: bundle.registry, combatProfiles: bundle.combatProfiles };
    const profiles = runtimeApi.listBrowserProfiles(store, validation);
    root.innerHTML = profileSelectionMarkup(profiles, {
      language: baseOptions.language,
      storageAvailable: Boolean(store),
      registry: bundle.registry,
      localization: bundle.localization?.[baseOptions.language] || null
    });`,
  'profile selector production validation and localization');
  source = replaceOnce(source,
`  profileCopy,
  profileSelectionMarkup,`,
`  profileCopy,
  profileLocalizedValue,
  profileContentName,
  profileRuntimeStatus,
  profileArmyMarkup,
  profileSelectionMarkup,`,
  'profile army helper exports');
  write(file, source);
}

function patchRegister02Presenter() {
  const file = 'game/js/vertical-slice-presenter-register-02.mjs';
  let source = read(file);
  source = replaceOnce(source,
`import { heroAssets } from './register-02-assets.mjs';`,
`import { heroAssets } from './register-02-assets.mjs';
import { kingAssets, doctrineAssets } from './register-01-assets.mjs';`,
  'army panel command asset imports');
  source = replaceOnce(source,
`function deploymentHeroRecord(snapshot, selectedId) {`,
`function heroArmyState(snapshot, heroId) {
  if (!heroId) return Object.freeze({ id: 'unknown', label: 'Нет данных' });
  if (snapshot?.status === 'deployment') {
    const unit = (snapshot.deployment?.units || []).find((entry) => recordHeroId(entry) === heroId);
    if (unit?.square) return Object.freeze({ id: 'field', label: \`На поле: ${'${unit.square}'}\` });
    if (unit) return Object.freeze({ id: 'reserve', label: 'Резерв расстановки' });
  }
  if (['scenario', 'boss'].includes(snapshot?.status)) {
    const piece = (snapshot.scenario?.pieces || []).find((entry) => recordHeroId(entry) === heroId);
    if (piece?.square) return Object.freeze({ id: 'field', label: \`На поле: ${'${piece.square}'}\` });
    const reserve = (snapshot.scenario?.reserve || []).find((entry) => recordHeroId(entry) === heroId);
    if (reserve) return Object.freeze({ id: 'reserve', label: 'В боевом резерве' });
    return Object.freeze({ id: 'inactive', label: 'Не участвует в текущем бою' });
  }
  if (snapshot?.status === 'complete') return Object.freeze({ id: 'complete', label: 'Поход завершён' });
  if (snapshot?.status === 'failed') return Object.freeze({ id: 'failed', label: 'Поход завершён поражением' });
  return Object.freeze({ id: 'roster', label: 'В составе похода' });
}

function armyPanelMarkup(snapshot) {
  const army = snapshot?.army;
  if (!army) return '';
  const king = kingAssets(army.kingId);
  const doctrine = doctrineAssets(army.doctrineId);
  const heroes = (army.heroes || []).map((hero) => {
    const profile = heroProfile(hero.heroId);
    const assets = heroAssets(hero.heroId);
    const state = heroArmyState(snapshot, hero.heroId);
    const name = hero.name || profile?.name || hero.heroId;
    return `<article class="rp02-army-hero rp02-army-hero--${state.id}">
      ${assets?.portrait ? `<img src="${assets.portrait}" alt="${name}">` : ''}
      <div><strong>${name}</strong><span>${state.label}</span><small>${hero.relicIds?.length || 0} реликв.</small></div>
    </article>`;
  }).join('');
  return `<aside class="rpvs__panel rp02-army-panel" data-rp02-army-panel>
    <div class="rpvs__panel-head"><h2 class="rpvs__title">Армия</h2><span class="rpvs__chip">${army.heroCount} гер.</span></div>
    <div class="rpvs__panel-body">
      <div class="rp02-army-command">
        ${king?.portrait ? `<img src="${king.portrait}" alt="${army.kingName}">` : ''}
        <div><small>Король</small><strong>${army.kingName}</strong></div>
        ${doctrine?.emblem ? `<img src="${doctrine.emblem}" alt="${army.doctrineName}">` : ''}
        <div><small>Доктрина</small><strong>${army.doctrineName}</strong></div>
      </div>
      <div class="rp02-army-summary"><span>Героев: ${army.heroCount}</span><span>Реликвий: ${army.relicCount}</span></div>
      <div class="rp02-army-list">${heroes}</div>
    </div>
  </aside>`;
}

function ensureArmyStyles(document) {
  if (document.getElementById('rp02-army-styles')) return;
  const style = document.createElement('style');
  style.id = 'rp02-army-styles';
  style.textContent = `
    .rpvs__layout.rpvs__layout--army{grid-template-columns:minmax(0,1fr) 330px 280px;max-width:1680px}.rp02-army-panel{align-self:start;position:sticky;top:18px;max-height:calc(100vh - 36px);overflow:auto}.rp02-army-command{display:grid;grid-template-columns:48px minmax(0,1fr);gap:7px 9px;align-items:center}.rp02-army-command img{width:48px;height:48px;object-fit:contain;border-radius:9px;background:#08111f}.rp02-army-command div{display:grid;min-width:0}.rp02-army-command small,.rp02-army-hero span,.rp02-army-hero small{color:#aab4c4;font-size:11px}.rp02-army-command strong,.rp02-army-hero strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rp02-army-summary{display:flex;justify-content:space-between;gap:8px;margin:12px 0;color:#f2cf76;font-size:12px}.rp02-army-list{display:grid;gap:7px}.rp02-army-hero{display:grid;grid-template-columns:48px minmax(0,1fr);gap:9px;align-items:center;padding:7px;border:1px solid #3b4f6c;border-radius:10px;background:#111d30}.rp02-army-hero img{width:48px;height:48px;object-fit:cover;border-radius:8px}.rp02-army-hero div{display:grid;min-width:0}.rp02-army-hero--field{border-color:#6ea77e}.rp02-army-hero--reserve{border-color:#b9964c}.rp02-army-hero--inactive{opacity:.66}.rp02-army-hero--failed{border-color:#a75e5e}@media(max-width:1280px){.rpvs__layout.rpvs__layout--army{grid-template-columns:minmax(0,1fr) 330px}.rp02-army-panel{position:static;grid-column:1/-1;max-height:none}.rp02-army-list{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:980px){.rp02-army-list{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.rp02-army-list{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function installArmyPanel(root, snapshot) {
  const layout = root.querySelector('.rpvs__layout');
  if (!layout || !snapshot?.army) return null;
  layout.querySelector('[data-rp02-army-panel]')?.remove();
  layout.classList.add('rpvs__layout--army');
  const host = layout.ownerDocument.createElement('div');
  host.innerHTML = armyPanelMarkup(snapshot);
  const panel = host.firstElementChild;
  if (panel) layout.appendChild(panel);
  return panel;
}

function deploymentHeroRecord(snapshot, selectedId) {`,
  'persistent army panel helpers');
  source = replaceOnce(source,
`    ensureCodexStyles(this.root.ownerDocument);`,
`    ensureCodexStyles(this.root.ownerDocument);
    ensureArmyStyles(this.root.ownerDocument);`,
  'persistent army panel styles');
  source = replaceOnce(source,
`    super.render(snapshotInput);
    installRegister02Codex(this.root, { target: '.rpvs__resources', label: 'Кодекс' });`,
`    super.render(snapshotInput);
    installArmyPanel(this.root, snapshotInput);
    installRegister02Codex(this.root, { target: '.rpvs__resources', label: 'Кодекс' });`,
  'persistent army panel render');
  source = replaceOnce(source,
`  heroIconMarkup,
  deploymentHeroRecord,`,
`  heroIconMarkup,
  heroArmyState,
  armyPanelMarkup,
  ensureArmyStyles,
  installArmyPanel,
  deploymentHeroRecord,`,
  'persistent army panel exports');
  write(file, source);
}

function patchPackage() {
  const file = 'package.json';
  const packageJson = JSON.parse(read(file));
  const anchor = 'node tests/browser-profile-selector.cjs';
  if (!packageJson.scripts.test.includes('tests/army-ui-surfaces.cjs')) {
    if (!packageJson.scripts.test.includes(anchor)) throw new Error('package test anchor missing');
    packageJson.scripts.test = packageJson.scripts.test.replace(anchor, `${anchor} && node tests/army-ui-surfaces.cjs`);
  }
  write(file, JSON.stringify(packageJson, null, 2) + '\n');
}

patchProfilePersistence();
patchPresenterBridge();
patchVerticalSliceApp();
patchRegister02Presenter();
patchPackage();
console.log('Applied profile army cards and persistent army presenter panel.');
