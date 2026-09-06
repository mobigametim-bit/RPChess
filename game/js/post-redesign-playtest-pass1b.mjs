import './ui-redesign-final.mjs';
import './post-pages-ui-polish.mjs';

// The compact Market presentation is rebuilt after each real purchase. Preserve the rendered
// price as a readable source for presentation-only refreshes between purchases.
function markCompactSupplyPrice(root = document) {
  for (const price of root.querySelectorAll?.('.settlement-supply-card__compact > strong:last-child') || []) {
    price.classList.add('settlement-price');
  }
}

if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.settlement-supply-card__compact')) markCompactSupplyPrice(node.parentElement || node);
        else if (node.querySelector?.('.settlement-supply-card__compact')) markCompactSupplyPrice(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  queueMicrotask(() => markCompactSupplyPrice(document));
}
