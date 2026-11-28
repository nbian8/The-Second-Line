'use strict';
const api='https://second-line-live.stormylotus11.chatgpt.site/room';
const $=id=>document.getElementById(id),names={boy:'男孩',worker:'工人',driver:'司机',guard:'联防'};
const params=new URLSearchParams(location.search),storeKey='second-line-live-v1';
let session=JSON.parse(localStorage.getItem(storeKey)||'null'),view=null,watch=null,picking=false,focused=false;
const palette={boy:'#202020',worker:'#197847',driver:'#ae3532',guard:'#244877'};
let chosenPlayer=null,lastInjury=false,actionSignature='',reviewMode=false;
let gps='等待定位',sync='',received=0,lastStamp=-1,polling=false,pending=false,noticeTimer,rosterKey='',actionKey='';
const join=$('join');join.elements.code.value=params.get('room')||'';
if(/^[A-F0-9]{8}$/i.test(join.elements.code.value)){
 $('codeField').hidden=true;$('invited').hidden=false;$('invited').textContent='即将加入房间 '+join.elements.code.value.toUpperCase()
}
function fold(open){$('sheet').hidden=!open;$('fold').setAttribute('aria-expanded',String(open));$('chevron').textContent=open?'⌄':'⌃'}
$('fold').onclick=()=>fold($('sheet').hidden);
$('back').onclick=()=>$('decision').close();
$('decision').addEventListener('close',()=>{chosenPlayer=null;reviewMode=false});
function details(title,body,buttons=[]){
 $('dialog-title').textContent=title;$('detail').textContent=body;
 $('decision-actions').replaceChildren(...buttons.map(([text,fn])=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;return b}));
 if(!$('decision').open)$('decision').showModal()
}
function describe(m){return [m.name+' · '+(names[m.role]||'待命'),m.status,m.last?'定位 '+Math.max(0,Math.floor((view.now-m.last)/1000))+' 秒前 · ±'+Math.round(m.acc)+' 米':'等待定位'].join('　')}
function inspect(m){if(m){chosenPlayer=m.id;details('玩家状态',describe(m))}}
function review(){
 reviewMode=true;
 const info=view.roster.filter(x=>['boy','guard'].includes(x.role)).map(describe);
 const event=view.log?.find(x=>x.line.includes('申请裁判复核'));
 if(event)info.unshift('申请时间 '+new Date(event.t).toLocaleTimeString());
 details('现场抓捕复核',info.join('\n\n'),[['驳回复核',()=>submitDecision('dismiss')],['核对后继续',()=>{reviewMode=false;details('确认结束本局？','此操作将判定男孩被抓获，并结束全员主线。',[['确认现场抓获',()=>submitDecision('approve')]])}]])
}
function submitDecision(a){$('decision').close();act(a)}
if(params.get('watch'))join.querySelector('button').textContent='加入观察席';
function say(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',4500)}
function escapeText(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function call(body,identity=session){
 const res=await fetch(api,{method:'POST',body:JSON.stringify({...identity,...body}),headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
 const data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'连接失败'),{status:res.status});return data;
}
function enter(s){session=s;localStorage.setItem(storeKey,JSON.stringify(s));$('entry').hidden=true;$('game').hidden=false;
 $('entry').querySelector('iframe').removeAttribute('src');$('atlas').src='./geo.html?embed=1&field=1&live=1&v=4';$('identity').textContent='房间 '+s.code;$('goal').textContent='正在恢复房间…';refresh()}
async function login(create){
 if(pending)return;pending=true;$('join-error').textContent='正在连接房间…';
 try{const code=join.elements.code.value.trim().toUpperCase(),saved=JSON.parse(localStorage.getItem('second-line-key-'+code)||'null');
 const s={token:!create&&saved?saved:crypto.randomUUID(),code};
 if(create)s.code=(await call({op:'create'},s)).code;
 else await call({op:'join',name:join.elements.name.value,invite:params.get('watch')},s);
 localStorage.setItem('second-line-key-'+s.code,JSON.stringify(s.token));enter(s);
 }catch(e){$('join-error').textContent=e.message}finally{pending=false}
}
join.onsubmit=e=>{e.preventDefault();login(false)};$('create').onclick=()=>login(true);
function mapUpdate(){if(!view)return;const doFocus=!focused&&view.actors.some(a=>a.own||view.roster);if(doFocus)focused=true;
 $('atlas').contentWindow?.postMessage({type:'field',actors:view.actors,targets:view.targets,guard:view.role==='guard',staff:!!view.roster,now:view.now,pick:picking?'rendezvous':false,focus:doFocus},location.origin)}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('atlas').contentWindow)return;
 if(e.data?.type==='field-ready'){focused=false;mapUpdate()}
 if(e.data?.type==='inspect-player')inspect(view?.roster?.find(m=>e.data.label===m.name+' · '+({driver:'出租车司机',guard:'联防队员'}[m.role]||names[m.role])));
 if(e.data?.type==='map-note'){$('response').textContent=e.data.text;fold(true)}
 if(e.data?.type==='field-pick'&&picking)act('pin',{p:e.data.p});
});
function pickMode(on){picking=on;$('response').textContent=on?'拖动地图，将中心十字对准约定地点。':'';mapUpdate();drawActions(view);fold(true)}
function controls(actions){
 const key=JSON.stringify(actions);if(key===actionKey)return;actionKey=key;
 $('actions').replaceChildren(...actions.map(([a,l])=>{
 const b=document.createElement('button');b.textContent=l;
 b.onclick=()=>{
  if(a==='pin')pickMode(true);
  else if(a==='cancelPin')pickMode(false);
  else if(a==='savePin')$('atlas').contentWindow.postMessage({type:'pin-submit'},location.origin);
  else if(a==='reviewDetails')review();
  else if(a==='fieldReview')details('现场复核','仅在现场已发现男孩、需要裁判核对时提交。',[['提交复核申请',()=>submitDecision('review')]]);
  else if(a==='catch')details('现场确认抓获','请核对现场身份，确认后本局主线结束。',[['确认已抓获',()=>submitDecision('catch')]]);
  else act(a)
 };return b}));
}
function drawActions(v){
 let actions=v.actions.filter(([a])=>a!=='review').map(([a,label])=>[a,a==='wireCross'?'支付 30 元并通过':label]);
 if(picking&&!actions.some(([a])=>a==='pin')){picking=false;mapUpdate()}
 if(picking)actions=[['cancelPin','取消'],['savePin','确认约在这里']];
 if(v.role==='guard'&&v.started&&!v.end)actions.push(['fieldReview','现场复核']);
 if(v.role==='admin'&&!v.started&&v.roster.length===4&&v.roster.every(x=>names[x.role]))actions.push(['begin','确认就位，开始游戏']);
 if(v.role==='admin'&&v.review&&!v.end)actions.push(['reviewDetails','1 项待裁定']);
 controls(actions)
}
function staffPanel(v){
 const staff=$('staff');if(!v.roster){staff.replaceChildren();return}
 const key=JSON.stringify(v.roster.map(m=>[m.id,m.role]));const admin=v.role==='admin';
 if(!v.started&&admin&&v.roster.length===4){
 if(rosterKey!==key){rosterKey=key;staff.innerHTML='<details open><summary>分配角色</summary>'+Object.entries(names).map(([r,n],i)=>'<label>'+n+'<select data-role="'+r+'">'+v.roster.map((m,j)=>'<option value="'+m.id+'" '+((m.role===r||m.role==='waiting'&&j===i)?'selected':'')+'>'+escapeText(m.name)+'</option>').join('')+'</select></label>').join('')+'<button id="assign">发给四人</button></details>';const selects=[...staff.querySelectorAll('select')];
 // Swap the other assignment when a player is selected, so all four roles stay unique.
 for(const sel of selects){sel.dataset.previous=sel.value;sel.onchange=()=>{const other=selects.find(x=>x!==sel&&x.value===sel.value);if(other){other.value=sel.dataset.previous;other.dataset.previous=other.value}sel.dataset.previous=sel.value}}
 $('assign').onclick=()=>act('assign',{ids:[...staff.querySelectorAll('select')].map(n=>n.value)})}return}
 const keyList='list:'+v.roster.map(m=>m.id).join(',');
 if(rosterKey!==keyList){
  rosterKey=keyList;
  staff.innerHTML='<details id="players"><summary></summary><div></div></details><details class="events"><summary>事件记录</summary><div></div></details>';
  $('players').open=!v.started;
  const list=$('players').querySelector('div');
  for(const m of v.roster){const b=document.createElement('button');b.className='roster-line';b.dataset.id=m.id;b.onclick=()=>inspect(view.roster.find(x=>x.id===m.id));list.append(b)}
 }
 const stale=v.roster.filter(m=>!m.last||v.now-m.last>20000).length;
 $('players').querySelector('summary').textContent=v.roster.length+' 人在局'+(stale?' · '+stale+' 人定位待更新':'');
 for(const b of staff.querySelectorAll('[data-id]')){const m=v.roster.find(x=>x.id===b.dataset.id);b.textContent=describe(m)}
 const log=staff.querySelector('.events'),last=v.log?.map(e=>e.t+e.line).join('|')||'';
 log.hidden=!last;
 if(log.dataset.last!==last){log.dataset.last=last;log.querySelector('div').replaceChildren(...(v.log||[]).map(e=>{const p=document.createElement('p');p.textContent=new Date(e.t).toLocaleTimeString()+'　'+e.line;return p}))}
 if(chosenPlayer){const m=v.roster.find(x=>x.id===chosenPlayer);if(m)$('detail').textContent=describe(m)}
 if(reviewMode&&!v.review)$('decision').close()
}
function receive(v){if(!v.role||v.now<lastStamp)return;lastStamp=v.now;view=v;received=Date.now();sync='进度已同步';
 $('identity').textContent=v.title;$('identity').style.setProperty('--role',v.actors.find(a=>a.own)?.color||palette[v.role]||'#656359');
 $('goal').textContent=v.roster?(v.end?'主线结束 · '+v.end:v.started?(v.review?'有待裁定事项':v.roster.length+' 名玩家 · 查看状态'):v.roster.length+'/4 人已进房'):v.task;
 const signature=JSON.stringify([v.task,v.actions,!!v.review,v.end]);
 if(signature!==actionSignature){actionSignature=signature;fold(!(v.roster&&v.started&&!v.review&&!v.end));$('response').textContent=''}
 if(v.injured&&!lastInjury){$('response').textContent='男孩已受伤 · 通过铁丝网已付 30 元。庇护期间仍可能短暂暴露。';lastInjury=true}
 drawActions(v);staffPanel(v);mapUpdate();clock();$('observe').hidden=v.role!=='admin';
 if(names[v.role]&&!v.end&&watch===null)locate();if(v.end&&watch!==null){navigator.geolocation.clearWatch(watch);watch=null}
}
function format(ms){let s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function clock(){if(!view)return;const elapsed=Date.now()-received,v=view;
 $('clock').textContent=v.end?'已结算':v.started?'剩余 '+format(v.started+7200000-v.now-elapsed):'等待开局';
 $('meta').textContent=[v.money!=null?v.money+' 元':'',v.injured?'男孩受伤':'',v.shield!=null?(v.covering?'庇护中 ':'庇护可用 ')+format(v.shield-(v.covering?elapsed:0)):'',v.result,v.feedback].filter(Boolean).join('　');
 $('status').textContent=[sync,names[v.role]?(v.actors.find(a=>a.own)&&v.now+elapsed-v.actors.find(a=>a.own).time>20000?'上次定位 '+Math.floor((v.now+elapsed-v.actors.find(a=>a.own).time)/1000)+' 秒前':gps):''].filter(Boolean).join(' · ')}
async function act(action,extra={}){if(pending)return;pending=true;
 $('response').textContent='正在提交…';
 try{const next=await call({op:'action',action,nonce:crypto.randomUUID(),...extra});if(action==='pin')picking=false;receive(next);if(action==='wireCross')$('response').textContent='已受伤 · 已扣 30 元。庇护期间仍可能短暂暴露。';else $('response').textContent=action==='pin'?'约定地点已同步给两人。':'操作已确认。'}
 catch(e){$('response').textContent=action==='review'?'当前无法提交复核，请与裁判联系。':e.message;refresh()}finally{pending=false}}
async function refresh(){if(!session||polling)return;polling=true;try{receive(await call({op:'state'}))}
 catch(e){sync='等待重新连接';if(e.status===404)sync='房间已过期，请从房间菜单返回入口';$('status').textContent=sync;clock()}finally{polling=false}}
async function fix(p){if(!session||view?.end)return;try{receive(await call({op:'fix',p:[p.coords.latitude,p.coords.longitude],acc:p.coords.accuracy,time:p.timestamp}));gps='定位 ±'+Math.round(p.coords.accuracy)+' 米';clock()}catch(e){gps='定位待同步';clock()}}
const opts={enableHighAccuracy:true,maximumAge:0,timeout:15000};
function geoError(e){gps=e.code===1?'请允许浏览器定位，再点刷新':'等待新的定位';clock()}
function locate(force=false){if(!navigator.geolocation){gps='此设备不支持定位';return}
 if(force&&watch!==null){navigator.geolocation.clearWatch(watch);watch=null}
 if(watch===null)watch=navigator.geolocation.watchPosition(fix,geoError,opts);if(force)navigator.geolocation.getCurrentPosition(fix,geoError,opts)}
function resume(){if(!session)return;sync='正在同步进度';clock();refresh();if(names[view?.role]&&!view?.end){gps='正在重新定位';clock();locate(true)}}
$('refresh').onclick=resume;document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});window.addEventListener('pageshow',resume);window.addEventListener('online',resume);
$('menu').onclick=()=>{$('roomCode').textContent='房间号 '+session.code;$('settings').showModal()};$('close').onclick=()=>$('settings').close();
async function invite(observer){const u=new URL(location.href);u.search='';u.searchParams.set('room',session.code);if(observer)u.searchParams.set('watch',view.invite);try{await navigator.clipboard.writeText(u.href);say('邀请链接已复制')}catch{$('roomCode').textContent=u.href}}
$('invite').onclick=()=>invite(false);$('observe').onclick=()=>invite(true);$('leave').onclick=()=>{localStorage.removeItem(storeKey);location.replace(location.pathname)};
setInterval(()=>{if(!document.hidden)refresh()},3000);
setInterval(()=>{if(!document.hidden&&names[view?.role]&&!view.end&&navigator.geolocation)navigator.geolocation.getCurrentPosition(fix,geoError,opts)},12000);setInterval(clock,1000);
if(session&&(!params.get('room')||params.get('room')===session.code))enter(session);else session=null;

function syncMapInsets(){
 if(!view)return;
 const bottom=innerHeight-$('card').getBoundingClientRect().top;
 const top=$('game').querySelector('header').getBoundingClientRect().bottom;
 $('atlas').contentWindow?.postMessage({type:'map-insets',bottom,top},location.origin)
}
new ResizeObserver(syncMapInsets).observe($('card'));
$('atlas').addEventListener('load',syncMapInsets);
