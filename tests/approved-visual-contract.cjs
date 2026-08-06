'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const contract = read('content/design/approved_visual_contract.md');
const index = read('game/index.html');
const app = read('game/js/vertical-slice-app.mjs');
const presenter = read('game/js/vertical-slice-presenter.mjs');
const heroPanel = read('game/js/register-02-codex.mjs');
const extension = read('game/js/vertical-slice-presenter-register-02.mjs');
const audio = read('game/js/vertical-slice-audio.mjs');
const css = read('game/css/approved-visual-shell.css');
const stageCss = read('game/css/stage-b-ui.css');

assert(contract.includes('Technical presenter layouts'));
assert(index.includes('style.css'));
assert(index.includes('css/approved-visual-shell.css'));
assert(app.includes('generated_assets/title_wordmark.png'));
assert(app.includes('commanderSelectionMarkup'));
assert(app.includes('heroLimit: 1'));
assert(app.includes('unlockedCommanders'));
assert(app.includes("['event', 'service', 'shop', 'treasure']"));
assert(css.includes('generated_assets/splash_poster.jpg'));
assert(css.includes('generated_assets/ui_button_primary.png'));
assert(css.includes('generated_assets/scene_event.jpg'));
assert(stageCss.includes('.rpvs__battle-sidebar-scroll'));
assert(stageCss.includes('.rpa-menu__main--open'));
assert.strictEqual(app.includes('Проведите живую шахматную армию через Железные Марши'), false);
assert(presenter.includes('drawWarriorPiece'));
assert(presenter.includes('unitArt(piece)'));
assert(presenter.includes('pieceGlyph(piece)'));
assert(presenter.includes("glyphSize = Math.max(13, Math.floor(rect.size * .24))"));
assert(presenter.includes("nodeArt(node.type || 'event')"));
assert.strictEqual(presenter.includes('Доступные маршруты'), false);
assert.strictEqual(presenter.includes('region.environmentSheet'), false);
assert(presenter.includes('humanFailure(item)'));
assert(presenter.includes('humanObjective(item)'));
assert(presenter.includes('Вашему королю объявлен шах'));
assert(heroPanel.includes('rp02-hero-panel__stars'));
assert(heroPanel.includes('Активная способность'));
assert(heroPanel.includes('Пассивные эффекты'));
assert(heroPanel.includes('rp02-relic-slot'));
assert.strictEqual(heroPanel.includes('<dt>Звёзды</dt>'), false);
assert.strictEqual(heroPanel.includes('<strong>Состояние</strong>'), false);
const extensionRender = extension.slice(extension.indexOf('render(snapshotInput)'), extension.indexOf('renderDeployment(snapshot)'));
assert.strictEqual(extensionRender.includes('installArmyPanel(this.root'), false);
assert(audio.includes("new Audio('SFX/win_fanfare.mp3')"));
assert(audio.includes("event.type === 'PieceCaptured'"));
assert(audio.includes("event.type === 'PieceMoved'"));
assert(audio.includes("snapshot.status === 'reward'"));

console.log('Approved visual contract: player-facing shell and asset rules passed.');
