// Local playtest diagram. These are diagram units, not geographic coordinates.
const sites = {
 boy:[142,142], worker:[241,126], driver:[359,248], guard:[475,220],
 meet:[237,155], gate:[275,218], gap:[184,190], inner:[306,242],
 decoy:[439,223], port:[405,294], hk:[447,325],
 cargo:[[85,157],[157,177],[275,218],[409,197],[544,166]]
};
const outline='M18 136 Q37 145 51 160L64 177 69 194 81 202Q90 209 84 216L69 225 67 240 59 247 62 262 50 273Q44 288 59 283L78 274 92 258 109 255 116 245 129 248 139 238 148 236 153 225 170 222 181 225 193 222 204 229 216 225 224 232 229 247 244 250 256 245 264 248 260 259 267 266 282 264 295 250 307 248 319 257 309 268 314 281 305 289 311 303 302 315Q298 326 316 324L335 315 351 313 365 304 376 298 385 298 396 292 405 294 411 283 426 285 436 278 452 280 466 274 481 277 496 267 503 257 516 257 529 247 520 237 530 230 545 230 557 224 566 212 580 205 588 192 604 186 616 175 637 170 661 156';
const boundary='M22 149 L41 154 55 148 65 146 74 151 85 157 95 158 105 169 114 169 119 178 135 180 146 175 157 177 172 181 184 190 198 190 212 199 224 202 229 214 241 218 253 214 266 216 275 218 290 217 299 208 311 208 320 200 333 197 346 200 362 195 375 196 386 191 395 196 409 197 420 199 426 213 440 215 455 211 465 202 477 193 484 178 498 177 505 171 520 172 531 167 544 166 553 171 566 163 580 161 589 151 600 145 608 131 621 127 635 111 647 106 658 93';
function task(p,label,offset=18){return '<g transform="translate('+p.join(' ')+')"><rect class="task" x="-4.5" y="-4.5" width="9" height="9"/><text text-anchor="middle" y="'+offset+'">'+label+'</text></g>'}
function drawChart(markers=[],mode='play'){
 const basemap='<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="'+outline+'" stroke="#707070" stroke-width="1.4"/><path d="'+boundary+'" stroke="#151515" stroke-width="3.7"/></g>';
 const stations=mode==='ready'?'':sites.cargo.map((p,i)=>task(p,'站'+['一','二','三','四','五'][i],i%2===0?-13:24)).join('')+task(sites.port,'交付点',25);
 const dots=markers.map(m=>m.task?task(m.p,m.task,m.offset):'<g transform="translate('+m.p.join(' ')+')">'+(m.me?'<circle r="12" fill="none" stroke="'+m.c+'" stroke-width="1.6"/>':'')+'<circle '+(m.win?'class="win-dot" ':'')+'r="6.6" fill="'+m.c+'" stroke="'+(m.win?'#111':'#fafafa')+'" stroke-width="1.3"/></g>').join('');
 return '<div class="chartwrap"><svg class="chart" viewBox="0 55 680 295" preserveAspectRatio="xMidYMid meet" role="img" aria-label="二线关游戏示意图，自身定位点有外环">'+basemap+stations+dots+'</svg></div>';
}
