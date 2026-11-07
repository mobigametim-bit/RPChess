/* Optional browser-native mentor narration. No API key, network call or audio file. */
const SPEAKER_ICON='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

function createMentorSpeech({getRoot,getLanguage,translate}){
 let active=null,activeText='',activeLang='';
 function supported(){
  return typeof globalThis.speechSynthesis?.speak==='function' &&
   typeof globalThis.SpeechSynthesisUtterance==='function';
 }
 function visibleText(){
  const root=getRoot();
  if(!root||root.hidden||root.querySelector('.mentor-thinking'))return '';
  return root.querySelector('.mentor-ai-explanation,.mentor-feedback-text')?.textContent?.trim()||'';
 }
 function buttonMarkup(){
  return '<button type="button" class="mentor-speech-button" data-mentor-action="speech"'+
   ' aria-label="'+translate('mentorSpeak')+'" title="'+translate('mentorSpeak')+'" aria-pressed="false">'+
   SPEAKER_ICON+'</button>';
 }
 function sync(){
  const button=getRoot()?.querySelector('[data-mentor-action="speech"]');
  if(!button)return;
  const available=supported(),playing=Boolean(active);
  const label=!available?translate('mentorSpeechUnavailable'):
   playing?translate('mentorStopSpeech'):translate('mentorSpeak');
  button.disabled=!available||(!playing&&!visibleText());
  button.setAttribute('aria-label',label);button.title=label;
  button.setAttribute('aria-pressed',String(playing));
  button.classList.toggle('is-speaking',playing);
 }
 function stop(){
  if(!active)return;
  active=null;activeText='';activeLang='';
  try{globalThis.speechSynthesis?.cancel();}catch{}
  sync();
 }
 function toggle(){
  if(active){stop();return;}
  const text=visibleText();
  if(!text||!supported())return;
  const locale=getLanguage()==='ru'?'ru-RU':'en-GB';
  try{
   const synth=globalThis.speechSynthesis;
   const utterance=new globalThis.SpeechSynthesisUtterance(text);
   utterance.lang=locale;utterance.rate=.96;utterance.pitch=1;
   const voices=typeof synth.getVoices==='function'?synth.getVoices():[];
   const prefix=locale.slice(0,2).toLowerCase();
   const matchesLanguage=v=>String(v.lang||'').toLowerCase().startsWith(prefix);
   // Honor the owner's chosen voices, irrespective of localService.
   // Web Speech exposes names and locales, but no reliable gender property.
   const preferred=prefix==='ru'
    ?voices.find(v=>matchesLanguage(v)&&/\bpavel\b/i.test(v.name||''))
    :voices.find(v=>matchesLanguage(v)&&/^google\s+uk\s+english\s+male$/i.test((v.name||'').trim()));
   const voice=preferred||
    voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase()&&v.localService)||
    voices.find(v=>v.lang?.toLowerCase()===locale.toLowerCase())||
    voices.find(v=>matchesLanguage(v)&&v.localService)||
    voices.find(matchesLanguage);
   if(voice){utterance.voice=voice;utterance.lang=voice.lang||locale;}
   utterance.onend=utterance.onerror=()=>{
    if(active!==utterance)return;
    active=null;activeText='';activeLang='';sync();
   };
   active=utterance;activeText=text;activeLang=getLanguage();
   // speak() must run directly within the user's click gesture on mobile.
   synth.cancel();synth.speak(utterance);sync();
  }catch{stop();}
 }
 function onRender(){
  if(active&&(activeText!==visibleText()||activeLang!==getLanguage()))stop();
  sync();
 }
 return {buttonMarkup,toggle,stop,onRender};
}
export {createMentorSpeech};
