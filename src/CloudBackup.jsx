import React,{useState} from 'react';
const endpoint='https://jxhrqzmkwyvhvnymaynt.supabase.co';
const publicKey='sb_publishable_PmMXS17xj3WIFtPoSIkDxQ_017_JyVW';
const tokenKey='peters-corner-cloud-session';
async function request(path,token,options={}){
 const response=await fetch(endpoint+path,{...options,headers:{apikey:publicKey,Authorization:'Bearer '+(token||publicKey),'Content-Type':'application/json',...(options.headers||{})}});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=null}
 if(!response.ok)throw Error(data?.msg||data?.message||data?.error_description||'Cloud request failed ('+response.status+')');
 return data;
}
export default function CloudBackup({db,onRestore}){
 const [session,setSession]=useState(()=>{try{return JSON.parse(sessionStorage.getItem(tokenKey))}catch{return null}});
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[remote,setRemote]=useState(null);
 async function login(){setBusy(true);try{
  const result=await request('/auth/v1/token?grant_type=password',null,{method:'POST',body:JSON.stringify({email,password})});
  const next={access_token:result.access_token,refresh_token:result.refresh_token,user:result.user};
  sessionStorage.setItem(tokenKey,JSON.stringify(next));setSession(next);setPassword('');setStatus('Signed in. Your local stock has not changed.');
 }catch(e){setStatus(e.message)}finally{setBusy(false)}}
 async function getCloud(){setBusy(true);try{
  const rows=await request('/rest/v1/shop_inventory_state?select=state,revision,updated_at&owner_id=eq.'+session.user.id,session.access_token);
  setRemote(rows[0]||null);setStatus(rows.length?'Cloud backup found. Review before restoring.':'No cloud backup found yet.');
 }catch(e){setStatus(e.message)}finally{setBusy(false)}}
 async function upload(){if(!confirm('Replace the cloud backup with this device\'s data? Export a Backup first.'))return;setBusy(true);try{
  const existing=await request('/rest/v1/shop_inventory_state?select=revision&owner_id=eq.'+session.user.id,session.access_token);
  const revision=existing[0]?.revision||0;
  const path='/rest/v1/shop_inventory_state'+(existing.length?'?owner_id=eq.'+session.user.id+'&revision=eq.'+revision:'');
  const result=await request(path,session.access_token,{method:existing.length?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(existing.length?{state:db,revision:revision+1,updated_at:new Date().toISOString()}:{owner_id:session.user.id,state:db,revision:1})});
  if(!result.length)throw Error('Cloud was updated elsewhere. Reload before uploading.');
  setRemote(null);setStatus('Cloud backup saved. Automatic synchronization is not active yet.');
 }catch(e){setStatus(e.message)}finally{setBusy(false)}}
 function restore(){if(!remote?.state)return;if(!confirm('Replace local inventory with the cloud backup? Export a Backup first.'))return;onRestore(remote.state);setStatus('Cloud data restored on this device.')}
 return <section className="panel"><h3>Supabase shop login & cloud backup</h3><p className="muted">Manual backup only for now. Existing stock stays on this device unless you explicitly restore.</p>
 {!session?<><label>Shop email<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button type="button" disabled={busy||!email||!password} onClick={login}>Sign in to shop</button></>:<><p>Signed in as {session.user.email}</p><div className="actions"><button type="button" className="secondary" disabled={busy} onClick={getCloud}>Check cloud backup</button><button type="button" disabled={busy} onClick={upload}>Upload this device's stock</button><button type="button" className="secondary" disabled={busy||!remote} onClick={restore}>Restore cloud backup</button><button type="button" className="secondary" onClick={()=>{sessionStorage.removeItem(tokenKey);setSession(null);setRemote(null)}}>Sign out</button></div>{remote&&<p className="muted">Cloud contains {remote.state?.products?.length||0} products, {remote.state?.batches?.length||0} batches and {remote.state?.sales?.length||0} sales.</p>}</>}
 {status&&<p role="status" className="muted">{status}</p>}</section>
}
