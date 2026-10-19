// Lichess's published puzzleTheme vocabulary. These tags are descriptive,
// NOT separate chess win conditions: one puzzle may carry many categories.
// Source: https://github.com/lichess-org/lila/blob/master/translation/source/puzzleTheme.xml
// Keep source tags as-is; never infer a motif solely from piece placement.
const PUZZLE_THEME_REGISTRY=Object.freeze({
  "advancedPawn": {
    "ru": "Продвинутая пешка",
    "en": "Advanced pawn",
    "group": "tactic"
  },
  "advantage": {
    "ru": "Преимущество",
    "en": "Advantage",
    "group": "goal"
  },
  "anastasiaMate": {
    "ru": "Мат Анастасии",
    "en": "Anastasia's mate",
    "group": "mate"
  },
  "arabianMate": {
    "ru": "Арабский мат",
    "en": "Arabian mate",
    "group": "mate"
  },
  "attackingF2F7": {
    "ru": "Атака на f2/f7",
    "en": "Attacking f2/f7",
    "group": "tactic"
  },
  "attraction": {
    "ru": "Завлечение",
    "en": "Attraction",
    "group": "tactic"
  },
  "backRankMate": {
    "ru": "Мат по последней горизонтали",
    "en": "Back-rank mate",
    "group": "mate"
  },
  "balestraMate": {
    "ru": "Мат Балестра",
    "en": "Balestra mate",
    "group": "mate"
  },
  "blindSwineMate": {
    "ru": "Мат двумя ладьями",
    "en": "Blind swine mate",
    "group": "mate"
  },
  "bishopEndgame": {
    "ru": "Слоновый эндшпиль",
    "en": "Bishop endgame",
    "group": "endgame"
  },
  "bodenMate": {
    "ru": "Мат Бодена",
    "en": "Boden's mate",
    "group": "mate"
  },
  "capturingDefender": {
    "ru": "Уничтожение защитника",
    "en": "Capture the defender",
    "group": "tactic"
  },
  "castling": {
    "ru": "Рокировка",
    "en": "Castling",
    "group": "special"
  },
  "clearance": {
    "ru": "Освобождение линии",
    "en": "Clearance",
    "group": "tactic"
  },
  "collinearMove": {
    "ru": "Движение по линии атаки",
    "en": "Collinear move",
    "group": "tactic"
  },
  "cornerMate": {
    "ru": "Мат в углу",
    "en": "Corner mate",
    "group": "mate"
  },
  "crushing": {
    "ru": "Решающее преимущество",
    "en": "Crushing",
    "group": "goal"
  },
  "defensiveMove": {
    "ru": "Защита",
    "en": "Defensive move",
    "group": "tactic"
  },
  "deflection": {
    "ru": "Отвлечение",
    "en": "Deflection",
    "group": "tactic"
  },
  "discoveredAttack": {
    "ru": "Вскрытое нападение",
    "en": "Discovered attack",
    "group": "tactic"
  },
  "discoveredCheck": {
    "ru": "Вскрытый шах",
    "en": "Discovered check",
    "group": "tactic"
  },
  "doubleBishopMate": {
    "ru": "Мат двумя слонами",
    "en": "Double bishop mate",
    "group": "mate"
  },
  "doubleCheck": {
    "ru": "Двойной шах",
    "en": "Double check",
    "group": "tactic"
  },
  "dovetailMate": {
    "ru": "Мат «ласточкин хвост»",
    "en": "Dovetail mate",
    "group": "mate"
  },
  "endgame": {
    "ru": "Эндшпиль",
    "en": "Endgame",
    "group": "phase"
  },
  "enPassant": {
    "ru": "Взятие на проходе",
    "en": "En passant",
    "group": "special"
  },
  "epauletteMate": {
    "ru": "Эполетный мат",
    "en": "Epaulette mate",
    "group": "mate"
  },
  "equality": {
    "ru": "Уравнение позиции",
    "en": "Equality",
    "group": "goal"
  },
  "exposedKing": {
    "ru": "Незащищённый король",
    "en": "Exposed king",
    "group": "tactic"
  },
  "fork": {
    "ru": "Вилка",
    "en": "Fork",
    "group": "tactic"
  },
  "hangingPiece": {
    "ru": "Незащищённая фигура",
    "en": "Hanging piece",
    "group": "tactic"
  },
  "hookMate": {
    "ru": "Мат крюком",
    "en": "Hook mate",
    "group": "mate"
  },
  "interference": {
    "ru": "Перекрытие",
    "en": "Interference",
    "group": "tactic"
  },
  "intermezzo": {
    "ru": "Промежуточный ход",
    "en": "Intermezzo",
    "group": "tactic"
  },
  "killBoxMate": {
    "ru": "Мат «клетка»",
    "en": "Kill box mate",
    "group": "mate"
  },
  "kingsideAttack": {
    "ru": "Атака на королевском фланге",
    "en": "Kingside attack",
    "group": "tactic"
  },
  "knightEndgame": {
    "ru": "Коневой эндшпиль",
    "en": "Knight endgame",
    "group": "endgame"
  },
  "long": {
    "ru": "Длинная комбинация",
    "en": "Long puzzle",
    "group": "length"
  },
  "master": {
    "ru": "Из партии мастера",
    "en": "Master game",
    "group": "origin"
  },
  "masterVsMaster": {
    "ru": "Из партии мастеров",
    "en": "Master vs Master",
    "group": "origin"
  },
  "mate": {
    "ru": "Матовая комбинация",
    "en": "Checkmate",
    "group": "goal"
  },
  "mateIn1": {
    "ru": "Мат в 1",
    "en": "Mate in 1",
    "group": "mate"
  },
  "mateIn2": {
    "ru": "Мат в 2",
    "en": "Mate in 2",
    "group": "mate"
  },
  "mateIn3": {
    "ru": "Мат в 3",
    "en": "Mate in 3",
    "group": "mate"
  },
  "mateIn4": {
    "ru": "Мат в 4",
    "en": "Mate in 4",
    "group": "mate"
  },
  "mateIn5": {
    "ru": "Мат в 5+",
    "en": "Mate in 5+",
    "group": "mate"
  },
  "middlegame": {
    "ru": "Миттельшпиль",
    "en": "Middlegame",
    "group": "phase"
  },
  "morphysMate": {
    "ru": "Мат Морфи",
    "en": "Morphy's mate",
    "group": "mate"
  },
  "oneMove": {
    "ru": "Один ход",
    "en": "One-move puzzle",
    "group": "length"
  },
  "opening": {
    "ru": "Дебют",
    "en": "Opening",
    "group": "phase"
  },
  "operaMate": {
    "ru": "Мат Оперы",
    "en": "Opera mate",
    "group": "mate"
  },
  "pawnEndgame": {
    "ru": "Пешечный эндшпиль",
    "en": "Pawn endgame",
    "group": "endgame"
  },
  "pillsburysMate": {
    "ru": "Мат Пильсбери",
    "en": "Pillsbury's mate",
    "group": "mate"
  },
  "pin": {
    "ru": "Связка",
    "en": "Pin",
    "group": "tactic"
  },
  "promotion": {
    "ru": "Превращение пешки",
    "en": "Promotion",
    "group": "special"
  },
  "queenEndgame": {
    "ru": "Ферзевый эндшпиль",
    "en": "Queen endgame",
    "group": "endgame"
  },
  "queenRookEndgame": {
    "ru": "Ферзево-ладейный эндшпиль",
    "en": "Queen and rook endgame",
    "group": "endgame"
  },
  "queensideAttack": {
    "ru": "Атака на ферзевом фланге",
    "en": "Queenside attack",
    "group": "tactic"
  },
  "quietMove": {
    "ru": "Тихий ход",
    "en": "Quiet move",
    "group": "tactic"
  },
  "rookEndgame": {
    "ru": "Ладейный эндшпиль",
    "en": "Rook endgame",
    "group": "endgame"
  },
  "sacrifice": {
    "ru": "Жертва",
    "en": "Sacrifice",
    "group": "tactic"
  },
  "short": {
    "ru": "Короткая комбинация",
    "en": "Short puzzle",
    "group": "length"
  },
  "skewer": {
    "ru": "Сквозной удар",
    "en": "Skewer",
    "group": "tactic"
  },
  "smotheredMate": {
    "ru": "Спёртый мат",
    "en": "Smothered mate",
    "group": "mate"
  },
  "superGM": {
    "ru": "Из партии супергроссмейстера",
    "en": "Super GM game",
    "group": "origin"
  },
  "swallowstailMate": {
    "ru": "Мат «ласточкин хвост»",
    "en": "Swallow's tail mate",
    "group": "mate"
  },
  "trappedPiece": {
    "ru": "Пойманная фигура",
    "en": "Trapped piece",
    "group": "tactic"
  },
  "triangleMate": {
    "ru": "Треугольный мат",
    "en": "Triangle mate",
    "group": "mate"
  },
  "underPromotion": {
    "ru": "Превращение не в ферзя",
    "en": "Underpromotion",
    "group": "special"
  },
  "veryLong": {
    "ru": "Очень длинная комбинация",
    "en": "Very long puzzle",
    "group": "length"
  },
  "vukovicMate": {
    "ru": "Мат Вуковича",
    "en": "Vuković mate",
    "group": "mate"
  },
  "xRayAttack": {
    "ru": "Рентген",
    "en": "X-ray attack",
    "group": "tactic"
  },
  "zugzwang": {
    "ru": "Цугцванг",
    "en": "Zugzwang",
    "group": "tactic"
  }
});
const PUZZLE_THEME_GROUPS=Object.freeze({"tactic":1,"special":2,"mate":3,"endgame":4,"phase":5,"goal":6,"length":7,"origin":8});
function namedPuzzleThemes(puzzle,language='ru'){
  const lang=language==='en'?'en':'ru';
  const source=Array.isArray(puzzle?.themes)?puzzle.themes:[];
  return [...new Set(source)].filter(key=>PUZZLE_THEME_REGISTRY[key])
    .sort((a,b)=>(PUZZLE_THEME_GROUPS[PUZZLE_THEME_REGISTRY[a].group]||99)
      -(PUZZLE_THEME_GROUPS[PUZZLE_THEME_REGISTRY[b].group]||99)||a.localeCompare(b))
    .map(key=>Object.freeze({key,group:PUZZLE_THEME_REGISTRY[key].group,label:PUZZLE_THEME_REGISTRY[key][lang]}));
}
function featuredPuzzleTheme(puzzle,language='ru'){
  // Mat in N / win specific piece are already explicit puzzle objectives.
  // A source motif is a useful additional clue, not an invented success rule.
  const labels=namedPuzzleThemes(puzzle,language);
  return labels.find(x=>x.group==='tactic'||x.group==='special'||x.group==='mate'&&!/^mateIn\d+$/.test(x.key))
    ||labels.find(x=>x.group==='endgame')
    ||labels.find(x=>x.group==='phase')
    ||null;
}
export {PUZZLE_THEME_REGISTRY,PUZZLE_THEME_GROUPS,namedPuzzleThemes,featuredPuzzleTheme};
