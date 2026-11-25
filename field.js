// Temporary playtest triggers in WGS84. Narrative sites are not surveyed historical entrances.
const fieldSites={
 boy:[22.6012,114.0440],worker:[22.6012,114.0489],meet:[22.5999,114.0464],
 driver:[22.5914,114.0483],guard:[22.5590,114.0550],gate:[22.5968,114.0468],
 gap:[22.5940,114.0449],inner:[22.5948,114.0468],decoy:[22.566,114.037],
 port:[22.518425,114.064321],hk:[22.5110,114.0656],
 cargo0:[22.5914,114.0483],cargo1:[22.5660,114.037],cargo2:[22.555,114.05],
 cargo3:[22.5401,114.0653],cargo4:[22.5292,114.0553]
};
const fieldNames={meet:'碰头点',gate:'测试过关点',gap:'虚拟路线点',port:'交付区',hk:'抵港测试点'};
function meters(a,b){
 const rad=Math.PI/180,dlat=(a[0]-b[0])*rad,dlon=(a[1]-b[1])*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
}
let gpsRole=null,gpsRecord=null,pickPosition=false,focusActor=true,fieldStatus='',replayGPS=false;
function sample(r){
 if(r===gpsRole)return gpsRecord;
 return s.field?.[r]||{p:fieldSites[s.pos[r]]||fieldSites[r],acc:0,source:'模拟'};
}
function usable(r){
 if(!roles[r])return false;
 const f=sample(r);
 return !!f&&(r!==gpsRole||(Date.now()-f.time<20000&&f.acc<=50));
}
function apart(a,b){return usable(a)&&usable(b)?meters(sample(a).p,sample(b).p):Infinity}
function setPoint(r,p){s.field??={};s.field[r]={p:p.slice(),acc:0,source:'模拟'}}
function targetFor(id){
 if(id==='ready')return s.role;
 if(id==='meet'||['boyOK','workerOK','driverOK'].includes(id))return 'meet';
 return {crossWire:'gap',crossTaxi:'gate',workerCross:'gate',port:'port',hk:'hk',deliverCargo:'cargo'+s.cargo}[id];
}
function inReach(id,r=s.role){
 const k=id==='ready'?r:targetFor(id);
 return !k||usable(r)&&meters(sample(r).p,fieldSites[k])<=45;
}
function currentTarget(){
 if(s.page==='ready')return s.role;
 if(s.page!=='play')return null;
 const ids=[...nextMove()[2].matchAll(/data-act="([^"]+)"/g)].map(m=>m[1]);
 return ids.map(targetFor).find(Boolean);
}
function fieldEvents(){
 if(s.page!=='play'||s.end)return;
 if(s.job==='passenger'&&s.aboard&&s.phase==='inside'&&!s.atPort&&!s.driverResult&&!s.bribeAsked&&!s.offerNear&&apart('guard','driver')<=1000){
  s.offerNear=true;s.log.unshift({role:'driver',line:'联防进入 1 公里范围，可以答复。'});save();
 }
}
function updateField(){
 fieldEvents();
 if(s.page==='play'&&!s.end&&s.phase==='inside'&&s.pos.boy!=='boy'&&usable('boy')){
  if(!s.atPort&&inReach('port','boy')){arrivePort();save()}
  else if(s.atPort&&inReach('hk','boy')){finish('抵港');render();return}
 }
 refreshPanel();syncField();updateGPS();
}
function testCrossing(previous,current,r){
 if(s.page!=='play'||s.end||!previous||!current||current.time-previous.time>20000||
    current.time<=previous.time||previous.acc>50||current.acc>50)return;
 const gate=fieldSites.gate;
 if(previous.p[0]<=gate[0]||current.p[0]>gate[0]||meters(current.p,gate)>45||meters(previous.p,gate)>85)return;
 if(r==='driver'&&s.aboard&&s.phase==='outside')enterTaxi();
 if(r==='worker'&&s.route==='wire'&&!s.workerInside&&s.pos.worker==='meet'){
  s.workerInside=true;s.pos.worker='inner';add('工人经过测试关线，定位转为红点。');
 }
 save();
}
function recordGPS(position){
 if(!gpsRole)return;
 const previous=gpsRecord;
 if(!previous&&s.role===gpsRole)focusActor=true;
 gpsRecord={p:[position.coords.latitude,position.coords.longitude],acc:position.coords.accuracy,time:position.timestamp,source:'GPS'};
 if(Date.now()-gpsRecord.time<20000)testCrossing(previous,gpsRecord,gpsRole);
 updateField();
}
function fieldToolbar(){
 return '<div class="field-toolbar"><label>玩家视角 <select id="field-role">'+Object.entries(roles).map(([k,r])=>'<option value="'+k+'" '+(k===s.role?'selected':'')+'>'+r.name+'</option>').join('')+'</select></label>'+btn('lab','测试台')+'</div>';
}
function fieldMap(){
 return '<section class="home-atlas field-atlas">'+atlasBar(false)+atlasFrame(true)+'</section>';
}
function refreshPanel(){
 const panel=$('field-panel');
 if(panel&&s.page==='play'){
  const content=playPanel();
  if(panel.dataset.last!==content){panel.innerHTML=content;panel.dataset.last=content}
 }
 const target=currentTarget(),f=sample(s.role);
 if($('field-read'))$('field-read').textContent=roles[s.role].name+' · '+(f?.source||'等待 GPS')+(f?' · '+f.p.map(n=>n.toFixed(5)).join(', '):'')+
 (f?.source==='GPS'?' · ±'+Math.round(f.acc)+' 米 · '+Math.max(0,Math.floor((Date.now()-f.time)/1000))+' 秒前':'')+
 (target&&f?' · 距'+(fieldNames[target]||'任务点')+' '+Math.round(meters(f.p,fieldSites[target]))+' 米':'')+
 (gpsRole===s.role&&!usable(s.role)?' · 等待新鲜且精度 ≤50 米的定位':'')+(target&&f&&usable(s.role)?(meters(f.p,fieldSites[target])<=45?' · 已进入触发圈':' · 圈外'):'')+(gpsRole===s.role&&f&&(f.p[0]<22.510||f.p[0]>22.604||f.p[1]<114.009||f.p[1]>114.076)?' · GPS 在试玩地图外':'')+(fieldStatus?' · '+fieldStatus:'');
 for(const b of main.querySelectorAll('[data-act]')){
  const id=b.dataset.act;if(targetFor(id))b.disabled=!inReach(id);
 }
}
function fieldActors(){
 let keys=[s.role];
 if(s.role==='driver')keys=Object.keys(roles);
 if(s.role==='worker'&&s.offer==='accepted')keys.push('driver');
 if(s.role==='guard'){
  if(workerRed())keys.push('worker');
  if(driverInside())keys.push('driver');
  if(boyShown())keys.push('boy');
 }
 return keys.filter(k=>sample(k)).map(k=>({p:sample(k).p,acc:k===s.role?sample(k).acc:0,own:k===s.role,
  label:k===s.role?'本人':s.role==='guard'?'':roles[k].name,color:k==='worker'&&workerRed()?roles.driver.color:roles[k].color}));
}
function driverInside(){const f=sample('driver');return !!f&&f.p[0]<=fieldSites.gate[0]}
function syncField(){
 const target=currentTarget(),entries=[];
 // The virtual gap is disclosed on the worker's map only.
 if(target&&(target!=='gap'||s.role==='worker'))entries.push([fieldSites[target],fieldNames[target]||'任务点']);
 if(s.role==='worker'&&s.page==='play')entries.push([fieldSites.gap,'虚拟路线点']);
 for(const fr of document.querySelectorAll('iframe[data-field]'))fr.contentWindow?.postMessage({type:'field',gateLine:target==='gate'?fieldSites.gate:null,actors:fieldActors(),targets:entries,pick:pickPosition,focus:focusActor},location.origin);
 focusActor=false;
}
function lab(){
 const opts=[['ready','四人就位'],['meet','关外会合'],['taxi','乘车过关前'],['wire','铁丝网过关前'],['near','联防接近前'],['cover','受伤与庇护'],['cargo','货运检查站'],['port','口岸交付前'],['last','正常通关后段'],['timeout','倒计时最后十秒']];
 const active=!!document.querySelector('iframe[data-field]');
 show('流程测试台','<p>本机共用一局。切换视角可检查同一局的进度。GPS 可单独绑定一人，其余角色使用模拟坐标。</p><h3>位置输入</h3><p id="lab-status"></p>'+(active?btn('verify','在地图点选实地参照物')+btn('bind','本机 GPS → '+roles[s.role].name)+btn('unbind','停止绑定，使用模拟点')+btn('pick','点地图放置当前角色')+btn('to-target','模拟移动到当前任务点')+(s.role==='guard'?btn('near-driver','移动至司机附近')+btn('near-boy','移动至男孩附近'):''):'')+'<h3>跳转测试阶段</h3><p>阶段跳转使用独立测试存档。</p><select id="scenario">'+opts.map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select>'+btn('load-stage','载入所选阶段')+btn('details','定位与行动记录')+(key===testKey&&s.page==='play'?btn('disconnect-test','模拟主动掉线并结算'):'')+(key===testKey?btn('leave-test','返回原试玩存档'):''));
 $('lab-status').textContent=(gpsRole?'GPS 已绑定'+roles[gpsRole].name:'当前使用模拟坐标')+' · '+geoText;
}
function stage(id){
 key=testKey;try{sessionStorage.setItem('zone-field-active','1')}catch{}
 stopGeo();gpsRole=null;gpsRecord=null;fix=null;geoText='尚未启用定位';pickPosition=false;fieldStatus='';previewOnEntry=false;
 s=fresh();s.role='boy';s.page='ready';s.first='boy';
 if(id==='ready'){render();return}
 for(const r of Object.keys(roles)){s.ready[r]=true;s.confirmed[r]=true;s.seen[r]=true}
 s.page='play';s.started=Date.now();s.job='passenger';s.offer='pending';
 if(id!=='meet'&&id!=='timeout'){
  const wire=['wire','cover','cargo'].includes(id);
  Object.assign(s,{job:wire?'cargo':'passenger',route:wire?'wire':'taxi',offer:wire?'declined':'accepted'});
  s.pos.boy=s.pos.worker='meet';
  if(!wire){s.driverOK=s.workerOK=s.boyOK=true;boardIfReady();s.pos.driver='meet'}
  if(!['wire','taxi','cargo'].includes(id)){
   s.phase='inside';s.workerInside=true;s.pos.boy=s.pos.worker='inner';
   if(wire)s.cash.boy=0;else s.pos.driver='inner';
  }
  if(id==='last')arrivePort();
 }
 if(id==='timeout')s.started-=7190000;
 s.role=({taxi:'driver',near:'guard',cover:'worker',cargo:'driver'})[id]||'boy';
 notice='';focusActor=true;render();
}
function fieldAction(id){
 if(id==='disconnect-test'&&key===testKey&&s.page==='play'){closeModal();finish('主动掉线');render();return true}
 if(id==='leave-test'){stopGeo();try{sessionStorage.removeItem('zone-field-active')}catch{}location.reload();return true}
 if(id==='lab'){lab();return true}
 if(id==='verify'){if(!gpsRecord||!gpsRole||!usable(gpsRole)){ $('lab-status').textContent='请先绑定本机 GPS，等待有效定位。';return true}pickPosition='verify';fieldStatus='在地图上点选你实际站立的位置';closeModal();syncField();refreshPanel();return true}
 if(id==='load-stage'){const k=$('scenario').value;closeModal();stage(k);return true}
 if(id==='bind'){
  fieldStatus='';fix=null;stopGeo();gpsRecord=null;gpsRole=s.role;focusActor=true;requestGeo();closeModal();updateField();return true;
 }
 if(id==='unbind'){geoText='已停止定位';fix=null;stopGeo();gpsRole=null;gpsRecord=null;fieldStatus='';closeModal();updateField();return true}
 if(['pick','to-target','near-driver','near-boy'].includes(id)){
  if(gpsRole===s.role){$('lab-status').textContent='先停止此角色的 GPS 绑定，再移动模拟点。';return true}
  if(id==='pick'){pickPosition=true;fieldStatus='点地图放置当前角色';closeModal();syncField();refreshPanel();return true}
  let p;
  if(id==='to-target'){const k=currentTarget();p=k&&fieldSites[k]}
  else{const other=sample(id==='near-boy'?'boy':'driver');if(other)p=[other.p[0]+(id==='near-boy'?0:.0006),other.p[1]]}
  if(!p){$('lab-status').textContent='当前没有可移动到的任务点。';return true}
  setPoint(s.role,p);closeModal();focusActor=true;save();updateField();return true;
 }
 return false;
}
document.addEventListener('change',e=>{
 if(e.target.id!=='field-role')return;
 s.role=e.target.value;pickPosition=false;focusActor=true;fieldStatus='';notice='';
 if(!s.started&&s.page!=='result')s.page=s.ready[s.role]?'ready':'brief';
 render();
});
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||!Array.from(document.querySelectorAll('iframe[data-field]')).some(f=>f.contentWindow===e.source))return;
 if(e.data?.type==='field-ready'){focusActor=true;syncField()}
 if(e.data?.type==='field-pick'&&pickPosition){
  const p=e.data.p;if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))return;
  if(pickPosition==='verify'){pickPosition=false;fieldStatus=usable(gpsRole)&&gpsRecord?'参照点与本机 GPS 相距 '+Math.round(meters(p,gpsRecord.p))+' 米':'定位已过期，请重新核对';refreshPanel();syncField();return}
  if(s.role===gpsRole)return;pickPosition=false;fieldStatus='';setPoint(s.role,p);save();updateField();
 }
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){replayGPS=!!gpsRole;stopGeo();gpsRecord=null}
 else if(replayGPS&&gpsRole&&!s.end){replayGPS=false;requestGeo();updateField()}
});
