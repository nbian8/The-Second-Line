// Local OpenMapTiles context in z14 tile coordinates (4096 units per tile).
function createAtlasContext(bounds){
 const sourceZ=14,cache=new Map();
 const paint={
  wood:[0,'#eeeeee'],water:[0,'#e1e5e7'],block:[16.5,'#e6e6e6'],
  trunk:[0,'#c2c2c2',1.25],major:[0,'#bbbbbb',1.05],street:[12,'#c9c9c9',.95],
  lane:[14,'#cecece',.85],foot:[15,'#a6a6a6',.9]
 };
 function load(x,y){
  const id=x+'-'+y;
  if(!cache.has(id))cache.set(id,fetch('./atlas-data/'+id+'.json').then(r=>{
   if(!r.ok)throw Error('Map tile unavailable');return r.json()
  }).catch(err=>{cache.delete(id);throw err}));
  return cache.get(id)
 }
 const Context=L.GridLayer.extend({
  createTile(coords,done){
   const tile=document.createElement('canvas'),dpr=Math.min(devicePixelRatio||1,2);
   tile.width=tile.height=256*dpr;
   const ctx=tile.getContext('2d'),ratio=2**(coords.z-sourceZ);
   const west=coords.x/ratio,north=coords.y/ratio,east=(coords.x+1)/ratio,south=(coords.y+1)/ratio;
   const jobs=[];
   for(let x=Math.max(13380,Math.floor(west));x<=Math.min(13383,Math.ceil(east)-1);x++){
    for(let y=Math.max(7135,Math.floor(north));y<=Math.min(7140,Math.ceil(south)-1);y++){
     jobs.push(load(x,y).then(features=>{
      const scale=ratio/16;
      ctx.save();ctx.scale(dpr,dpr);ctx.translate((x-west)*ratio*256,(y-north)*ratio*256);ctx.scale(scale,scale);
      ctx.beginPath();ctx.rect(0,0,4096,4096);ctx.clip();ctx.lineCap='round';ctx.lineJoin='round';
      for(const [kind,box,parts] of features){
       const [min,color,width]=paint[kind];
       if(coords.z<min||box[2]<(west-x)*4096||box[0]>(east-x)*4096||box[3]<(north-y)*4096||box[1]>(south-y)*4096)continue;
       ctx.beginPath();
       for(const flat of parts){ctx.moveTo(flat[0],flat[1]);for(let i=2;i<flat.length;i+=2)ctx.lineTo(flat[i],flat[i+1]);if(!width)ctx.closePath()}
       if(width){ctx.strokeStyle=color;ctx.lineWidth=width/scale;ctx.stroke()}else{ctx.fillStyle=color;ctx.fill('evenodd')}
      }
      ctx.restore()
     }))
    }
   }
   Promise.all(jobs).then(()=>done(null,tile),err=>done(err,tile));return tile
  }
 });
 return new Context({bounds,noWrap:true,maxZoom:19,keepBuffer:1,attribution:'<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">OpenMapTiles</a>'})
}
