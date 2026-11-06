/* Copy only branch-modified game files. Netlify CDN fills all other
 * /play/ assets from the existing public GitHub Pages production release.
 * No full 500MB game duplication and no checkout secrets required.
 */
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..','..');
const dest=path.join(repo,'netlify-gateway','public','play');
const files=[
 ['game/index.html','index.html'],
 ['game/js/api-route.mjs','js/api-route.mjs'],
 ['game/js/tournament-app.mjs','js/tournament-app.mjs'],
 ['game/js/profile-client.mjs','js/profile-client.mjs'],
 ['game/css/tournament-v4.css','css/tournament-v4.css']
];
fs.rmSync(dest,{recursive:true,force:true});
for(const [source,target] of files){
 const input=path.join(repo,source),output=path.join(dest,target);
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.copyFileSync(input,output);
}
const page=fs.readFileSync(path.join(dest,'index.html'),'utf8');
if(!page.includes('data-tournament-open')||!page.includes('rpchess-profile-api'))
 throw Error('Incomplete preview homepage');
console.log('RPChess branch playable preview files:',files.map(f=>f[1]).join(', '));
