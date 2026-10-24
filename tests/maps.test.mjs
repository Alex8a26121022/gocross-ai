import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stores, parseOrigin, distanceKm, nearbyStores, routeUrl, mapEmbedUrl, mapStopsEmbedUrl } from '../public/maps.mjs';

test('经纬度严格校验，允许已收录地点名，不把任意地址猜成坐标', () => {
  assert.deepEqual(parseOrigin('22.19,113.54'), { lat: 22.19, lon: 113.54 });
  assert.equal(parseOrigin('新八佰伴').id, 'yaohan');
  for (const value of ['', '90.1,113', '22,181', '22,', '未知酒店']) assert.equal(parseOrigin(value), null);
});
test('最近地点按球面直线距离排序，不伪造实际路程或时间', () => {
  assert.equal(distanceKm(stores[0], stores[0]), 0);
  const nearby = nearbyStores({ lat: 22.1909, lon: 113.5404 });
  assert.equal(nearby[0].id, 'yaohan'); assert.ok(nearby[0].distance < 0.01);
  assert.equal(nearbyStores(null)[0].distance, null);
  assert.throws(() => distanceKm({ lat: NaN, lon: 113 }, stores[0]));
});
test('免费路线 URL 保留文字或 GPS 起点、终点与出行方式，不需要 key', () => {
  const gps = new URL(routeUrl({ lat: 22.2, lon: 113.5 }, stores[0], 'transit'));
  assert.equal(gps.hostname, 'www.google.com'); assert.equal(gps.searchParams.get('api'), '1');
  assert.equal(gps.searchParams.get('origin'), '22.2,113.5'); assert.equal(gps.searchParams.get('travelmode'), 'transit');
  assert.ok(gps.searchParams.get('destination').includes('上葡京')); assert.equal(gps.searchParams.has('key'), false);
  assert.equal(new URL(routeUrl('澳门关闸 & 酒店', stores[0])).searchParams.get('origin'), '澳门关闸 & 酒店');
  assert.equal(new URL(routeUrl(null, stores[0])).searchParams.has('origin'), false);
  assert.throws(() => routeUrl(null, stores[0], 'invalid'));
});
test('嵌入地图只使用门店坐标，定位数据不发送给地图 iframe', () => {
  const url = new URL(mapEmbedUrl(stores[0]));
  assert.equal(url.hostname, 'www.openstreetmap.org');
  assert.equal(url.searchParams.get('marker'), `${stores[0].lat},${stores[0].lon}`);
  assert.equal(url.searchParams.has('origin'), false);
});
test('多站地图范围覆盖真实到店地点，拒绝未知和重复门店', () => {
  const url = new URL(mapStopsEmbedUrl(['cdf', 'yaohan']));
  const [west, south, east, north] = url.searchParams.get('bbox').split(',').map(Number);
  for (const store of stores.filter((s) => ['cdf', 'yaohan'].includes(s.id))) assert.ok(store.lon > west && store.lon < east && store.lat > south && store.lat < north);
  assert.equal(url.searchParams.get('marker'), `${stores[0].lat},${stores[0].lon}`);
  for (const ids of [[], ['unknown'], ['cdf', 'cdf'], null]) assert.throws(() => mapStopsEmbedUrl(ids), /INVALID_ROUTE/);
});
