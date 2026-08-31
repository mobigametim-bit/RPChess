const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');
const game = path.join(root, 'game');

(async () => {
  const notes = await import(pathToFileURL(path.join(game, 'js/content/hero-notes.mjs')).href);
  const settlement = await import(pathToFileURL(path.join(game, 'js/settlement-core.mjs')).href);

  const ids = Object.keys(notes.HERO_NOTES);
  assert.strictEqual(ids.length, 37, 'Hero Notes must contain HERO-01..36 plus Oathkeeper');
  assert.strictEqual(notes.heroNoteForId('king.oathkeeper'), 'Крепость, которую Хранитель поклялся защищать, уже пала. Клятва почему-то осталась. Теперь он ведёт тех, кто всё ещё верит, что слово переживает стены и короны.');
  assert.strictEqual(notes.heroNoteForId('hero.aldric_wall'), 'Он пережил три падения крепостей и всякий раз уходил последним. Альдрик до сих пор считает, что за его спиной никто не должен погибать.');
  assert.strictEqual(notes.heroNoteForId('hero.khulan_star'), 'Хулан никогда не спорит за право идти первой — она просто оказывается там раньше остальных. Для неё власть начинается с темпа.');

  const register = fs.readFileSync(path.join(root, 'register/REGISTER_02_HEROES_AND_POLITICS.md'), 'utf8');
  const heroSlugs = [...register.matchAll(/\| HERO-\d+ `([^`]+)`/g)].map((match) => match[1]);
  assert.strictEqual(heroSlugs.length, 36, 'Register 02 must expose exactly 36 HERO slugs');
  for (const slug of heroSlugs) {
    const note = notes.heroNoteForId(`hero.${slug}`);
    assert(note && note.length >= 50, `missing character note for hero.${slug}`);
  }

  for (const candidate of settlement.RECRUIT_LIBRARY) {
    assert(notes.heroNoteForId(candidate.id), `every recruitable named hero must have a character note: ${candidate.id}`);
  }

  const routeSource = fs.readFileSync(path.join(game, 'js/battle-route.mjs'), 'utf8');
  const runtimeSource = fs.readFileSync(path.join(game, 'js/content/hero-notes-runtime.mjs'), 'utf8');
  assert(routeSource.includes("import './content/hero-notes-runtime.mjs'"), 'Hero Notes runtime must load with the journey bootstrap');
  assert(runtimeSource.includes('[data-roster-card][aria-pressed="true"]'), 'Roster detail must receive the canonical note');
  assert(runtimeSource.includes('[data-settlement-recruit-card]'), 'Settlement recruitment cards must receive the canonical note');
  assert(runtimeSource.includes('MutationObserver'), 'Hero Notes must survive rerenders and legacy save presentation');

  console.log('Hero Notes: 36 registered heroes + Oathkeeper, roster/settlement presentation: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
