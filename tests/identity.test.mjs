import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalQuery, specification, sameProduct } from '../public/identity.mjs';
import { rankProducts, searchProductsText } from '../matching.mjs';

test('SK II 各种拼写使用同一官网查询，短中文品类也能检索', async () => {
  const products = [{ id: 'p1', name: 'SK-II 清莹嫩肤露', brand: 'SK-II', specification: '160ml' }, { id: 'p2', name: '索尼无线耳机', brand: 'SONY' }];
  for (const query of ['SK II', 'SK-II', 'SKII', 'ＳＫ－ＩＩ', 'sk 2']) {
    assert.equal(canonicalQuery(query), 'SK-II');
    const result = await searchProductsText(query, { search: async (value) => { assert.equal(value, 'SK-II'); return { products }; } });
    assert.deepEqual(result.products.map((p) => p.id), ['p1']);
  }
  assert.equal(rankProducts({ product_name: '耳机' }, products)[0].id, 'p2');
});

test('识别清莹露时不把同品牌精华露或面膜混进来', () => {
  const products = ['SK-II 清莹嫩肤露 160ml', 'SK-II 护肤精华露 160ml', 'SK-II 护肤面膜 28ml*20'].map((name, id) => ({ id, name, brand: 'SK-II' }));
  assert.deepEqual(rankProducts({ brand: 'SK II', product_name: 'Facial Treatment Clear Lotion', search_keywords: ['SK-II 清莹嫩肤露'] }, products).map((p) => p.id), [0]);
});

test('同款匹配区分容量、件数、产品系列；条码不能覆盖规格冲突', () => {
  assert.equal(specification('0.16L').key, '160ml*1');
  assert.equal(specification('160毫升×2').key, '160ml*2');
  assert.equal(specification('160ml 3瓶装').key, '160ml*3');
  assert.equal(specification('160ml 双瓶').key, '160ml*2');
  const item = { name: 'SK-II 清莹嫩肤露', brand: 'SK II', specification: '160ml', variants: [{ barcode: '123' }] };
  assert.ok(sameProduct(item, { ...item, brand: 'SK-II', specification: '0.16L' }));
  for (const change of [{ specification: '230ml' }, { specification: '160ml*2' }, { name: 'SK-II 护肤精华露', variants: [] }, { specification: '', name: 'SK-II 清莹嫩肤露', variants: [] }, { name: 'SK-II 清莹嫩肤露 赠眼霜', variants: [] }]) assert.equal(sameProduct(item, { ...item, ...change }), false);
});
