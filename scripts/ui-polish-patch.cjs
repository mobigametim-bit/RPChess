const fs = require('fs');
const path = require('path');

module.exports = function applyUiPolishPatch(dist) {
  const uiPath = path.join(dist, 'js', 'ui.js');
  const cssPath = path.join(dist, 'style.css');
  const buildInfoPath = path.join(dist, 'BUILD_INFO.json');
  let ui = fs.readFileSync(uiPath, 'utf8');
  let css = fs.readFileSync(cssPath, 'utf8');

  if (!ui.includes('escapeAttr(v)')) {
    ui = ui.replace(/(\n\s*shortText\(s,max=96\)\{[^\n]*\}\n)/, "$1    escapeAttr(v){return String(v??'').replace(/&/g,'&amp;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}\n");
  }

  ui = ui.replace(
    /return `<div class="tag" title="\$\{this\.lang\(\)==='en'\?a\.descEn:a\.descRu\}">\$\{this\.lang\(\)==='en'\?a\.nameEn:a\.nameRu\}<\/div>`;/,
    "const name=this.lang()==='en'?a.nameEn:a.nameRu,desc=this.lang()==='en'?a.descEn:a.descRu;return `<button class=\"tag relic-tag\" type=\"button\" data-relic-name=\"${this.escapeAttr(name)}\" data-relic-desc=\"${this.escapeAttr(desc)}\">${name}</button>`;"
  );

  ui = ui.replace(
    /if\(it\.type==='artifact'\)\{const a=D\.artifacts\.find\(x=>x\.id===it\.id\);return `<div class="reward-art" style="background-image:url\('\$\{art\}'\)"><\/div><h3>\$\{this\.lang\(\)==='en'\?a\.nameEn:a\.nameRu\}<\/h3><p class="compact-copy">\$\{this\.shortText\(this\.lang\(\)==='en'\?a\.descEn:a\.descRu,92\)\}<\/p>`;\}/,
    "if(it.type==='artifact'){const a=D.artifacts.find(x=>x.id===it.id),name=this.lang()==='en'?a.nameEn:a.nameRu,desc=this.lang()==='en'?a.descEn:a.descRu;return `<div class=\"reward-art\" style=\"background-image:url('${art}')\"></div><button class=\"relic-name-button\" type=\"button\" data-relic-name=\"${this.escapeAttr(name)}\" data-relic-desc=\"${this.escapeAttr(desc)}\">${name}</button><p class=\"compact-copy\">${this.shortText(desc,92)}</p>`;}"
  );

  ui = ui.replace(
    /if\(x\.type==='artifact'\)\{const a=D\.artifacts\.find\(v=>v\.id===x\.artifactId\);return `<div class="reward-art" style="background-image:url\('\$\{this\.rewardArt\('artifact'\)\}'\)"><\/div><h3>\$\{this\.lang\(\)==='en'\?a\.nameEn:a\.nameRu\}<\/h3><p class="compact-copy">\$\{this\.shortText\(this\.lang\(\)==='en'\?a\.descEn:a\.descRu,92\)\}<\/p><span class="tag">\$\{a\.rarity\}<\/span>`;\}/,
    "if(x.type==='artifact'){const a=D.artifacts.find(v=>v.id===x.artifactId),name=this.lang()==='en'?a.nameEn:a.nameRu,desc=this.lang()==='en'?a.descEn:a.descRu;return `<div class=\"reward-art\" style=\"background-image:url('${this.rewardArt('artifact')}')\"></div><button class=\"relic-name-button\" type=\"button\" data-relic-name=\"${this.escapeAttr(name)}\" data-relic-desc=\"${this.escapeAttr(desc)}\">${name}</button><p class=\"compact-copy\">${this.shortText(desc,92)}</p><span class=\"tag\">${a.rarity}</span>`;}"
  );

  if (!ui.includes('openRelicModal(name,desc)')) {
    const modalHelpers = "\n    openRelicModal(name,desc){\n      this.closeRelicModal();\n      const overlay=document.createElement('div');\n      overlay.className='relic-modal-backdrop';\n      overlay.innerHTML=`<div class=\"relic-modal panel\" role=\"dialog\" aria-modal=\"true\" aria-label=\"${this.t('Описание реликвии','Relic details')}\"><button class=\"relic-modal-close\" type=\"button\" aria-label=\"${this.t('Закрыть','Close')}\">×</button><div class=\"eyebrow\">${this.t('РЕЛИКВИЯ','RELIC')}</div><h3></h3><p></p></div>`;\n      overlay.querySelector('h3').textContent=name;\n      overlay.querySelector('p').textContent=desc;\n      overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.relic-modal-close'))this.closeRelicModal();});\n      document.body.appendChild(overlay);\n      this.relicModalEl=overlay;\n    }\n    closeRelicModal(){if(this.relicModalEl){this.relicModalEl.remove();this.relicModalEl=null;}}\n";
    ui = ui.replace(/(\n\s*bindScreen\(type\)\{\n)/, modalHelpers + '$1');
  }

  if (!ui.includes("openRelicModal(el.dataset.relicName")) {
    ui = ui.replace(
      "      this.root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>this.action(el.dataset.action)));\n",
      "      this.root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>this.action(el.dataset.action)));\n      this.root.querySelectorAll('[data-relic-name]').forEach(el=>el.addEventListener('click',()=>{this.audio.click();this.openRelicModal(el.dataset.relicName,el.dataset.relicDesc);}));\n"
    );
  }

  if (!ui.includes("if(a==='close_relic_modal')")) {
    ui = ui.replace(
      "    action(a){\n      this.audio.click();\n",
      "    action(a){\n      if(a==='close_relic_modal'){this.closeRelicModal();return;}\n      this.closeRelicModal?.();\n      this.audio.click();\n"
    );
  }

  const marker = '/* 1.3.5 — scene card sizing and relic tooltip modal */';
  if (!css.includes(marker)) {
    css += `\n\n${marker}\n.scene-header{grid-template-columns:minmax(340px,.92fr) max-content!important;align-items:stretch;min-height:324px!important;padding:14px 18px!important;gap:18px!important}\n.scene-header-copy{display:flex;flex-direction:column;justify-content:center;padding:16px 6px 16px 12px!important;text-shadow:none!important}.scene-header-copy .eyebrow{font-size:1.45rem!important;line-height:1.1;color:#6ea5cf!important;text-shadow:none!important}.scene-header-copy .section-title{font-size:clamp(2.4rem,3.4vw,4rem)!important;line-height:.98;color:#2f3d4d!important;text-shadow:none!important;margin:10px 0 16px!important}.scene-header-copy .section-subtitle{font-size:1.5rem!important;line-height:1.24;color:#46525c!important;font-weight:600;text-shadow:none!important;max-width:32ch!important}.scene-header-art{justify-self:end;width:auto!important;max-width:min(58vw,860px);height:auto!important;min-height:292px!important;padding-right:6px!important;background:transparent!important;border-radius:0!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;overflow:visible!important}.scene-header-art img{display:block;width:auto!important;max-width:100%!important;height:292px!important;max-height:292px!important;object-fit:contain!important;object-position:right center!important;filter:drop-shadow(0 16px 26px rgba(0,0,0,.34))!important}\n.event-stage{grid-template-columns:minmax(340px,.92fr) max-content!important;min-height:430px!important}.event-copy{padding:32px 22px 28px 30px!important}.event-copy .eyebrow{font-size:1.38rem!important;color:#6ea5cf!important;text-shadow:none!important}.event-copy h2,.event-copy .section-title{font-size:clamp(2.2rem,3vw,3.6rem)!important;color:#2f3d4d!important;text-shadow:none!important}.event-copy .lead,.event-copy .section-subtitle,.event-copy p{font-size:1.4rem!important;line-height:1.24;color:#46525c!important;text-shadow:none!important}.event-hero{justify-self:end;min-height:0!important;padding:10px 6px 10px 0!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;overflow:visible!important}.event-hero img{display:block;width:auto!important;max-width:min(58vw,860px)!important;height:364px!important;max-height:364px!important;object-fit:contain!important;object-position:right center!important;border-radius:12px!important}\n.relic-tag{cursor:pointer}.relic-name-button{display:block;margin:2px 0 6px;padding:0;border:0;background:none;color:#f1e7c8;font:inherit;font-size:1.32rem;font-weight:800;line-height:1.12;text-align:left;cursor:pointer}.relic-name-button:hover,.relic-tag:hover{text-decoration:underline}\n.relic-modal-backdrop{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,12,18,.72);backdrop-filter:blur(4px)}.relic-modal{position:relative;width:min(560px,92vw);padding:28px 28px 24px;border:30px solid transparent;border-image-source:url(\"generated_assets/ui_panel_frame.png\");border-image-slice:80 fill;border-image-width:26px;border-image-repeat:stretch;background:linear-gradient(180deg,rgba(10,26,36,.98),rgba(8,19,28,.98));box-shadow:0 24px 60px rgba(0,0,0,.5)}.relic-modal .eyebrow{color:#8bc5ff!important}.relic-modal h3{margin:8px 0 14px;color:#f0e4c2;font-size:2rem;line-height:1.05}.relic-modal p{margin:0;color:#d8dddf;font-size:1.18rem;line-height:1.4}.relic-modal-close{position:absolute;top:12px;right:14px;border:0;background:none;color:#f0e4c2;font-size:1.9rem;line-height:1;cursor:pointer}\n@media(max-width:1100px){.scene-header,.event-stage{grid-template-columns:1fr!important}.scene-header-art,.event-hero{justify-self:center;max-width:100%;padding-right:0!important}.scene-header-art img{height:min(42vw,290px)!important}.event-hero img{height:min(54vw,360px)!important;max-width:100%!important}.scene-header-copy,.event-copy{padding:12px 8px 0 10px!important}.scene-header-copy .section-subtitle,.event-copy p{max-width:none!important}}\n@media(max-width:700px){.scene-header{padding:12px 10px!important;min-height:0!important}.scene-header-art{min-height:0!important}.scene-header-art img{height:220px!important;max-height:220px!important}.scene-header-copy .eyebrow,.event-copy .eyebrow{font-size:1.12rem!important}.scene-header-copy .section-title,.event-copy h2,.event-copy .section-title{font-size:2rem!important}.scene-header-copy .section-subtitle,.event-copy p{font-size:1.06rem!important}.event-hero img{height:240px!important;max-height:240px!important}}\n`;
  }

  fs.writeFileSync(uiPath, ui);
  fs.writeFileSync(cssPath, css);
  if (fs.existsSync(buildInfoPath)) {
    const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    info.version = '1.3.5';
    info.build_name = 'RPChess Fantasy Edition 1.3.5 Scene and Relic Polish';
    info.notes = 'Scene illustrations scale larger without tails; frame text is darker and larger; relic names open a description modal.';
    fs.writeFileSync(buildInfoPath, JSON.stringify(info, null, 2));
  }

  if (!ui.includes('relic-name-button') || !css.includes('relic-modal-backdrop') || !ui.includes('openRelicModal(name,desc)')) throw new Error('UI polish patch validation failed');
  console.log('Applied RPChess 1.3.5 scene/relic polish patch.');
};
