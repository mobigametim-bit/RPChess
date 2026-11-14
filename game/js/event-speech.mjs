/* Browser-native Events narration. Same voice preferences and 1.5x rate as Mentor.
   One click reads title, story, optional king reaction, then choice button text. */
const SPEAKER_ICON='<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
function createEventSpeech({getRoot,getLanguage}){
 let active=null,activeText='',activeLang='';
 const labels={
  ru:{start:'Озвучить событие',stop:'Остановить чтение',unavailable:'Озвучивание недоступно в этом браузере'},
  en:{start:'Read event aloud',stop:'Stop reading',unavailable:'Speech is unavailable in this browser'}
 };
 const copy=()=>labels[getLanguage()==='en'?'en':'ru'];
 const supported=()=>typeof globalThis.speechSynthesis?.speak==='function'&&
   typeof globalThis.SpeechSynthesisUtterance==='function';
 function visibleText(){
  const root=getRoot();
  if(!root||root.hidden||root.querySelector('[data-events-outcome]')?.hidden===false)return '';
  const parts=[],add=node=>{const text=node?.textContent?.trim();if(text)parts.push(text);};
  add(root.querySelector('[data-events-title]'));
  root.querySelectorAll('[data-events-story] p').forEach(add);
  const reaction=root.querySelector('[data-events-king-reaction]');
  if(reaction&&!reaction.hidden)add(reaction);
  root.querySelectorAll('[data-event-choice]').forEach(button=>{
   // Preserve the exact visual reading order of the actionable button copy.
   add(button.querySelector('.events-choice__head strong'));
   add(button.querySelector('.events-choice__head > span'));
   button.querySelectorAll('.events-choice__hero-line,.events-choice__reaction,.events-choice__meta small').forEach(add);
  });
  return parts.join('. ');
 }
 function sync(){
  const button=getRoot()?.querySelector('[data-events-speech]');
  if(!button)return;
  const ready=supported(),playing=Boolean(active);
  const label=!ready?copy().unavailable:playing?copy().stop:copy().start;
  button.disabled=!ready||(!playing&&!visibleText());
  button.setAttribute('aria-label',label);button.title=label;
  button.setAttribute('aria-pressed',String(playing));
  button.classList.toggle('is-speaking',playing);
 }
 function stop(){
  if(!active){sync();return;}
  active=null;activeText='';activeLang='';
  try{globalThis.speechSynthesis?.cancel();}catch{}
  sync();
 }
 function toggle(){
  if(active){stop();return;}
  const text=visibleText();if(!text||!supported())return;
  const locale=getLanguage()==='en'?'en-GB':'ru-RU';
  try{
   const synth=globalThis.speechSynthesis;
   const utterance=new globalThis.SpeechSynthesisUtterance(text);
   utterance.lang=locale;utterance.rate=1.5;utterance.pitch=1;
   const voices=typeof synth.getVoices==='function'?synth.getVoices():[];
   const prefix=locale.slice(0,2).toLowerCase();
   const matches=v=>String(v.lang||'').toLowerCase().startsWith(prefix);
   const preferred=prefix==='ru'
    ?voices.find(v=>matches(v)&&/\bpavel\b/i.test(v.name||''))
    :voices.find(v=>matches(v)&&/^google\s+uk\s+english\s+male$/i.test((v.name||'').trim()));
   const voice=preferred||
    voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase()&&v.localService)||
    voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase())||
    voices.find(v=>matches(v)&&v.localService)||voices.find(matches);
   if(voice){utterance.voice=voice;utterance.lang=voice.lang||locale;}
   utterance.onend=utterance.onerror=()=>{
    if(active!==utterance)return;
    active=null;activeText='';activeLang='';sync();
   };
   active=utterance;activeText=text;activeLang=getLanguage();
   // The browser requires speak() directly inside the tap/click event.
   synth.cancel();synth.speak(utterance);sync();
  }catch{stop();}
 }
 function onRender(){
  if(active&&(activeText!==visibleText()||activeLang!==getLanguage()))stop();
  sync();
 }
 return {buttonMarkup:()=>'<button type="button" class="events-speech-button" data-events-speech aria-pressed="false" aria-label="'+copy().start+'" title="'+copy().start+'">'+SPEAKER_ICON+'</button>',
  stop,toggle,onRender,visibleText};
}
export {createEventSpeech};
