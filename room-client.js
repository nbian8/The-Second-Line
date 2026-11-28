'use strict';
const api='https://second-line-live.stormylotus11.chatgpt.site/room';
const $=id=>document.getElementById(id),names={boy:'男孩',worker:'工人',driver:'司机',guard:'联防'};
const params=new URLSearchParams(location.search),storeKey='second-line-live-v1';
let session=JSON.parse(localStorage.getItem(storeKey)||'null'),view=null,watch=null,picking=false,focused=false;
let gps='等待定位',sync='',received=0,lastStamp=-1,polling=false,pending=false,noticeTimer,rosterKey='',actionKey='';
const join=$('join');join.elements.code.value=params.get('room')||'';
if(params.get('watch'))join.querySelector('button').textContent='加入观察席';
function say(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',4500)}
function escapeText(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function call(body,identity=session){
 const res=await fetch(api,{method:'POST',body:JSON.stringify({...identity,...body}),headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
 const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'连接失败'),{status:res.status});return data;
}
function enter(s){session=s;localStorage.setItem(storeKey,JSON.stringify(s));$('entry').hidden=true;$('game').hidden=false;
 $('entry').querySelector('iframe').removeAttribute('src');$('atlas').src='./geo.html?embed=1&field=1&live=1';$('identity').textContent='房间 '+s.code;$('goal').textContent='正在恢复房间…';refresh()}
async function login(create){
 if(pending)return;pending=true;
 try{const code=join.elements.code.value.trim().toUpperCase(),saved=JSON.parse(localStorage.getItem('second-line-key-'+code)||'null');
 const s={token:!create&&saved?saved:crypto.randomUUID(),code};
 if(create)s.code=(await call({op:'create'},s)).code;
 else await call({op:'join',name:join.elements.name.value,invite:params.get('watch')},s);
 localStorage.setItem('second-line-key-'+s.code,JSON.stringify(s.token));enter(s);
 }catch(e){say(e.message)}finally{pending=false}
}
join.onsubmit=e=>{e.preventDefault();login(false)};$('create').onclick=()=>login(true);
function mapUpdate(){if(!view)return;const doFocus=!focused&&view.actors.some(a=>a.own);if(doFocus)focused=true;
 $('atlas').contentWindow?.postMessage({type:'field',actors:view.actors,targets:view.targets,pick:picking?'rendezvous':false,focus:doFocus},location.origin)}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('atlas').contentWindow)return;
 if(e.data?.type==='field-ready'){focused=false;mapUpdate()}
 if(e.data?.type==='field-pick'&&picking){picking=false;act('pin',{p:e.data.p})}});
function controls(actions){const key=JSON.stringify(actions);if(key===actionKey)return;actionKey=key;
 $('actions').replaceChildren(...actions.map(([a,l])=>{const b=document.createElement('button');b.textContent=l;b.onclick=()=>{if(a==='pin'){picking=!picking;mapUpdate();say(picking?'轻点地图，约定关内碰头地点':'已取消选点')}else act(a)};return b}))}
function staffPanel(v){
 const staff=$('staff');if(!v.roster){staff.replaceChildren();return}
 const key=JSON.stringify(v.roster.map(m=>[m.id,m.role]));const admin=v.role==='admin';
 if(!v.started&&admin&&v.roster.length===4){
 if(rosterKey!==key){rosterKey=key;staff.innerHTML='<details open><summary>分配角色</summary>'+Object.entries(names).map(([r,n],i)=>'<label>'+n+'<select data-role="'+r+'">'+v.roster.map((m,j)=>'<option value="'+m.id+'" '+((m.role===r||m.role==='waiting'&&j===i)?'selected':'')+'>'+escapeText(m.name)+'</option>').join('')+'</select></label>').join('')+'<button id="assign">发给四人</button></details>';$('assign').onclick=()=>act('assign',{ids:[...staff.querySelectorAll('select')].map(n=>n.value)})}return}
 rosterKey='';const wasOpen=staff.querySelector('details')?.open??true;const eventsOpen=staff.querySelector('.events')?.open;
 staff.innerHTML='<details '+(wasOpen?'open':'')+'><summary>玩家状态 · '+v.roster.length+' 人</summary>'+v.roster.map(m=>'<p><b>'+escapeText(m.name)+'</b> · '+(names[m.role]||'待命')+' · '+escapeText(m.status)+'<br><small>'+(m.last?'定位 '+Math.max(0,Math.floor((v.now-m.last)/1000))+' 秒前 · ±'+Math.round(m.acc)+' 米':'等待定位')+'</small></p>').join('')+'</details>'+(v.log?.length?'<details class="events"><summary>事件记录</summary>'+v.log.map(e=>'<p>'+new Date(e.t).toLocaleTimeString()+'　'+escapeText(e.line)+'</p>').join('')+'</details>':'');if(eventsOpen&&staff.querySelector('.events'))staff.querySelector('.events').open=true;
}
function receive(v){if(!v.role||v.now<lastStamp)return;lastStamp=v.now;view=v;received=Date.now();sync='进度已同步';
 $('identity').textContent=v.title+' · '+session.code;
 $('goal').textContent=v.roster?(v.end?'主线结束 · '+v.end:v.started?'全员地图':v.roster.length+'/4 人已进房'):v.task;
 const actions=[...v.actions];if(v.role==='admin'&&!v.started&&v.roster.length===4&&v.roster.every(x=>names[x.role]))actions.push(['begin','确认就位，开始游戏']);
 if(v.role==='admin'&&v.review&&!v.end)actions.push(['approve','确认现场抓获'],['dismiss','驳回复核']);
 controls(actions);staffPanel(v);mapUpdate();clock();$('observe').hidden=v.role!=='admin';
 if(names[v.role]&&!v.end&&watch===null)locate();if(v.end&&watch!==null){navigator.geolocation.clearWatch(watch);watch=null}
}
function format(ms){let s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function clock(){if(!view)return;const elapsed=Date.now()-received,v=view;
 $('clock').textContent=v.end?'已结算':v.started?format(v.started+7200000-v.now-elapsed):'等待开局';
 $('meta').textContent=[v.money!=null?v.money+' 元':'',v.injured?'男孩受伤 · 庇护期间仍可能闪现':'',v.shield!=null?(v.covering?'庇护中 ':'庇护余额 ')+format(v.shield-(v.covering?elapsed:0)):'',v.result,v.feedback].filter(Boolean).join('　');
 $('status').textContent=[sync,names[v.role]?gps:''].filter(Boolean).join(' · ')}
async function act(action,extra={}){if(pending)return;pending=true;
 try{receive(await call({op:'action',action,nonce:crypto.randomUUID(),...extra}))}catch(e){say(e.message);refresh()}finally{pending=false}}
async function refresh(){if(!session||polling)return;polling=true;try{receive(await call({op:'state'}))}
 catch(e){sync='等待重新连接';if(e.status===404)sync='房间已过期，请从房间菜单返回入口';$('status').textContent=sync;clock()}finally{polling=false}}
async function fix(p){if(!session||view?.end)return;try{receive(await call({op:'fix',p:[p.coords.latitude,p.coords.longitude],acc:p.coords.accuracy,time:p.timestamp}));gps='定位 ±'+Math.round(p.coords.accuracy)+' 米';clock()}catch(e){gps='定位待同步';clock()}}
const opts={enableHighAccuracy:true,maximumAge:0,timeout:15000};
function geoError(e){gps=e.code===1?'请允许浏览器定位，再点刷新':'等待新的定位';clock()}
function locate(force=false){if(!navigator.geolocation){gps='此设备不支持定位';return}
 if(force&&watch!==null){navigator.geolocation.clearWatch(watch);watch=null}
 if(watch===null)watch=navigator.geolocation.watchPosition(fix,geoError,opts);if(force)navigator.geolocation.getCurrentPosition(fix,geoError,opts)}
function resume(){if(!session)return;refresh();if(names[view?.role]&&!view?.end){gps='正在重新定位';locate(true)}}
$('refresh').onclick=resume;document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});window.addEventListener('pageshow',resume);window.addEventListener('online',resume);
$('menu').onclick=()=>{$('roomCode').textContent='房间号 '+session.code;$('settings').showModal()};$('close').onclick=()=>$('settings').close();
async function invite(observer){const u=new URL(location.href);u.search='';u.searchParams.set('room',session.code);if(observer)u.searchParams.set('watch',view.invite);try{await navigator.clipboard.writeText(u.href);say('邀请链接已复制')}catch{$('roomCode').textContent=u.href}}
$('invite').onclick=()=>invite(false);$('observe').onclick=()=>invite(true);$('leave').onclick=()=>{localStorage.removeItem(storeKey);location.replace(location.pathname)};
setInterval(()=>{if(!document.hidden)refresh()},3000);
setInterval(()=>{if(!document.hidden&&names[view?.role]&&!view.end&&navigator.geolocation)navigator.geolocation.getCurrentPosition(fix,geoError,opts)},12000);setInterval(clock,1000);
if(session&&(!params.get('room')||params.get('room')===session.code))enter(session);
