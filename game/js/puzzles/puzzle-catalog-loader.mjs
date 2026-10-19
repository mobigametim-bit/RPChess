// The 11,498 verified CC0 tasks remain available offline. Additional curated
// Lichess tasks are split by difficulty and fetched only for the chosen route.
import { PUZZLE_CATALOG } from './puzzle-catalog.mjs';
const EXTRA_IMPORTERS=Object.freeze([
  ()=>import('./extra-star-01.mjs'),
  ()=>import('./extra-star-02.mjs'),
  ()=>import('./extra-star-03.mjs'),
  ()=>import('./extra-star-04.mjs'),
  ()=>import('./extra-star-05.mjs'),
  ()=>import('./extra-star-06.mjs'),
  ()=>import('./extra-star-07.mjs'),
  ()=>import('./extra-star-08.mjs'),
  ()=>import('./extra-star-09.mjs'),
  ()=>import('./extra-star-10.mjs'),
  ()=>import('./extra-star-11.mjs'),
  ()=>import('./extra-star-12.mjs')
]);
const cache=new Map();
async function loadPuzzleStar(stars){
  const star=Math.max(1,Math.min(12,Math.round(Number(stars)||1)));
  if(!cache.has(star)){
    cache.set(star,(async()=>{
      const legacy=PUZZLE_CATALOG.filter(p=>p.difficulty===star);
      try{
        const mod=await EXTRA_IMPORTERS[star-1]();
        const more=Array.isArray(mod.EXTRA_PUZZLES)?mod.EXTRA_PUZZLES:[];
        const used=new Set(legacy.map(p=>p.sourceId));
        return Object.freeze([...legacy,...more.filter(p=>p.difficulty===star&&!used.has(p.sourceId))]);
      }catch(error){
        console.warn('[RPChess] expanded puzzles unavailable; using offline catalog',star,error);
        return Object.freeze(legacy);
      }
    })());
  }
  return cache.get(star);
}
export {loadPuzzleStar};
