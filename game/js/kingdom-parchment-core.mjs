/* Procedural, coordinate-stable terrain for the optional parchment Journey skin.
 * All 112 sprite names match the artist's seven 4x4 sheets. Gameplay is separate.
 */
import {VISUAL} from './kingdom-world-config.mjs?v=20261109-atlas-visual5';
const GROUPS=Object.freeze({
 parchment_base_variations:'01_light_ochre_plain 02_faded_olive_meadow 03_warm_dry_earth 04_pale_rocky_soil 05_gray_green_lowland 06_sandy_swirl 07_dry_steppe 08_grassy_islands 09_pale_clay 10_dark_olive_veins 11_weathered_dry_soil 12_chalky_stones 13_embedded_stones 14_withered_grass 15_plain_to_dry 16_plain_to_meadow'.split(' '),
 forest_clusters:'01_small_grove 02_round_grove 03_dense_wood 04_horizontal_forest 05_vertical_forest 06_sparse_edge 07_convex_north 08_convex_south 09_west_edge 10_east_edge 11_l_shaped 12_crescent_grove 13_open_clearing 14_scattered_trees 15_conifer_strip 16_mixed_forest'.split(' '),
 mountain_clusters:'01_single_summit 02_two_peaks 03_three_peaks 04_horizontal_ridge 05_vertical_ridge 06_curved_ridge 07_diagonal_slash 08_diagonal_backslash 09_sparse_mountains 10_dense_massif 11_saddle 12_mountain_pass 13_cliff_edge 14_foothills 15_dominant_peak 16_fading_edge'.split(' '),
 hills_rocks:'01_three_hills 02_long_low_ridge 03_prominent_hill 04_low_hill_group 05_pale_boulders 06_dark_boulders 07_rocky_spur 08_sparse_rocks 09_terrain_contours 10_diagonal_ridge 11_stone_scree 12_soft_bluff 13_rocks_and_grass 14_branched_crest 15_single_round_hill 16_low_foothills'.split(' '),
 fog_of_war_shapes:'01_broad_blot 02_long_blot 03_round_blot 04_thin_edge 05_ragged_horizontal 06_ragged_vertical 07_soft_corner 08_jagged_corner 09_loose_wisps 10_dense_blot 11_crescent 12_tendril 13_open_center 14_deep_recess 15_haze_ribbon 16_small_islands'.split(' ')
});
const PARCHMENT_TILE=142,PARCHMENT_CHUNK_CELLS=4;
// Additional uploaded artwork is discovered at build time, not guessed by filename.
const PARCHMENT_MODE_KEY='rpchess.kingdom.visual.v1';
// The build inserts this meta only after converting all 112 master SVGs.
const PARCHMENT_RUNTIME_FORMAT=typeof document!=='undefined' &&
 document.querySelector('meta[name="rpchess-parchment-raster"]')?.content==='png'?'png':'svg';
function hash32(value){
 let hash=2166136261;
 for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return hash>>>0;
}
function randomAt(seed,x,y,salt=''){return hash32(seed+':'+salt+':'+x+':'+y)/4294967296;}
function smooth(t){return t*t*(3-2*t);}
function noise2D(seed,x,y,salt=''){
 const ix=Math.floor(x),iy=Math.floor(y),dx=smooth(x-ix),dy=smooth(y-iy);
 const a=randomAt(seed,ix,iy,salt),b=randomAt(seed,ix+1,iy,salt);
 const c=randomAt(seed,ix,iy+1,salt),d=randomAt(seed,ix+1,iy+1,salt);
 return (a*(1-dx)+b*dx)*(1-dy)+(c*(1-dx)+d*dx)*dy;
}
function terrainAt(seed,x,y){
 // Sample continuous world-space coordinates, never local chunk coordinates.
 const large=noise2D(seed,x/VISUAL.landScale,y/VISUAL.landScale,'land');
 const small=noise2D(seed,x/VISUAL.detailScale,y/VISUAL.detailScale,'detail');
 const wet=noise2D(seed,x/VISUAL.wetScale,y/VISUAL.wetScale,'wet');
 const elevation=large*VISUAL.largeWeight+small*(1-VISUAL.largeWeight);
 const kind=elevation>VISUAL.mountainThreshold?'mountain':
  elevation>VISUAL.hillThreshold?'hill':
  wet>VISUAL.forestThreshold?'forest':'plain';
 return {kind,elevation,wet};
}
function spritePath(kind,index){
 const group=GROUPS[kind];
 if(!group)return null;
 const n=Math.max(0,Math.min(group.length-1,Math.floor(Number(index)||0)));
 return 'assets/kingdom-parchment/'+kind+'/'+group[n]+'.'+PARCHMENT_RUNTIME_FORMAT;
}
function pickSprite(seed,kind,x,y,salt='sprite'){
 const group=GROUPS[kind];
 return group?spritePath(kind,hash32(seed+':'+kind+':'+x+':'+y+':'+salt)%group.length):null;
}
function chunkCoordinate(cell){return Math.floor(cell/PARCHMENT_CHUNK_CELLS);}
export {GROUPS,PARCHMENT_TILE,PARCHMENT_CHUNK_CELLS,PARCHMENT_MODE_KEY,PARCHMENT_RUNTIME_FORMAT,
 hash32,randomAt,noise2D,terrainAt,spritePath,pickSprite,chunkCoordinate};
