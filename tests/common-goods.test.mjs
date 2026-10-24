import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupCommonGoods } from '../common-goods.mjs';
import { categoryStores } from '../public/maps.mjs';
import { planPurchaseRoute } from '../purchasing.mjs';
import { validateAgentInput, parseAgentAnswer } from '../agent.mjs';

test('葡挞返回参考价区间与钜记等饼家', () => {
  const [item] = lookupCommonGoods('葡挞');
  assert.equal(item.id, 'egg-tart');
  assert.deepEqual(item.price_range, { min: 8, max: 12, currency: 'MOP' });
  assert.equal(item.typicalPrice, 10);
  assert.ok(item.shops.some((shop) => shop.includes('钜记')));
  assert.equal(item.kind, 'editorial_reference');
});

test('英文与别名均可命中，未知商品不返回参考价', () => {
  assert.equal(lookupCommonGoods('egg tart')[0]?.id, 'egg-tart');
  assert.equal(lookupCommonGoods('蛋挞')[0]?.id, 'egg-tart');
  assert.deepEqual(lookupCommonGoods('费列罗'), []);
});

test('品类映射到建议门店', () => {
  assert.deepEqual(categoryStores('巧克力').map((s) => s.id), ['venetian', 'senado', 'taipa-village']);
  assert.deepEqual(categoryStores('美妆').map((s) => s.id).sort(), ['cdf', 'city-of-dreams', 'four-seasons', 'galaxy', 'mgm-macau', 'parisian', 'studio-city', 'venetian', 'wynn-macau', 'yaohan']);
  assert.deepEqual(categoryStores('随便').map((s) => s.id), []);
});

test('建议到店点单独返回并由路线规划器排序', () => {
  const plan = planPurchaseRoute([
    { item: '费列罗', channel: 'suggested', store_id: 'yaohan' },
    { item: '葡挞', channel: 'unresolved', store_id: '' },
  ], '', 'walking');
  assert.equal(plan.route, null);
  assert.deepEqual(plan.suggested_stops.map((s) => s.store_id), ['yaohan']);
  assert.deepEqual(plan.suggested_stops[0].items, ['费列罗']);
  assert.deepEqual(plan.suggested_route.stops.map((s) => s.store_id), ['yaohan']);
  assert.deepEqual(plan.unresolved_items, ['葡挞']);
});

test('用户输入控制字符被清理，纯控制字符消息被拒', () => {
  assert.equal(validateAgentInput({ message: '你好\u0000\u0007世界', language: 'zh' }).message, '你好世界');
  assert.throws(() => validateAgentInput({ message: '\u0000\u0001', language: 'zh' }), /INVALID_AGENT_REQUEST/);
});

test('答案中的 HTML 与脚本仍被拒绝', () => {
  const part = { answer: 'ok', considerations: [], next_steps: [], question: '' };
  assert.throws(() => parseAgentAnswer(JSON.stringify({ zh: { ...part, answer: '<img src=x onerror=1>' }, en: part, source_ids: [], product_ids: [] }), []), /INVALID_AGENT_RESULT/);
});
