const fs = require('fs');
const path = require('path');

module.exports = function applyUiHotfix136(dist) {
  const uiPath = path.join(dist, 'js', 'ui.js');
  const cssPath = path.join(dist, 'style.css');
  const buildInfoPath = path.join(dist, 'BUILD_INFO.json');

  let ui = fs.readFileSync(uiPath, 'utf8');
  let css = fs.readFileSync(cssPath, 'utf8');

  // A reward card is already a button. Nested buttons are invalid HTML and
  // caused the broken card layout. Keep the relic title interactive, but use
  // a focusable span inside the card instead.
  ui = ui.replace(/<button class="relic-name-button" type="button" data-relic-name=/g,
    '<span class="relic-name-button" role="button" tabindex="0" data-relic-name=');
  ui = ui.replace(/<\/button><p class="compact-copy">/g,
    '</span><p class="compact-copy">');

  const marker = '/* 1.3.6 hotfix — reward cards and banner typography */';
  if (!css.includes(marker)) {
    css += `

${marker}
/* Keep every reward option as one clean vertical card. */
.reward-grid .card {
  display:flex !important;
  flex-direction:column !important;
  align-items:flex-start !important;
  justify-content:flex-start !important;
  gap:8px;
  min-height:300px;
  overflow:hidden;
}
.reward-grid .card > * { max-width:100%; }
.reward-grid .card .tag { margin-top:auto; align-self:flex-start; }
.reward-grid .compact-copy { max-width:26ch; }
.relic-name-button {
  display:block;
  margin:2px 0 6px;
  padding:0;
  border:0;
  background:none;
  color:#f1e7c8;
  font:inherit;
  font-size:1.12rem;
  font-weight:800;
  line-height:1.16;
  text-align:left;
  cursor:pointer;
}
.relic-name-button:hover,
.relic-name-button:focus-visible { text-decoration:underline; outline:none; }

/* Banner typography reduced by 20%; wrapping is allowed only between words. */
.scene-header-copy .eyebrow {
  font-size:1.16rem !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
}
.scene-header-copy .section-title {
  font-size:clamp(1.92rem,2.72vw,3.2rem) !important;
  line-height:1.04 !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
  text-wrap:balance;
}
.scene-header-copy .section-subtitle {
  font-size:1.2rem !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
}
.event-copy .eyebrow {
  font-size:1.1rem !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
}
.event-copy h2,
.event-copy .section-title {
  font-size:clamp(1.76rem,2.4vw,2.88rem) !important;
  line-height:1.04 !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
  text-wrap:balance;
}
.event-copy .lead,
.event-copy .section-subtitle,
.event-copy p {
  font-size:1.12rem !important;
  word-break:normal !important;
  overflow-wrap:normal !important;
  hyphens:none !important;
}

@media (min-width:1101px) {
  .scene-header { grid-template-columns:minmax(430px,1fr) minmax(420px,52%) !important; }
  .event-stage { grid-template-columns:minmax(430px,1fr) minmax(420px,52%) !important; }
}
`;
  }

  fs.writeFileSync(uiPath, ui);
  fs.writeFileSync(cssPath, css);

  if (fs.existsSync(buildInfoPath)) {
    const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    info.version = '1.3.6';
    info.build_name = 'RPChess Fantasy Edition 1.3.6 Reward Card and Banner Typography Fix';
    info.notes = 'Fixed reward-card nesting, reduced top-frame typography by 20 percent, and prevented words from splitting.';
    fs.writeFileSync(buildInfoPath, JSON.stringify(info, null, 2));
  }

  if (ui.includes('<button class="relic-name-button"')) {
    throw new Error('Nested relic button remained after RPChess 1.3.6 hotfix.');
  }

  console.log('Applied RPChess 1.3.6 reward-card and typography hotfix.');
};
