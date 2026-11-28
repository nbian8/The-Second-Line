const roles=['boy','worker','driver','guard'];
const titles={boy:'男孩',worker:'工人',driver:'出租车司机',guard:'联防队员',admin:'管理员',observer:'观察席',waiting:'等待分配'};
const colors={boy:'#202020',worker:'#197847',driver:'#ae3532',guard:'#244877'};
const sites={meet:[22.5999,114.0464],gap:[22.5940,114.0449],gate:[22.5968,114.0468],port:[22.518425,114.064321],hk:[22.511,114.0656]};
const cargo=[[22.5914,114.0483],[22.566,114.037],[22.555,114.05],[22.5401,114.0653],[22.5292,114.0553]];
const start={boy:'民乐村 · A 点',worker:'民乐村 · B 点',driver:'梅林关附近 · 关内',guard:'水围村 · 水围文化广场'};
const labels={begin:'开始游戏',meet:'我们已到碰头点',wire:'走铁丝网',taxi:'找司机',accept:'接单',decline:'拒绝载客',freight:'选择货运',board:'确认上车',taxiCross:'确认同车过关',pin:'约定关内碰头点',wireCross:'支付 30 元，确认通过',workerCross:'持证入关',reunite:'已和男孩会合',cover:'开启庇护',pause:'暂停庇护',deliver:'到站交货',bribe:'收下 50 元，承认载客',hide:'拒绝，隐瞒载客',catch:'现场确认抓获',review:'申请裁判复核',approve:'确认抓获',dismiss:'驳回复核',port:'到达交付区',hk:'确认抵港',inspect:'盘查附近红点'};
export const newRoom=()=>({members:[],started:0,end:'',route:'',job:'',met:{},boarded:{},inside:{driver:true,guard:true},money:{boy:30,worker:70,driver:0,guard:0},cover:1200000,since:0,cargo:0,log:[],seq:0});
const member=(s,r)=>s.members.find(m=>m.role===r);
const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
const dist=(a,b)=>Math.hypot((a[0]-b[0])*111195,(a[1]-b[1])*102700);
const fresh=(m,t)=>m?.fix&&t-m.fix.time<=20000&&m.fix.acc<=50;
function near(s,r,p,t,d=45){let m=member(s,r);return fresh(m,t)&&p&&dist(m.fix.p,p)<=d}
function together(s,a,b,t,d){const m=member(s,b);return fresh(m,t)&&near(s,a,m.fix.p,t,d)}
const remaining=(s,t)=>Math.max(0,s.cover-(s.since?t-s.since:0));
function note(s,line,t){s.log.unshift({line,t});s.log.length=Math.min(45,s.log.length)}
function finish(s,end,t){s.cover=remaining(s,t);s.since=0;s.end=end;if(s.job==='passenger'&&!s.result)s.result='订单失败';note(s,end,t)}
function arrive(s,t){s.atPort=true;if(s.job==='passenger'&&!s.result)s.result='守约送达';note(s,'男孩抵达交付区，停止追捕',t)}
function tick(s,t){
 if(!s.started||s.end)return;
 if(t>=s.started+7200000){finish(s,'超时',t);return}
 if(s.since&&!remaining(s,t)){s.since=0;s.cover=0}
 if(s.since&&t>s.flash+5000)s.flash=t+30000+Math.random()*60000;
 if(s.inside.boy&&(s.route!=='wire'||s.reunited)&&!s.atPort&&near(s,'boy',sites.port,t))arrive(s,t);
 if(s.atPort&&near(s,'boy',sites.hk,t))finish(s,'抵港',t);
 if(s.job==='passenger'&&s.inside.boy&&!s.atPort&&!s.result&&!s.answered&&together(s,'driver','guard',t,1000))s.offer=true;
}
function task(s,r,t){
 const A=(text,...actions)=>({text,actions});
 if(s.end)return A('主线结束 · '+s.end);
 if(!s.started)return A(start[r]?'你的起点在'+start[r]+'，等待管理员开局。':'等待分配角色');
 if(r==='guard'){
  if(s.atPort)return A('正式查验区域内停止追捕');
  const acts=[];
  if(['driver','worker'].some(k=>s.inside[k]&&together(s,r,k,t,45)))acts.push('inspect');
  if(s.inside.boy)acts.push(together(s,r,'boy',t,5)?'catch':s.review?'':'review');
  return A(s.review?'抓捕复核已提交':'巡查关内，红点不显示身份',...acts.filter(Boolean));
 }
 if(r==='driver'){
  if(s.result)return A('个人结算 · '+s.result);
  if(s.job==='cargo')return A('货运检查站 '+(s.cargo+1)+' / 5','deliver');
  if(s.route==='request')return A('工人与男孩请求乘车','accept','decline');
  if(s.route!=='taxi')return A('等待乘车请求，或前往货运检查站','freight');
 }
 if(['boy','worker'].includes(r)&&!s.met[r])return A(r==='boy'?'去民乐村找老乡':'到民乐村碰头点等男孩','meet');
 if(['boy','worker'].includes(r)&&(!s.met.boy||!s.met.worker))return A('等待老乡确认会合');
 if(!s.route)return r==='worker'?A(s.refused?'司机无法接单，商量铁丝网路线':'和男孩商量怎么过关','wire',...(!s.refused?['taxi']:[])):A('和工人商量怎么过关，由工人确认');
 if(s.route==='request')return A('已向司机发出乘车请求');
 if(s.route==='taxi'&&!s.inside.boy){
  if(!s.boarded[r])return A('到碰头点，三人确认上车','board');
  return r==='driver'&&roles.slice(0,3).every(k=>s.boarded[k])?A('已收车费，到梅林关确认过关','taxiCross'):A('等待同车入关');
 }
 if(r==='driver')return s.offer&&!s.answered?A('联防靠近，你是否承认载过两人？','hide','bribe'):A('守约期间，男孩的位置保持隐藏');
 if(s.route==='wire'){
  if(!s.pin)return r==='worker'?A('先商量关内在哪儿再见，点地图约地点','pin'):A('先和工人约好关内碰头点');
  let change=r==='worker'&&!s.reunited?['pin']:[];
  if(!s.inside[r])return r==='boy'?A('跟随工人指引，到游戏点通过，受伤后可能暴露','wireCross'):A('指引男孩后，从检查站持证入关','workerCross',...change);
  if(!s.reunited)return r==='worker'&&s.inside.boy?A('去约定地点，见到男孩后确认','reunite',...change):A('去约定地点等老乡',...change);
 }
 if(r==='worker')return A(s.atPort?'男孩已到交付区':'陪男孩走一段，或分头掩护',...(s.injured&&!s.atPort&&remaining(s,t)>0?[s.since?'pause':'cover']:[]));
 return s.atPort?A('正常通关，定位确认抵港','hk'):A('前往福田口岸查验区外的交付点','port');
}
function check(ok,msg){if(!ok)throw Error(msg)}
export function command(s,m,a,b,t){
 tick(s,t);
 const r=m.role;
 if(a==='fix'){
  check(roles.includes(r)&&!s.end&&valid(b.p)&&Number.isFinite(b.acc)&&b.acc>=0&&Number.isFinite(b.time),'定位无效');
  if(b.time>=t-20000&&(!m.fix||b.time>m.fix.time))m.fix={p:b.p,acc:b.acc,time:Math.min(t,b.time)};
  tick(s,t);return;
 }
 if(a==='assign'){
  check(r==='admin'&&!s.started,'无法分配');const chosen=b.ids;
  const players=s.members.filter(x=>roles.includes(x.role)||x.role==='waiting');
  check(Array.isArray(chosen)&&chosen.length===4&&players.every(x=>chosen.includes(x.id))&&chosen.filter(Boolean).length===players.length&&chosen.every(id=>id===''||players.some(x=>x.id===id)),'请为每位在场玩家分配一个不同角色');
  roles.forEach((role,i)=>{if(chosen[i])players.find(x=>x.id===chosen[i]).role=role});return;
 }
 if(a==='begin'){
  check(r==='admin'&&!s.started,'仅管理员可开启待命中的房间');
  check(!s.members.some(x=>x.role==='waiting'),'请先给已进房的玩家分配角色');
  const missing=roles.filter(role=>!member(s,role));
  check(!missing.length||JSON.stringify(b.confirmMissing)===JSON.stringify(missing),'请重新确认本局空缺的角色');
  s.started=t;note(s,missing.length?'提前开局 · 空缺：'+missing.map(role=>titles[role]).join('、'):'游戏开始',t);return;
 }
 if(r==='admin'&&s.started&&!s.end&&s.review&&['approve','dismiss'].includes(a)){s.review=false;if(a==='approve'&&!s.atPort)finish(s,'被抓获',t);return}
 check(roles.includes(r)&&s.started&&!s.end&&task(s,r,t).actions.includes(a),'事件已更新，请查看当前任务');
 function reach(p){check(near(s,r,p,t),'请到达目标附近并刷新定位')}
 switch(a){
 case 'meet':reach(sites.meet);s.met[r]=true;break;
 case 'taxi':if(s.job==='cargo'){s.refused=true}else s.route='request';break;
 case 'wire':s.route='wire';break;
 case 'accept':s.job='passenger';s.route='taxi';break;
 case 'decline':s.route='';s.refused=true;break;
 case 'freight':s.job='cargo';break;
 case 'deliver':reach(cargo[s.cargo]);s.cargo++;s.money.driver+=20;if(s.cargo===5)s.result='货运达标';break;
 case 'board':reach(sites.meet);s.boarded[r]=true;if(roles.slice(0,3).every(k=>s.boarded[k])){s.money.boy-=20;s.money.worker-=30;s.money.driver+=50}break;
 case 'taxiCross':reach(sites.gate);s.inside.boy=s.inside.worker=true;break;
 case 'pin':check(valid(b.p)&&b.p[0]>=22.52&&b.p[0]<=22.595&&b.p[1]>=114.009&&b.p[1]<=114.076,'请选择关内的碰头地点');s.pin=b.p;break;
 case 'wireCross':reach(sites.gap);s.money.boy-=30;s.injured=true;s.inside.boy=true;break;
 case 'workerCross':reach(sites.gate);s.inside.worker=true;break;
 case 'reunite':reach(s.pin);check(near(s,'boy',s.pin,t),'等待男孩到约定地点并刷新定位');s.reunited=true;break;
 case 'cover':s.since=t;s.flash=t+30000+Math.random()*60000;break;
 case 'pause':s.cover=remaining(s,t);s.since=0;break;
 case 'bribe':s.money.driver+=50;s.result='出卖乘客';case 'hide':s.answered=true;break;
 case 'catch':finish(s,'被抓获',t);break;
 case 'review':s.review=true;break;
 case 'inspect':{
 const k=['worker','driver'].filter(k=>s.inside[k]&&together(s,r,k,t,45)).sort((a,b)=>dist(m.fix.p,member(s,a).fix.p)-dist(m.fix.p,member(s,b).fix.p))[0];
 m.feedback=k==='driver'&&s.job==='cargo'&&!s.result?'查获货物':'盘查落空';if(m.feedback==='查获货物'&&s.seized!==s.cargo){s.seized=s.cargo;s.seizures=(s.seizures||0)+1}break}
 case 'port':reach(sites.port);arrive(s,t);break;
 case 'hk':reach(sites.hk);finish(s,'抵港',t);break;
 }
 note(s,titles[r]+' · '+(a==='wireCross'?'通过铁丝网，受伤':labels[a]),t);
}
export function snapshot(s,m,t){
 const r=m.role,staff=['admin','observer'].includes(r),pair=['boy','worker'].includes(r),active=roles.includes(r);
 const vulnerable=s.inside.boy&&!s.atPort&&(s.route==='wire'?(!remaining(s,t)||!s.since||t>=s.flash&&t<s.flash+5000):s.result==='出卖乘客');
 const actors=s.members.filter(x=>x.fix&&roles.includes(x.role)&&(staff||x===m||s.started&&(r==='driver'||r==='worker'&&s.route==='taxi'&&x.role==='driver'||r==='guard'&&s.inside[x.role]&&(x.role!=='boy'||vulnerable)))).map(x=>({p:x.fix.p,acc:x.fix.acc,time:x.fix.time,own:x===m,color:colors[x.role==='worker'&&s.inside.worker?'driver':x.role],label:staff?x.name+' · '+titles[x.role]:x===m?'我':''}));
 let targets=[],q=active?task(s,r,t):{text:'',actions:[]};
 if(s.started&&!s.end&&active){
 if((pair&&!s.met[r])||(s.route==='taxi'&&!s.inside.boy&&!s.boarded[r]))targets.push([sites.meet,'关外碰头点']);
 if(pair&&s.route==='wire'&&s.pin&&!s.reunited)targets.push([s.pin,'关内约定地点']);
 if(r==='worker'&&s.route==='wire'&&!s.inside.boy)targets.push([sites.gap,'破洞 · 游戏点']);
 if(q.actions.includes('taxiCross')||q.actions.includes('workerCross'))targets.push([sites.gate,'检查站']);
 if(q.actions.includes('deliver'))targets.push([cargo[s.cargo],'货运检查站']);
 if(q.actions.includes('hk')||q.actions.includes('port'))targets.push(s.atPort?[sites.hk,'抵港确认区']:[sites.port,'交付区']);
 }
 return {role:r,title:titles[r],started:s.started,end:s.end,now:t,actors,targets,task:q.text,actions:q.actions.map(a=>[a,labels[a]]),money:s.money[r],injured:(pair||staff)&&!!s.injured,shield:((pair||staff)&&s.reunited)?remaining(s,t):null,covering:!!s.since&&(pair||staff),result:r==='driver'||staff?s.result:null,feedback:m.feedback,review:staff&&s.review,roster:staff?s.members.filter(x=>roles.includes(x.role)||x.role==='waiting').map(x=>({name:x.name,id:x.id,role:x.role,status:roles.includes(x.role)?task(s,x.role,t).text:'待分配',last:x.fix?.time,acc:x.fix?.acc})):undefined,log:staff?s.log:undefined};
}
export {tick,roles};
