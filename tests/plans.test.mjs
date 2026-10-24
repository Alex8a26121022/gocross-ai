import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planQuantity, planTotals, planSnapshot, planItemText } from '../public/plans.mjs';

const products = [
  { id: 'a', name: 'Cream', specification: '50ml', quote: { amount: 4780, currency: 'MOP', cny: 3967.4 } },
  { id: 'b', name: 'Lotion', quote: { amount: 1200, currency: 'MOP', cny: 996 } },
  { id: 'c', name: 'Unknown', quote: null },
];
test('plan quantities default safely and support the 1–99 range', () => {
  for (const value of [undefined, 0, -1, 100, 1.5, '2', NaN]) assert.equal(planQuantity({ a: value }, 'a'), 1);
  assert.equal(planQuantity({ a: 99 }, 'a'), 99);
});
test('selected plan totals multiply quantities and sum money in integer cents', () => {
  const total = planTotals(products, new Set(['a', 'b']), { a: 2, b: 1 });
  assert.deepEqual(total.amounts, [{ currency: 'MOP', amount: 10760 }]);
  assert.equal(total.cny, 8930.8); assert.equal(total.units, 3); assert.equal(total.count, 2);
  assert.equal(planTotals(products, new Set(['a']), { a: 99 }).amounts[0].amount, 473220);
});
test('unknown prices stay excluded and mixed currencies are never silently added', () => {
  const total = planTotals([...products, { id: 'd', quote: { amount: 200, currency: 'HKD', cny: null } }], new Set(['a', 'c', 'd']), {});
  assert.deepEqual(total.amounts, [{ currency: 'MOP', amount: 4780 }, { currency: 'HKD', amount: 200 }]);
  assert.equal(total.unpriced, 1); assert.equal(total.unconverted, 1); assert.equal(total.cny, 3967.4);
});
test('plan snapshots keep only known selections and route text includes quantities', () => {
  assert.deepEqual(planSnapshot(products, new Set(['a', 'missing']), { a: 2 }), { selected: ['a'], quantities: { a: 2 } });
  assert.equal(planItemText(products[0], { a: 2 }), 'Cream 50ml ×2');
  assert.equal(planItemText({ ...products[0], name: 'Cream 50ml' }, {}), 'Cream 50ml ×1');
});
