const fs=require('fs');
const path=require('path');
const file=path.join('tests','responsive-viewport-browser.cjs');
const source=fs.readFileSync(file,'utf8');
const marker='\n(async () => {';
const pos=source.lastIndexOf(marker);
if(pos<0)throw new Error('responsive runner marker missing');
const suffix=`
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await auditEventLayout(browser, 1024, 768, 'ru');
    await auditEventLayout(browser, 844, 390, 'ru');
    console.log('Targeted RU Event landscape owner geometry: PASS');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
`;
fs.writeFileSync(file,source.slice(0,pos)+suffix);
