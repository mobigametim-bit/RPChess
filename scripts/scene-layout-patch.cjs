const fs = require('fs');
const path = require('path');

function asExpression(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith('${')) {
    let depth = 1;
    for (let i = 2; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++;
      else if (trimmed[i] === '}') {
        depth--;
        if (depth === 0) {
          if (i === trimmed.length - 1) return trimmed.slice(2, -1);
          break;
        }
      }
    }
  }
  return '`' + trimmed.replace(/`/g, '\`') + '`';
}

module.exports = function applySceneLayoutPatch(dist) {
  const uiPath = path.join(dist, 'js', 'ui.js');
  const cssPath = path.join(dist, 'style.css');
  const buildInfoPath = path.join(dist, 'BUILD_INFO.json');

  let ui = fs.readFileSync(uiPath, 'utf8');
  let css = fs.readFileSync(cssPath, 'utf8');

  if (!ui.includes('sceneHeader(kind')) {
    const anchor = "    sceneArt(kind){return this.asset(`scene_${kind}.jpg`);}\n";
    const helper = anchor + "    sceneHeader(kind,eyebrow,title,subtitle='',extraClass=''){return `<div class=\"scene-header ${extraClass}\"><div class=\"scene-header-copy\"><div class=\"eyebrow\">${eyebrow}</div><h2 class=\"section-title\">${title}</h2>${subtitle?`<p class=\"section-subtitle\">${subtitle}</p>`:''}</div><div class=\"scene-header-art\"><img src=\"${this.sceneArt(kind)}\" alt=\"\" loading=\"eager\"></div></div>`;}\n";
    if (!ui.includes(anchor)) throw new Error('RPChess sceneArt helper was not found.');
    ui = ui.replace(anchor, helper);
  }

  const standardBanner = /<div class="banner-panel compact"><div class="banner-art" style="background-image:url\('\$\{this\.sceneArt\('([^']+)'\)\}'\)"><\/div><div class="banner-copy"><div class="eyebrow">([\s\S]*?)<\/div><h2(?: class="section-title")?>([\s\S]*?)<\/h2><p class="section-subtitle">([\s\S]*?)<\/p><\/div><\/div>/g;
  ui = ui.replace(standardBanner, (_, kind, eyebrow, title, subtitle) => {
    return `\${this.sceneHeader('${kind}',${asExpression(eyebrow)},${asExpression(title)},${asExpression(subtitle)})}`;
  });

  const campaignBanner = /<div class="campaign-banner" style="background-image:url\('\$\{this\.sceneArt\('campaign'\)\}'\)"><div><div class="eyebrow">([\s\S]*?)<\/div><h2 class="section-title">([\s\S]*?)<\/h2><p class="section-subtitle">([\s\S]*?)<\/p><\/div><\/div>/;
  ui = ui.replace(campaignBanner, (_, eyebrow, title, subtitle) => {
    return `\${this.sceneHeader('campaign',${asExpression(eyebrow)},${asExpression(title)},${asExpression(subtitle)},'campaign-header')}`;
  });

  const eventStage = /<div class="event-stage"><div class="event-hero" style="background-image:url\('\$\{this\.eventArt\(e\.id\)\}'\)"><\/div><div class="event-overlay"><\/div><div class="event-copy">([\s\S]*?)<\/div><\/div>/;
  ui = ui.replace(eventStage, '<div class="event-stage"><div class="event-copy">$1</div><div class="event-hero"><img src="${this.eventArt(e.id)}" alt=""></div></div>');

  const marker = '/* 1.3.4 — full-scene presentation: no cropped scene banners */';
  if (!css.includes(marker)) {
    css += `\n\n${marker}\n.scene-header{display:grid;grid-template-columns:minmax(260px,.78fr) minmax(420px,1.22fr);align-items:center;gap:24px;position:relative;min-height:280px;margin:0 0 18px;padding:22px 24px;border:30px solid transparent;border-image-source:url("generated_assets/ui_panel_wide.png");border-image-slice:75 150 fill;border-image-width:25px 52px;border-image-repeat:stretch;background:linear-gradient(90deg,rgba(12,25,33,.94),rgba(12,25,33,.76));overflow:hidden}\n.scene-header-copy{min-width:0;align-self:center;padding:8px 2px 8px 8px}.scene-header-copy .section-title{margin:6px 0 10px}.scene-header-copy .section-subtitle{max-width:38ch;margin:0}\n.scene-header-art{min-width:0;height:230px;display:flex;align-items:center;justify-content:flex-end;overflow:hidden;border-radius:12px;background:radial-gradient(circle at 68% 50%,rgba(80,123,151,.20),rgba(7,15,21,.04) 70%)}\n.scene-header-art img{display:block;width:100%;height:100%;object-fit:contain;object-position:right center;filter:saturate(.96) contrast(1.03) drop-shadow(0 14px 30px rgba(0,0,0,.35))}\n.campaign-header{min-height:310px}.campaign-header .scene-header-art{height:260px}.banner-panel,.campaign-banner{display:none!important}\n.event-stage{display:grid;grid-template-columns:minmax(300px,.76fr) minmax(480px,1.24fr);align-items:stretch;min-height:430px;overflow:hidden;background:linear-gradient(90deg,rgba(9,18,25,.98),rgba(9,18,25,.82))}\n.event-copy{position:relative;z-index:1;min-height:0;padding:34px 30px;justify-content:center}.event-copy .lead{max-width:36ch}\n.event-hero{position:relative;inset:auto;min-height:430px;display:flex;align-items:center;justify-content:flex-end;padding:16px 18px 16px 0;background:none!important;filter:none}\n.event-hero img{width:100%;height:100%;max-height:398px;object-fit:contain;object-position:right center;border-radius:12px;filter:drop-shadow(0 18px 34px rgba(0,0,0,.42))}.event-overlay{display:none!important}\n.hero-compact{display:grid;grid-template-columns:minmax(330px,.82fr) minmax(480px,1.18fr);align-items:stretch;min-height:560px;padding:28px;gap:26px}.hero-compact::before{display:none}\n.hero-compact .hero-art{position:relative;inset:auto;grid-column:2;grid-row:1;width:100%;min-height:500px;opacity:1;background-size:contain;background-repeat:no-repeat;background-position:right center;transform:none!important;animation:none!important;border-radius:14px}\n.hero-compact .hero-content{grid-column:1;grid-row:1;align-self:center;width:auto;max-width:none;margin:0;padding:18px 12px 18px 18px}\n@media(max-width:1050px){.scene-header,.event-stage,.hero-compact{grid-template-columns:1fr}.scene-header{min-height:0}.scene-header-copy{padding:6px 8px 0}.scene-header-art,.campaign-header .scene-header-art{height:clamp(220px,42vw,360px);justify-content:center}.scene-header-art img{object-position:center}.event-copy{padding:26px 24px 12px}.event-hero{min-height:320px;padding:8px 18px 20px;justify-content:center}.event-hero img{max-height:360px;object-position:center}.hero-compact{min-height:0}.hero-compact .hero-content{grid-column:1;grid-row:1;padding:12px 10px 0}.hero-compact .hero-art{grid-column:1;grid-row:2;min-height:clamp(300px,56vw,500px);background-position:center}}\n@media(max-width:640px){.scene-header{border-width:18px;border-image-width:18px 32px;padding:14px 12px;gap:12px}.scene-header-art,.campaign-header .scene-header-art{height:230px}.event-stage{min-height:0}.event-hero{min-height:250px}.hero-compact{padding:14px;gap:10px}}\n`;
  }

  fs.writeFileSync(uiPath, ui);
  fs.writeFileSync(cssPath, css);

  if (fs.existsSync(buildInfoPath)) {
    const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    info.version = '1.3.4';
    info.build_name = 'RPChess Fantasy Edition 1.3.4 Full Scene Layout';
    info.notes = 'All scene illustrations are shown whole on the right side without cropping.';
    fs.writeFileSync(buildInfoPath, JSON.stringify(info, null, 2));
  }

  if (!ui.includes('scene-header-art') || !css.includes('object-fit:contain')) {
    throw new Error('Full-scene layout patch validation failed.');
  }
  console.log('Applied RPChess 1.3.4 full-scene layout patch.');
};
