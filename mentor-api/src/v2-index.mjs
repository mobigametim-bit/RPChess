/* ONLY the explicitly named v2 test Worker uses this entrypoint.
 * The deployed v1 Mentor API and production Workers are unaffected.
 */
import {handleMentorApi} from './index.mjs';
export default {fetch(request,env){
 return handleMentorApi(request,env,globalThis.fetch,undefined,2);
}};
