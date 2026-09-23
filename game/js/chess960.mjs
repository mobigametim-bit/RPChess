// Scharnagl numbering: 0..959, with orthodox chess at index 518.
export function chess960BackRank(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 960) throw new Error('Invalid Chess960 index');
  const rank = Array(8).fill(null);
  let n = index;
  rank[(n % 4) * 2 + 1] = 'b'; n = Math.floor(n / 4);
  rank[(n % 4) * 2] = 'b'; n = Math.floor(n / 4);
  const empty = () => rank.map((piece, file) => piece ? -1 : file).filter(file => file >= 0);
  rank[empty()[n % 6]] = 'q'; n = Math.floor(n / 6);
  const pairs = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 5; b++) pairs.push([a, b]);
  const slots = empty();
  for (const slot of pairs[n]) rank[slots[slot]] = 'n';
  empty().forEach((file, i) => { rank[file] = ['r', 'k', 'r'][i]; });
  return rank.join('');
}
export function chess960Fen(index) {
  const rank = chess960BackRank(index);
  const rooks = [...rank].map((p, f) => p === 'r' ? 'abcdefgh'[f] : '').filter(Boolean).reverse().join('');
  return `${rank}/pppppppp/8/8/8/8/PPPPPPPP/${rank.toUpperCase()} w ${rooks.toUpperCase()}${rooks} - 0 1`;
}
