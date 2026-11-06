import { ClassicChessEngine } from './classic-chess-engine.mjs';

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const TRAINING_MENTORS = Object.freeze([
 {id:1,elo:400,race:'humans',type:'pawn',ru:'Альрик',en:'Alric'},
 {id:2,elo:600,race:'orcs',type:'pawn',ru:'Грум',en:'Grum'},
 {id:3,elo:800,race:'fae',type:'knight',ru:'Эйрин',en:'Eirin'},
 {id:4,elo:1000,race:'dark_elves',type:'knight',ru:'Ваэр',en:'Vaer'},
 {id:5,elo:1200,race:'dwarves',type:'bishop',ru:'Борин',en:'Borin'},
 {id:6,elo:1400,race:'undead',type:'bishop',ru:'Ксар',en:'Xar'},
 {id:7,elo:1600,race:'humans',type:'rook',ru:'Гарольд',en:'Harold'},
 {id:8,elo:1800,race:'demons',type:'rook',ru:'Моррак',en:'Morrak'},
 {id:9,elo:2000,race:'elves',type:'queen',ru:'Сильвена',en:'Sylvena'},
 {id:10,elo:2200,race:'dragonborn',type:'queen',ru:'Ашара',en:'Ashara'},
 {id:11,elo:2400,race:'angels',type:'king',ru:'Ауриэль',en:'Auriel'},
 {id:12,elo:2600,race:'constructs',type:'king',ru:'Архон',en:'Archon'}
]);

function rebuildTraining(moves, cursor = moves.length) {
 if (!Array.isArray(moves) || moves.length > 1000 || !Number.isInteger(cursor) || cursor < 0 || cursor > moves.length)
  throw new Error('Invalid training history');
 const game = new ClassicChessEngine();
 for (let i = 0; i < cursor; i++) {
  const record = moves[i];
  const uci = typeof record === 'string' ? record : record?.uci;
  if (!UCI.test(uci)) throw new Error('Invalid training move');
  const applied = game.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4) || null);
  if (!applied.ok) throw new Error('Illegal training history');
 }
 return game;
}

function extendTraining(moves, cursor, uci) {
 if (!UCI.test(uci)) throw new Error('Invalid move');
 const game = rebuildTraining(moves,cursor);
 const applied = game.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null);
 if (!applied.ok) return {ok:false,reason:applied.reason,choices:applied.choices};
 const old = moves[cursor];
 const same = old && (typeof old === 'string' ? old : old.uci) === uci;
 const next = same ? moves.slice() : moves.slice(0,cursor);
 if (!same) next.push({uci});
 return {ok:true,moves:next,cursor:cursor+1,branched:!same&&cursor<moves.length,fen:game.fen(),status:applied.status};
}

function trainingMoveQuality(before,after,uci) {
 if (!before || !after || !UCI.test(uci) || before.depth < 5 || after.depth < 5 ||
     !Number.isFinite(before.cp) || !Number.isFinite(after.cp) || !UCI.test(before.bestMove))
  return null;
 const loss = Math.max(0,Math.round(before.cp + after.cp));
 if (before.bestMove===uci || loss<65) return {kind:null,loss};
 return {kind:loss>=250?'blunder':loss>=120?'mistake':'inaccuracy',loss};
}

export { TRAINING_MENTORS, UCI, rebuildTraining, extendTraining, trainingMoveQuality };