/* Exact reversible Kingdom entry snapshot for optional Battle/Caravan mercenaries.
 * The transient snapshot is kept only while the offer is pending. */
function captureMercenaryEntry(run,point){
 const map=run?.kingdomMap,id=point?.x+','+point?.y;
 if(!map||!map.king||!map.cells)return null;
 return {king:{...map.king},cell:map.cells[id]?{...map.cells[id]}:null,
  day:map.day,calendarActions:[...(map.calendarActions||[])],
  processedThroughWeek:map.processedThroughWeek,
  productionCyclesResolved:map.productionCyclesResolved,
  industry:map.industry?structuredClone(map.industry):null,
  productionClaims:[...(map.productionClaims||[])],
  royalRoads:structuredClone(map.royalRoads||[]),
  completedRoads:structuredClone(map.completedRoads||[]),
  supplies:run.supplies,journeyStep:run.journeyStep};
}
function rollbackMercenaryEntry(run){
 const map=run?.kingdomMap,id=map?.pendingCell,cell=map?.cells?.[id];
 const saved=cell?.mercenaryEntryRollback;
 if(!id||!saved||!map.king||!saved.king||!Array.isArray(saved.calendarActions))return {ok:false,run};
 const cells={...map.cells};
 if(saved.cell)cells[id]=saved.cell;else delete cells[id];
 const rollbackMap={...map,cells,pendingCell:null,king:{...saved.king},
  day:saved.day,calendarActions:[...saved.calendarActions],
  processedThroughWeek:saved.processedThroughWeek,
  productionCyclesResolved:saved.productionCyclesResolved,
  industry:saved.industry||map.industry,
  productionClaims:saved.productionClaims||[],
  royalRoads:saved.royalRoads||[],
  completedRoads:saved.completedRoads||[]};
 return {ok:true,run:{...run,kingdomMap:rollbackMap,
  supplies:saved.supplies,journeyStep:saved.journeyStep,
  activeTravelChoice:null,currentCaravan:null,currentTravelChoices:null,
  combatArtifactChoice:null}};
}
export {captureMercenaryEntry,rollbackMercenaryEntry};
