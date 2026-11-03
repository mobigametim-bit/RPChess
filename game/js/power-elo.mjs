/* Pure Elo formula shared by Journey and Tournament's Cloudflare Worker.
 * The same rating curve (K=32) is used in all modes. No browser APIs.
 */
const STARTING_POWER = 500;
const ELO_K = 32;

function normalizePower(value) {
  const numeric = Number(value);
  return Math.max(0, Number.isFinite(numeric) ? Math.round(numeric) : STARTING_POWER);
}
function normalizeResult(result) {
  const numeric = Number(result);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}
function expectedScore(power, opponentElo) {
  const player = normalizePower(power);
  const opponent = Math.max(0, Number.isFinite(Number(opponentElo)) ? Number(opponentElo) : 0);
  return 1 / (1 + Math.pow(10, (opponent - player) / 400));
}
function ratingDelta(power, opponentElo, result, k = ELO_K) {
  return Math.round(Math.max(1, Number(k) || ELO_K) * (normalizeResult(result) - expectedScore(power, opponentElo)));
}
export { STARTING_POWER, ELO_K, normalizePower, normalizeResult, expectedScore, ratingDelta };
