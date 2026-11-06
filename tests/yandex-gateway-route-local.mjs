import assert from 'node:assert/strict';
import {chooseRoute,routePreference,apiBase,YANDEX} from '../game/js/api-route.mjs';
const profile='https://rpchess-profile-preview.mobigametim.workers.dev';
const tour='https://rpchess-tournament-profile-preview.mobigametim.workers.dev';
const direct={profile,tournament:tour};
const ok=async()=>({ok:true,json:async()=>({ok:true})});
const outage=async url=>{if(url.startsWith(tour))throw Error('blocked');return ok();};
const offline=async()=>{throw Error('blocked');};
assert.equal(await chooseRoute({fetcher:ok,direct}),'direct');
assert.equal(await chooseRoute({fetcher:outage,direct}),'yandex');
assert.equal(await chooseRoute({fetcher:offline,direct}),'yandex');
assert.equal(await chooseRoute({preference:'yandex',fetcher:ok,direct}),'yandex');
assert.equal(await chooseRoute({preference:'direct',fetcher:offline,direct}),'direct');
assert.equal(await chooseRoute({enabled:false,preference:'yandex',direct}),'direct');
assert.equal(routePreference(),'auto');
assert.equal(await apiBase('profile',profile),profile,'no production browser, no rerouting');
assert.equal(await apiBase('unknown','https://example.test'),'https://example.test');
assert.equal(await apiBase('tournament','https://rpchess-tournament-preview.mobigametim.workers.dev'),
 'https://rpchess-tournament-preview.mobigametim.workers.dev',
 'Legacy Tournament must never point to profile-backed Yandex upstream');
assert.equal(await apiBase('profile','https://rpchess-profile-v4-preview.mobigametim.workers.dev'),
 'https://rpchess-profile-v4-preview.mobigametim.workers.dev',
 'Independent preview Profile must not be rerouted');
assert.ok(YANDEX.endsWith('.apigw.yandexcloud.net'));
const {readFileSync}=await import('node:fs');
const {fileURLToPath}=await import('node:url');
const buildSource=readFileSync(new URL('../scripts/build.cjs',import.meta.url),'utf8');
assert(buildSource.includes("'js/api-route.mjs'"),'Production build must package the new transport module');
console.log('RPChess Yandex transport selection and release build contract PASS');
