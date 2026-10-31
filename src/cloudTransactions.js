// Shared cloud transaction helper. Not activated until checkout/stock handlers are migrated.
// Never fall back to an unconfirmed local sale when the network or revision check fails.
const endpoint='https://jxhrqzmkwyvhvnymaynt.supabase.co';
const apiKey='sb_publishable_PmMXS17xj3WIFtPoSIkDxQ_017_JyVW';
const sessionKey='peters-corner-cloud-session';
export class CloudConflictError extends Error {
 constructor(){super('Cloud inventory changed on another device. Reload latest stock and retry.');this.name='CloudConflictError'}
}
async function authenticated(path,options={}){
 let session=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
 if(!session?.access_token)throw Error('Sign in to the shop under Stock Entry before cloud billing.');
 async function call(token){
  return fetch(endpoint+path,{...options,headers:{apikey:apiKey,Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
 }
 let response=await call(session.access_token);
 if(response.status===401){
  if(!session.refresh_token)throw Error('Shop login expired. Sign in again.');
  const renewal=await fetch(endpoint+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:apiKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
  if(!renewal.ok)throw Error('Shop login expired. Sign in again.');
  const tokens=await renewal.json();
  session={...session,access_token:tokens.access_token,refresh_token:tokens.refresh_token||session.refresh_token};
  sessionStorage.setItem(sessionKey,JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('peters-cloud-session-refreshed',{detail:session}));
  response=await call(session.access_token);
 }
 const body=await response.json().catch(()=>null);
 if(!response.ok)throw Error(body?.message||body?.error||'Cloud request failed ('+response.status+')');
 return body;
}
export async function getLatestInventory(){
 const session=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
 if(!session?.user?.id)throw Error('Sign in to the shop first.');
 const rows=await authenticated('/rest/v1/shop_inventory_state?select=state,revision,updated_at&owner_id=eq.'+encodeURIComponent(session.user.id));
 if(!rows?.length)throw Error('No cloud inventory exists. Restore and verify the cloud backup first.');
 return rows[0];
}
export async function commitInventoryRevision(expectedRevision,nextState){
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('Invalid cloud revision.');
 if(!Array.isArray(nextState?.products)||!Array.isArray(nextState?.batches)||!Array.isArray(nextState?.sales))throw Error('Invalid inventory data.');
 const result=await authenticated('/rest/v1/rpc/update_shop_inventory_if_revision',{method:'POST',body:JSON.stringify({expected_revision:expectedRevision,next_state:nextState})});
 if(!Array.isArray(result)||result.length!==1)throw Error('Cloud did not confirm the update.');
 if(!result[0].saved)throw new CloudConflictError();
 return result[0].current_revision;
}

export async function commitCloudChange(transform){for(let n=0;n<3;n++){const current=await getLatestInventory();const result=transform(current.state);try{await commitInventoryRevision(Number(current.revision),result.state);return result}catch(e){if(!(e instanceof CloudConflictError)||n===2)throw e}}}
