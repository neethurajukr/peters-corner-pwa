import React,{useEffect,useState} from 'react';
const endpoint='https://jxhrqzmkwyvhvnymaynt.supabase.co';
const publicKey='sb_publishable_PmMXS17xj3WIFtPoSIkDxQ_017_JyVW';
const sessionKey='peters-corner-cloud-session';
async function readCloud(){
 let session;try{session=JSON.parse(sessionStorage.getItem(sessionKey)||'null')}catch{}
 if(!session?.user?.id)return {kind:'signed-out'};
 async function fetchState(token){
  const response=await fetch(endpoint+'/rest/v1/shop_inventory_state?select=revision,updated_at,state&owner_id=eq.'+encodeURIComponent(session.user.id),{headers:{apikey:publicKey,Authorization:'Bearer '+token}});
  if(response.status===401)throw Error('JWT expired');
  if(!response.ok)throw Error('Cloud check failed: '+response.status);
  const rows=await response.json();return rows[0]||null;
 }
 try{return {kind:'ok',row:await fetchState(session.access_token)}}catch(e){
  if(!/JWT expired/.test(e.message)||!session.refresh_token)return {kind:'error',message:e.message};
  try{
   const response=await fetch(endpoint+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
   if(!response.ok)throw Error('Sign in again to check cloud status');
   const fresh=await response.json();session={...session,access_token:fresh.access_token,refresh_token:fresh.refresh_token||session.refresh_token};
   sessionStorage.setItem(sessionKey,JSON.stringify(session));
   window.dispatchEvent(new CustomEvent('peters-cloud-session-refreshed',{detail:session}));
   return {kind:'ok',row:await fetchState(session.access_token)};
  }catch(err){return {kind:'error',message:err.message}}
 }
}
export default function CloudStatus({db}){
 const [status,setStatus]=useState({kind:'checking'});
 useEffect(()=>{let active=true;async function check(){if(document.visibilityState==='hidden')return;const result=await readCloud();if(active)setStatus(result)}check();const timer=setInterval(check,30000);return()=>{active=false;clearInterval(timer)}},[]);
 const row=status.row;
 const localSales=new Set((db.sales||[]).map(s=>s.id));
 const missingSales=row?.state?.sales?.filter(s=>!localSales.has(s.id)).length||0;
 const remoteSales=new Set((row?.state?.sales||[]).map(s=>s.id));
 const unsyncedSales=(db.sales||[]).filter(s=>!remoteSales.has(s.id)).length;
 return <div className="panel"><h3>Cloud sync status (read-only)</h3>
 {status.kind==='checking'&&<p>Checking Supabase…</p>}
 {status.kind==='signed-out'&&<p>Sign in under Stock Entry to check cloud status.</p>}
 {status.kind==='error'&&<p role="alert">{status.message}</p>}
 {status.kind==='ok'&&<><p>Cloud revision: {row?.revision??'Not found'} · Last saved: {row?.updated_at?new Date(row.updated_at).toLocaleString():'Never'}</p>
 <p>Cloud sales not on this device: <b>{missingSales}</b> · Device sales not in cloud: <b>{unsyncedSales}</b></p>
 <p className="muted">Read-only monitoring. Automatic writes and multi-device billing are NOT enabled. Do not overwrite cloud data from a stale device.</p></>}
 </div>
}
