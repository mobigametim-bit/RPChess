/* UI-only mentor copy: no LLM calls and no free-form claims of a tactic. */
const THINKING={
 ru:[
 'Хм… тут есть над чем подумать.',
 'Этот ход вызывает вопросы. Сейчас разберём.',
 'Не спеши. Я проверяю продолжения.',
 'Кажется, можно было точнее…',
 'Любопытное решение. Давай посмотрим.',
 'Погоди, я кое-что заметил.',
 'Сейчас проверю, что за этим последует.',
 'Так-так… позиция изменилась.',
 'Дай взглянуть на варианты.',
 'Уверен в этом решении? Проверим.',
 'Хм, соперник может этим воспользоваться.',
 'Тут нужна внимательность. Разбираюсь.',
 'Проверяю возможные ответы.',
 'Интересный момент. Сейчас объясню.',
 'Посмотрим на последствия хода.',
 'Я вижу повод задуматься…',
 'Не торопись с выводами.',
 'Давай заглянем чуть дальше.',
 'Подожди, я просчитываю детали.',
 'В этой позиции не всё так просто.'
 ],
 en:[
 'Hmm… this deserves a closer look.',
 'That move raises a question. Let me check.',
 'Hold on. I am checking continuations.',
 'There might have been a more accurate move…',
 'Interesting choice. Let’s examine it.',
 'Wait, something caught my eye.',
 'Checking what might follow.',
 'Well now… the position has changed.',
 'Let me look at the variations.',
 'Are you sure about that choice? Let’s check.',
 'Hmm, your opponent may have an opportunity.',
 'This needs care. I am investigating.',
 'Checking possible replies.',
 'Interesting moment. I will explain.',
 'Let’s examine the consequences.',
 'This gives us something to think about…',
 'Don’t rush to a conclusion.',
 'Let’s look a little further ahead.',
 'One moment while I calculate.',
 'This position is more subtle than it seems.'
 ]
};
const PRAISE={
 ru:{
 good:[
 'Отличный ход! Ты нашёл сильное продолжение.',
 'Верно подмечено. Хорошее решение!',
 'Прекрасно! Так и надо играть эту позицию.',
 'Здорово! Ты увидел важную возможность.',
 'Точный ход. Продолжай в том же духе.',
 'Красиво сыграно! Отличная находка.',
 'Ты не упустил шанс. Молодец!',
 'Хорошая работа! Ход заслуживает похвалы.',
 'Сильное решение. Сопернику непросто.',
 'Отлично! Ты выбрал убедительный план.'
 ],
 excellent:[
 'Блестяще! Очень сильное решение.',
 'Великолепно! Вот это находка.',
 'Превосходный ход! Настоящий шахматный момент.',
 'Браво! Решение требует точного расчёта.',
 'Это было мощно. Поздравляю!',
 'Шикарная находка! Сыграно уверенно.',
 'Впечатляет! Ты увидел главное.',
 'Замечательно! Очень точный выбор.',
 'Блестящая игра! Снимаю шляпу.',
 'Редко увидишь такую точность. Браво!'
 ]
 },
 en:{
 good:[
 'Great move! You found a strong continuation.',
 'Well spotted. Good decision!',
 'Excellent! This is a sound way to play.',
 'Nice! You saw an important opportunity.',
 'Accurate move. Keep it up.',
 'Beautiful play! Great find.',
 'You seized the chance. Well done!',
 'Good work! That move deserves praise.',
 'Strong choice. Your opponent has work to do.',
 'Excellent! You chose a convincing plan.'
 ],
 excellent:[
 'Brilliant! A very strong choice.',
 'Magnificent! What a find.',
 'Superb move! A real chess moment.',
 'Bravo! That required accurate calculation.',
 'Powerful play. Congratulations!',
 'Fantastic find! Nicely done.',
 'Impressive! You saw what mattered.',
 'Wonderful! An extremely precise choice.',
 'Brilliant chess! Hats off.',
 'Remarkable accuracy. Bravo!'
 ]
 }
};
const FALLBACK={
 ru:{
 inaccuracy:'Неточность. Позицию можно было разыграть точнее. Попробуй найти более надёжный ход.',
 mistake:'Ошибка. Этот ход ухудшил твою позицию. Вернись назад и поищи другое решение.',
 blunder:'Зевок. Ход создаёт серьёзные проблемы. Проверь угрозы соперника.'
 },
 en:{
 inaccuracy:'Inaccuracy. You could have played this position more precisely. Look for a sounder move.',
 mistake:'Mistake. This move worsened your position. Go back and try another plan.',
 blunder:'Blunder. This move creates serious problems. Check your opponent’s threats.'
 }
};
function pick(items,seed){
 const text=String(seed||'');
 let h=2166136261;
 for(const char of text){h=Math.imul(h^char.charCodeAt(0),16777619)>>>0;}
 return items[h%items.length];
}
function thinkingText(language,seed){return pick(THINKING[language==='en'?'en':'ru'],seed);}
function praiseText(language,kind,seed){
 const collection=PRAISE[language==='en'?'en':'ru'][kind];
 return collection?pick(collection,seed):'';
}
function fallbackText(language,kind){return FALLBACK[language==='en'?'en':'ru'][kind]||'';}
export {THINKING,PRAISE,FALLBACK,thinkingText,praiseText,fallbackText};
