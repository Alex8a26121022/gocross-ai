// 门店地址、WGS84 坐标来自澳门旅游局页面内的公开地点资料（2026-10-19）。
// 目的地到「商场/商圈」级：确认该场内有相关品牌门店即可作为采购目的地，不承诺具体铺位与库存。
export const stores = [
  { id: 'cdf', region: '路氹', district: '路氹城', name: 'cdf 澳门上葡京店', en: 'cdf Grand Lisboa Palace', address: '澳门路氹射击路上葡京综合度假村一楼', addressEn: 'Level 1, Grand Lisboa Palace, Rua do Tiro, Cotai, Macau', lat: 22.14410206169343, lon: 113.57398191122883, categories: ['美妆', '香水', '酒类'], source: 'https://www.macaotourism.gov.mo/zh-hans/shopping/shopping-malls/cdf' },
  { id: 'yaohan', region: '澳门半岛', district: '大堂区', name: '新八佰伴百货公司', en: 'New Yaohan', address: '澳门苏亚利斯博士大马路90号', addressEn: '90 Avenida Doutor Mário Soares, Macau', lat: 22.190916, lon: 113.540414, categories: ['百货', '美妆', '食品'], source: 'https://www.macaotourism.gov.mo/zh-hans/shopping/shopping-malls/new-yaohan-department-store' },
  { id: 'four-seasons', region: '路氹', district: '路氹城', name: '四季名店', en: 'Shoppes at Four Seasons', address: '澳门路氹金光大道四季酒店', addressEn: 'Four Seasons Hotel, Cotai Strip, Macau', lat: 22.146236, lon: 113.561917, categories: ['奢侈品', '美妆'], source: 'https://www.macaotourism.gov.mo/zh-hans/shopping/shopping-malls/shoppes-at-four-seasons' },
  { id: 'venetian', region: '路氹', district: '路氹城', name: '威尼斯人购物中心', en: 'Shoppes at Venetian', address: '澳门路氹连贯公路威尼斯人度假村', addressEn: 'The Venetian Macao, Estrada da Baía de N. Senhora da Esperança, Cotai, Macau', lat: 22.148158299263272, lon: 113.56122052724322, categories: ['美妆', '百货', '食品', '手信'], source: 'https://www.macaotourism.gov.mo/en/shopping/shopping-malls/shoppes-at-venetian' },
  { id: 'senado', region: '澳门半岛', district: '大堂区', name: '新马路手信商圈', en: 'Senado Square souvenir area', address: '澳门新马路至议事亭前地一带（钜记、咀香园等）', addressEn: 'Avenida de Almeida Ribeiro to Senado Square, Macau', lat: 22.19359974600576, lon: 113.53978116677166, categories: ['手信', '食品'], source: 'https://www.macaotourism.gov.mo/en/sightseeing/macao-world-heritage/senado-square' },
  { id: 'taipa-village', region: '氹仔', district: '嘉模堂区', name: '氹仔官也街', en: 'Rua do Cunha, Taipa Village', address: '澳门氹仔官也街一带（饼家、手信与小吃）', addressEn: 'Rua do Cunha, Taipa Village, Macau', lat: 22.152998, lon: 113.55716299999995, categories: ['手信', '食品'], source: 'https://www.macaotourism.gov.mo/zh-hant/sightseeing/other-attractions/rua-do-cunha', coordinateSource: 'https://www.taipavillagemacau.com/tc/directory/cunha-street/', coordinateAnchor: 'Rua do Cunha map point published by Taipa Village Destination Ltd.' },
  { id: 'galaxy', region: '路氹', district: '路氹城', name: '澳门银河时尚汇', en: 'Galaxy Promenade', address: '澳门路氹澳门银河综合度假城', addressEn: 'Galaxy Macau, Cotai, Macau', lat: 22.14868361462274, lon: 113.55466372845342, categories: ['美妆', '香水', '奢侈品', '百货'], source: 'https://www.macaotourism.gov.mo/en/shopping/shopping-malls/galaxy-promenade' },
  { id: 'wynn-macau', region: '澳门半岛', district: '大堂区', name: '永利澳门名店购物区', en: 'Wynn Esplanade, Wynn Macau', address: '澳门外港填海区仙德丽街永利澳门', addressEn: 'Wynn Macau, Rua Cidade de Sintra, NAPE, Macau', lat: 22.188096959683335, lon: 113.54689579603047, categories: ['美妆', '香水', '奢侈品'], source: 'https://www.wynnresortsmacau.com/en/wynn-macau/shops', coordinateSource: 'https://www.macaotourism.gov.mo/en/shopping/shopping-malls/wynn-esplanade' },
  { id: 'mgm-macau', region: '澳门半岛', district: '大堂区', name: '澳门美高梅购物区', en: 'MGM Macau shopping', address: '澳门孙逸仙大马路1101号澳门美高梅', addressEn: 'MGM Macau, 1101 Avenida Dr. Sun Yat-Sen, Macau', lat: 22.18597317465273, lon: 113.54811709965043, categories: ['美妆', '香水', '奢侈品'], source: 'https://www.mgm.mo/en/macau/retail', coordinateSource: 'https://www.macaotourism.gov.mo/en/accommodation/mgm-macau' },
  { id: 'city-of-dreams', region: '路氹', district: '路氹城', name: '新濠天地购物区', en: 'City of Dreams shopping', address: '澳门路氹连贯公路新濠天地', addressEn: 'City of Dreams, Estrada do Istmo, Cotai, Macau', lat: 22.14922792787968, lon: 113.5664623874195, categories: ['美妆', '香水', '奢侈品', '百货'], source: 'https://www.macaotourism.gov.mo/en/shopping/shopping-malls/city-of-dreams-designer-brand-shopping-experience' },
  { id: 'parisian', region: '路氹', district: '路氹城', name: '巴黎人购物中心', en: 'Shoppes at Parisian', address: '澳门路氹连贯公路巴黎人度假村', addressEn: 'The Parisian Macao, Estrada do Istmo, Lote 3, Cotai, Macau', lat: 22.143694111133556, lon: 113.56084576007936, categories: ['美妆', '香水', '百货', '食品'], source: 'https://www.parisianmacao.com/shopping/directory/cosmetics-and-skincare.html', coordinateSource: 'https://www.macaotourism.gov.mo/en/accommodation/the-parisian-macao' },
  { id: 'studio-city', region: '路氹', district: '路氹城', name: '新濠影汇购物区', en: 'Studio City shopping', address: '澳门路氹连贯公路新濠影汇', addressEn: 'Studio City, Estrada do Istmo, Cotai, Macau', lat: 22.141096420640707, lon: 113.56052500023799, categories: ['美妆', '奢侈品', '百货'], source: 'https://www.macaotourism.gov.mo/en/shopping/shopping-malls/studio-city-diverse-shopping-experience' },
];

// 品类→门店映射：只用于「建议到店点」，不代表库存或实际价格。
const categoryGroups = [
  { label: '美妆', words: ['美妆', '化妆品', '护肤', '香水', '彩妆', '口红', '面霜', '精华', '面膜', '防晒', 'beauty', 'cosmetics', 'skincare', 'cream', 'perfume'], stores: ['cdf', 'yaohan', 'four-seasons', 'venetian', 'galaxy', 'wynn-macau', 'mgm-macau', 'city-of-dreams', 'parisian', 'studio-city'] },
  { label: '食品', words: ['食品', '零食', '巧克力', '糖果', '手信', '饼', '蛋挞', '葡挞', '肉干', '糕点', '小吃', '饼干'], stores: ['venetian', 'taipa-village', 'senado'] },
  { label: '酒类', words: ['酒', '葡萄酒', '洋酒', '威士忌'], stores: ['cdf', 'venetian'] },
  { label: '奢侈品', words: ['奢侈', '名牌', '手袋', '腕表', '钟表'], stores: ['four-seasons', 'venetian'] },
];

export function categoryStores(category) {
  const text = String(category || '').toLowerCase();
  const ids = new Set();
  for (const group of categoryGroups) if (group.words.some((word) => text.includes(word))) group.stores.forEach((id) => ids.add(id));
  return stores.filter((store) => ids.has(store.id));
}

const sandsBeauty = 'https://www.venetianmacao.com/shopping/shoppes/cosmetics-and-skincare.html';
const cdfBrands = 'https://www.grandlisboapalace.com/en/shops/cdf-macau-grand-lisboa-palace-shop';
const counter = (storeId, unit, floor, source = sandsBeauty, kind = 'counter') => Object.freeze({ storeId, unit, floor, source, kind, as_of: '2026-10-19' });
export const counters = Object.freeze({
  'estee-lauder': Object.freeze({ name: 'Estée Lauder', aliases: ['雅诗兰黛', '雅詩蘭黛', 'esteelauder'], locations: [counter('four-seasons', '1101/20-21 & 30V', 'L1'), counter('yaohan', null, 'G/F', 'https://www.newyaohan.com/zh-hk/shop/632'), counter('cdf', null, 'L1', cdfBrands, 'brand_at_retailer')] }),
  lancome: Object.freeze({ name: 'Lancôme', aliases: ['兰蔻', '蘭蔻', 'lancome'], locations: [counter('four-seasons', '1101/28', 'L1'), counter('cdf', null, 'L1', cdfBrands, 'brand_at_retailer')] }),
  'sk-ii': Object.freeze({ name: 'SK-II', aliases: ['skii', 'sk2'], locations: [counter('four-seasons', '1101/27', 'L1')] }),
  'la-mer': Object.freeze({ name: 'La Mer', aliases: ['海蓝之谜', '海藍之謎', 'lamer'], locations: [counter('four-seasons', '1101/22', 'L1'), counter('venetian', '950b', 'L3'), counter('cdf', null, 'L1', cdfBrands, 'brand_at_retailer')] }),
  'helena-rubinstein': Object.freeze({ name: 'Helena Rubinstein', aliases: ['赫莲娜', '赫蓮娜', 'helenarubinstein', 'hr'], locations: [counter('venetian', '951a', 'L3'), counter('four-seasons', '1101/30d', 'L1'), counter('cdf', null, 'L1', cdfBrands, 'brand_at_retailer')] }),
  dior: Object.freeze({ name: 'Dior', aliases: ['迪奥', '迪奧', 'dior'], locations: [counter('four-seasons', '1101/C01', 'L1'), counter('venetian', '961', 'L3')] }),
  chanel: Object.freeze({ name: 'Chanel', aliases: ['香奈儿', '香奈兒', 'chanel'], locations: [counter('four-seasons', '1101/29', 'L1'), counter('venetian', '006', 'L3'), counter('wynn-macau', null, null, 'https://www.wynnresortsmacau.com/en/wynn-macau/shops')] }),
});
const brandKey = text => String(text || '').normalize('NFKD').replace(/[\u0300-\u036f\s-]/g, '').toLowerCase();
export function brandCounters(item) {
  const key = brandKey(item);
  return Object.values(counters).filter(brand => brand.aliases.some(alias => alias === 'hr' ? /\bhr\b/i.test(String(item)) : key.includes(brandKey(alias)))).flatMap(brand => brand.locations.map(location => ({ ...location, brand: brand.name })));
}

export function buyingSpots(item, category, origin = '') {
  const verified = brandCounters(item), point = parseOrigin(origin);
  const candidates = new Map(categoryStores(category).map(store => [store.id, store]));
  for (const entry of verified) { const store = stores.find(store => store.id === entry.storeId); if (store) candidates.set(store.id, store); }
  return [...candidates.values()].map(store => ({ ...store, counters: verified.filter(entry => entry.storeId === store.id), distance: point ? distanceKm(point, store) : null })).sort((a, b) => point ? a.distance - b.distance : Number(Boolean(b.counters.length)) - Number(Boolean(a.counters.length)));
}

export function validPoint(point) {
  return Boolean(point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180);
}
export function parseOrigin(text) {
  const parts = text.trim().split(/[,，]/);
  if (parts.length === 2 && parts.every((part) => part.trim() !== '' && /^-?\d+(?:\.\d+)?$/.test(part.trim()))) {
    const point = { lat: Number(parts[0]), lon: Number(parts[1]) };
    return validPoint(point) ? point : null;
  }
  return stores.find((store) => [store.name, store.en, store.address].some((name) => text.trim() && name.toLowerCase().includes(text.trim().toLowerCase()))) || null;
}
export function distanceKm(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new Error('INVALID_COORDINATES');
  const rad = (degrees) => degrees * Math.PI / 180;
  const dlat = rad(b.lat - a.lat), dlon = rad(b.lon - a.lon);
  const value = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}
export function nearbyStores(origin) {
  return stores.map((store) => ({ ...store, distance: validPoint(origin) ? distanceKm(origin, store) : null })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
}
export function routeUrl(origin, store, mode = 'walking') {
  if (!validPoint(store) || !['walking', 'transit', 'driving'].includes(mode)) throw new Error('INVALID_ROUTE');
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({ api: '1', destination: `${store.name} ${store.address}`, travelmode: mode });
  if (validPoint(origin)) url.searchParams.set('origin', `${origin.lat},${origin.lon}`);
  else if (typeof origin === 'string' && origin.trim()) url.searchParams.set('origin', origin.trim().slice(0, 180));
  return url.href;
}
// 高德 URI：大陆可直接打开；坐标按 WGS84 传入，由高德自行换算。
const amapMode = { walking: 'walk', transit: 'bus', driving: 'car' };
export function amapRouteUrl(origin, store, mode = 'walking') {
  if (!validPoint(store) || !['walking', 'transit', 'driving'].includes(mode)) throw new Error('INVALID_ROUTE');
  if (!validPoint(origin)) return amapMarkerUrl(store);
  const url = new URL('https://uri.amap.com/navigation');
  url.search = new URLSearchParams({ from: `${origin.lon},${origin.lat},起点`, to: `${store.lon},${store.lat},${store.name}`, mode: amapMode[mode], coordinate: 'wgs84', callnative: '1', src: 'gocross' });
  return url.href;
}
export function amapMarkerUrl(store) {
  if (!validPoint(store)) throw new Error('INVALID_COORDINATES');
  const url = new URL('https://uri.amap.com/marker');
  url.search = new URLSearchParams({ position: `${store.lon},${store.lat}`, name: `${store.name} ${store.address}`, coordinate: 'wgs84', callnative: '1', src: 'gocross' });
  return url.href;
}
export function mapEmbedUrl(store) {
  if (!validPoint(store)) throw new Error('INVALID_COORDINATES');
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.search = new URLSearchParams({ bbox: `${store.lon - 0.008},${store.lat - 0.006},${store.lon + 0.008},${store.lat + 0.006}`, layer: 'mapnik', marker: `${store.lat},${store.lon}` });
  return url.href;
}

export function mapStopsEmbedUrl(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 3 || new Set(ids).size !== ids.length || !ids.every((id) => stores.some((s) => s.id === id))) throw new Error('INVALID_ROUTE');
  const points = ids.map((id) => stores.find((s) => s.id === id));
  const url = new URL(mapEmbedUrl(points[0]));
  url.searchParams.set('bbox', `${Math.min(...points.map((s) => s.lon)) - 0.006},${Math.min(...points.map((s) => s.lat)) - 0.006},${Math.max(...points.map((s) => s.lon)) + 0.006},${Math.max(...points.map((s) => s.lat)) + 0.006}`);
  return url.href;
}

export function shoppingRoute(origin, storeIds, mode = 'walking') {
  if (!Array.isArray(storeIds) || storeIds.length < 1 || storeIds.length > 3 || new Set(storeIds).size !== storeIds.length || !storeIds.every((id) => stores.some((s) => s.id === id)) || !['walking', 'transit', 'driving'].includes(mode)) throw new Error('INVALID_ROUTE');
  const point = typeof origin === 'string' ? parseOrigin(origin) : validPoint(origin) ? origin : null;
  let stops = storeIds.map((id) => stores.find((s) => s.id === id));
  // A route contains at most three stops; enumerate their straight-line orders.
  const permutations = (items) => items.length < 2 ? [items] : items.flatMap((item) => permutations(items.filter((s) => s.id !== item.id)).map((rest) => [item, ...rest]));
  if (point) {
    const length = (items) => items.reduce((sum, item, index) => sum + distanceKm(index ? items[index - 1] : point, item), 0);
    stops = permutations(stops).sort((a, b) => length(a) - length(b))[0];
  }
  const url = new URL(routeUrl(point || origin, stops.at(-1), mode));
  // Google Maps URLs do not support transit waypoints; provide each leg instead.
  if (stops.length > 1 && mode !== 'transit') url.searchParams.set('waypoints', stops.slice(0, -1).map((s) => `${s.lat},${s.lon}`).join('|'));
  return { stops, orderBasis: point ? 'straight_line' : 'requested_order', url: mode === 'transit' && stops.length > 1 ? null : url.href, legs: stops.map((store, i) => ({ from: i ? stops[i - 1].id : 'origin', to: store.id, url: routeUrl(i ? stops[i - 1] : point || origin, store, mode) })) };
}
