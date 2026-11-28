'use strict';
const query=new URLSearchParams(window.location.search);
const embedded=query.get('embed')==='1'&&window.parent!==window;
if(embedded){
  document.body.classList.add('embedded');
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('info').open)window.parent.postMessage('atlas-close',location.origin)});
}
const elem = id => document.getElementById(id);
// WGS84 playtest envelope. The northern strip includes the outside-gate starts.
const playBounds=L.latLngBounds([22.510,114.009],[22.604,114.076]);
const map=L.map('map',{maxBounds:playBounds,maxBoundsViscosity:1,maxZoom:19,zoomSnap:.25,zoomDelta:1,
  bounceAtZoomLimits:false,wheelPxPerZoomLevel:90,attributionControl:true});
map.attributionControl.setPrefix(false);
const osmAttribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
// At overview scale a rectangular map can leave margins on a different-shaped screen.
// Clip all geographic layers together, keeping controls outside the clip.
function frameMap(){
  const nw=map.latLngToLayerPoint(playBounds.getNorthWest()),se=map.latLngToLayerPoint(playBounds.getSouthEast());
  map.getPane('mapPane').style.clipPath='polygon('+nw.x+'px '+nw.y+'px,'+se.x+'px '+nw.y+'px,'+
    se.x+'px '+se.y+'px,'+nw.x+'px '+se.y+'px)';
}
function fitLimit(){
  // Use the projection independently of the previous minimum after a resize.
  const extent=map.project(playBounds.getSouthEast(),0).subtract(map.project(playBounds.getNorthWest(),0));
  const size=map.getSize();
  return Math.min(19,Math.max(0,Math.floor(4*Math.log2(Math.min(size.x/extent.x,size.y/extent.y)))/4));
}
map.setMinZoom(fitLimit());
map.on('move zoom viewreset',frameMap);
map.on('resize',()=>{map.setMinZoom(fitLimit());map.panInsideBounds(playBounds,{animate:false});frameMap()});
const frame=L.rectangle(playBounds,{color:'#777',weight:1,fill:false,interactive:false}).addTo(map);
const walking=createWalkingMap(map);
L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  bounds:playBounds,noWrap:true,keepBuffer:1,maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',
  attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
});
const modernPoints=L.layerGroup();
for(const [name,at] of [['福田口岸 · 交付点',[22.518425,114.064321]],['梅林关站',[22.597202306,114.048275806]]]){
  L.marker(at,{title:name,alt:name,icon:L.divIcon({className:'sq',iconSize:[9,9],iconAnchor:[4.5,4.5]})})
    .bindTooltip(name,{direction:'right',className:'landmark-name'}).bindPopup(name).addTo(modernPoints);
}
let streetMode=false, tileIssue=false, accuracy=null, dot=null, watch=null, latest=null, follow=false;
function updateState(message){elem('state').textContent=message}
function focusArea(area){
  follow=false;map.closePopup();
  if(area==='all')map.setView(playBounds.getCenter(),map.getMinZoom(),{animate:false});
  else {
    const views={pass:[22.5960,114.0452],center:[22.5418,114.0465],reservoir:[22.5740,114.031],port:[22.5227,114.0633]};
    map.setView(views[area]||views.port,area==='pass'?16:15,{animate:false});
  }
  elem('area').value='';
}
function walkStatus(){
  if(streetMode)return;
  elem('walk-key').dataset.detail=String(map.getZoom()>=15);
  if(map.getZoom()===map.getMinZoom()){updateState('试玩范围 · 北至梅林关外，南至深圳河口岸一带。');return}
  if(!walking.covers(map.getCenter())){updateState('此处在简图采录范围外，可切换今日街图。');return}
  const z=map.getZoom();
  updateState(z<15?'放大查看街巷与山径。':z<16?'梅林山地浅线为等高线，短虚线为现地山径。':'点路段可对照今名。');
}
function layerMode(on){
  streetMode=on;map.closePopup();
  if(on){walking.disable();modernPoints.addTo(map);map.attributionControl.removeAttribution(osmAttribution);tileIssue=false;streets.addTo(map);updateState('正在加载街道图…')}
  else{streets.remove();modernPoints.remove();walking.enable();map.attributionControl.addAttribution(osmAttribution);walkStatus()}
  map.fire('basemapchange');
  elem('walk-key').hidden=on;
  elem('simple').setAttribute('aria-pressed',String(!on));elem('street').setAttribute('aria-pressed',String(on));
}
streets.on('loading',()=>{tileIssue=false});
streets.on('tileerror',()=>{tileIssue=true;if(streetMode){updateState('部分图块未载入，可切回 1994 简图。')}});
streets.on('load',()=>{if(streetMode&&!tileIssue){updateState('街道图 · OpenStreetMap')}});
elem('street').onclick=()=>{if(streetMode)streets.remove();layerMode(true)};
elem('simple').onclick=()=>{if(streetMode)layerMode(false)};
elem('area').onchange=e=>focusArea(e.target.value);
map.on('moveend',walkStatus);
map.on('dragstart',()=>{follow=false});
function displayFix(position){
  latest=position.coords;
  const point=L.latLng(latest.latitude,latest.longitude);
  if(!playBounds.contains(point)){
    if(dot){dot.remove();accuracy.remove();dot=null}
    updateState('当前位置在试玩范围外，可继续浏览地图。');return;
  }
  if(!dot){
    accuracy=L.circle(point,{radius:latest.accuracy,color:'#333',weight:1,fillColor:'#333',fillOpacity:.06,interactive:false}).addTo(map);
    dot=L.circleMarker(point,{radius:6,color:'#fff',weight:2,fillColor:'#111',fillOpacity:1}).bindTooltip('我的位置').addTo(map);
  }else{accuracy.setLatLng(point).setRadius(latest.accuracy);dot.setLatLng(point)}
  if(follow)map.setView(point,Math.max(16,map.getZoom()),{animate:false});
  updateState('定位精度约 ±'+Math.round(latest.accuracy)+' 米'+(!streetMode&&!walking.covers(point)?' · 当前位置在步行简图范围外，可切换今日街图。':''));
}
function stopWatch(){if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null}}
function locate(){
  if(!navigator.geolocation){updateState('此浏览器未提供定位，可继续浏览地图。');return}
  follow=true;
  if(watch!==null&&latest){displayFix({coords:latest});return}
  if(watch!==null)return;
  updateState('正在获取手机位置…');
  watch=navigator.geolocation.watchPosition(displayFix,error=>{
    stopWatch();latest=null;
    updateState(error.code===1?'定位权限未开启，可在浏览器中允许后再点「我的位置」。':'暂时无法取得位置，可重试。');
  },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
}
elem('locate').onclick=locate;
window.addEventListener('pagehide',stopWatch);
elem('about').onclick=()=>elem('info').showModal();
elem('closeInfo').onclick=()=>elem('info').close();
{
  new ResizeObserver(()=>map.invalidateSize({pan:true,debounceMoveend:true})).observe(elem('map'));
}
if(embedded){focusArea('all');layerMode(false)}
else if(query.get('layer')==='street'){focusArea('all');layerMode(true)}
else {focusArea(query.get('area')||'all');layerMode(false)}
if(embedded&&query.has('live'))mountLiveMap();
else if(embedded&&query.has('field')){
 const layer=L.layerGroup().addTo(map);let picking=false,self=null;
 function send(type,extra={}){parent.postMessage({type,...extra},location.origin)}
 elem('locate').textContent='角色位置';
 elem('locate').onclick=()=>{if(self&&playBounds.contains(self))map.setView(self,Math.max(16,map.getZoom()));else updateState('当前角色在范围外或正在等待定位。')};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='field')return;
  const data=e.data;picking=data.pick;layer.clearLayers();self=null;
  if(data.gateLine){
   const [lat,lon]=data.gateLine;
   L.polyline([[lat,lon-.00040],[lat,lon+.00040]],{color:'#333',weight:2,dashArray:'6 4',interactive:false}).addTo(layer);
  }
  for(const [p,label] of data.targets){
   L.circle(p,{radius:45,color:'#555',weight:1,dashArray:'4 4',fillOpacity:.05,interactive:false}).addTo(layer);
   L.marker(p,{icon:L.divIcon({className:'sq',iconSize:[8,8]})}).bindTooltip(label,{permanent:true,direction:'top'}).addTo(layer);
  }
  for(const a of data.actors){
   if(a.own){self=a.p;if(a.acc)L.circle(a.p,{radius:a.acc,stroke:false,fillOpacity:.12,color:a.color,interactive:false}).addTo(layer)}
   const marker=L.circleMarker(a.p,{radius:a.own?7:5,color:a.own?'#fff':a.color,weight:2.5,fillColor:a.color,fillOpacity:1}).addTo(layer);
   if(a.label){const label=document.createElement('span');label.textContent=a.label;marker.bindTooltip(label)}
  }
  if(data.focus&&self&&playBounds.contains(self))map.setView(self,Math.max(15,map.getZoom()),{animate:false});
  if(picking)updateState(picking==='rendezvous'?'轻点关内地点，与男孩约定碰头位置。':picking==='verify'?'点选你实际站立的参照位置。':'轻点地图，为当前角色放置模拟坐标。');
 });
 map.on('click',e=>{if(picking&&playBounds.contains(e.latlng))send('field-pick',{p:[e.latlng.lat,e.latlng.lng]})});
 send('field-ready');
}

// Keep the two narrative boundaries above both basemaps and below the player markers.
const borderPane=map.createPane('borderLines');
borderPane.style.zIndex='410';borderPane.style.pointerEvents='none';
const borderRenderer=L.svg({pane:'borderLines',padding:.25});
const borders=[
 {title:'二线关 · 约略走向',sides:['关外','关内'],lines:[secondLine],south:false},
 {title:'深港分界 · 旧河道示意',sides:['深圳','香港'],lines:[streetMode?portBoundary:historicalPortLine],south:true}
];
for(const border of borders){
 const style={pane:'borderLines',renderer:borderRenderer,interactive:false,lineCap:'butt',lineJoin:'round',opacity:1};
 border.strokes=[];
 function stroke(options){border.strokes.push(L.polyline(border.lines,{...style,...options}).addTo(map))}
 stroke({color:'white',weight:8});
 stroke({color:border.south?'#343637':'#211f1d',weight:border.south?5.5:4.5});
 if(border.south)stroke({color:'white',weight:1.7});
 border.label=L.tooltip({permanent:true,interactive:false,direction:'top',offset:[0,-5],opacity:1,
  className:'border-caption'+(border.south?' south':'')}).setContent(border.sides[0]+' · '+border.title);
 border.lower=L.tooltip({permanent:true,interactive:false,direction:'bottom',offset:[0,4],opacity:1,className:'border-side'}).setContent(border.sides[1]);
}
function labelBorders(){
 const size=map.getSize();
 for(const border of borders){
  const target=L.point(size.x*.45,size.y*.52);let best=null,score=Infinity;
  for(const line of border.lines){
   for(let i=1;i<line.length;i++){
    const a=map.latLngToContainerPoint(line[i-1]),b=map.latLngToContainerPoint(line[i]);
    const p=L.LineUtil.closestPointOnSegment(target,a,b);
    if(p.x<85||p.x>size.x-85||p.y<27||p.y>size.y-15)continue;
    const dist=p.distanceTo(target);if(dist<score){best=p;score=dist}
   }
  }
  if(best){
   const anchor=map.containerPointToLatLng(best);
   border.label.setLatLng(anchor).addTo(map);
   border.lower.setLatLng(anchor).addTo(map);
  }else{border.label.remove();border.lower.remove()}
 }
}
function switchBorder(){
 const border=borders[1];
 border.lines=[streetMode?portBoundary:historicalPortLine];
 for(const stroke of border.strokes)stroke.setLatLngs(border.lines);
 border.label.setContent(streetMode?'深圳 · 深港分界（今日）':'深圳 · 深港分界（旧河道示意）');
 labelBorders();
}
map.on('basemapchange',switchBorder);
map.on('moveend zoomend resize',labelBorders);switchBorder();
