import { platform } from '../platform.mjs';
import { summarizeRun } from '../endless-run-core.mjs';
import { renderRunStory } from './story-card.mjs';
import { currentLanguage, translateLegacy } from '../i18n.mjs';

const VK_GAME_LINK = 'https://vk.com/app54754579';

const END_REASON_EN = Object.freeze({
  starvation_king:'The King died while travelling without Supplies.',
  event_king:'The King died because of a decision made during an event.',
  king_solo_battle:'Mercenaries ignored the words of a lone king without a kingdom and hanged you from the nearest tree.',
  king_dead:'The King died. The journey is over.'
});

function languageCode(language = currentLanguage()) { return language === 'en' ? 'en' : 'ru'; }

function localizedEndReason(summary, language) {
  if (language === 'en') return END_REASON_EN[summary.endReason] || END_REASON_EN.king_dead;
  return summary.endReasonLabel;
}

function localizedKingName(summary, language) {
  return language === 'en' ? translateLegacy(summary.kingName, 'en') : summary.kingName;
}

function formatRunShare(run, { power = 0, language = currentLanguage(), link = VK_GAME_LINK } = {}) {
  const lang = languageCode(language);
  const summary = summarizeRun(run, { power });
  const kingName = localizedKingName(summary, lang);
  const playerName = String(run?.playerName || '').trim();
  const identity = playerName ? `${playerName} · ${kingName}` : kingName;
  if (lang === 'en') {
    return [
      '♟️ RPChess — my run',
      `👑 ${identity}`,
      `🗓️ Weeks: ${summary.weeks}`,
      `⚔️ Battle wins: ${summary.battleWins}`,
      `🛡️ Skirmish wins: ${summary.skirmishWins}`,
      `🧩 Puzzles solved: ${summary.puzzlesSolved}`,
      `📜 Events resolved: ${summary.eventsResolved}`,
      `👥 Heroes recruited: ${summary.heroesRecruited}`,
      `🔥 Power: ${summary.finalPower}`,
      `☠️ End: ${localizedEndReason(summary, lang)}`,
      `🎮 Play RPChess: ${link}`
    ].join('\n');
  }
  return [
    '♟️ RPChess — мой забег',
    `👑 ${identity}`,
    `🗓️ Недель: ${summary.weeks}`,
    `⚔️ Побед в битвах: ${summary.battleWins}`,
    `🛡️ Побед в стычках: ${summary.skirmishWins}`,
    `🧩 Решено задач: ${summary.puzzlesSolved}`,
    `📜 Событий завершено: ${summary.eventsResolved}`,
    `👥 Нанято героев: ${summary.heroesRecruited}`,
    `🔥 Мощь: ${summary.finalPower}`,
    `☠️ Финал: ${localizedEndReason(summary, lang)}`,
    `🎮 Играть в RPChess: ${link}`
  ].join('\n');
}

function downloadStoryImage(dataUrl) {
  if (!dataUrl || !globalThis.document?.createElement) return false;
  try {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = 'rpchess-journey-result.jpg';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch { return false; }
}

async function shareRunResult(run, { power = 0, language = currentLanguage(), link = VK_GAME_LINK } = {}) {
  const text = formatRunShare(run, { power, language, link });
  let story = null;
  try {
    const summary = summarizeRun(run, { power });
    story = await renderRunStory(run, {
      power,
      language,
      endReason:localizedEndReason(summary,languageCode(language))
    });
  } catch (error) {
    console.warn('[RPChess] story image rendering failed', error);
  }

  if (platform.launch.isVK() && story?.dataUrl) {
    const result = await platform.social.showStory({ blob:story.dataUrl, link });
    if (result.status === 'completed')
      return Object.freeze({ status:'editor-opened', method:'story', text, link });
    if (result.status === 'closed')
      return Object.freeze({ status:'closed', method:'story', text, link });
    if (result.status === 'no-response')
      return Object.freeze({ status:'unconfirmed', method:'story', text, link });
    if (result.status === 'error') console.warn('[RPChess] VK story editor failed', result.error || result.reason);
  }

  // Fallback for unsupported VK clients and standalone web: save a portrait image.
  if (story?.dataUrl && downloadStoryImage(story.dataUrl))
    return Object.freeze({ status:'download-started', method:'image', text, link });

  if (platform.launch.isVK() && await platform.social.copyText(text))
    return Object.freeze({ status:'copied', method:'copy', text, link });

  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return Object.freeze({ status:'copied', method:'clipboard', text, link });
    }
  } catch {}
  return Object.freeze({ status:'unavailable', method:'none', text, link });
}

export { VK_GAME_LINK, formatRunShare, shareRunResult };
