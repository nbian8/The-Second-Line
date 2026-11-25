// WGS84 label anchors identify areas. They do not identify the door of a former building.
const historicPlaces = [
  {name:'交付点', at:[22.518425,114.064321], kind:'task', zoom:12,
    note:'游戏交付区在今天的福田口岸查验区外。福田口岸于 2007 年开通。'},
  {name:'皇岗口岸', at:[22.5236,114.0696], kind:'port', zoom:13,
    note:'皇岗口岸片区。1989 年启用货检，1991 年启用旅检。'},
  {name:'梅林检查站', at:[22.5968,114.0468], kind:'port', zoom:12,
    note:'此处标示关口一带。1994 年已有梅林检查站编制批复，站区于 1995 年建成投用。'},
  {name:'皇岗村', at:[22.52920,114.05529], kind:'village', zoom:13,
    note:'旧皇岗村包括上围、下围和吉龙三个自然村。'},
  {name:'渔农村', at:[22.51906,114.06753], kind:'village', zoom:14,
    note:'深圳河畔的旧村。1990 年的市政府公报以渔农村和落马洲大桥标示福田南部的位置。'},
  {name:'深圳河', at:[22.5131,114.0654], kind:'land', zoom:13,
    note:'深港之间的河流。近景河道线取自今天的地图，河曲曾经整治。'},
  {name:'民乐村', at:[22.60074,114.04613], kind:'village', zoom:14,
    note:'梅林关以北的村落，图上标示村落所在一带。'},
  {name:'岗厦村', at:[22.54014,114.06531], kind:'village', zoom:13,
    note:'福田中心区建设前的村落。'},
  {name:'莲花山', at:[22.55613,114.05432], kind:'land', zoom:13,
    note:'山体是辨认福田中部方位的地标，莲花路沿山脚一带展开。'},
  {name:'梅林水库', at:[22.5770,114.0245], kind:'land', zoom:13,
    note:'1994 年由上、下马泻水库扩建并更名。此处采用更名后的称呼。'},
  {name:'下梅林', at:[22.5650,114.0332], kind:'village', zoom:14,
    note:'下梅林村一带，水库位于北侧。'},
  {name:'水围村', at:[22.52475,114.05796], kind:'village', zoom:14,
    note:'福田南部的旧村落，图上标示村落所在一带。'}
];
const historicStreets = new Set(['深南大道','新洲路','莲花路','香梅路','福强路']);
