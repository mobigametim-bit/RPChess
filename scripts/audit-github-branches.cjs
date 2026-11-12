#!/usr/bin/env node
'use strict';
// GitHub branch inventory. STRICTLY READ-ONLY: never delete refs.
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const REPO=process.env.GITHUB_REPOSITORY||'mobigametim-bit/RPChess';
const TOKEN=process.env.GITHUB_TOKEN;
const OUT=path.resolve(process.env.RPCHESS_BRANCH_AUDIT_DIR||'test-results/branch-audit');
const DAY=86400000;
const NEVER_DELETE=/^(?:main|deploy|Legasy|archive\/|backup\/|rollback\/|release\/|night\/)/;
async function api(endpoint,attempt=0){
  const response=await fetch('https://api.github.com/repos/'+REPO+endpoint,{
    headers:{'Accept':'application/vnd.github+json','User-Agent':'RPChess-branch-audit','X-GitHub-Api-Version':'2022-11-28',...(TOKEN?{'Authorization':'Bearer '+TOKEN}:{})}
  });
  if((response.status===429||response.status>=500)&&attempt<4){
    await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    return api(endpoint,attempt+1);
  }
  if(!response.ok)throw new Error(response.status+' '+endpoint+' '+(await response.text()).slice(0,250));
  return response.json();
}
async function pages(endpoint){
  const list=[];
  for(let p=1;p<=20;p++){
    const chunk=await api(endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page='+p);
    if(!Array.isArray(chunk))throw Error('Unexpected list: '+endpoint);
    list.push(...chunk);
    if(chunk.length<100)return list;
  }
  throw Error('Unexpected pagination beyond 20 pages: '+endpoint);
}
async function mapped(values,concurrency,fn){
  let index=0;
  const out=new Array(values.length);
  await Promise.all(Array.from({length:Math.min(concurrency,values.length)},async()=>{
    while(index<values.length){
      const n=index++;
      try{out[n]=await fn(values[n],n);}
      catch(e){out[n]={name:values[n].name,error:String(e)};}
    }
  }));
  return out;
}
function workflowInventory(){
  const folder=path.join(ROOT,'.github','workflows');
  const files=fs.readdirSync(folder).filter(f=>/\.ya?ml$/.test(f));
  const list=files.map(file=>{
    const text=fs.readFileSync(path.join(folder,file),'utf8');
    const header=text.match(/^on:\s*\n([\s\S]*?)(?=^[a-z][\w-]*:|$(?![\s\S]))/m);
    const block=header?.[1]||'';
    return {file,has_push:/^\s{2}push:/m.test(block),has_pr:/^\s{2}pull_request:/m.test(block),manual:/^\s{2}workflow_dispatch:/m.test(block),scheduled:/^\s{2}schedule:/m.test(block),references:block};
  });
  return list;
}
function decide(branch,prHeads,workflowText){
  const age=branch.last_commit_date?(Date.now()-Date.parse(branch.last_commit_date))/DAY:null;
  const hold=[];
  if(NEVER_DELETE.test(branch.name))hold.push('reserved_branch');
  if(branch.protected)hold.push('github_protected');
  if(prHeads.has(branch.name))hold.push('open_pr');
  if(workflowText.includes(branch.name))hold.push('workflow_reference');
  if(branch.ahead_by===null||branch.ahead_by===undefined)hold.push('unknown_compare');
  if(branch.error)hold.push('api_error');
  const integrated=branch.ahead_by===0;
  const candidate=integrated&&age!==null&&age>=60&&hold.length===0;
  return {...branch,age_days:age===null?null:Math.floor(age),integrated_into_main:integrated,unique_commits:branch.ahead_by,candidate_for_manual_cleanup:candidate,hold_reasons:hold};
}
function selfTest(){
  const base={name:'feature/old',protected:false,head_sha:'a',ahead_by:0,last_commit_date:'2025-01-01T00:00:00Z'};
  if(!decide(base,new Set(),'').candidate_for_manual_cleanup)throw Error('merged old branch is a candidate');
  if(decide({...base,ahead_by:3},new Set(),'').candidate_for_manual_cleanup)throw Error('unique commits must be preserved');
  if(decide({...base,name:'archive/v1'},new Set(),'').candidate_for_manual_cleanup)throw Error('archive must be preserved');
  if(decide(base,new Set(['feature/old']),'').candidate_for_manual_cleanup)throw Error('open PR must be preserved');
  console.log('GitHub branch audit self-test: PASS');
}
async function main(){
  if(process.argv.includes('--self-test')){selfTest();return;}
  if(!TOKEN)throw Error('GITHUB_TOKEN is required to audit all refs and compare histories');
  const branches=await pages('/branches');
  const prs=await pages('/pulls?state=open');
  const prHeads=new Set(prs.filter(x=>x.head?.repo?.full_name===REPO).map(x=>x.head.ref));
  const workflows=workflowInventory();
  const workflowText=workflows.map(x=>x.references).join('\n');
  const data=await mapped(branches,6,async b=>{
    const sha=b.commit.sha;
    const [commit,comparison]=await Promise.all([
      api('/commits/'+encodeURIComponent(sha)),
      api('/compare/main...'+encodeURIComponent(b.name))
    ]);
    const d=commit.commit?.committer?.date||commit.commit?.author?.date||null;
    return decide({name:b.name,head_sha:sha,protected:!!b.protected,last_commit_date:d,ahead_by:comparison.ahead_by??null,behind_by:comparison.behind_by??null,status:comparison.status},prHeads,workflowText);
  });
  const rows=data.map(r=>r?.hold_reasons?r:decide({...r,protected:false,ahead_by:null,last_commit_date:null},prHeads,workflowText));
  const candidates=rows.filter(r=>r.candidate_for_manual_cleanup);
  const failures=rows.filter(r=>r.error);
  const counts={total:rows.length,workflows:workflows.length,open_prs:prs.length,integrated:rows.filter(r=>r.integrated_into_main).length,with_unique_commits:rows.filter(r=>typeof r.ahead_by==='number'&&r.ahead_by>0).length,stale30:rows.filter(r=>r.age_days>=30).length,stale60:rows.filter(r=>r.age_days>=60).length,cleanup_candidates_60d:candidates.length,api_errors:failures.length};
  const report={date:new Date().toISOString(),repository:REPO,baseline_main:'main',read_only:true,counts,open_prs:prs.map(x=>({number:x.number,head:x.head?.ref,draft:x.draft})),workflows:workflows.map(({references,...x})=>x),branches:rows};
  fs.mkdirSync(OUT,{recursive:true});
  fs.writeFileSync(path.join(OUT,'branch-audit.json'),JSON.stringify(report,null,2)+'\n');
  const markdown=[
    '# RPChess branch/workflow audit (read-only)',
    '',
    'Generated '+report.date+' from GitHub REST compare + last-commit timestamps. NO REFS DELETED.',
    '',
    ...Object.entries(counts).map(([key,value])=>'- **'+key+'**: '+value),
    '',
    '## Conservative cleanup candidates (merged + older than 60d, no open PR/known refs)',
    '',
    '| Branch | Last commit | Ahead of main | Days idle |',
    '|---|---|---:|---:|',
    ...candidates.map(x=>'| `'+x.name+'` | '+x.last_commit_date+' | '+x.ahead_by+' | '+x.age_days+' |'),
    '',
    '## Open PR source branches (preserve)',
    '',
    ...report.open_prs.map(x=>'- #'+x.number+' `'+x.head+'`'+(x.draft?' (Draft)':'')),
    '',
    '## Errors requiring review',
    '',
    ...failures.map(x=>'- `'+x.name+'`: '+x.error),
    '',
    'Before any deletion, re-check each branch tip, uniqueness, downstream dependencies and secure fresh owner approval. Branch age alone is NEVER deletion authority.'
  ].join('\n')+'\n';
  fs.writeFileSync(path.join(OUT,'branch-audit.md'),markdown);
  console.log(JSON.stringify(counts,null,2));
  console.log('READ-ONLY audit files: '+OUT);
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
