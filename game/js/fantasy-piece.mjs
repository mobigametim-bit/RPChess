/* Single Fantasy chess set for all playable race armies.
 * Maurizio Monge (MIT), see assets/pieces/fantasy/LICENSE.txt.
 * Images (rather than inline SVG) keep internal gradients/IDs independent.
 */
const ROLES=Object.freeze({p:'P',n:'N',b:'B',r:'R',q:'Q',k:'K',pawn:'P',knight:'N',bishop:'B',rook:'R',queen:'Q',king:'K'});
export function fantasyPiecePath(type,color){
  const role=ROLES[type];
  if(!role)throw new Error('Unknown chess role: '+type);
  return 'assets/pieces/fantasy/'+(color==='b'?'b':'w')+role+'.svg';
}
export function fantasyPieceMarkup(type,color){
  return '<img class="rpchess-fantasy-piece" src="'+fantasyPiecePath(type,color)+'" alt="" draggable="false" aria-hidden="true">';
}
