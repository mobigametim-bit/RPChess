import { platform } from '../platform.mjs';
import { summarizeRun } from '../endless-run-core.mjs';
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

async function shareRunResult(run, { power = 0, language = currentLanguage(), link = VK_GAME_LINK } = {}) {
  const text = formatRunShare(run, { power, language, link });
  if (platform.launch.isVK()) {
    const wall = await platform.social.wallPost({ message:text, attachments:link });
    if (wall.status === 'completed') return Object.freeze({ status:'completed', method:'wall', text, link, postId:wall.postId });
    if (wall.status === 'closed') return Object.freeze({ status:'closed', method:'wall', text, link });

    const shared = await platform.social.shareLink(link);
    if (shared.status === 'completed') {
      await platform.social.copyText(text);
      return Object.freeze({ status:'completed', method:'share-link', text, link, textCopied:true });
    }
    if (shared.status === 'closed') return Object.freeze({ status:'closed', method:'share-link', text, link });

    if (await platform.social.copyText(text)) return Object.freeze({ status:'completed', method:'copy', text, link });
  }

  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return Object.freeze({ status:'completed', method:'clipboard', text, link });
    }
  } catch {}
  return Object.freeze({ status:'unavailable', method:'none', text, link });
}

export { VK_GAME_LINK, formatRunShare, shareRunResult };
