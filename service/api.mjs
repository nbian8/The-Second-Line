import {newRoom,command,snapshot,tick} from './room.mjs';
const headers={'access-control-allow-origin':'https://nbian8.github.io','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type','cache-control':'no-store'};
function reply(data,status=200){return Response.json(data,{status,headers})}
const uuid=()=>crypto.randomUUID();
export default {async fetch(req,env){
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({service:'二线关房间'});
 try{
 const b=await req.json(),db=env.DB,t=Date.now();
 if(typeof b.token!=='string'||!/^[-0-9a-f]{36}$/.test(b.token))return reply({error:'无效的设备身份'},401);
 const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.token))),x=>x.toString(16).padStart(2,'0')).join('');
 if(b.op==='create'){
 const code=uuid().replaceAll('-','').slice(0,8).toUpperCase(),s=newRoom();s.members.push({key,id:uuid(),name:'裁判',role:'admin'});s.invite=uuid();
 await db.prepare('INSERT INTO rooms(code, rev, state, expires) VALUES (?,0,?,?)').bind(code,JSON.stringify(s),t+86400000).run();
 await db.prepare('DELETE FROM rooms WHERE expires < ?').bind(t).run();return reply({code});
 }
 for(let attempt=0;attempt<8;attempt++){
 const row=await db.prepare('SELECT rev,state FROM rooms WHERE code=? AND expires>?').bind(String(b.code),t).first();
 if(!row)return reply({error:'房间不存在或已结束保存'},404);
 const s=JSON.parse(row.state),before=row.state;let m=s.members.find(x=>x.key===key);
 if(!m&&b.op==='join'){
 const observer=b.invite&&b.invite===s.invite;
 if(observer?s.members.some(x=>x.role==='observer'):s.started||s.members.filter(x=>!['admin','observer'].includes(x.role)).length>=4)return reply({error:'此席位已满或已开局'},409);
 const name=String(b.name||'').trim().slice(0,18);if(!name)return reply({error:'请输入昵称'},400);
 m={id:uuid(),key,name,role:observer?'observer':'waiting'};s.members.push(m);
 }
 if(!m)return reply({error:'此设备尚未加入房间'},403);
 tick(s,t);
 if(b.op==='action'&&!(m.receipts||[]).includes(b.nonce)){
 if(typeof b.nonce!=='string'||b.nonce.length!==36)return reply({error:'请重新提交'},400);
 command(s,m,b.action,b,t);m.receipts=[...(m.receipts||[]).slice(-15),b.nonce];
 }
 if(b.op==='fix')command(s,m,'fix',b,t);
 const state=JSON.stringify(s);
 if(state!==before){const res=await db.prepare('UPDATE rooms SET state=?,rev=rev+1 WHERE code=? AND rev=?').bind(state,b.code,row.rev).run();if(!res.meta.changes)continue}
 const result=snapshot(s,m,t);if(m.role==='admin')result.invite=s.invite;
 return reply(result);
 }
 return reply({error:'房间正在同步，请重试'},409);
 }catch(e){const internal=/D1|database|prepare|SQL/i.test(e.message);return reply({error:internal?'房间服务暂时不可用':e.message},internal?503:400)}
}};
