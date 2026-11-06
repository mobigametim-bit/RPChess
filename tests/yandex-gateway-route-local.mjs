import assert from 'node:assert/strict';
import {chooseRoute,routePreference,apiBase,YANDEX} from '../game/js/api-route.mjs';
const profile='https://rpchess-profile-preview.mobigametim.workers.dev';
const tour='https://rpchess-tournament-profile-preview.mobigametim.workers.dev';
const direct={profile,tournament:tour};
// GET /health must return actual upstream health JSON; a second GET to the
// session endpoint expects a safe method/auth error, NOT a successful session.
const good=async url=>url.endsWith('/health')
 ?{ok:true,status:200,json:async()=>({ok:true})}
 :{ok:false,status:405};
const blockedProfile=async url=>url.startsWith(profile)?{ok:false,status:502}:good(url);
const blockedTournament=async url=>url.startsWith(tour)?{ok:false,status:502}:good(url);
const blockedYandex=async url=>url.startsWith(YANDEX)?{ok:false,status:502}:good(url);
const offline=async()=>{throw Error('network blocked');};
assert.equal(await chooseRoute({service:'profile',fetcher:good,direct}),'direct');
assert.equal(await chooseRoute({service:'tournament',fetcher:good,direct}),'direct');
assert.equal(await chooseRoute({service:'profile',fetcher:blockedProfile,direct}),'yandex');
assert.equal(await chooseRoute({service:'tournament',fetcher:blockedProfile,direct}),'direct',
 'Blocked Profile must not force Tournament through Yandex');
assert.equal(await chooseRoute({service:'profile',fetcher:blockedTournament,direct}),'direct',
 'Blocked Tournament must not force Profile through Yandex');
assert.equal(await chooseRoute({service:'tournament',fetcher:blockedTournament,direct}),'yandex');
assert.equal(await chooseRoute({service:'profile',fetcher:offline,direct}),'yandex');
await assert.rejects(chooseRoute({service:'profile',fetcher:blockedYandex,
 direct:{profile:'https://blocked.invalid',tournament:tour}}),/unreachable/);
assert.equal(await chooseRoute({service:'profile',preference:'yandex',fetcher:offline,direct}),'yandex');
assert.equal(await chooseRoute({service:'profile',preference:'direct',fetcher:offline,direct}),'direct');
assert.equal(await chooseRoute({service:'profile',enabled:false,preference:'yandex',direct}),'direct');
assert.equal(routePreference(),'auto');
assert.equal(await apiBase('profile',profile),profile,'non-browser must not reroute');
assert.equal(await apiBase('unknown','https://example.test'),'https://example.test');
assert.equal(await apiBase('tournament','https://rpchess-tournament-preview.mobigametim.workers.dev'),
 'https://rpchess-tournament-preview.mobigametim.workers.dev',
 'Legacy Tournament preview must never point to profile-backed Yandex upstream');
assert.equal(await apiBase('profile','https://rpchess-profile-v4-preview.mobigametim.workers.dev'),
 'https://rpchess-profile-v4-preview.mobigametim.workers.dev',
 'Independent preview Profile must not be rerouted');
assert.ok(YANDEX.endsWith('.apigw.yandexcloud.net'));
const {readFileSync}=await import('node:fs');
const buildSource=readFileSync(new URL('../scripts/build.cjs',import.meta.url),'utf8');
assert(buildSource.includes("'js/api-route.mjs'"),'Production build must package the transport module');
console.log('RPChess independent Profile/Tournament transport selection and build contract PASS');
