import { currentLanguage } from './i18n.mjs';

const COPY = Object.freeze({
  ru:Object.freeze({
    kicker:'ОБЛАЧНОЕ СОХРАНЕНИЕ',
    title:'Найдены два разных забега',
    body:'Выберите, какой прогресс продолжить. Выбранная версия станет основной для этого VK-профиля.',
    local:'На этом устройстве',
    cloud:'В облаке',
    noRun:'Нет активного забега',
    week:'Неделя {week}',
    power:'Мощь {power}',
    updated:'Сохранено {date}',
    chooseLocal:'Продолжить этот забег',
    chooseCloud:'Продолжить облачный',
    working:'Синхронизация…',
    error:'Не удалось синхронизировать сохранение. Проверьте соединение и попробуйте снова.'
  }),
  en:Object.freeze({
    kicker:'CLOUD SAVE',
    title:'Two different runs were found',
    body:'Choose which progress to continue. The selected version will become authoritative for this VK profile.',
    local:'On this device',
    cloud:'In the cloud',
    noRun:'No active run',
    week:'Week {week}',
    power:'Power {power}',
    updated:'Saved {date}',
    chooseLocal:'Continue this run',
    chooseCloud:'Continue cloud run',
    working:'Syncing…',
    error:'The save could not be synchronized. Check your connection and try again.'
  })
});

function text(key, params = {}) {
  const language = currentLanguage() === 'en' ? 'en' : 'ru';
  let value = COPY[language][key] || COPY.ru[key] || key;
  for (const [name, replacement] of Object.entries(params)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

function ensureStylesheet() {
  if (document.querySelector('[data-cloud-save-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/cloud-save.css?v=20260915-v1';
  link.dataset.cloudSaveCss = '';
  document.head.append(link);
}

function safeDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  try {
    const locale = currentLanguage() === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, { dateStyle:'short', timeStyle:'short' }).format(new Date(timestamp));
  } catch { return new Date(timestamp).toISOString(); }
}

function sideView(envelope, label) {
  const run = envelope?.payload?.run || null;
  const power = Math.max(0, Math.round(Number(envelope?.payload?.rating?.power) || 0));
  const week = Math.max(0, Math.round(Number(run?.journeyStep) || 0));
  return {
    label,
    runId:run?.id || null,
    playerName:typeof run?.playerName === 'string' && run.playerName.trim() ? run.playerName.trim() : text('noRun'),
    week,
    power,
    updatedAt:Number(envelope?.updatedAt) || 0
  };
}

function conflictViewModel(conflict) {
  return Object.freeze({
    local:sideView(conflict?.local, text('local')),
    cloud:sideView(conflict?.cloud, text('cloud'))
  });
}

function card(side, choice) {
  const article = document.createElement('article');
  article.className = 'cloud-conflict-card ui-panel-safe';
  article.dataset.cloudConflictChoice = choice;

  const label = document.createElement('div');
  label.className = 'reboot-eyebrow cloud-conflict-card__label';
  label.textContent = side.label;

  const name = document.createElement('h3');
  name.textContent = side.playerName;

  const metrics = document.createElement('div');
  metrics.className = 'cloud-conflict-card__metrics';
  const week = document.createElement('strong');
  week.textContent = text('week', { week:side.week });
  const power = document.createElement('strong');
  power.textContent = text('power', { power:side.power });
  metrics.append(week, power);

  const updated = document.createElement('p');
  updated.className = 'cloud-conflict-card__updated';
  updated.textContent = text('updated', { date:safeDate(side.updatedAt) });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'reboot-button reboot-button--primary cloud-conflict-card__button';
  button.dataset.cloudConflictSelect = choice;
  button.textContent = choice === 'local' ? text('chooseLocal') : text('chooseCloud');

  article.append(label, name, metrics, updated, button);
  return article;
}

function openCloudConflict(conflict, resolver) {
  if (!conflict?.local || !conflict?.cloud || typeof resolver !== 'function') return Promise.resolve(null);
  ensureStylesheet();
  document.querySelector('[data-cloud-conflict-modal]')?.remove();
  const view = conflictViewModel(conflict);

  const modal = document.createElement('div');
  modal.className = 'reboot-modal cloud-conflict-modal';
  modal.dataset.cloudConflictModal = '';
  modal.dataset.modalStatic = '';

  const panel = document.createElement('section');
  panel.className = 'reboot-modal__panel cloud-conflict-panel ui-panel-safe';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'cloud-conflict-title');

  const header = document.createElement('header');
  header.className = 'cloud-conflict-head';
  const kicker = document.createElement('div');
  kicker.className = 'reboot-eyebrow';
  kicker.textContent = text('kicker');
  const title = document.createElement('h2');
  title.id = 'cloud-conflict-title';
  title.textContent = text('title');
  const body = document.createElement('p');
  body.textContent = text('body');
  header.append(kicker, title, body);

  const options = document.createElement('div');
  options.className = 'cloud-conflict-options';
  options.append(card(view.local, 'local'), card(view.cloud, 'cloud'));

  const status = document.createElement('p');
  status.className = 'cloud-conflict-status';
  status.dataset.cloudConflictStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  panel.append(header, options, status);
  modal.append(panel);
  document.body.append(modal);
  document.body.classList.add('reboot-modal-open');

  return new Promise((resolve) => {
    const buttons = [...modal.querySelectorAll('[data-cloud-conflict-select]')];
    const select = async (choice) => {
      buttons.forEach((button) => { button.disabled = true; });
      status.hidden = false;
      status.textContent = text('working');
      let ok = false;
      try { ok = await resolver(choice); }
      catch { ok = false; }
      if (!ok) {
        status.textContent = text('error');
        buttons.forEach((button) => { button.disabled = false; });
        return;
      }
      modal.remove();
      document.body.classList.remove('reboot-modal-open');
      resolve(choice);
    };
    for (const button of buttons) button.addEventListener('click', () => void select(button.dataset.cloudConflictSelect));
    buttons[0]?.focus();
  });
}

export { COPY, conflictViewModel, openCloudConflict };
