// Generated from human-approved Events v1: 100 events / 415 choices. Mini-story scene copy included.
import { EVENTS_01 } from './events/event-data-01.mjs';
import { EVENTS_02 } from './events/event-data-02.mjs';
import { EVENTS_03 } from './events/event-data-03.mjs';
import { EVENTS_04 } from './events/event-data-04.mjs';
import { EVENTS_05 } from './events/event-data-05.mjs';
import { EVENTS_06 } from './events/event-data-06.mjs';
import { EVENTS_07 } from './events/event-data-07.mjs';
import { EVENTS_08 } from './events/event-data-08.mjs';
import { EVENTS_09 } from './events/event-data-09.mjs';
import { EVENTS_10 } from './events/event-data-10.mjs';
const EVENT_CATALOG=Object.freeze([...EVENTS_01,...EVENTS_02,...EVENTS_03,...EVENTS_04,...EVENTS_05,...EVENTS_06,...EVENTS_07,...EVENTS_08,...EVENTS_09,...EVENTS_10]);
const EVENT_BY_ID=Object.freeze(Object.fromEntries(EVENT_CATALOG.map((event)=>[event.id,event])));
const EVENT_IDS=Object.freeze(EVENT_CATALOG.map((event)=>event.id));
function eventById(id){return EVENT_BY_ID[id]||null;}
export {EVENT_CATALOG,EVENT_BY_ID,EVENT_IDS,eventById};
