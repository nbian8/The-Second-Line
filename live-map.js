// Dedicated in-game controls. The standalone atlas and local rehearsal use their own controls.
function mountLiveMap(){
 const panel=document.querySelector('.map-panel'), toolbar=document.createElement('div');
 document.body.classList.add('live-map');
 toolbar.className='map-tools';
 const layers=document.createElement('button'),locate=elem('locate');
 locate.classList.remove('primary');
 const locateLabel=document.createElement('span');
 locate.innerHTML='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m20 4-6.5 16-2.7-6.8L4 10.5 20 4Z"/></svg>';
 locate.append(locateLabel);locateLabel.textContent='我的位置';
 layers.innerHTML='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5"/></svg><span>图层</span>';layers.setAttribute('aria-expanded','false');
 toolbar.append(layers,locate);document.body.append(toolbar);
 layers.onclick=()=>{const open=panel.classList.toggle('shown');layers.setAttribute('aria-expanded',String(open))};
 const cross=document.createElement('span');cross.className='crosshair';cross.hidden=true;document.body.append(cross);
 const tracks=new Map(),targets=L.layerGroup().addTo(map);let targetKey='',data={},radius=null,last=0;
 let topInset=70,bottomInset=125;
 function send(type,extra={}){parent.postMessage({type,...extra},location.origin)}
 locate.onclick=()=>{
  const people=data.actors||[];
  if(data.staff){const pts=people.filter(a=>playBounds.contains(a.p)).map(a=>a.p);if(pts.length)map.fitBounds(L.latLngBounds(pts),{paddingTopLeft:[30,topInset+52],paddingBottomRight:[30,bottomInset+88],maxZoom:16});else focusArea('all')}
  else {const me=people.find(a=>a.own);if(me&&playBounds.contains(me.p))map.setView(me.p,Math.max(16,map.getZoom()));else send('map-note',{text:'当前位置在范围外或仍在等待定位'})}
 };
 function paint(){
  const now=(data.now||Date.now())+Date.now()-last,seen=new Set(),counts={};
  for(const a of data.actors||[]){
   const stale=now-a.time>20000;
   if(data.guard&&!a.own&&(stale||Date.now()-last>5500))continue;
   const group=a.own?'self':a.label||a.color;
   const key=group+':'+(counts[group]=(counts[group]||0)+1);seen.add(key);
   let marker=tracks.get(key);
   if(!marker){marker=L.circleMarker(a.p,{radius:a.own?8:6,weight:2.5}).addTo(map);tracks.set(key,marker);
    if(a.label){const title=document.createElement('span');marker.bindTooltip(title);if(data.staff)marker.on('click',()=>send('inspect-player',{label:a.label}))}}
   if(!marker.getLatLng().equals(a.p))marker.setLatLng(a.p);
   marker.setStyle({color:a.own&&!stale?'#fff':a.color,fillColor:stale?'#fff':a.color,fillOpacity:stale?.65:1,dashArray:stale?'3 2':null});
   if(a.label)marker.getTooltip().getContent().textContent=a.label+(stale?' · '+Math.floor((now-a.time)/1000)+' 秒前':'');
   if(a.own&&a.acc){if(!radius)radius=L.circle(a.p,{interactive:false,stroke:false,color:a.color,fillOpacity:.09}).addTo(map);radius.setLatLng(a.p).setRadius(a.acc)}
  }
  for(const [k,m] of tracks)if(!seen.has(k)){m.remove();tracks.delete(k)}
  if(radius&&!data.actors?.some(a=>a.own&&a.acc)){radius.remove();radius=null}
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent)return;
  if(e.data?.type==='map-insets'){
   topInset=e.data.top;bottomInset=e.data.bottom;
   document.body.style.setProperty('--sheet-space',bottomInset+'px');
   document.body.style.setProperty('--top-space',topInset+'px');return
  }
  if(e.data?.type==='pin-submit'&&!cross.hidden){const c=map.getCenter();send('field-pick',{p:[c.lat,c.lng]});return}
  if(e.data?.type!=='field')return;
  data=e.data;last=Date.now();cross.hidden=!data.pick;locateLabel.textContent=data.staff?'查看全员':'我的位置';
  const key=JSON.stringify(data.targets);
  if(key!==targetKey){targetKey=key;targets.clearLayers();for(const [p,label] of data.targets){
   L.circle(p,{radius:45,interactive:false,color:'#555',weight:1,fillOpacity:.04}).addTo(targets);
   L.marker(p,{icon:L.divIcon({className:'sq',iconSize:[8,8]})}).bindTooltip(label,{permanent:true,direction:'top'}).addTo(targets)
  }}
  paint();if(data.focus&&!data.pick)locate.onclick()
 });
 setInterval(paint,1000);send('field-ready')
}
