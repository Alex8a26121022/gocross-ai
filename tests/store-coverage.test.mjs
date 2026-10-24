import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stores, categoryStores, counters, brandCounters, buyingSpots, distanceKm, shoppingRoute } from '../public/maps.mjs';
import { runAgent } from '../agent.mjs';

test('verified destination coverage includes all required malls and keeps beauty alternatives distinct', () => {
  for (const id of ['galaxy', 'wynn-macau', 'mgm-macau', 'city-of-dreams', 'parisian', 'studio-city', 'yaohan', 'cdf', 'senado', 'taipa-village', 'venetian', 'four-seasons']) {
    const store = stores.find(store => store.id === id);
    assert.ok(store && store.region && store.district && store.addressEn);
    assert.match(store.source, /^https:\/\//); assert.ok(store.lat > 22 && store.lat < 22.3 && store.lon > 113.5 && store.lon < 113.6);
  }
  const beauty = categoryStores('美妆'); assert.equal(beauty.length, 10);
  assert.equal(new Set(beauty.map(store => store.id)).size, 10);
  assert.equal(categoryStores('beauty').length, 10);
});
test('seven beauty brands have dated official counter evidence; unverified K23 is not asserted', () => {
  assert.equal(Object.keys(counters).length, 7);
  for (const brand of Object.values(counters)) for (const location of brand.locations) {
    assert.match(location.source, /^https:\/\//); assert.equal(location.as_of, '2026-10-19'); assert.ok(stores.some(store => store.id === location.storeId));
  }
  assert.equal(brandCounters('雅诗兰黛面霜').find(counter => counter.storeId === 'four-seasons').unit, '1101/20-21 & 30V');
  assert.equal(brandCounters('La Mer cream').find(counter => counter.storeId === 'venetian').unit, '950b');
  assert.ok(!brandCounters('雅诗兰黛').some(counter => counter.unit === 'K23'));
});
test('buying options cover four or more destinations while route choices are sorted by origin distance', () => {
  const origin = stores.find(store => store.id === 'venetian');
  const options = buyingSpots('雅诗兰黛面霜', '美妆', origin.name);
  assert.ok(options.length >= 4); assert.ok(options.some(store => store.id === 'venetian')); assert.ok(options.some(store => store.id === 'four-seasons'));
  assert.deepEqual(options.slice(0, 3).map(store => store.id), [...categoryStores('美妆')].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b)).slice(0, 3).map(store => store.id));
  const route = shoppingRoute(origin, ['galaxy', 'mgm-macau', 'city-of-dreams']); assert.equal(route.stops.length, 3);
  assert.throws(() => shoppingRoute(origin, ['galaxy', 'mgm-macau', 'city-of-dreams', 'parisian']));
});
test('agent store suggestions expose region/district and specific verified counters without inventing units', async () => {
  let sawOptions = false;
  await runAgent({ message: '雅诗兰黛面霜在哪买', language: 'zh' }, { key: 'test', fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    const tool = body.messages.find(message => message.role === 'tool');
    if (!tool) return { ok: true, json: async () => ({ choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{ id: 'spots', type: 'function', function: { name: 'suggest_buying_spots', arguments: JSON.stringify({ items: [{ item: '雅诗兰黛面霜', category: '美妆' }], origin: '' }) } }] } }] }) };
    const data = JSON.parse(tool.content); const stores = data.suggestions[0].stores;
    assert.ok(stores.length >= 4 && stores.every(store => store.region && store.district));
    assert.equal(stores.find(store => store.store_id === 'four-seasons').counters[0].unit, '1101/20-21 & 30V'); sawOptions = true;
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: body.response_format ? JSON.stringify({ zh: { answer: '可选择四季名店、新八佰伴、中免及威尼斯人购物中心。' }, en: { answer: 'Buying options include Four Seasons, New Yaohan, cdf and Venetian.' } }) : 'READY' } }] }) };
  } });
  assert.ok(sawOptions);
});
