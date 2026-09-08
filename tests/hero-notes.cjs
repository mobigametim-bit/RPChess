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
  const rosterSource = fs.readFileSync(path.join(game, 'js/roster-app.mjs'), 'utf8');
  const settlementSource = fs.readFileSync(path.join(game, 'js/settlement-app.mjs'), 'utf8');
  const legacyRuntime = path.join(game, 'js/content/hero-notes-runtime.mjs');

  assert(!fs.existsSync(legacyRuntime), 'Hero Notes must not require a MutationObserver presentation runtime');
  assert(!routeSource.includes('hero-notes-runtime.mjs'), 'journey bootstrap must not depend on Hero Notes for presentation patches');
  assert(rosterSource.includes("import { heroNoteForId } from './content/hero-notes.mjs'"), 'Roster must own Hero Notes rendering');
  assert(rosterSource.includes('heroNoteForId(character.id) || character.description'), 'Roster detail must render the canonical note directly');
  assert(settlementSource.includes("import { heroNoteForId } from './content/hero-notes.mjs'"), 'Settlement must own Hero Notes rendering');
  assert(settlementSource.includes('heroNoteForId(candidate.id) || candidate.description'), 'Settlement recruit cards must render the canonical note directly');

  console.log('Hero Notes: 36 registered heroes + Oathkeeper, owner-level Roster/Settlement presentation: PASS');
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
