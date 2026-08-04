/* RPChess fantasy content registry. Internal IDs are retained for save compatibility. */
window.NC_DATA = (() => {
  const units = {
    process: { id:'process', nameRu:'Пешка', nameEn:'Pawn', glyph:'♟', value:1, descRu:'Идёт вперёд и берёт по диагонали.', descEn:'Moves forward and captures diagonally.' },
    injector: { id:'injector', nameRu:'Конь', nameEn:'Knight', glyph:'♞', value:3, descRu:'Прыгает буквой «Г» через фигуры и преграды.', descEn:'Jumps in an L-shape over pieces and obstacles.' },
    scanner: { id:'scanner', nameRu:'Слон', nameEn:'Bishop', glyph:'♝', value:3, descRu:'Скользит по диагоналям.', descEn:'Slides diagonally.' },
    bastion: { id:'bastion', nameRu:'Ладья', nameEn:'Rook', glyph:'♜', value:5, descRu:'Скользит по вертикали и горизонтали.', descEn:'Slides orthogonally.' },
    battle_ai: { id:'battle_ai', nameRu:'Ферзь', nameEn:'Queen', glyph:'♛', value:9, descRu:'Самая подвижная фигура: ходит по прямым и диагоналям.', descEn:'The most mobile piece, moving along ranks, files, and diagonals.' },
    core: { id:'core', nameRu:'Король', nameEn:'King', glyph:'♚', value:100, descRu:'Главная фигура армии. Его потеря означает поражение.', descEn:'The army’s central piece. Losing it means defeat.' },
    machine_king: { id:'machine_king', nameRu:'Тёмный король', nameEn:'Dark King', glyph:'♚', value:250, descRu:'Многофазный владыка, нарушающий законы доски.', descEn:'A multi-phase ruler who bends the laws of the board.' },
    shield_node: { id:'shield_node', nameRu:'Магический оберег', nameEn:'Arcane Ward', glyph:'◆', value:8, descRu:'Поддерживает защиту Тёмного короля.', descEn:'Sustains the Dark King’s protection.' }
  };

  const commanders = [
    { id:'warlord', nameRu:'Полководец', nameEn:'Warlord', unlock:0, passiveRu:'+1 очко приказа в каждом ходу.', passiveEn:'+1 Order Point each turn.', ability:'rally', squad:['process','process','injector','bastion'] },
    { id:'necromancer', nameRu:'Некромант', nameEn:'Necromancer', unlock:1, passiveRu:'Первая павшая фигура возвращается через 2 раунда.', passiveEn:'The first fallen piece returns after 2 rounds.', ability:'recompile', squad:['process','process','scanner','injector'] },
    { id:'engineer', nameRu:'Рунный мастер', nameEn:'Runesmith', unlock:2, passiveRu:'Ладья начинает бой с магическим щитом.', passiveEn:'The Rook starts battle with an arcane shield.', ability:'fortress', squad:['process','bastion','bastion','scanner'] },
    { id:'psionic', nameRu:'Провидец', nameEn:'Seer', unlock:3, passiveRu:'Проклятые метки делают цель уязвимее.', passiveEn:'Cursed marks make targets more vulnerable.', ability:'mind_lock', squad:['process','injector','scanner','scanner'] },
    { id:'chronicler', nameRu:'Хронист', nameEn:'Chronicler', unlock:5, passiveRu:'Один раз за бой может переписать последнее действие.', passiveEn:'May rewrite the last action once per battle.', ability:'rewind', squad:['process','process','scanner','bastion'] },
    { id:'aggressor', nameRu:'Берсерк', nameEn:'Berserker', unlock:7, passiveRu:'После взятия союзная фигура получает дополнительный ход.', passiveEn:'After a capture, an allied piece gains an extra move.', ability:'overclock', squad:['process','injector','injector','battle_ai'] }
  ];

  const artifacts = [
    { id:'echo_shield', nameRu:'Щит эха', nameEn:'Echo Shield', rarity:'common', descRu:'Первое вражеское взятие в бою поглощается оберегом.', descEn:'The first enemy capture each battle is absorbed by a ward.' },
    { id:'ghost_route', nameRu:'Призрачные шпоры', nameEn:'Phantom Spurs', rarity:'common', descRu:'Конь становится невидимым после обычного хода.', descEn:'Knights become invisible after a normal move.' },
    { id:'shared_firewall', nameRu:'Круг защиты', nameEn:'Circle of Warding', rarity:'rare', descRu:'В начале боя два случайных союзника получают щит.', descEn:'Two random allies gain shields at battle start.' },
    { id:'forked_command', nameRu:'Двойной приказ', nameEn:'Twin Command', rarity:'rare', descRu:'Первая способность каждого боя не расходует очки приказа.', descEn:'The first ability each battle costs no Order Points.' },
    { id:'early_promotion', nameRu:'Королевский указ', nameEn:'Royal Decree', rarity:'rare', descRu:'Пешка превращается, достигнув предпоследней линии.', descEn:'Pawns promote upon reaching the penultimate rank.' },
    { id:'death_cache', nameRu:'Клятва павших', nameEn:'Oath of the Fallen', rarity:'epic', descRu:'После гибели союзника вы получаете 1 очко приказа.', descEn:'Gain 1 Order Point when an ally falls.' },
    { id:'second_thread', nameRu:'Второе дыхание', nameEn:'Second Wind', rarity:'epic', descRu:'Один ветеран может действовать дважды каждый второй раунд.', descEn:'One veteran may act twice every other round.' },
    { id:'quantum_swap', nameRu:'Королевская рокировка', nameEn:'Royal Exchange', rarity:'epic', descRu:'Король один раз за бой меняется местами с союзником.', descEn:'The King may swap places with an ally once per battle.' },
    { id:'corrosive_trace', nameRu:'Проклятый след', nameEn:'Cursed Trail', rarity:'common', descRu:'После хода Ладьи исходная клетка становится опасной для врага.', descEn:'After a Rook moves, its origin becomes hazardous to enemies.' },
    { id:'protocol_zero', nameRu:'Печать феникса', nameEn:'Phoenix Seal', rarity:'legendary', descRu:'Один раз за поход поражение заменяется повторной попыткой.', descEn:'Once per run, a defeat becomes a retry.' },
    { id:'glass_queen', nameRu:'Стеклянная корона', nameEn:'Glass Crown', rarity:'legendary', descRu:'Ферзь может действовать дважды, но не получает щиты.', descEn:'The Queen acts twice but cannot receive shields.' },
    { id:'memory_of_home', nameRu:'Благословение очага', nameEn:'Hearth Blessing', rarity:'rare', descRu:'После каждого боя одна раненая фигура восстанавливается.', descEn:'After each battle, one wounded piece recovers.' }
  ];

  const achievements = [
    ['first_blood','Первое взятие','First Capture','Взять первую вражескую фигуру.','Capture your first enemy piece.'],
    ['first_win','Первая победа','First Victory','Победить в первом бою.','Win your first battle.'],
    ['boss_one','Король свергнут','King Dethroned','Победить Тёмного короля.','Defeat the Dark King.'],
    ['run_win','Королевство спасено','Realm Saved','Завершить успешный поход.','Complete a successful run.'],
    ['flawless','Без потерь','Flawless','Победить, не потеряв фигур.','Win a battle without losing pieces.'],
    ['veteran','Ветеран короны','Crown Veteran','Повысить фигуру до 3 уровня.','Raise a piece to level 3.'],
    ['collector','Хранитель реликвий','Relic Keeper','Собрать 6 артефактов за поход.','Hold 6 artifacts in one run.'],
    ['promotion','Возвышение','Ascension','Превратить Пешку.','Promote a Pawn.'],
    ['marked_kill','Проклятая цель','Cursed Target','Взять отмеченную фигуру.','Capture a marked target.'],
    ['rich','Королевская казна','Royal Treasury','Накопить 100 золотых.','Hold 100 gold.'],
    ['all_commanders','Совет героев','Council of Heroes','Открыть всех командиров.','Unlock every commander.'],
    ['hard_win','Испытание стали','Trial of Steel','Пройти поход на высокой сложности.','Win a run on hard difficulty.'],
    ['iron_win','Последняя клятва','Final Oath','Пройти режим окончательной смерти.','Win permadeath mode.'],
    ['ability_master','Великий тактик','Master Tactician','Применить 25 способностей.','Use 25 abilities.'],
    ['capture_chain','Серия взятий','Capture Chain','Сделать 3 взятия за один раунд.','Make 3 captures in one round.'],
    ['survivor','Последняя фигура','Last Piece','Победить с одним оставшимся союзником.','Win with one ally remaining.'],
    ['shopper','Любимец купцов','Merchant’s Friend','Купить 5 предметов за поход.','Buy 5 items in one run.'],
    ['event_horizon','Зов судьбы','Call of Fate','Пройти 8 событий.','Resolve 8 events.'],
    ['seed_keeper','Хранитель предначертания','Keeper of Fate','Завершить бой с указанным seed.','Finish a seeded battle.'],
    ['secret_node','Тайная тропа','Hidden Path','Найти тайный узел.','Find a hidden node.']
  ].map(a => ({id:a[0],nameRu:a[1],nameEn:a[2],descRu:a[3],descEn:a[4]}));

  const events = [
    {
      id:'orphan_packet', titleRu:'Забытый герб', titleEn:'Forgotten Crest',
      textRu:'На заброшенной дороге лежит герб павшего дома. В нём заключены воинское знание и память последнего владельца.',
      textEn:'A fallen house crest lies on an abandoned road, holding martial knowledge and its last owner’s memory.',
      choices:[
        {textRu:'Принять воинское знание',textEn:'Accept the martial knowledge',effect:{upgradeRandom:1}},
        {textRu:'Продать герб (+28 золота)',textEn:'Sell the crest (+28 gold)',effect:{credits:28}},
        {textRu:'Сохранить память (+2 эссенции)',textEn:'Preserve the memory (+2 essence)',effect:{meta:2}}
      ]
    },
    {
      id:'broken_gate', titleRu:'Разрушенные врата', titleEn:'Broken Gate',
      textRu:'Проклятые врата скрывают короткую дорогу к богатой земле.', textEn:'A cursed gate hides a shortcut to a wealthy land.',
      choices:[
        {textRu:'Прорваться: случайная рана, +45 золота',textEn:'Push through: random injury, +45 gold',effect:{credits:45,woundRandom:1}},
        {textRu:'Заплатить 18 золота за очищение',textEn:'Pay 18 gold for cleansing',cost:18,effect:{artifactRandom:1}},
        {textRu:'Обойти врата',textEn:'Take the long road',effect:{}}
      ]
    },
    {
      id:'mirror_core', titleRu:'Зеркальная корона', titleEn:'Mirror Crown',
      textRu:'Отражение вашего Короля предлагает обменять часть будущего на силу сейчас.', textEn:'A reflection of your King offers to trade part of the future for power now.',
      choices:[
        {textRu:'Принять: +2 уровня фигуре, -1 место в отряде',textEn:'Accept: +2 levels to a piece, -1 squad slot',effect:{upgradeRandom:2,maxSquad:-1}},
        {textRu:'Разбить зеркало: получить реликвию',textEn:'Shatter the mirror: gain a relic',effect:{artifactRandom:1}},
        {textRu:'Задать вопрос: открыть запись летописи',textEn:'Ask a question: unlock a chronicle entry',effect:{codex:'mirror_core'}}
      ]
    },
    {
      id:'zero_channel', titleRu:'Тропа без имени', titleEn:'Nameless Path',
      textRu:'Тайный орден предлагает помощь в обмен на часть вашей казны.', textEn:'A hidden order offers aid in exchange for part of your treasury.',
      secret:true,
      choices:[
        {textRu:'Отдать половину золота и исцелить всех',textEn:'Give half your gold and heal everyone',effect:{halfCredits:true,healAll:true}},
        {textRu:'Отдать реликвию и получить легендарную',textEn:'Trade a relic for a legendary one',effect:{tradeArtifact:true,legendaryRandom:1}},
        {textRu:'Запомнить путь (+3 эссенции)',textEn:'Remember the path (+3 essence)',effect:{meta:3,codex:'zero_channel'}}
      ]
    }
  ];

  const nodeTypes = {
    battle:{icon:'⚔',ru:'БОЙ',en:'BATTLE',descRu:'Обычная тактическая схватка.',descEn:'A standard tactical battle.'},
    elite:{icon:'◆',ru:'ЭЛИТА',en:'ELITE',descRu:'Опасный враг и лучшая награда.',descEn:'A dangerous foe and better rewards.'},
    event:{icon:'?',ru:'СОБЫТИЕ',en:'EVENT',descRu:'Выбор с последствиями.',descEn:'A choice with consequences.'},
    shop:{icon:'●',ru:'ЛАВКА',en:'SHOP',descRu:'Реликвии, исцеление и новые фигуры.',descEn:'Relics, healing, and new pieces.'},
    repair:{icon:'✚',ru:'ИСЦЕЛЕНИЕ',en:'HEALING',descRu:'Восстановление раненых фигур.',descEn:'Restore wounded pieces.'},
    training:{icon:'↑',ru:'ТРЕНИРОВКА',en:'TRAINING',descRu:'Развитие ветеранов.',descEn:'Improve veterans.'},
    vault:{icon:'▣',ru:'СОКРОВИЩНИЦА',en:'VAULT',descRu:'Награда без боя, иногда с риском.',descEn:'A reward without combat, sometimes risky.'},
    bargain:{icon:'!',ru:'ТЁМНАЯ СДЕЛКА',en:'DARK BARGAIN',descRu:'Большая выгода за высокую цену.',descEn:'A powerful benefit at a steep price.'},
    story:{icon:'☙',ru:'ЛЕТОПИСЬ',en:'STORY',descRu:'История мира и редкие выборы.',descEn:'Lore and rare choices.'},
    boss:{icon:'♛',ru:'БОСС',en:'BOSS',descRu:'Тёмный король преграждает путь.',descEn:'The Dark King blocks the road.'}
  };

  const codex = {
    process:['Пешка','Скромный воин, способный стать любой старшей фигурой, если дойдёт до края доски.'],
    machine_king:['Тёмный король','Проклятый владыка разрушенного королевства. Его защищают магические обереги и линии теневого пламени.'],
    mirror_core:['Зеркальная корона','Древняя реликвия, показывающая решения, которые командир ещё не успел принять.'],
    zero_channel:['Тропа без имени','Путь тайного ордена, не отмеченный ни на одной королевской карте.']
  };

  return { units, commanders, artifacts, achievements, events, nodeTypes, codex };
})();
