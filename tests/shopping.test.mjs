import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTerm, identificationQuery } from '../public/shopping.mjs';

test('任意商品不受三种样例限制，清理购物用语并保留品牌规格', () => {
  assert.equal(searchTerm('我想买两瓶兰蔻粉水，帮我看看多少钱'), '兰蔻粉水');
  for (const value of ['手表', '巧克力', '耳机', '资生堂化妆水 200ml', 'SK-II Facial Treatment Essence']) assert.equal(searchTerm(value), value);
});
test('部分识图字段足以生成可编辑检索词，不强制匹配样例', () => {
  assert.equal(identificationQuery({ brand: '兰蔻', product_name: '兰蔻粉水' }), '兰蔻粉水');
  assert.equal(identificationQuery({ category: '爽肤水' }), '爽肤水');
  assert.equal(identificationQuery({ visible_text: ['TONER'] }), 'TONER');
  assert.equal(identificationQuery({ brand: 'ESTÉE LAUDER', product_name: 'Lotion', search_keywords: ['雅诗兰黛'] }), '雅诗兰黛');
});
