import { platform } from '../platform.mjs';
import { currentLanguage, subscribe } from '../i18n.mjs';
import { readRun, writeRun } from '../run-persistence.mjs';

const AD_RECEIPTS_STORAGE_KEY = 'rpchess.reboot.v1.ad-receipts';
const MONETIZATION_SCHEMA_VERSION = 1;
const REWARDED_INTERSTITIAL_COOLDOWN_MS = 60_000;
const INTERSTITIAL_STEP_INTERVAL = 5;
const STARVATION_RESCUE_SUPPLIES = 5;
const TRAVEL_EVENTS = Object.freeze([
  'rpchess:skirmish-open',
  'rpchess:battle-open',
  'rpchess:event-open',
  'rpchess:settlement-open',
  'rpchess:puzzle-open'
]);

const COPY = Object.freeze({
  ru:Object.freeze({
    doubleGold:'×2 золота за просмотр рекламы',
    doubleGoldBusy:'Проверяем рекламу…',
    doubleGoldDone:'Золото удвоено',
    doubleGoldUnavailable:'Реклама сейчас недоступна',
    rescueKicker:'НЕ ХВАТАЕТ ПРИПАСОВ',
    rescueTitle:'Избежать голода?',
    rescueBody:'Посмотрите рекламу и получите 5 припасов. Стоимость уже выбранного пути будет оплачена сразу, и отряд продолжит путь без голода.',
    rescueReward:'Получить 5 припасов',
    rescueDecline:'Продолжить без рекламы',
    rescueBusy:'Проверяем рекламу…'
  }),
  en:Object.freeze({
    doubleGold:'Double gold by watching an ad',
    doubleGoldBusy:'Checking ad…',
    doubleGoldDone:'Gold doubled',
    doubleGoldUnavailable:'Ad is unavailable right now',
    rescueKicker:'NOT ENOUGH SUPPLIES',
    rescueTitle:'Avoid starvation?',
    rescueBody:'Watch a rewarded ad to get 5 Supplies. The already selected route will be paid immediately and the party will continue without starvation.',
    rescueReward:'Get 5 Supplies',
    rescueDecline:'Continue without ad',
    rescueBusy:'Checking ad…'
  })
});

let installed = false;
let starvationBound = false;
let rescueModal = null;
let pendingRescue = null;
let unsubscribeLanguage = null;

function copy() { return COPY[currentLanguage() === 'en' ? 'en' : 'ru']; }
function localStore() { return platform.storage.local; }
function nowMs() { return Date.now(); }

function defaultState() {
  return {
    schemaVersion:MONETIZATION_SCHEMA_VERSION,
    lastRewardedAt:0,
    pendingInterstitial:null,
    receipts:{}
  };
}

function normalizeReceipt(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id) return null;
  return {
    ...value,
    id:value.id,
    type:String(value.type || ''),
    status:String(value.status || ''),
    granted:Boolean(value.granted),
    updatedAt:Math.max(0, Math.floor(Number(value.updatedAt) || 0))
  };
}

function normalizeState(value) {
  if (!value || value.schemaVersion !== MONETIZATION_SCHEMA_VERSION) return defaultState();
  const receipts = {};
  for (const [key, raw] of Object.entries(value.receipts || {})) {
    const receipt = normalizeReceipt(raw);
    if (receipt) receipts[key] = receipt;
  }
  const pending = value.pendingInterstitial && Number.isInteger(value.pendingInterstitial.step)
    ? {
        runId:String(value.pendingInterstitial.runId || ''),
        step:value.pendingInterstitial.step,
        eligibleAfterStep:Number.isInteger(value.pendingInterstitial.eligibleAfterStep)
          ? value.pendingInterstitial.eligibleAfterStep
          : value.pendingInterstitial.step,
        createdAt:Math.max(0, Math.floor(Number(value.pendingInterstitial.createdAt) || 0))
      }
    : null;
  return {
    schemaVersion:MONETIZATION_SCHEMA_VERSION,
    lastRewardedAt:Math.max(0, Math.floor(Number(value.lastRewardedAt) || 0)),
    pendingInterstitial:pending,
    receipts
  };
}

function readMonetizationState() {
  try {
    const raw = localStore()?.getItem(AD_RECEIPTS_STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultState();
  }
}

function writeMonetizationState(state) {
  const normalized = normalizeState({ ...state, schemaVersion:MONETIZATION_SCHEMA_VERSION });
  try { localStore()?.setItem(AD_RECEIPTS_STORAGE_KEY, JSON.stringify(normalized)); }
  catch (error) { console.warn('[RPChess] monetization state write failed', error); }
  if (typeof globalThis.dispatchEvent === 'function' && typeof globalThis.CustomEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent('rpchess:ad-receipts-updated', { detail:{ state:normalized } }));
  }
  return normalized;
}

function updateReceipt(id, patch) {
  const state = readMonetizationState();
  const previous = state.receipts[id] || { id, type:patch?.type || '', status:'new', granted:false, updatedAt:0 };
  const receipt = normalizeReceipt({ ...previous, ...patch, id, updatedAt:nowMs() });
  return writeMonetizationState({ ...state, receipts:{ ...state.receipts, [id]:receipt } }).receipts[id];
}

function receipt(id) { return readMonetizationState().receipts[id] || null; }

function featureOverride(name) {
  const flags = globalThis.RPChessFeatureFlags;
  if (flags && typeof flags === 'object' && typeof flags[name] === 'boolean') return flags[name];
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    if (params.get('rpchess_ads') === '0') return false;
    const value = params.get(`rpchess_${name}`);
    if (value === '0') return false;
    if (value === '1') return true;
  } catch {}
  return null;
}

function featureEnabled(name) {
  const override = featureOverride(name);
  if (override !== null) return override && platform.launch.isVK();
  return platform.launch.isVK();
}

function dueInterstitial(step) {
  return Number.isInteger(step) && step > 0 && step % INTERSTITIAL_STEP_INTERVAL === 0;
}

function interstitialReceiptId(runId, step) { return `interstitial:${runId}:${step}`; }
function rescueReceiptId(runId, choiceId) { return `rescue:${runId}:${choiceId}`; }
function doubleGoldReceiptId(runId, kind, count, amount) { return `double-gold:${runId}:${kind}:${count}:${amount}`; }

function rewardedCooldownRemaining(state = readMonetizationState(), now = nowMs()) {
  return Math.max(0, REWARDED_INTERSTITIAL_COOLDOWN_MS - (Number(now) - Number(state.lastRewardedAt || 0)));
}

function noteRewardedExposure(result, now = nowMs()) {
  if (!['completed','closed'].includes(result?.status)) return readMonetizationState();
  const state = readMonetizationState();
  return writeMonetizationState({ ...state, lastRewardedAt:Number(now) });
}

function setPendingInterstitial(runId, step, { eligibleAfterStep = step } = {}) {
  const state = readMonetizationState();
  const current = state.pendingInterstitial;
  if (current && current.runId === String(runId) && current.step <= step) return current;
  const pending = { runId:String(runId || ''), step, eligibleAfterStep, createdAt:nowMs() };
  writeMonetizationState({ ...state, pendingInterstitial:pending });
  return pending;
}

function clearPendingInterstitial(expected = null) {
  const state = readMonetizationState();
  if (expected && state.pendingInterstitial && (state.pendingInterstitial.runId !== expected.runId || state.pendingInterstitial.step !== expected.step)) return state;
  return writeMonetizationState({ ...state, pendingInterstitial:null });
}

function adGatePassed(detail) { return Boolean(detail?.__rpchessAdGatePassed); }
function travelSource(detail) { return detail?.source === 'travel-choice'; }

function redispatchTravelEvent(name, detail) {
  globalThis.dispatchEvent?.(new CustomEvent(name, { detail:{ ...(detail || {}), __rpchessAdGatePassed:true } }));
}

async function serveInterstitial(name, detail, pending, currentStep) {
  const id = interstitialReceiptId(pending.runId, pending.step);
  updateReceipt(id, { type:'interstitial', status:'pending', runId:pending.runId, step:pending.step });
  let result;
  try { result = await platform.ads.show('interstitial'); }
  catch (error) {
    console.warn('[RPChess] interstitial failed', error);
    result = { status:'error', format:'interstitial' };
  }
  updateReceipt(id, { type:'interstitial', status:result.status, runId:pending.runId, step:pending.step });
  clearPendingInterstitial(pending);
  if (dueInterstitial(currentStep) && currentStep !== pending.step) {
    setPendingInterstitial(detail?.runId || pending.runId, currentStep, { eligibleAfterStep:currentStep + 1 });
  }
  redispatchTravelEvent(name, detail);
}

function onTravelOpenEvent(event) {
  const detail = event?.detail || {};
  if (!travelSource(detail) || adGatePassed(detail) || !featureEnabled('interstitial')) return;
  const run = readRun();
  if (!run || run.ended) return;
  const step = Number.isInteger(run.activeTravelChoice?.step) ? run.activeTravelChoice.step : run.journeyStep;
  let state = readMonetizationState();
  let pending = state.pendingInterstitial;
  if (dueInterstitial(step) && !receipt(interstitialReceiptId(run.id, step))) {
    pending = pending || setPendingInterstitial(run.id, step);
    state = readMonetizationState();
  }
  if (!pending || pending.runId !== run.id || step < pending.eligibleAfterStep) return;
  if (rewardedCooldownRemaining(state) > 0) return;
  event.stopImmediatePropagation?.();
  event.preventDefault?.();
  void serveInterstitial(event.type, detail, pending, step);
}

function ensureStyles() {
  if (document.querySelector('[data-rpchess-monetization-style]')) return;
  const style = document.createElement('style');
  style.dataset.rpchessMonetizationStyle = '';
  style.textContent = `
.resource-combat-reward .rpchess-ad-offer{grid-column:3;grid-row:1;justify-self:end;display:grid;gap:0;margin:0}
.resource-combat-reward .rpchess-ad-offer__button{min-width:72px;min-height:42px;padding:6px 14px;font-size:22px;line-height:1}
.resource-combat-reward .rpchess-ad-offer__note{display:none}
.rpchess-rescue[hidden]{display:none!important}
.rpchess-rescue{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;padding:clamp(12px,2.5vw,28px);box-sizing:border-box;background:rgba(2,6,12,.82);backdrop-filter:blur(3px)}
.rpchess-rescue__card{width:min(560px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:hidden;box-sizing:border-box;padding:22px 24px;border:1px solid rgba(210,180,112,.72);border-radius:14px;background:rgba(7,13,22,.98);box-shadow:0 22px 72px rgba(0,0,0,.55);display:grid;gap:12px}
.rpchess-rescue__kicker{font:700 11px/1.1 system-ui,sans-serif;letter-spacing:.16em;color:#d9bd7b}
.rpchess-rescue__card h2,.rpchess-rescue__card p{margin:0}.rpchess-rescue__card p{font:500 15px/1.4 system-ui,sans-serif;color:rgba(244,247,250,.9)}
.rpchess-rescue__actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-height:430px){.rpchess-ad-offer{margin:3px 0;gap:2px}.rpchess-ad-offer__button{min-height:32px;padding-top:5px!important;padding-bottom:5px!important;font-size:12px!important}.rpchess-ad-offer__note{font-size:10px}.rpchess-rescue{padding:10px 14px}.rpchess-rescue__card{width:min(660px,calc(100vw - 28px));max-height:calc(100dvh - 20px);padding:12px 16px;gap:7px}.rpchess-rescue__kicker{font-size:9px}.rpchess-rescue__card h2{font-size:22px}.rpchess-rescue__card p{font-size:12px;line-height:1.3}.rpchess-rescue__actions .reboot-button{min-height:34px;padding-top:5px!important;padding-bottom:5px!important;font-size:11px!important}}
`;
  document.head.append(style);
}

function runClaimIds(run) { return Array.isArray(run?.adRewardClaims) ? run.adRewardClaims.filter((id) => typeof id === 'string') : []; }
function hasRunClaim(run, id) { return runClaimIds(run).includes(id); }

function markRunClaim(run, id) {
  return { ...run, adRewardClaims:[...new Set([...runClaimIds(run), id])] };
}

function grantDoubleGold({ receiptId, kind, count, amount }) {
  let run = readRun();
  if (!run || run.id !== receipt(receiptId)?.runId) return false;
  if (hasRunClaim(run, receiptId)) {
    updateReceipt(receiptId, { granted:true, status:'completed' });
    return true;
  }
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!safeAmount) return false;
  const key = kind === 'battle' ? 'lastBattle' : 'lastSkirmish';
  const last = run[key];
  if (!last || Number(run[`${kind}Count`]) !== Number(count)) return false;
  run = markRunClaim({
    ...run,
    gold:(run.gold || 0) + safeAmount,
    [key]:{ ...last, adBonusGold:safeAmount }
  }, receiptId);
  writeRun(run);
  updateReceipt(receiptId, { granted:true, status:'completed' });
  globalThis.dispatchEvent?.(new CustomEvent('rpchess:run-updated', { detail:{ source:'rewarded-double-gold', kind, count } }));
  globalThis.dispatchEvent?.(new CustomEvent('rpchess:resources-updated', { detail:{ source:'rewarded-double-gold', goldReward:safeAmount } }));
  return true;
}

async function claimDoubleGold(button, note, meta) {
  const { receiptId, kind, count, amount, runId } = meta;
  const existing = receipt(receiptId);
  if (existing?.granted) return;
  button.disabled = true;
  button.textContent = '…';
  updateReceipt(receiptId, { type:'double-gold', status:'pending', granted:false, runId, kind, count, amount });
  let result;
  try { result = await platform.ads.show('reward'); }
  catch (error) {
    console.warn('[RPChess] rewarded double-gold failed', error);
    result = { status:'error', format:'reward' };
  }
  noteRewardedExposure(result);
  if (result.status === 'completed') {
    updateReceipt(receiptId, { type:'double-gold', status:'completed', granted:false, runId, kind, count, amount });
    if (grantDoubleGold(meta)) {
      button.textContent = '✓×2';
      note.textContent = `+${amount}`;
      return;
    }
  }
  updateReceipt(receiptId, { type:'double-gold', status:result.status, granted:false, runId, kind, count, amount });
  note.textContent = copy().doubleGoldUnavailable;
  button.textContent = '×2';
  button.disabled = false;
}

function renderDoubleGoldOffer(kind, count) {
  if (!featureEnabled('rewarded')) return false;
  const run = readRun();
  if (!run || run.ended) return false;
  const key = kind === 'battle' ? 'lastBattle' : 'lastSkirmish';
  const amount = Math.max(0, Math.floor(Number(run[key]?.goldReward) || 0));
  if (!amount || Number(run[`${kind}Count`]) !== Number(count)) return false;
  const receiptId = doubleGoldReceiptId(run.id, kind, count, amount);
  const claimed = Boolean(receipt(receiptId)?.granted || hasRunClaim(run, receiptId));
  const screen = document.querySelector(kind === 'battle' ? '[data-battle-aftermath]' : '[data-skirmish-aftermath]');
  const reward = screen?.querySelector('[data-resource-combat-reward]');
  if (!reward || screen.hidden) return false;
  const existing = reward.querySelector('[data-ad-double-gold]');
  if (existing) {
    const button = existing.querySelector('[data-ad-double-gold-button]');
    if (claimed && button) { button.disabled = true; button.textContent = '×2'; }
    return true;
  }
  const root = document.createElement('div');
  root.className = 'rpchess-ad-offer';
  root.dataset.adDoubleGold = '';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reboot-button reboot-button--primary rpchess-ad-offer__button';
  button.dataset.adDoubleGoldButton = '';
  button.textContent = '×2';
  button.title = copy().doubleGold;
  button.setAttribute('aria-label', copy().doubleGold);
  const note = document.createElement('div');
  note.className = 'rpchess-ad-offer__note';
  note.dataset.adDoubleGoldNote = '';
  root.append(button, note);
  reward.append(root);
  if (claimed) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    return true;
  }
  button.addEventListener('click', () => void claimDoubleGold(button, note, { receiptId, kind, count, amount, runId:run.id }));
  return true;
}
function scheduleDoubleGoldOffer(kind, count, attempts = 16) {
  if (renderDoubleGoldOffer(kind, count) || attempts <= 0) return;
  const retry = () => scheduleDoubleGoldOffer(kind, count, attempts - 1);
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(retry);
  else setTimeout(retry, 0);
}

function onCombatCompleted(event) {
  const kind = event?.detail?.kind;
  const count = Number(event?.detail?.count);
  if (!['battle','skirmish'].includes(kind) || !Number.isInteger(count)) return;
  queueMicrotask(() => scheduleDoubleGoldOffer(kind, count));
}

function onDoubleGoldRunUpdated(event) {
  if (event?.detail?.source !== 'rewarded-double-gold') return;
  const kind = event.detail.kind;
  const count = Number(event.detail.count);
  if (!['battle','skirmish'].includes(kind) || !Number.isInteger(count)) return;
  const renderCompletedOffer = () => scheduleDoubleGoldOffer(kind, count);
  if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(renderCompletedOffer);
  else setTimeout(renderCompletedOffer, 0);
}

function rescueEligible(run) {
  const choice = run?.activeTravelChoice;
  return Boolean(
    featureEnabled('rewarded') &&
    run && choice &&
    choice.starvationVictimId &&
    Number.isInteger(choice.supplyCostAtSelection) &&
    Number.isInteger(choice.supplyPaid) &&
    choice.supplyPaid < choice.supplyCostAtSelection
  );
}

function stripStarvation(choice) {
  if (!choice) return choice;
  const {
    starvationVictimId,
    starvationVictimPreviousStatus,
    starvationKingDied,
    starvationAcknowledged,
    ...clean
  } = choice;
  return clean;
}

function applyStarvationRescue(run, receiptId) {
  const choice = run?.activeTravelChoice;
  if (!run || !choice) return null;
  if (hasRunClaim(run, receiptId)) return run;
  const missing = Math.max(0, Number(choice.supplyCostAtSelection || 0) - Number(choice.supplyPaid || 0));
  const restoredStatus = ['healthy','wounded'].includes(choice.starvationVictimPreviousStatus)
    ? choice.starvationVictimPreviousStatus
    : 'healthy';
  const rescuedChoice = {
    ...stripStarvation(choice),
    supplyPaid:choice.supplyCostAtSelection,
    starvationRescued:true,
    starvationRescueReceiptId:receiptId
  };
  const rescued = markRunClaim({
    ...run,
    supplies:Math.max(0, Number(run.supplies || 0) + STARVATION_RESCUE_SUPPLIES - missing),
    roster:(run.roster || []).map((character) => character.id === choice.starvationVictimId ? { ...character, status:restoredStatus } : character),
    activeTravelChoice:rescuedChoice,
    ...(run.endReason === 'starvation_king' ? { ended:false, endReason:null } : {})
  }, receiptId);
  return rescued;
}

function dispatchRescuedEncounter(run) {
  const choice = run?.activeTravelChoice;
  const events = {
    skirmish:'rpchess:skirmish-open',
    battle:'rpchess:battle-open',
    event:'rpchess:event-open',
    settlement:'rpchess:settlement-open',
    puzzle:'rpchess:puzzle-open'
  };
  const name = events[choice?.type];
  if (!name) return false;
  redispatchTravelEvent(name, { source:'travel-choice', runId:run.id, choice });
  return true;
}

function hideRescueModal() {
  if (rescueModal) rescueModal.hidden = true;
  document.body.classList.remove('rpchess-rescue-open');
  pendingRescue = null;
}

function resetRescueActions() {
  const reward = rescueModal?.querySelector('[data-rescue-reward]');
  const decline = rescueModal?.querySelector('[data-rescue-decline]');
  if (reward) reward.disabled = false;
  if (decline) decline.disabled = false;
}

function renderRescueCopy() {
  if (!rescueModal) return;
  const text = copy();
  const kicker = rescueModal.querySelector('[data-rescue-kicker]');
  const title = rescueModal.querySelector('[data-rescue-title]');
  const body = rescueModal.querySelector('[data-rescue-body]');
  const reward = rescueModal.querySelector('[data-rescue-reward]');
  const decline = rescueModal.querySelector('[data-rescue-decline]');
  if (kicker) kicker.textContent = text.rescueKicker;
  if (title) title.textContent = text.rescueTitle;
  if (body) body.textContent = text.rescueBody;
  if (reward) reward.textContent = text.rescueReward;
  if (decline) decline.textContent = text.rescueDecline;
}

function ensureRescueModal() {
  if (rescueModal) return rescueModal;
  ensureStyles();
  rescueModal = document.createElement('div');
  rescueModal.className = 'rpchess-rescue';
  rescueModal.setAttribute('data-starvation-rescue', '');
  rescueModal.hidden = true;
  rescueModal.innerHTML = `
    <section class="rpchess-rescue__card ui-panel-surface" role="dialog" aria-modal="true" aria-labelledby="rpchess-rescue-title" aria-describedby="rpchess-rescue-body">
      <div class="rpchess-rescue__kicker" data-rescue-kicker></div>
      <h2 id="rpchess-rescue-title" data-rescue-title></h2>
      <p id="rpchess-rescue-body" data-rescue-body></p>
      <div class="rpchess-rescue__actions">
        <button class="reboot-button reboot-button--primary" type="button" data-rescue-reward></button>
        <button class="reboot-button reboot-button--primary" type="button" data-rescue-decline></button>
      </div>
    </section>`;
  rescueModal.querySelector('[data-rescue-decline]')?.addEventListener('click', () => {
    const pending = pendingRescue;
    hideRescueModal();
    pending?.originalOpen?.(pending.run);
  });
  rescueModal.querySelector('[data-rescue-reward]')?.addEventListener('click', () => void claimStarvationRescue());
  document.body.append(rescueModal);
  renderRescueCopy();
  return rescueModal;
}

async function claimStarvationRescue() {
  const pending = pendingRescue;
  if (!pending) return;
  const button = rescueModal?.querySelector('[data-rescue-reward]');
  const decline = rescueModal?.querySelector('[data-rescue-decline]');
  if (button) { button.disabled = true; button.textContent = copy().rescueBusy; }
  if (decline) decline.disabled = true;
  const choice = pending.run.activeTravelChoice;
  const receiptId = rescueReceiptId(pending.run.id, choice.id);
  updateReceipt(receiptId, { type:'starvation-rescue', status:'pending', granted:false, runId:pending.run.id, routeId:choice.id, supplies:STARVATION_RESCUE_SUPPLIES });
  let result;
  try { result = await platform.ads.show('reward'); }
  catch (error) {
    console.warn('[RPChess] starvation rescue rewarded failed', error);
    result = { status:'error', format:'reward' };
  }
  noteRewardedExposure(result);
  if (result.status === 'completed') {
    updateReceipt(receiptId, { type:'starvation-rescue', status:'completed', granted:false, runId:pending.run.id, routeId:choice.id, supplies:STARVATION_RESCUE_SUPPLIES });
    const current = readRun() || pending.run;
    const rescued = applyStarvationRescue(current, receiptId);
    if (rescued) {
      const persisted = writeRun(rescued);
      updateReceipt(receiptId, { type:'starvation-rescue', status:'completed', granted:true, runId:persisted.id, routeId:choice.id, supplies:STARVATION_RESCUE_SUPPLIES });
      globalThis.dispatchEvent?.(new CustomEvent('rpchess:run-updated', { detail:{ source:'rewarded-starvation-rescue' } }));
      hideRescueModal();
      dispatchRescuedEncounter(persisted);
      return;
    }
  }
  updateReceipt(receiptId, { type:'starvation-rescue', status:result.status, granted:false, runId:pending.run.id, routeId:choice.id, supplies:STARVATION_RESCUE_SUPPLIES });
  const originalOpen = pending.originalOpen;
  const originalRun = pending.run;
  hideRescueModal();
  originalOpen?.(originalRun);
}

async function prepareStarvationRescue(run, originalOpen) {
  const choice = run.activeTravelChoice;
  if (dueInterstitial(choice.step) || readMonetizationState().pendingInterstitial) {
    setPendingInterstitial(run.id, readMonetizationState().pendingInterstitial?.step || choice.step, { eligibleAfterStep:choice.step + 1 });
  }
  let available = false;
  try { available = await platform.ads.check('reward'); }
  catch {}
  if (!available) {
    originalOpen(run);
    return;
  }
  pendingRescue = { run, originalOpen };
  const modal = ensureRescueModal();
  // A previous cancelled/failed rewarded request disables both controls while it is pending.
  // The modal is reused for the next starvation event, so make each new presentation interactive.
  resetRescueActions();
  renderRescueCopy();
  modal.hidden = false;
  document.body.classList.add('rpchess-rescue-open');
  requestAnimationFrame(() => modal.querySelector('[data-rescue-reward]')?.focus());
}

function bindStarvationRescue() {
  if (starvationBound) return true;
  const original = globalThis.RPChessStarvation;
  if (!original?.open) return false;
  const originalOpen = original.open.bind(original);
  const wrapper = Object.freeze({
    open(run) {
      if (!rescueEligible(run)) return originalOpen(run);
      const id = rescueReceiptId(run.id, run.activeTravelChoice.id);
      if (receipt(id)?.granted || hasRunClaim(run, id)) return originalOpen(run);
      void prepareStarvationRescue(run, originalOpen);
      return true;
    },
    render:original.render?.bind(original),
    get run() { return original.run; }
  });
  globalThis.RPChessStarvation = wrapper;
  starvationBound = true;
  return true;
}

function reconcileCompletedRewards() {
  const state = readMonetizationState();
  for (const item of Object.values(state.receipts)) {
    if (item.status !== 'completed' || item.granted) continue;
    if (item.type === 'double-gold') {
      grantDoubleGold({ receiptId:item.id, kind:item.kind, count:item.count, amount:item.amount });
      continue;
    }
    if (item.type === 'starvation-rescue') {
      const run = readRun();
      if (!run || run.id !== item.runId || run.activeTravelChoice?.id !== item.routeId) continue;
      const rescued = applyStarvationRescue(run, item.id);
      if (!rescued) continue;
      writeRun(rescued);
      updateReceipt(item.id, { granted:true, status:'completed' });
      globalThis.dispatchEvent?.(new CustomEvent('rpchess:run-updated', { detail:{ source:'rewarded-recovery' } }));
    }
  }
}

function installMonetization() {
  if (installed) return;
  installed = true;
  ensureStyles();
  for (const name of TRAVEL_EVENTS) globalThis.addEventListener?.(name, onTravelOpenEvent);
  globalThis.addEventListener?.('rpchess:combat-completed', onCombatCompleted);
  globalThis.addEventListener?.('rpchess:run-updated', onDoubleGoldRunUpdated);
  unsubscribeLanguage = subscribe(() => {
    renderRescueCopy();
    for (const button of document.querySelectorAll('[data-ad-double-gold-button]')) {
      button.title = copy().doubleGold;
      button.setAttribute('aria-label', copy().doubleGold);
      if (!button.disabled) button.textContent = '×2';
    }
  });
  reconcileCompletedRewards();
  globalThis.RPChessMonetization = Object.freeze({
    state:readMonetizationState,
    dueInterstitial,
    bindStarvationRescue,
    renderDoubleGoldOffer,
    reconcileCompletedRewards
  });
}

function destroyMonetization() {
  unsubscribeLanguage?.();
  unsubscribeLanguage = null;
}

export {
  AD_RECEIPTS_STORAGE_KEY,
  MONETIZATION_SCHEMA_VERSION,
  REWARDED_INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_STEP_INTERVAL,
  STARVATION_RESCUE_SUPPLIES,
  dueInterstitial,
  interstitialReceiptId,
  rescueReceiptId,
  doubleGoldReceiptId,
  readMonetizationState,
  writeMonetizationState,
  rewardedCooldownRemaining,
  installMonetization,
  bindStarvationRescue,
  reconcileCompletedRewards,
  destroyMonetization
};
