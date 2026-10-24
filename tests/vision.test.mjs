import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImage, parseIdentification, recogniseProduct, visionModel } from '../vision.mjs';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCQkAAAAASUVORK5CYII=';
const identification = { is_product: true, brand: '示例品牌', product_name: '精华水', specification: '230 mL', category: '护肤', visible_text: ['230 mL'], uncertain_fields: ['品牌需核对'] };

test('图片须有允许的 MIME、有效 Base64 和对应格式签名', () => {
  assert.equal(validateImage(image), image);
  for (const bad of [null, '', 'https://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJjZA==', image.replace('image/png', 'image/jpeg')]) assert.throws(() => validateImage(bad), { code: 'INVALID_IMAGE' });
});
test('大于 8 MB 的图片在调用供应商前被拒绝', () => {
  const bytes = Buffer.alloc(8 * 1024 * 1024 + 1);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  assert.throws(() => validateImage(`data:image/png;base64,${bytes.toString('base64')}`), { code: 'IMAGE_TOO_LARGE' });
});
test('解析 JSON 或围栏 JSON，只接受约定字段', () => {
  assert.deepEqual(parseIdentification(JSON.stringify({ ...identification, inventedPrice: 10 })), identification);
  assert.deepEqual(parseIdentification('```json\n' + JSON.stringify(identification) + '\n```'), identification);
});
test('拒绝模型非 JSON、缺字段、错误字段类型和过长结果', () => {
  for (const bad of ['不是 JSON', 'null', '{}', JSON.stringify({ ...identification, is_product: 'true' }), JSON.stringify({ ...identification, uncertain_fields: '猜测' }), JSON.stringify({ ...identification, brand: 'a'.repeat(301) })]) assert.throws(() => parseIdentification(bad), { code: 'INVALID_MODEL_RESULT' });
});
test('没有清晰商品时保留模型的否定结果，不强行匹配样例', () => {
  const blank = { is_product: false, brand: null, product_name: null, specification: null, category: null, visible_text: [], uncertain_fields: ['图片空白'] };
  assert.deepEqual(parseIdentification(JSON.stringify(blank)), blank);
});
test('品牌或规格缺失时保留可读品名和文字，不把部分识别判为失败', () => {
  const result = parseIdentification('{"is_product":true,"product_name":"护肤水","visible_text":["TONER"]}');
  assert.equal(result.brand, null); assert.equal(result.specification, null);
  assert.equal(result.product_name, '护肤水'); assert.deepEqual(result.uncertain_fields, []);
});
test('中文检索词保留，包装功效口号不当作容量或型号', () => {
  const result = parseIdentification(JSON.stringify({ ...identification, specification: 'Prep + Hydrate + Glow', search_keywords: ['雅诗兰黛'] }));
  assert.equal(result.specification, null); assert.deepEqual(result.search_keywords, ['雅诗兰黛']);
  assert.ok(result.uncertain_fields.some((word) => word.includes('规格')));
});
test('主模型超时或返回坏 JSON 时备用模型仍可完成识别', async () => {
  for (const bad of ['timeout', 'json']) {
    let count = 0;
    const result = await recogniseProduct(image, { key: 'test', fetchImpl: async () => {
      if (++count === 1) { if (bad === 'timeout') throw new DOMException('', 'TimeoutError'); return new Response('bad json'); }
      return Response.json({ choices: [{ message: { content: JSON.stringify(identification) } }] });
    } });
    assert.equal(count, 2); assert.equal(result.identification.product_name, '精华水');
  }
});
test('真实请求格式包含图片与指定免费模型，密钥只进入鉴权头', async () => {
  const key = 'test-only-secret';
  const result = await recogniseProduct(image, { key, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    const body = JSON.parse(options.body);
    assert.equal(body.model, visionModel); assert.equal(body.thinking.type, 'disabled'); assert.equal(body.messages[0].content[0].image_url.url, image);
    assert.equal(options.body.includes(key), false);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(identification) } }] }));
  } });
  assert.deepEqual(result.identification, identification); assert.equal(JSON.stringify(result).includes(key), false);
});
test('缺少密钥不发送请求', async () => {
  await assert.rejects(recogniseProduct(image, { key: '', fetchImpl: () => assert.fail('must not fetch') }), { code: 'NOT_CONFIGURED', status: 503 });
});
test('主模型繁忙时仅回退一次官方免费视觉型号，返回实际使用型号', async () => {
  const seen = [];
  const result = await recogniseProduct(image, { key: 'test', fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); seen.push(body.model);
    if (seen.length === 1) return new Response('{}', { status: 429 });
    assert.equal(body.thinking, undefined);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(identification) } }] }));
  } });
  assert.deepEqual(seen, ['glm-4.6v-flash', 'glm-4v-flash']);
  assert.equal(result.model, 'glm-4v-flash');
});
test('鉴权和限流只返回安全错误码，不反射上游错误或密钥', async () => {
  for (const [status, code] of [[401, 'VISION_AUTH_ERROR'], [403, 'VISION_AUTH_ERROR'], [429, 'VISION_RATE_LIMIT'], [500, 'VISION_UPSTREAM_ERROR']]) {
    await assert.rejects(recogniseProduct(image, { key: 'secret', fetchImpl: async () => new Response('secret upstream detail', { status }) }), (error) => error.code === code && !error.message.includes('secret'));
  }
});
test('网络超时和无效上游响应有明确错误', async () => {
  await assert.rejects(recogniseProduct(image, { key: 'test', fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }), { code: 'VISION_TIMEOUT' });
  await assert.rejects(recogniseProduct(image, { key: 'test', fetchImpl: async () => new Response('not json') }), { code: 'INVALID_MODEL_RESULT' });
});
