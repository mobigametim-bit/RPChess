/* One verified board question per detected error; no LLM-created chess facts.
 * A Stockfish PV is ONE possible continuation, not proof that a tactic is forced.
 */
import {ClassicChessEngine} from './classic-chess-engine.mjs';

const PRIORITY=Object.freeze({
 back_rank_mate:120,mate_sequence:115,double_check:110,discovered_check:105,
 fork:98,pin:92,skewer_pattern:89,overloaded_defender:86,
 removed_defender:84,undefended_capture:81,promotion:79,
 discovered_attack:77,advanced_passed_pawn:76,interference:71,
 material_loss:68,capture:63,en_passant:61,check:52
});
const TYPES={
 ru:{p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'},
 en:{p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}
};
const NAMES={
 ru:{p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'},
 en:{p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}
};
const GUIDES={
 back_rank_mate:{ru:['Какая фигура может создать матовую угрозу по последней горизонтали?','Сначала проверь безопасность короля и пути его отхода.'],en:['Which piece can create a back-rank mating threat?','Start with the king’s escape squares.']},
 mate_sequence:{ru:['Какая фигура начинает опасную атаку на короля?','Проверяй шахи прежде, чем оценивать взятия и обычные угрозы.'],en:['Which piece starts a dangerous attack on the king?','Look at checks before captures and quieter threats.']},
 double_check:{ru:['Какая фигура создаёт двойной шах?','При двойном шахе нужно искать ответ королём.'],en:['Which piece triggers a double check?','A double check calls for a king move.']},
 discovered_check:{ru:['Какая фигура открывает линию шаха?','Посмотри, что скрывается за фигурой на одной линии с королём.'],en:['Which piece reveals a discovered check?','Look for a line to the king hidden behind another piece.']},
 fork:{ru:['Какая фигура может напасть сразу на несколько целей?','После каждого хода проверяй двойные нападения.'],en:['Which piece can attack multiple targets?','Scan for double attacks after every move.']},
 pin:{ru:['Какая фигура может создать связку?','Проверь фигуры, за которыми стоит король.'],en:['Which piece can create a pin?','Check pieces standing in front of their king.']},
 skewer_pattern:{ru:['Какая фигура может выстроить сквозную атаку?','Проверь тяжёлые фигуры, стоящие на одной линии.'],en:['Which piece can create a skewer pattern?','Check valuable pieces aligned on the same ray.']},
 overloaded_defender:{ru:['Какая фигура может использовать перегруженную защиту?','Проверь, не прикрывает ли один защитник сразу несколько важных целей.'],en:['Which piece can exploit an overloaded defender?','Check whether a single defender protects multiple targets.']},
 removed_defender:{ru:['Какая фигура может устранить ключевого защитника?','Ищи фигуры, которые держат под защитой важную цель.'],en:['Which piece can remove a key defender?','Find the piece guarding an important target.']},
 undefended_capture:{ru:['Какая фигура может взять незащищённый материал?','Проверяй взятия, на которые не последует ответное взятие защитником.'],en:['Which piece can capture an undefended target?','Check captures against pieces with no defenders.']},
 promotion:{ru:['Какая пешка может превратиться?','Смотри, сколько ходов осталось до последней горизонтали.'],en:['Which pawn can promote?','Count the squares remaining to the last rank.']},
 advanced_passed_pawn:{ru:['Какая проходная пешка может стать опасной?','Проверь, есть ли на её пути встречные пешки.'],en:['Which advanced passed pawn could become dangerous?','Look for enemy pawns blocking its path.']},
 discovered_attack:{ru:['Какая фигура может открыть скрытую линию атаки?','Посмотри на дальнобойные фигуры за другими своими фигурами.'],en:['Which piece can uncover a hidden attack?','Look for sliders behind their own pieces.']},
 interference:{ru:['Какая фигура может перекрыть открытую линию?','Не забывай, что фигура может защитить цель, встав на линию атаки.'],en:['Which piece can block an open line?','A piece can defend by stepping onto an attacking line.']},
 material_loss:{ru:['Какая фигура участвует в материальной угрозе?','Оцени, какие взятия доступны сопернику.'],en:['Which piece is involved in a material threat?','Check the opponent’s available captures.']},
 capture:{ru:['Какая фигура может совершить взятие?','Перед своим ходом перечисли возможные взятия соперника.'],en:['Which piece can make the capture?','List the opponent’s captures before moving.']},
 en_passant:{ru:['Какая пешка может взять на проходе?','Помни о специальном взятии пешки после хода на две клетки.'],en:['Which pawn can capture en passant?','Remember en passant after a double pawn push.']},
 check:{ru:['Какая фигура может дать шах?','Начни поиск с шахов, затем переходи к взятиям.'],en:['Which piece can give check?','Scan checks first, then captures.']}
};
const DEFAULT={
 ru:{question:'Что изменилось в позиции после твоего хода?',tip:'Проверь шахи, взятия, угрозы и безопасность своих фигур.',answer:'Конкретная тактика по проверенной линии не установлена. Вернись перед ошибкой и сравни ответы соперника.'},
 en:{question:'What changed after your move?',tip:'Check forcing moves, captures, threats and the safety of your pieces.',answer:'No specific tactic was established by the verified line. Return before the mistake and compare the opponent’s replies.'}
};
function lessonFromVerified(verified){
 if(!verified||!Array.isArray(verified.afterLine)||typeof verified.afterFen!=='string')return null;
 const events=Array.isArray(verified.tactics)?verified.tactics:[];
 // Prefer a concrete early motif over a late speculative feature of a long PV.
 const ranked=events.filter(e=>PRIORITY[e.kind]&&Number.isInteger(e.ply)&&e.ply>=1&&e.ply<=verified.afterLine.length)
  .map(event=>({event,score:PRIORITY[event.kind]-Math.max(0,event.ply-1)*3}))
  .sort((a,b)=>b.score-a.score||a.event.ply-b.event.ply);
 for(const {event} of ranked){
  const board=new ClassicChessEngine(verified.afterFen);
  let valid=true;
  for(let n=0;n<event.ply-1;n++){
   const uci=verified.afterLine[n];
   if(!board.move(uci.slice(0,2),uci.slice(2,4),uci.slice(4)||null).ok){valid=false;break;}
  }
  const move=verified.afterLine[event.ply-1];
  if(!valid||!move||move.slice(0,2)!==event.from||move.slice(2,4)!==event.to)continue;
  const actor=board.pieceAt(event.from);
  if(!actor||actor.color===verified.player)continue;
  const found=board.legalMoves(event.from).some(m=>m.to===event.to&&(!m.promotion||m.promotion===move.slice(4)));
  if(!found)continue;
  return {kind:event.kind,ply:event.ply,from:event.from,to:event.to,actor:actor.type,
   targets:Array.isArray(event.targetSquares)?event.targetSquares.slice(0,3):[],
   targetTypes:Array.isArray(event.targets)?event.targets.slice(0,3):[],
   totalPlies:verified.afterLine.length};
 }
 return {kind:'positional',ply:0,from:null,to:null,targets:[],totalPlies:verified.afterLine.length};
}
function mentorLessonCopy(plan,language='ru',stage=0){
 const loc=language==='en'?'en':'ru',topic=GUIDES[plan?.kind]?.[loc],fallback=DEFAULT[loc];
 const question=topic?.[0]||fallback.question;
 const principle=topic?.[1]||fallback.tip;
 const noun=NAMES[loc][plan?.actor]|| (loc==='ru'?'фигуру':'piece');
 const from=plan?.from||'',to=plan?.to||'';
 const hint1=from
  ?loc==='ru'?'Ищи '+noun+' соперника.': 'Look for the opponent’s '+noun+'.'
  :principle;
 const hint2=from
  ?loc==='ru'?'Она находится на вертикали '+from[0]+'.':'It stands on the '+from[0]+'-file.'
  :principle;
 const locations=(Array.isArray(plan?.targets)?plan.targets:[]).filter(v=>/^[a-h][1-8]$/.test(v)).slice(0,3);
 const shown=locations.join(loc==='ru'?' и ':' and ');
 const concrete={
  ru:{
   mate_sequence:'Здесь возможен мат королю'+(shown?' на '+shown:'')+'.',
   back_rank_mate:'Здесь показан мат по последней горизонтали'+(shown?' королю на '+shown:'')+'.',
   double_check:'После хода король'+(shown?' на '+shown:'')+' получает двойной шах.',
   discovered_check:'Освобождается линия атаки на короля'+(shown?' на '+shown:'')+'.',
   fork:'После хода фигура одновременно атакует'+(shown?' цели '+shown:' несколько целей')+'.',
   pin:'Возникает связка'+(shown?' фигуры на '+shown:' фигуры у короля')+'.',
   skewer_pattern:'В одной линии стоят две ценные цели'+(shown?': '+shown:'')+'. Это геометрический мотив, но выигрыш материала не гарантирован.',
   overloaded_defender:'После снятия защитника под ударом оказываются'+(shown?' цели '+shown:' несколько целей')+'.',
   removed_defender:'После снятия защитника цель'+(shown?' на '+shown:'')+' остаётся без защиты и под ударом.',
   undefended_capture:'Происходит взятие'+(shown?' на '+shown:'')+'. Перед этим фигура не имела защитников.',
   promotion:'Пешка превращается'+(shown?' на '+shown:'')+'.',
   advanced_passed_pawn:'Проходная пешка достигает'+(shown?' поля '+shown:' предпоследней горизонтали')+'.',
   discovered_attack:'Открывается новая линия атаки'+(shown?' на '+shown:'')+'.',
   interference:'Ход перекрывает линию нападения'+(shown?' между '+shown:'')+'.',
   capture:'В линии есть взятие'+(shown?' на '+shown:'')+'.',
   material_loss:'В этой линии происходит потеря материала'+(shown?' на '+shown:'')+'.',
   en_passant:'В этой линии возможно взятие на проходе'+(shown?' пешки на '+shown:'')+'.',
   check:'Следует шах'+(shown?' королю на '+shown:'')+'.'
  },
  en:{
   mate_sequence:'This line ends in checkmate'+(shown?' against the king on '+shown:'')+'.',
   back_rank_mate:'This is a back-rank mate'+(shown?' against the king on '+shown:'')+'.',
   double_check:'The king'+(shown?' on '+shown:'')+' faces a double check.',
   discovered_check:'A discovered check opens against the king'+(shown?' on '+shown:'')+'.',
   fork:'The piece attacks'+(shown?' targets on '+shown:' multiple targets')+' simultaneously.',
   pin:'A piece becomes pinned'+(shown?' on '+shown:'')+'.',
   skewer_pattern:'Two targets align on the same ray'+(shown?': '+shown:'')+'. This pattern does not guarantee a material gain.',
   overloaded_defender:'After removing a defender, several targets are under attack'+(shown?': '+shown:'')+'.',
   removed_defender:'After the defender is removed, the target'+(shown?' on '+shown:'')+' is attacked and unprotected.',
   undefended_capture:'A capture occurs'+(shown?' on '+shown:'')+'. The target had no defenders.',
   promotion:'A pawn promotes'+(shown?' on '+shown:'')+'.',
   advanced_passed_pawn:'An advanced passed pawn reaches'+(shown?' '+shown:' the seventh rank')+'.',
   discovered_attack:'A line opens to attack'+(shown?' '+shown:' a piece')+'.',
   interference:'The move blocks a sliding attack'+(shown?' between '+shown:'')+'.',
   capture:'This line contains a capture'+(shown?' on '+shown:'')+'.',
   material_loss:'Material is lost in this line'+(shown?' on '+shown:'')+'.',
   en_passant:'This line contains an en passant capture'+(shown?' of the pawn on '+shown:'')+'.',
   check:'A check is given'+(shown?' to the king on '+shown:'')+'.'
  }
 };
 const consequence=concrete[loc][plan?.kind]||'';
 const answer=from
  ?(loc==='ru'?'В проверенной линии соперник ходит ':'In the verified line the opponent plays ')+from+'–'+to+'. '+consequence+' '+principle
  :fallback.answer;
 return {question,hint1,hint2,answer,principle,
  optional:loc==='ru'?'Это одна возможная линия, а не вынужденный результат.':'This is one possible line, not a forced outcome.',
  instruction:loc==='ru'?'Нажми на фигуру соперника на доске.':'Tap the opponent’s piece on the board.',
  correct:loc==='ru'?'Верно, ты нашёл нужную фигуру!':'Correct, you found the piece!',
  wrong:loc==='ru'?'Это другая фигура. Проверь направление атаки.':'That is not the piece. Check the attack direction.',
  show:loc==='ru'?'Показать разбор':'Show explanation'};
}
function validateLessonGuess(plan,square){return Boolean(plan?.from&&plan.from===square);}
export {PRIORITY,GUIDES,lessonFromVerified,mentorLessonCopy,validateLessonGuess};
