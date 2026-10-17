// 门店地址、WGS84 坐标来自澳门旅游局页面内的公开地点资料（2026-10-15）。
export const stores = [
  { id: 'cdf', name: 'cdf 澳门上葡京店', en: 'cdf Grand Lisboa Palace', address: '澳门路氹射击路上葡京综合度假村一楼', lat: 22.14410206169343, lon: 113.57398191122883, source: 'https://www.macaotourism.gov.mo/zh-hans/shopping/shopping-malls/cdf' },
  { id: 'yaohan', name: '新八佰伴百货公司', en: 'New Yaohan', address: '澳门苏亚利斯博士大马路90号', lat: 22.190916, lon: 113.540414, source: 'https://www.macaotourism.gov.mo/zh-hans/shopping/shopping-malls/new-yaohan-department-store' },
  { id: 'four-seasons', name: '四季名店', en: 'Shoppes at Four Seasons', address: '澳门路氹金光大道四季酒店', lat: 22.146236, lon: 113.561917, source: 'https://www.macaotourism.gov.mo/zh-hans/shopping/shopping-malls/shoppes-at-four-seasons' },
];

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
export function mapEmbedUrl(store) {
  if (!validPoint(store)) throw new Error('INVALID_COORDINATES');
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.search = new URLSearchParams({ bbox: `${store.lon - 0.008},${store.lat - 0.006},${store.lon + 0.008},${store.lat + 0.006}`, layer: 'mapnik', marker: `${store.lat},${store.lon}` });
  return url.href;
}
