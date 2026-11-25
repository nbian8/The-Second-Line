const roles={boy:{name:'男孩',en:'THE BOY',color:'#151515',cash:30,goal:'在两小时内抵达香港，寻找失联的家人。',start:'关外 · 男孩起点'},worker:{name:'工人',en:'THE WORKER',color:'#18743b',cash:70,goal:'带男孩入关，争取时间，引开联防。',start:'关外 · 工人起点'},driver:{name:'出租车司机',en:'THE DRIVER',color:'#b01818',cash:0,goal:'守约送男孩到口岸，或完成五单货运。',start:'关内 · 出租车站'},guard:{name:'联防队员',en:'THE PATROL',color:'#173578',cash:0,goal:'在允许追捕的区域内找到男孩，现场确认抓获。',start:'关内 · 巡查岗'}};
const regularKey='special-zone-demo-1',testKey='special-zone-field-test';
let key=regularKey;try{if(sessionStorage.getItem('zone-field-active'))key=testKey}catch{}
const main=document.querySelector('#main'),modal=document.querySelector('#modal'),body=document.querySelector('#modalBody');
const $=id=>document.getElementById(id);
const roll=()=>Object.keys(roles)[Math.floor(Math.random()*4)];
function fresh(){return {version:2,ready:{},confirmed:{},seen:{},first:'boy',page:'home',role:'boy',started:0,end:'',phase:'outside',route:'',job:'',offer:'',aboard:false,workerOK:false,driverOK:false,boyOK:false,driverResult:'',bribeAsked:false,atPort:false,workerInside:false,cash:{boy:30,worker:70,driver:0,guard:80},pos:{boy:'boy',worker:'worker',driver:'driver',guard:'guard'},cargo:0,seized:0,inspected:0,guardMoved:0,cover:600000,coverSince:0,flashAt:0,log:[]}}
let s=fresh();try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&[1,2].includes(saved.version)&&roles[saved.role]){s={...fresh(),...saved,version:2};if(saved.version===1){s.cash.guard=s.driverResult==='出卖乘客'?30:80;s.first=s.role;if(!s.started&&s.page==='setup')s.page='brief';s.log=[]}}}catch{}
let previewOnEntry=s.page!=='home';
let watch=null,fix=null,geoText='尚未启用定位',notice='',remainFocus=null;
function save(){try{localStorage.setItem(key,JSON.stringify(s))}catch{}}
function add(line){s.log.unshift({role:s.role,line});s.log=s.log.slice(0,60);notice=line}
function time(ms){const n=Math.max(0,Math.ceil(ms/1000));return (n>=3600?String(Math.floor(n/3600)).padStart(2,'0')+':':'')+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function left(){return s.coverSince?Math.max(0,s.cover-(Date.now()-s.coverSince)):s.cover}
function stopCover(){s.cover=left();s.coverSince=0}
function finish(reason){stopCover();s.finishedAt=Date.now();s.end=reason;s.page='result';if(reason==='抵港'){s.pos.boy='hk';s.wonAt=Date.now()}if(reason!=='抵港'&&s.job==='passenger'&&!s.driverResult)s.driverResult='订单失败';add('主线结束 · '+reason);stopGeo()}
function requestGeo(){if(watch!==null)return;if(!navigator.geolocation){geoText='此浏览器未提供定位';return}geoText='正在等待手机定位…';watch=navigator.geolocation.watchPosition(p=>{fix=p.coords;recordGPS(p);geoText='定位精度约 ±'+Math.round(fix.accuracy)+' 米';updateGPS()},e=>{gpsRecord=null;geoText=e.code===1?'定位权限未开启':'暂时无法取得位置';stopGeo();refreshPanel();syncField();updateGPS()},{enableHighAccuracy:true,maximumAge:0,timeout:15000})}
function stopGeo(){if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null}
function updateGPS(){if($('geo'))$('geo').textContent=geoText;if($('coords'))$('coords').textContent=fix?'纬度 '+fix.latitude.toFixed(5)+' / 经度 '+fix.longitude.toFixed(5):''}
function point(id){return id.startsWith('cargo')?sites.cargo[Number(id.slice(5))]:sites[id]}
function coord(r){return point(s.pos[r])}
function distance(a,b){return Math.hypot(...a.map((n,i)=>n-b[i]))}
function workerRed(){return s.workerInside||s.aboard&&s.phase==='inside'}
function isFlash(){return s.route==='wire'&&s.coverSince&&Date.now()>=s.flashAt&&Date.now()<s.flashAt+5000}
function boyShown(){return s.phase==='inside'&&!s.atPort&&(s.route==='taxi'?s.driverResult==='出卖乘客':!s.coverSince||isFlash())}
function canInspect(){return s.phase==='inside'&&!s.atPort}
function viewMarkers(){
 const me=s.role,allowed=new Set([me]);
 if(me==='driver')Object.keys(roles).forEach(k=>allowed.add(k));
 if(me==='worker'&&s.offer==='accepted')allowed.add('driver');
 if(me==='guard'){if(workerRed())allowed.add('worker');if(!['meet','gate'].includes(s.pos.driver))allowed.add('driver');if(boyShown())allowed.add('boy')}
 const out=[...allowed].sort((a,b)=>Number(a===me)-Number(b===me)).map(k=>({p:coord(k),c:k==='worker'&&workerRed()?roles.driver.color:roles[k].color,me:me===k}));
 if((me==='worker'||me==='boy')&&s.phase==='outside')out.push({p:sites.meet,task:'碰头点',offset:-15});
 if(me==='worker')out.push({p:sites.gap,task:'破洞',offset:24});
 return out;
}
const btn=(id,label,primary=false)=>'<button data-act="'+id+'" class="'+(primary?'primary':'wide')+'">'+label+'</button>';
const switchBtn=r=>btn('switch-'+r,'切换到'+roles[r].name);
function nextMove(){
 const r=s.role,wait=(msg,k)=>[msg,'切换视角，接着完成另一名玩家的操作。',switchBtn(k)];
 if(r==='driver'){
 if(s.driverResult)return [s.driverResult,s.driverResult==='出卖乘客'?'已收取 100 点，男孩的位置已暴露。':'个人结果已锁定。主线仍由男孩继续。',switchBtn('boy')];
 if(!s.job)return ['选择今天的生意','载客向男孩和工人发出邀约。货运每单收入 20 点。',btn('offer','发出载客邀约',true)+btn('freight','选择货运')];
 if(s.job==='cargo')return ['货运检查站 '+(s.cargo+1)+' / 5','前往下一个任务点，交付一单货物获得 20 点。',btn('deliverCargo','到站交货',true)];
 if(s.offer==='pending')return wait('等待工人答复','worker');
 if(!s.driverOK)return ['到碰头点接客','请两名乘客确认上车，车费合计 50 点。',btn('driverOK','确认接人',true)];
 if(!s.workerOK)return wait('等待工人上车','worker');if(!s.boyOK)return wait('等待男孩上车','boy');
 if(s.phase==='outside')return ['驶过二线关','两名乘客均已上车，可一同进入特区。',btn('crossTaxi','确认过关',true)];
 if(!s.bribeAsked&&!s.atPort&&s.offerNear)return ['联防询问','你载过这两个人吗？',btn('hide','拒绝，隐瞒载客',true)+btn('bribe','接受 50 点，承认载客')];
 return ['护送男孩到口岸','司机可以分开行动。男孩抵达交付区时，守约订单完成。',btn('driverDecoy','前往另一处检查站')+switchBtn('boy')];
 }
 if(r==='worker'){
 if(s.pos.worker==='worker')return ['与男孩碰头','你们从相距约 500 米的两个起点出发。',btn('meet','确认会合',true)];
 if(s.pos.boy==='boy')return wait('等待男孩到碰头点','boy');
 if(!s.job)return wait('等待司机选择业务','driver');
 if(s.offer==='pending')return ['商量入关路线','出租车合付 50 点。走铁丝网由男孩付 30 点，过关后会受伤。两条路都有可能被联防抓到。',btn('accept','接受邀约',true)+btn('decline','走铁丝网路线')];
 if(s.route==='taxi'&&!s.driverOK)return wait('等待司机到达','driver');
 if(s.route==='taxi'&&!s.workerOK)return ['支付 30 点车费','本次试玩工人支付 30 点，男孩支付 20 点。',btn('workerOK','确认上车',true)];
 if(s.route==='taxi'&&s.phase==='outside')return wait('等待同车入关',s.boyOK?'driver':'boy');
 if(!s.workerInside)return ['持证通过检查站','男孩已获知游戏路线点。你可以独自从检查站入关。',btn('workerCross','确认持证入关',true)];
 return ['为男孩打掩护','你可以独自前往另一处检查站，让联防追错目标。',(s.route==='wire'&&s.phase==='inside'&&left()>0?btn('cover',s.coverSince?'暂停庇护':'开启庇护',true):'')+btn('workerDecoy',s.pos.worker==='decoy'?'返回关内会合处':'前往另一处检查站')+switchBtn('boy')];
 }
 if(r==='guard'){
 if(s.atPort)return ['停止追捕','男孩已进入口岸查验阶段。',switchBtn('boy')];
 const targets=['driver','worker'].filter(k=>k==='worker'?workerRed():driverInside()).filter(k=>apart(k,'guard')<=45).sort((a,b)=>sample(a).p[1]-sample(b).p[1]);
 let buttons=targets.map((k,i)=>btn('inspect-'+k,'查验'+(targets.length>1?'红点 '+(i+1):'')+'')).join('');
 if(canInspect()&&apart('boy','guard')<=5)buttons+=btn('catch','现场确认抓获',true);
 return [targets.length?'附近有可查验的目标':'巡查关内目标','选择红点查验。',buttons||switchBtn('boy')];
 }
 if(s.pos.boy==='boy')return ['去找老乡','工人知道入关的路。先去两人约好的碰头点。',btn('meet','确认会合',true)];
 if(s.pos.worker==='worker')return wait('等待工人会合','worker');
 if(!s.job)return wait('等待司机选择业务','driver');
 if(s.offer==='pending')return ['和工人商议入关路线','出租车两人合付 50 点，铁丝网由你支付 30 点并受伤。两条路都有可能被联防抓到。',switchBtn('worker')];
 if(s.route==='taxi'&&!s.driverOK)return wait('等待司机接客','driver');
 if(s.route==='taxi'&&!s.boyOK)return ['支付 20 点车费','本次试玩你支付 20 点，工人支付 30 点。',btn('boyOK','确认上车',true)];
 if(s.route==='taxi'&&s.phase==='outside')return wait('等待乘车入关',s.workerOK?'driver':'worker');
 if(s.phase==='outside')return ['支付 30 点，经破洞入关','在游戏地图上确认通过，支付 30 点。受伤后，位置可能短暂暴露。',btn('crossWire','尝试入关',true)];
 if(!s.atPort)return ['前往福田口岸','抵达交付区时结算司机订单。你还要继续过关。',btn('port','确认抵达交付区',true)];
 return ['正常通关，抵达香港','查验区域停止追捕。完成最后一段行程，结算这一局。',btn('hk','确认抵港',true)];
}
function roleButtons(){return '<div class="rolelist">'+Object.entries(roles).map(([k,r])=>'<button data-act="role-'+k+'" aria-pressed="'+(s.role===k)+'"><i class="dot" style="--dot:'+r.color+'"></i>'+r.name+'<small>'+(s.role===k?'已选择':'选择')+'</small></button>').join('')+'</div>'}
function atlasFrame(field=false){
 return '<iframe '+(field?'data-field ':'')+'class="atlas-frame" title="可缩放的 1994 深圳街道简图" src="./geo.html?embed=1&v=10'+(field?'&field=1':'')+'" allow="geolocation"></iframe>';
}
function atlasBar(expanded){
 return '<div class="atlas-bar"><h2>1994 街道简图</h2><button class="subtle" data-act="atlas-size" aria-expanded="'+expanded+'">'+(expanded?'收起地图':'展开地图')+'</button></div>';
}
function homeAtlas(){
 return '<section class="home-atlas" aria-label="地图预览">'+atlasBar(false)+atlasFrame()+'</section>';
}
function closeAtlas(){
 const dialog=$('play-atlas');
 if(dialog.open){dialog.close();return}
 const panel=document.querySelector('.home-atlas.expanded');
 if(!panel)return;
 panel.classList.remove('expanded');document.body.classList.remove('atlas-open');
 const b=panel.querySelector('button');b.textContent='展开地图';b.setAttribute('aria-expanded','false');b.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAtlas()});
window.addEventListener('message',e=>{
 if(e.origin===location.origin&&e.data==='atlas-close'&&Array.from(document.querySelectorAll('.atlas-frame')).some(f=>f.contentWindow===e.source))closeAtlas();
});
$('play-atlas').addEventListener('close',()=>{$('play-atlas').replaceChildren();document.body.classList.remove('atlas-open')});
function home(){
 const resume=previewOnEntry||(s.started&&!s.end);
 return '<section class="page entry"><div class="top"><b class="brand">SPECIAL ZONE</b><button class="subtle" data-act="rules">规则手册</button></div><h1><span>1994</span>深圳经济特区</h1>'+homeAtlas()+'<div class="intro-text"><p>进入特区，需要通行证。</p><p>有人可以自由穿行，有人第一次持证过关，也有人没有获得通行证的办法。</p><p>你将成为其中一员。前往自己的起点，等待其他人就位。</p></div><div class="entry-actions">'+btn('lab','流程测试台')+btn('enter',resume?(s.end?'查看上局结果':'继续试玩'):'确认参加',true)+'</div></section>';
}
const birth={
 boy:'你是一个刚刚成年的少年，需要前往香港寻找失联的家人。一位老乡会帮助你。请先找到他，避免自己的黑点暴露。',
 worker:'你是一个工人，第一次持证进深圳上工。从检查站过关后，你会获得红色身份。请先在关外找到你的老乡。你可以提供十分钟的庇护，过关后为他打掩护。',
 driver:'你是一名特区的红色出租车司机，可以自由过关。你可以走完五处检查站，每单赚二十点。也可以接两人上车，先收五十点车费。男孩抵达福田口岸交付区，你就完成了载客订单。',
 guard:'你是一名特区的联防队员。追踪地图上的黑点，查验可能藏着他的红点。抓到男孩即可获胜，查到走私货物另有奖励。'
};
const topLine='<div class="top"><b class="brand">SPECIAL ZONE</b><button class="subtle" data-act="rules">规则手册</button></div>';
function legend(){
 const items=[['driver','红色','拥有通行权，可以自由过关。'],['worker','绿色','持有通行证，尚未第一次入关。'],['boy','黑色','没有通行证，需要避免被发现。']];
 return '<section class="page stage">'+fieldToolbar()+topLine+'<h1>定位点颜色</h1><div class="legend">'+items.map(([k,n,d])=>'<div><i class="dot" style="--dot:'+roles[k].color+'"></i><span><b>'+n+'</b>　'+d+'</span></div>').join('')+'</div><div class="stage-actions">'+btn('readColors','查看我的身份',true)+'</div></section>';
}
function briefing(){
 const r=roles[s.role];
 if(s.role!=='guard'&&!s.seen[s.role])return legend();
 const actions=s.role==='driver'&&!s.job?btn('job-cargo','走私货物')+btn('job-passenger','偷渡旅客'):btn('toReady','前往起点',true);
 return '<section class="page stage">'+fieldToolbar()+topLine+'<h1 style="color:'+r.color+'">'+r.name+'</h1><div class="copy"><p>'+birth[s.role]+'</p><p>待所有成员就位，点击进入地图。</p></div><div class="stage-actions">'+actions+'</div></section>';
}
function readyView(){
 const count=Object.keys(s.ready).length,confirmed=Object.keys(s.confirmed).length,r=roles[s.role];
 let action='';
 if(!s.ready[s.role])action=btn('ready','确认到达起点',true);
 else if(count<4)action=btn('next-ready','切换到下一位试玩角色');
 action+=count===4&&!s.confirmed[s.role]?btn('start','进入地图',true):'<button disabled>进入地图</button>';
 return '<section class="page stage">'+fieldToolbar()+topLine+'<h1>等待就位</h1><p>'+r.start+'</p>'+fieldMap()+'<p id="field-read" class="notes"></p>'+'<div class="ready-line"><span>已就位 '+count+' / 4</span><span>已确认 '+confirmed+' / 4</span></div><div class="controls">'+action+'</div><p class="notes">单机试玩，依次代四人就位、确认。</p></section>';
}
function hud(){
 return '<div class="hud"><b id="clock" aria-label="剩余时间">'+time(Math.max(0,s.started+7200000-(s.finishedAt||Date.now())))+'</b><span>余额 '+s.cash[s.role]+'</span></div>';
}
function playPanel(){
 const [title,desc,actions]=nextMove(),event=title==='联防询问'||title.includes('商议入关')||title==='商量入关路线';
 const cover=s.coverSince&&['worker','boy'].includes(s.role)?'<p class="hint">身份已隐藏 · 剩余庇护时间 <b id="coverTime"></b></p>':s.role==='worker'&&s.route==='wire'?'<p class="hint">剩余庇护时间 <b id="coverTime"></b></p>':'';
 const count=(actions.match(/<button/g)||[]).length;
 const panel=count===1&&!event?'<div class="compact"><h2>'+title+'</h2>'+actions+'</div>':'<h2>'+title+'</h2>'+(event?'<p>'+desc+'</p>':'')+'<div class="controls">'+actions+'</div>';
 return panel+cover+(notice?'<div class="notes" role="status">'+notice+'</div>':'');
}
function playView(){
 return '<section class="page play">'+hud()+fieldToolbar()+fieldMap()+'<p id="field-read" class="notes"></p><section class="sheet" id="field-panel">'+playPanel()+'</section></section>';
}
function resultView(){
 const won=s.end==='抵港',boyMarker={p:coord('boy'),c:won?'#fff':roles.boy.color,me:s.role==='boy',win:won&&Date.now()-(s.wonAt||0)<1600};
 return '<section class="page play">'+hud()+fieldToolbar()+fieldMap()+'<section class="sheet summary"><h2>'+({抵港:'男孩抵达香港',被抓:'男孩被抓获',超时:'行动已超时',主动掉线:'主动掉线 · 本局结束'}[s.end]||'行动结束')+'</h2><p>男孩 · '+(s.route==='wire'?'铁丝网路线':s.route==='taxi'?'出租车路线':'尚未选路')+'，'+(s.route==='wire'&&s.phase==='inside'?'受伤':'未受伤')+'，'+(s.atPort?'已到口岸':'未到口岸')+'。</p><p>工人 · 庇护 '+time(600000-left())+'，受到 '+s.inspected+' 次盘查。</p><p>司机 · 收入 '+s.cash.driver+' 点，'+(s.driverResult||'未完成')+'。</p><p>联防 · '+(s.end==='被抓'?'抓获男孩':'未抓获男孩')+'，查获货物 '+s.seized+' 次。</p><div class="controls">'+btn('restart','再玩一局',true)+'</div></section></section>';
}
function render(){
 if(s.page==='setup')s.page='brief';
 const views={home,brief:briefing,ready:readyView,play:playView,result:resultView};
 if(document.querySelector('.home-atlas.expanded'))document.body.classList.remove('atlas-open');
 main.innerHTML=(previewOnEntry?home:(views[s.page]||home))();fieldEvents();refreshPanel();save();updateGPS();tick();
}
function show(title,content){
 if(!modal.open)remainFocus=document.activeElement;
 body.innerHTML='<h2 id="dialog-title">'+title+'</h2>'+content;if(!modal.open)modal.showModal();modal.scrollTop=0
}
function closeModal(){modal.close()}
modal.addEventListener('close',()=>{if(remainFocus?.isConnected)remainFocus.focus()});
$('close').onclick=closeModal;
function showRules(){show('规则手册','<p>1994 年，男孩想穿过深圳二线关，去香港寻找失联的家人。四个人拿着不同的地图，有各自的目的。</p><details class="info" open><summary>怎么玩这一版</summary><p>单机共用一局。依次代四名角色就位并确认进入地图。开局后在「试玩选项」里切换角色。测试台可将本机 GPS 绑定一名角色，也可点图模拟移动。计时在离开页面时继续，刷新可接着玩。</p></details><details class="info"><summary>两条路线与两次结算</summary><p>出租车合付 50 点，司机守约时男孩的黑点隐藏。铁丝网花费 30 点，必然受伤。工人的庇护共十分钟，可暂停，期间仍可能闪现。两条路都有可能被联防抓到。</p><p>男孩到达福田口岸交付区，守约司机完成订单。男孩正常通关抵港后才获胜。</p></details><details class="info"><summary>司机和联防</summary><p>司机也可选五单货运，每单 20 点。载客入关后，联防靠近会触发一次抉择。收下 50 点会暴露男孩位置。仅在关内允许追捕的区域现场确认抓获，联防才获胜。口岸查验区域停止追捕。</p></details><details class="info"><summary>定位与试玩参数</summary><p>允许定位后，可在行动记录查看本机经纬度和精度。位置仅在本机显示。实地测试使用 WGS84 坐标。测试点位与触发圈为试玩参数。五个任务站暂用编号。车费暂分男孩 20 点、工人 30 点，拒绝贿赂后本局不再询问。星级留待实测。</p></details>')}
function tick(){
 if(gpsRole&&$('field-read'))refreshPanel();
 if(s.page==='result')return;
 if(!s.started||s.end)return;const remaining=s.started+7200000-Date.now();
 if(remaining<=0){finish('超时');render();return}
 if($('clock'))$('clock').textContent=time(remaining);
 if(s.coverSince&&left()===0){stopCover();render();return}
 if($('coverTime'))$('coverTime').textContent=time(left());
 if(s.coverSince&&Date.now()>=s.flashAt+5000){s.flashAt=Date.now()+15000+Math.random()*30000;save()}
 if(s.page==='play'&&s.role==='guard'&&s.coverSince&&lastFlash!==!!isFlash()){lastFlash=!!isFlash();render()}
}
let lastFlash=false;
function boardIfReady(){if(s.driverOK&&s.boyOK&&s.workerOK&&!s.aboard){s.aboard=true;s.cash.boy-=20;s.cash.worker-=30;s.cash.driver+=50;add('乘客已上车，车费 50 点已付清。')}}
function enterTaxi(){s.phase='inside';s.workerInside=true;for(const k of ['driver','worker','boy']){s.pos[k]='inner';if(k!==gpsRole)setPoint(k,fieldSites.inner)}add('三人已入关，司机开始庇护男孩。')}
function arrivePort(){
 s.atPort=true;s.pos.boy='port';if(s.route==='taxi'&&!s.driverResult)s.driverResult='守约交付';
 add('男孩已到交付区，进入正常通关阶段。');
}
function act(id){
 if(fieldAction(id))return;
 if(targetFor(id)&&!inReach(id)){notice='请先抵达任务点。';refreshPanel();return}

 if(id==='enter'&&previewOnEntry){previewOnEntry=false;if(gpsRole&&!s.end)requestGeo();render();return}
 if(id==='atlas-play'){
   if(modal.open)closeModal();
   const dialog=$('play-atlas');dialog.innerHTML=atlasBar(true)+atlasFrame();dialog.showModal();document.body.classList.add('atlas-open');return;
 }
 if(id==='atlas-size'){
   const panel=document.querySelector('.home-atlas');
   if($('play-atlas').open||panel?.classList.contains('expanded')){closeAtlas();return}
   if(panel){panel.classList.add('expanded');document.body.classList.add('atlas-open');const b=panel.querySelector('button');b.textContent='收起地图';b.setAttribute('aria-expanded','true')}
   return;
 }
 if(id==='rules'){showRules();return}
 else if(id==='menu'){show('试玩选项','<button class="map-entry" data-act="atlas-play">查看 1994 街道简图</button>'+btn('switch','切换角色')+btn('details','定位与个人行动记录')+btn('rules','规则手册')+btn('home','回到首页'));return}
 else if(id==='home'){closeModal();s.page='home';notice=''}
 else if(id==='enter'||id==='restart'){
  if(id==='enter'&&s.started&&!s.end)s.page='play';
  else{stopGeo();gpsRole=null;gpsRecord=null;fix=null;fieldStatus='';pickPosition=false;s=fresh();s.first=roll();s.role=s.first;s.page='brief';notice=''}
  if(key===regularKey&&!gpsRole)gpsRole=s.role;
  if(gpsRole)requestGeo();
 }
 else if(id==='readColors'){s.seen[s.role]=true}
 else if(id==='toReady'){s.page='ready'}
 else if(id.startsWith('job-')&&s.page==='brief'&&s.role==='driver'){s.job=id.slice(4);s.route=s.job==='cargo'?'wire':'';s.offer=s.job==='cargo'?'declined':'pending';s.page='ready'}
 else if(id==='ready'&&s.page==='ready'){s.ready[s.role]=true}
 else if(id==='next-ready'&&s.page==='ready'){const k=Object.keys(roles).find(r=>!s.ready[r]);if(k){s.role=k;s.page='brief'}}
 else if(id.startsWith('role-')||id.startsWith('switch-')){s.role=id.split('-')[1];if(modal.open)closeModal();notice=''}
 else if(id==='start'&&s.page==='ready'&&Object.keys(s.ready).length===4){
  s.confirmed[s.role]=true;const k=Object.keys(roles).find(r=>!s.confirmed[r]);
  if(k)s.role=k;
  else{s.role=s.first;s.started=Date.now();s.page='play';add('四人已确认进入地图。')}
 }
 else if(id==='switch'){show('切换视角',roleButtons());return}
 else if(id==='details'){show('定位与行动记录','<p class="gps" id="geo"></p><p class="gps" id="coords"></p>'+(!s.end?btn('gps','重新请求定位'):'')+'<ol class="log">'+s.log.filter(t=>s.end||t.role===s.role).map(t=>'<li>'+t.line+'</li>').join('')+'</ol>');updateGPS();return}
 else if(id==='gps'){stopGeo();gpsRole=s.role;gpsRecord=null;requestGeo();updateGPS();return}
 else if(s.page!=='play'||s.end)return;
 else if(id==='meet'){s.pos[s.role]='meet';add(roles[s.role].name+'抵达碰头点。')}
 else if(id==='offer'){s.job='passenger';s.offer='pending';add('司机已发出载客邀约。')}
 else if(id==='freight'||id==='decline'){s.job='cargo';s.route='wire';s.offer='declined';add(id==='decline'?'工人婉拒邀约。司机转为货运。':'司机选择货运。男孩和工人将走铁丝网路线。')}
 else if(id==='accept'){s.offer='accepted';s.route='taxi';add('工人接受邀约，等待司机接客。')}
 else if(['driverOK','workerOK','boyOK'].includes(id)){s[id]=true;s.pos[s.role]='meet';add(roles[s.role].name+'已确认。');boardIfReady()}
 else if(id==='crossTaxi')enterTaxi();
 else if(id==='crossWire'){s.phase='inside';s.pos.boy='inner';s.cash.boy-=30;add('男孩已入关，受伤并付出 30 点。')}
 else if(id==='workerCross'){s.workerInside=true;s.pos.worker='inner';add('工人持证入关，定位转为红点。')}
 else if(id==='cover'){if(s.coverSince){stopCover();add('工人暂停庇护。')}else{s.coverSince=Date.now();s.flashAt=Date.now()+12000+Math.random()*25000;add('工人开启庇护。')}}
 else if(id==='workerDecoy'||id==='driverDecoy'){if(gpsRole===s.role){notice='请按实际路线行走。';refreshPanel();return}s.pos[s.role]=s.pos[s.role]==='decoy'?'inner':'decoy';setPoint(s.role,fieldSites[s.pos[s.role]]);add(roles[s.role].name+'已移动。')}
 else if(id==='hide'||id==='bribe'){s.bribeAsked=true;if(id==='bribe'){s.cash.driver+=50;s.cash.guard-=50;s.driverResult='出卖乘客';add('司机收下 50 点，男孩的位置已暴露。')}else add('司机隐瞒载客，庇护继续。')}
 else if(id==='deliverCargo'){s.pos.driver='cargo'+s.cargo;s.cargo++;s.cash.driver+=20;if(s.cargo===5)s.driverResult='货运达标';add('交付第 '+s.cargo+' 单货物，收入 20 点。')}
 else if(id.startsWith('inspect-')){const k=id.split('-')[1];if(apart('guard',k)>45)return;if(k==='worker'){s.inspected++;add('查到工人。'+(apart('boy','guard')<=5&&canInspect()?'男孩也在现场。':'此次盘查落空。'))}else if(s.job==='cargo'&&s.cargo<5){if(s.lastSeized!==s.cargo){s.seized++;s.lastSeized=s.cargo;add('查获一批游戏货物，记入附加成绩。')}else add('本批货物已查验。')}else add('查到司机。'+(s.aboard&&s.phase==='inside'&&!s.bribeAsked?'切换司机视角作出答复。':'未查获货物。'))}
 else if(id==='catch'&&canInspect()&&apart('guard','boy')<=5){s.pos.guard=s.pos.boy;finish('被抓')}
 else if(id==='port')arrivePort();
 else if(id==='hk'&&s.atPort)finish('抵港');
 render()
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)act(b.dataset.act)});
setInterval(tick,1000);render();
