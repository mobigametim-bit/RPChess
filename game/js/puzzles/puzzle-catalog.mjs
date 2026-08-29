// Seed catalog for the first playable Puzzles preview.
// All source positions are Lichess Open Database puzzles (CC0).
// `fen` is normalized to the actual puzzle start, i.e. AFTER the first source UCI blunder.
// The developer importer will expand this seed into the full curated library without changing runtime format.

const PUZZLE_CATALOG = Object.freeze([
  Object.freeze({id:'puzzle.000rZ',sourceId:'000rZ',fen:'2kr1b1r/p1p2pp1/2pqN3/7p/6n1/2NPB3/PPP2PPP/R2Q1RK1 b - - 3 13',side:'b',solution:Object.freeze(['d6h2']),type:'mate1',rating:602,difficulty:1,themes:Object.freeze(['kingsideAttack','mate','mateIn1','oneMove','opening']),targetPiece:null,materialGain:0,reward:12}),
  Object.freeze({id:'puzzle.001pC',sourceId:'001pC',fen:'r4rk1/pp3ppp/3b4/2p1pPB1/7N/2PP3n/PP4PP/R2Q2RK b - - 6 18',side:'b',solution:Object.freeze(['h3f2']),type:'mate1',rating:870,difficulty:2,themes:Object.freeze(['mate','mateIn1','middlegame','oneMove','smotheredMate']),targetPiece:null,materialGain:0,reward:15}),
  Object.freeze({id:'puzzle.001Wz',sourceId:'001Wz',fen:'6k1/5ppp/r1p5/p1n1rP2/8/2P2N1P/2P3P1/3R2K1 w - - 1 22',side:'w',solution:Object.freeze(['d1d8','e5e8','d8e8']),type:'mate2',rating:1118,difficulty:3,themes:Object.freeze(['backRankMate','endgame','mate','mateIn2','short']),targetPiece:null,materialGain:0,reward:18}),
  Object.freeze({id:'puzzle.001om',sourceId:'001om',fen:'5r1k/pp4pp/5p2/1BbQp1r1/7K/7P/1PP3P1/3R3R b - - 3 26',side:'b',solution:Object.freeze(['c5f2','g2g3','f2g3']),type:'mate2',rating:1018,difficulty:4,themes:Object.freeze(['mate','mateIn2','middlegame','morphysMate','short']),targetPiece:null,materialGain:0,reward:21}),
  Object.freeze({id:'puzzle.0000D',sourceId:'0000D',fen:'5rk1/1p3ppp/pq1Q1b2/8/8/1P3N2/P4PPP/3R2K1 b - - 3 27',side:'b',solution:Object.freeze(['f8d8','d6d8','f6d8']),type:'material',rating:1474,difficulty:5,themes:Object.freeze(['advantage','endgame','short']),targetPiece:'queen',materialGain:4,reward:24}),
  Object.freeze({id:'puzzle.000hf',sourceId:'000hf',fen:'r1bq3r/pp1nbkp1/2p1p2p/8/2BP4/1PN3P1/P3QP1P/3R1RK1 w - - 1 20',side:'w',solution:Object.freeze(['e2e6','f7f8','e6f7']),type:'mate2',rating:1576,difficulty:6,themes:Object.freeze(['mate','mateIn2','middlegame','short']),targetPiece:null,materialGain:0,reward:27}),
  Object.freeze({id:'puzzle.dPwd4',sourceId:'dPwd4',fen:'r3r1k1/3R4/2p3pB/3bNp2/pb1P4/8/1P3PPP/6K1 w - - 0 31',side:'w',solution:Object.freeze(['d7g7','g8h8','e5g6']),type:'mate2',rating:1619,difficulty:7,themes:Object.freeze(['intermezzo','mate','mateIn2','middlegame','short']),targetPiece:null,materialGain:0,reward:30}),
  Object.freeze({id:'puzzle.2Tn3h',sourceId:'2Tn3h',fen:'8/R7/5p2/6kp/n3p2N/6P1/r4PK1/8 w - - 0 53',side:'w',solution:Object.freeze(['a7g7','g5h6','h4f5']),type:'mate2',rating:1713,difficulty:8,themes:Object.freeze(['cornerMate','endgame','mate','mateIn2','short']),targetPiece:null,materialGain:0,reward:33}),
  Object.freeze({id:'puzzle.AAMws',sourceId:'AAMws',fen:'2Q5/5ppk/2K4p/2Q5/1p6/1P6/8/q2q4 w - - 1 46',side:'w',solution:Object.freeze(['c5f5','g7g6','f5f7','a1g7','c8g8']),type:'mate3',rating:1876,difficulty:9,themes:Object.freeze(['endgame','long','mate','mateIn3','queenEndgame']),targetPiece:null,materialGain:0,reward:36}),
  Object.freeze({id:'puzzle.03Iup',sourceId:'03Iup',fen:'3R4/1rp2ppk/p1p1q1bp/8/4p3/P1B1Q3/1PP2PPP/6K1 w - - 1 23',side:'w',solution:Object.freeze(['d8h8','h7h8','e3h6','h8g8','h6g7']),type:'mate3',rating:2032,difficulty:10,themes:Object.freeze(['attraction','deflection','endgame','mate','mateIn3','pin','sacrifice']),targetPiece:null,materialGain:0,reward:39}),
  Object.freeze({id:'puzzle.47w70',sourceId:'47w70',fen:'r1bqk1nr/1pp3p1/1pnp3p/5p2/2BpP3/3P3P/PPP2PP1/R1BQK2R w KQkq - 0 10',side:'w',solution:Object.freeze(['d1h5','e8d7','h5f5','d7e7','f5f7']),type:'mate3',rating:2111,difficulty:11,themes:Object.freeze(['exposedKing','interference','long','mate','mateIn3','opening','swallowstailMate']),targetPiece:null,materialGain:0,reward:42}),
  Object.freeze({id:'puzzle.2mire',sourceId:'2mire',fen:'2r2rk1/pp3ppp/1q2p3/2bp4/b5N1/2BQ3P/1P3PP1/2R1R1K1 w - - 2 23',side:'w',solution:Object.freeze(['g4f6','g7f6','d3g3','g8h8','c3f6']),type:'mate3',rating:2054,difficulty:12,themes:Object.freeze(['intermezzo','kingsideAttack','long','mate','mateIn3','middlegame','sacrifice']),targetPiece:null,materialGain:0,reward:45})
]);

const PUZZLE_SOURCE = Object.freeze({name:'Lichess Open Database Puzzles',license:'CC0',url:'https://database.lichess.org/#puzzles'});

export { PUZZLE_CATALOG, PUZZLE_SOURCE };
