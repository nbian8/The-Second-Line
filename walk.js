'use strict';
function createWalkingMap(map) {
  const shapes=L.layerGroup(), labels=L.layerGroup();
  const canvas=L.canvas({padding:.3,tolerance:5});
  const areas=walkNetwork.bounds.map(([w,s,e,n])=>L.latLngBounds([s,w],[n,e]));
  const makePath=([kind,name,points])=>({kind,name,points,bounds:L.latLngBounds(points)});
  const streets=walkNetwork.ways.map(makePath);
  const terrain=landscape.map(makePath);
  const relief=hillsideContext.map(([kind,points])=>makePath([kind,'',points]));
  const firstZoom={express:12.5,avenue:13,street:14,lane:15.5,greenway:15};
  function drawHills(bounds,z){
    for(const p of relief){
      if(!bounds.intersects(p.bounds))continue;
      const contour=typeof p.kind==='number',index=contour&&p.kind%100===0;
      const minZoom=contour?(index?12.5:p.kind%50===0?14:15.5):14;
      if(z<minZoom)continue;
      const trail=p.kind==='trail';
      const line=L.polyline(p.points,{renderer:canvas,interactive:trail,color:contour?(index?'#b7b0a5':'#cbc5bb'):(trail?'#796f62':'#8a979b'),
        weight:contour?(index?1.15:.8):1.35,opacity:Math.min(1,.55+(z-minZoom)*.35),dashArray:trail?'3 3':undefined,smoothFactor:.55});
      if(trail)line.on('click',e=>popup(e.latlng,'山径','现地采录的路径，通行情况需现场确认。'));
      line.addTo(shapes);
    }
  }
  const modernTypes={express:'机动车干道',avenue:'主要街道',street:'街道',lane:'支路',greenway:'自行车道',walk:'人行通道',steps:'台阶',bridge:'人行桥',tunnel:'人行地下通道',crosswalk:'过街通道'};
  const styles={
    road:['#777',2],express:['#ccc',1.5],avenue:['#b6b6b6',1.6],street:['#bebebe',1.1],lane:['#ccc',.9],
    walk:['#494949',1.55],steps:['#424242',2.5,'1 3'],greenway:['#999',1.4,'4 3'],bridge:['#333',2.2],
    tunnel:['#555',1.7,'4 3'],crosswalk:['#333',2.4,'1 3'],patrol:['#373737',2.7,'7 3 1 3'],river:['#999',3]
  };
  let active=false;
  function popup(at,title,note){
    const card=document.createElement('div'),head=document.createElement('strong'),body=document.createElement('div');
    head.textContent=title;body.textContent=note;card.className='map-note';card.append(head,body);
    L.popup({closeButton:true,autoPan:false,maxWidth:235}).setLatLng(at).setContent(card).openOn(map);
  }
  function stroke(path,type,z,title,note){
    const [color,width,dashArray]=styles[type];
    L.polyline(path.points,{renderer:canvas,color,weight:width*(z>=17?1.16:1),dashArray,lineCap:dashArray?'butt':'round'})
      .on('click',e=>popup(e.latlng,title,note)).addTo(shapes);
  }
  function onScreenSegment(path,size){
    const pts=path.points.map(p=>map.latLngToContainerPoint(p));
    let best=null;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],mid=a.add(b).divideBy(2),length=a.distanceTo(b);
      if(mid.x<35||mid.x>size.x-35||mid.y<25||mid.y>size.y-30||length<4)continue;
      if(best&&length<=best.length)continue;
      let angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
      if(angle>90)angle-=180;
      if(angle< -90)angle+=180;
      best={mid,length,angle};
    }
    return best;
  }
  function paint(){
    if(!active)return;
    shapes.clearLayers();labels.clearLayers();
    const z=map.getZoom(),size=map.getSize(),bounds=map.getBounds().pad(.12);
    if(z<12)return;
    const choices=[],occupied=[],used=new Set();
    function reserve(at,w,h){
      const b=L.bounds([at.x-w/2-4,at.y-h/2-3],[at.x+w/2+4,at.y+h/2+3]);
      if(occupied.some(other=>other.intersects(b)))return false;
      occupied.push(b);return true;
    }
    drawHills(bounds,z);
    for(const path of terrain){
      if(!bounds.intersects(path.bounds))continue;
      if(path.kind==='lake'){
        L.polygon(path.points,{renderer:canvas,interactive:false,color:'#aaa',weight:1,fillColor:'#dfdfdf',fillOpacity:.65}).addTo(shapes);
      }else if(path.kind==='river'&&z>=13){
        stroke(path,'river',z,'深圳河','河道线供今天现场辨向。');
      }
    }
    const visible=streets.filter(path=>bounds.intersects(path.bounds));
    // Draw present-day streets first. Pedestrian links stay readable above them.
    for(const path of visible){
      if(!(path.kind in firstZoom)||z<firstZoom[path.kind])continue;
      stroke(path,path.kind,z,path.name?'今名 · '+path.name:'现地街道',modernTypes[path.kind]+' · 街道方位参照');
    }
    for(const path of visible){
      if(!historicStreets.has(path.name)||!['street','avenue','express'].includes(path.kind))continue;
      stroke(path,'road',z,path.name,'历史街名 · 图中路段沿现地走向概绘。');
      const candidate=onScreenSegment(path,size);
      if(candidate)choices.push({...candidate,name:path.name});
    }
    if(z>=15)for(const path of visible){
      if(z<16 && ['crosswalk','steps'].includes(path.kind))continue;
      if(['walk','bridge','tunnel','steps','crosswalk'].includes(path.kind)){
        stroke(path,path.kind,z,modernTypes[path.kind],path.name?'今名 · '+path.name:'现地步行参照');
      }
    }
    for(const path of terrain){
      if(path.kind!=='patrol'||!bounds.intersects(path.bounds))continue;
      stroke(path,'patrol',z,'二线巡逻道','管理线走向示意。现地路名为「'+path.name+'」。');
      const candidate=onScreenSegment(path,size);
      if(candidate)choices.push({...candidate,name:'二线巡逻道',priority:1});
    }
    for(const place of historicPlaces){
      if(z<place.zoom||!bounds.contains(place.at))continue;
      const pos=map.latLngToContainerPoint(place.at),width=place.name.length*17+14;
      if(pos.x<0||pos.x>size.x||pos.y<0||pos.y>size.y)continue;
      if(!reserve(pos,width,26))continue;
      const el=document.createElement('span');el.className='atlas-name '+place.kind;el.textContent=place.name;
      L.marker(place.at,{title:place.name,alt:place.name,zIndexOffset:500,
        icon:L.divIcon({className:'atlas-anchor',iconSize:[width,36],iconAnchor:[width/2,18],html:el})})
        .on('click',()=>popup(place.at,place.name,place.note)).addTo(labels);
    }
    for(const c of choices.sort((a,b)=>(b.priority||0)-(a.priority||0)||b.length-a.length)){
      if(used.has(c.name))continue;
      const len=c.name.length*12+10,rad=c.angle*Math.PI/180;
      if(!reserve(c.mid,Math.abs(len*Math.cos(rad))+Math.abs(15*Math.sin(rad)),Math.abs(len*Math.sin(rad))+Math.abs(15*Math.cos(rad))))continue;
      used.add(c.name);
      const tag=document.createElement('span');tag.className='street-letters';tag.textContent=c.name;
      tag.style.transform='translate(-50%,-50%) rotate('+c.angle+'deg)';
      L.marker(map.containerPointToLatLng(c.mid),{interactive:false,keyboard:false,
        icon:L.divIcon({className:'walk-label',iconSize:[0,0],html:tag})}).addTo(labels);
    }
  }
  return {
    covers(point){return areas.some(b=>b.contains(point))},
    enable(){if(active)return;active=true;shapes.addTo(map);labels.addTo(map);map.on('moveend resize',paint);paint()},
    disable(){active=false;map.off('moveend resize',paint);shapes.remove();labels.remove();shapes.clearLayers();labels.clearLayers()}
  };
}
