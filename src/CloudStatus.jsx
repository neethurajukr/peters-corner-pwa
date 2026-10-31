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
 const [status,setStatus]=useState({kind:'checking'});const [expanded,setExpanded]=useState(false);
 useEffect(()=>{let active=true;async function check(){if(document.visibilityState==='hidden')return;const result=await readCloud();if(active)setStatus(result)}check();const timer=setInterval(check,30000);return()=>{active=false;clearInterval(timer)}},[]);
 const row=status.row;
 const localSales=new Set((db.sales||[]).map(s=>s.id));
 const missingSales=row?.state?.sales?.filter(s=>!localSales.has(s.id)).length||0;
 const deviceBatches=new Map((db.batches||[]).map(b=>[b.id,b]));
 const cloudBatches=new Map((row?.state?.batches||[]).map(b=>[b.id,b]));
 const differentCloudBatches=(row?.state?.batches||[]).filter(b=>!deviceBatches.has(b.id)||Number(deviceBatches.get(b.id).qty)!==Number(b.qty)).length;
 const deviceOnlyBatches=(db.batches||[]).filter(b=>!cloudBatches.has(b.id)).length;
 const deviceProducts=new Set((db.products||[]).map(p=>p.id));
 const cloudProducts=new Set((row?.state?.products||[]).map(p=>p.id));
 const cloudOnlyProducts=(row?.state?.products||[]).filter(p=>!deviceProducts.has(p.id)).length;
 const deviceOnlyProducts=(db.products||[]).filter(p=>!cloudProducts.has(p.id)).length;
 const remoteSales=new Set((row?.state?.sales||[]).map(s=>s.id));
 const unsyncedSales=(db.sales||[]).filter(s=>!remoteSales.has(s.id)).length;
 const counts=[missingSales,unsyncedSales,differentCloudBatches,deviceOnlyBatches,cloudOnlyProducts,deviceOnlyProducts];
 const healthy=status.kind==='ok'&&!!row&&counts.every(n=>n===0);
 const labels=['Cloud sales missing locally','Device sales missing in cloud','Different cloud batches','Device-only batches','Cloud-only products','Device-only products'];
 return <section className={'panel pc-cloud-panel '+(healthy?'pc-cloud-healthy':'pc-cloud-attention')}>
 <button type="button" className="pc-cloud-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
 <span className="pc-cloud-title"><span aria-hidden="true">{healthy?'✓':'☁'}</span> Cloud sync status <span className="pc-cloud-chip">{status.kind==='checking'?'Checking…':healthy?'All checks match':status.kind==='signed-out'?'Sign in required':status.kind==='error'?'Connection issue':'Review status'}</span></span>
 <span aria-hidden="true">{expanded?'⌃':'⌄'}</span>
 </button>
 {expanded&&<div className="pc-cloud-details">
 {status.kind==='checking'&&<p>Checking Supabase…</p>}
 {status.kind==='signed-out'&&<p>Sign in under Stock Entry to check cloud status.</p>}
 {status.kind==='error'&&<p role="alert">{status.message}</p>}
 {status.kind==='ok'&&<><p className="muted">Cloud revision: {row?.revision??'Not found'} · Last saved: {row?.updated_at?new Date(row.updated_at).toLocaleString():'Never'}</p>
 <div className="pc-cloud-grid">{labels.map((label,i)=><div key={label} className="pc-cloud-metric"><span>{label}</span><strong>{counts[i]}</strong></div>)}</div>
 <p className="muted">Comparison is read-only and checked every 30 seconds while this page is visible. Matching counts do not guarantee that all data fields are identical or that every device has refreshed. Cloud writes require a confirmed sign-in and network connection.</p></>}
 </div>}
 </section>
}
