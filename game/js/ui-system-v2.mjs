const BUILD_VERSION = 'v1.3.9';
const bypass = new WeakSet();

function createSystemModal(options = {}) {
  const document = options.document || globalThis.document;
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.className = `rpu-system-modal${options.danger ? ' is-danger' : ''}`;
    const input = options.input ? `<input data-rpu-modal-input maxlength="42" value="${String(options.value || '').replace(/[&<>"]/g, '')}" aria-label="${String(options.inputLabel || 'Значение').replace(/[&<>"]/g, '')}">` : '';
    host.innerHTML = `<div class="rpu-system-modal__scrim" data-rpu-modal-cancel></div><section class="rpu-system-modal__card" role="dialog" aria-modal="true"><span class="rpu-kicker">${options.danger ? 'ОПАСНОЕ ДЕЙСТВИЕ' : 'RPCHESS'}</span><h2>${options.title || 'ПОДТВЕРЖДЕНИЕ'}</h2><p>${options.message || ''}</p>${input}<div class="rpu-system-modal__actions"><button class="rpa-button" data-rpu-modal-cancel>ОТМЕНА</button><button class="rpa-button ${options.danger ? 'rpa-button--danger' : 'rpa-button--primary'}" data-rpu-modal-confirm>${options.confirmLabel || 'ПОДТВЕРДИТЬ'}</button></div></section>`;
    const finish = (value) => { document.removeEventListener('keydown', onKey); host.remove(); resolve(value); };
    const onKey = (event) => { if (event.key === 'Escape') finish(null); if (event.key === 'Enter') finish(options.input ? host.querySelector('[data-rpu-modal-input]')?.value ?? '' : true); };
    document.addEventListener('keydown', onKey);
    host.querySelectorAll('[data-rpu-modal-cancel]').forEach((button) => button.addEventListener('click', () => finish(null)));
    host.querySelector('[data-rpu-modal-confirm]')?.addEventListener('click', () => finish(options.input ? host.querySelector('[data-rpu-modal-input]')?.value ?? '' : true));
    document.body.appendChild(host);
    queueMicrotask(() => (host.querySelector('[data-rpu-modal-input]') || host.querySelector('[data-rpu-modal-confirm]'))?.focus());
  });
}

function replayWithNativeBypass(button, kind, value = true) {
  bypass.add(button);
  if (kind === 'confirm') {
    const original = globalThis.confirm;
    globalThis.confirm = () => true;
    try { button.click(); } finally { globalThis.confirm = original; bypass.delete(button); }
  } else {
    const original = globalThis.prompt;
    globalThis.prompt = () => value;
    try { button.click(); } finally { globalThis.prompt = original; bypass.delete(button); }
  }
}

function interceptNativeDialogs(document = globalThis.document) {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('button');
    if (!button || bypass.has(button)) return;
    const profileAction = button.dataset.profileAction;
    if (profileAction === 'new' || profileAction === 'delete') {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const isDelete = profileAction === 'delete';
      const accepted = await createSystemModal({ document, danger:isDelete, title:isDelete ? 'УДАЛИТЬ ХРОНИКУ?' : 'НАЧАТЬ ЗАНОВО?', message:isDelete ? 'Хроника и её резервная копия будут удалены. Это действие нельзя отменить.' : 'Текущее сохранение в этом слоте будет заменено новым походом.', confirmLabel:isDelete ? 'УДАЛИТЬ' : 'НАЧАТЬ ЗАНОВО' });
      if (accepted) replayWithNativeBypass(button, 'confirm');
      return;
    }
    if (button.classList.contains('rpprofile__approved-rename')) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const card = button.closest('[data-profile-id]');
      const current = card?.querySelector('.rpprofile__approved-title')?.textContent?.trim() || 'Хроника';
      const value = await createSystemModal({ document, title:'ПЕРЕИМЕНОВАТЬ ХРОНИКУ', message:'Введите короткое название для этого сохранения.', input:true, inputLabel:'Название хроники', value:current, confirmLabel:'СОХРАНИТЬ' });
      if (value != null) replayWithNativeBypass(button, 'prompt', String(value).trim().slice(0,42));
    }
  }, true);
}

function enhanceMenu(root) {
  const menu = root.querySelector('.rpa-menu');
  if (!menu) return;
  root.querySelectorAll('[data-shell-action="chronicle"]').forEach((button) => button.remove());
  if (!menu.querySelector('.rpu-build-version')) {
    const version = root.ownerDocument.createElement('div');
    version.className = 'rpu-build-version';
    version.textContent = BUILD_VERSION;
    menu.appendChild(version);
  }
}
function enhanceCommander(root) {
  const screen = root.querySelector('.rpa-commander-layout')?.closest('.rpa-subscreen');
  if (!screen) return;
  screen.querySelector('.rpa-field:has([data-world-seed])')?.remove();
  const back = screen.querySelector('[data-shell-action="profiles"]');
  if (back && !back.classList.contains('rpu-logo-back')) {
    back.classList.add('rpu-logo-back');
    back.setAttribute('aria-label','Вернуться к хроникам');
    back.innerHTML = '<img src="generated_assets/logo_main.png" alt="RPChess">';
  }
}
function enhanceRuntime(root) {
  root.querySelectorAll('.rpvs__resources [data-rp02-codex-launch],.rpvs__resources [data-rp03-codex-launch],.rpvs__resources .rp03-codex-launch').forEach((button) => button.remove());
}
function enhanceBoot(root) {
  const boot = root.querySelector('.rpboot');
  if (boot) boot.classList.add('rpu-boot');
}
function enhance(root) { enhanceMenu(root); enhanceCommander(root); enhanceRuntime(root); enhanceBoot(root); }
function startUiSystem(options = {}) {
  const document = options.document || globalThis.document;
  const root = options.root || document?.getElementById('app');
  if (!document || !root) return null;
  interceptNativeDialogs(document);
  let scheduled = false;
  const refresh = () => { scheduled=false; enhance(root); };
  const schedule = () => { if (scheduled) return; scheduled=true; queueMicrotask(refresh); };
  const observer = new MutationObserver(schedule); observer.observe(root,{ childList:true,subtree:true }); refresh();
  return Object.freeze({ refresh, destroy:()=>observer.disconnect() });
}

if (typeof document !== 'undefined') {
  const boot = () => startUiSystem();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
}

export { BUILD_VERSION, createSystemModal, startUiSystem };
