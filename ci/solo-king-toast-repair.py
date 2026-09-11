from pathlib import Path

path = Path('game/js/battle-app.mjs')
text = path.read_text(encoding='utf-8')
old = "setBattleNavigationLocked(false);globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'"
new = "setBattleNavigationLocked(false);clearTimeout(toastTimer);toastTimer=null;document.querySelectorAll('.battle-toast').forEach((toast)=>toast.remove());globalThis.dispatchEvent(new CustomEvent('rpchess:run-updated'"
assert text.count(old) == 1, 'Battle finish toast-cleanup anchor changed'
path.write_text(text.replace(old, new), encoding='utf-8')
