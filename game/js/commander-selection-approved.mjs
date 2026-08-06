function commanderScreen(root = globalThis.document?.getElementById?.('app')) {
  return root?.querySelector?.('.rpa-commander-layout')?.closest?.('.rpa-subscreen') || null;
}

function profileButtonLabel(document = globalThis.document) {
  return document?.documentElement?.lang === 'en' ? 'Profiles' : 'Профили';
}

function applyApprovedCommanderSelection(options = {}) {
  const document = options.document || globalThis.document;
  const root = options.root || document?.getElementById?.('app');
  const screen = commanderScreen(root);
  if (!screen) return false;

  screen.classList.add('is-approved-commander-selection');

  const profileButton = screen.querySelector('[data-shell-action="profiles"]');
  const desiredLabel = profileButtonLabel(document);
  if (profileButton && profileButton.textContent.trim() !== desiredLabel) {
    profileButton.textContent = desiredLabel;
    profileButton.setAttribute('aria-label', desiredLabel);
  }

  const worldSeedField = screen.querySelector('.rpa-field:has([data-world-seed])');
  if (worldSeedField) worldSeedField.remove();

  for (const card of screen.querySelectorAll('.rpa-commander')) {
    const name = card.querySelector('h3')?.textContent?.trim() || '';
    if (name && !card.getAttribute('aria-label')) card.setAttribute('aria-label', name);
  }

  const launch = screen.querySelector('[data-launch-commander]');
  if (launch) launch.setAttribute('aria-describedby', 'rpa-approved-commander-summary');
  const previewBody = screen.querySelector('.rpa-launch__body');
  if (previewBody && !previewBody.id) previewBody.id = 'rpa-approved-commander-summary';

  return true;
}

function installApprovedCommanderSelection(options = {}) {
  const document = options.document || globalThis.document;
  const root = options.root || document?.getElementById?.('app');
  if (!document || !root) return null;

  let scheduled = false;
  const apply = () => {
    scheduled = false;
    applyApprovedCommanderSelection({ document, root });
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  };

  apply();
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(schedule)
    : null;
  observer?.observe(root, { childList: true, subtree: true });

  return Object.freeze({
    apply,
    observer,
    destroy: () => observer?.disconnect()
  });
}

if (typeof document !== 'undefined') {
  const boot = () => installApprovedCommanderSelection();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}

export {
  commanderScreen,
  profileButtonLabel,
  applyApprovedCommanderSelection,
  installApprovedCommanderSelection
};
