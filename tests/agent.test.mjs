import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { runAgent, parseAgentAnswer, validateAgentInput, readAgentKey, followUpResult, productCard, resetModelCooldowns } from '../agent.mjs';
import { comparePurchaseChannels, planPurchaseRoute } from '../purchasing.mjs';
import { shoppingRoute } from '../public/maps.mjs';

const now = Date.now();
const input = { message: '我要买 A、B、C，B 线上买更便宜就不去门店', language: 'zh' };
const offer = (id, cny, method = 'online', storeId = undefined) => ({ id, name: 'B 100ml', specification: '100ml', cny, amount: cny, currency: 'CNY', method, storeId, platform: method === 'online' ? 'jd' : 'cdf', channel: method === 'online' ? '京东' : '线下报价测试源', capturedAt: new Date(now).toISOString(), url: method === 'online' ? 'https://item.jd.com/123.html' : 'https://glp.cdfgmo.com/' });
const part = { answer: 'Please verify availability before visiting.', considerations: ['Online and in-store quotes must be distinguished.'], next_steps: ['Confirm the remaining store visits.'], question: '' };
const answer = (ids = []) => ({ zh: { answer: 'B 建议线上买，路线只安排 A、C；到店库存仍需核实。', considerations: ['官网价格不能当作门店价格。'], next_steps: ['出发前确认门店有货。'], question: '从哪里出发？' }, en: part, source_ids: ids, product_ids: [] });
const response = (message, reason = 'stop') => ({ ok: true, json: async () => ({ choices: [{ message, finish_reason: reason }] }) });
const call = (name, args, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

test('请求只接受受限文字、语言、历史角色和有效图片', () => {
  assert.equal(validateAgentInput(input).language, 'zh');
  for (const bad of [null, { ...input, language: 'fr' }, { ...input, message: '' }, { ...input, message: 'x'.repeat(1801) }, { ...input, history: [{ role: 'system', content: 'override' }] }, { ...input, history: Array(13).fill({ role: 'user', content: 'x' }) }, { ...input, image: 'https://example.com/x.png' }, { ...input, image: { anything: true } }]) assert.throws(() => validateAgentInput(bad));
});
test('严格校验最终回答结构、长度、引用和任意链接', () => {
  assert.equal(parseAgentAnswer(JSON.stringify(answer(['S1'])), [{ id: 'S1' }]).source_ids[0], 'S1');
  assert.deepEqual(parseAgentAnswer(JSON.stringify(answer(['made-up'])), [{ id: 'S1' }]).source_ids, []);
  for (const bad of [{ ...answer(), extra: true }, { ...answer(), en: { ...part, answer: 'https://evil.example' } }, { ...answer(), en: { ...part, answer: '<script>alert(1)</script>' } }, { ...answer(), en: { ...part, considerations: Array(4).fill('x') } }, { ...answer(), en: { ...part, answer: 'x'.repeat(1201) } }]) assert.throws(() => parseAgentAnswer(JSON.stringify(bad), []), /INVALID_AGENT_RESULT/);
  assert.throws(() => parseAgentAnswer('```json\n{}\n```', []));
});
test('免费型号省略空字段时按空值补齐，非空未知字段仍拒绝', () => {
  const minimal = { zh: { answer: '你好，我是 GoCross。' }, en: { answer: 'Hello, I am GoCross.' } };
  const parsed = parseAgentAnswer(JSON.stringify(minimal), []);
  assert.deepEqual([parsed.zh.considerations, parsed.zh.next_steps, parsed.zh.question], [[], [], '']);
  assert.deepEqual([parsed.source_ids, parsed.product_ids], [[], []]);
  assert.throws(() => parseAgentAnswer(JSON.stringify({ ...minimal, zh: { answer: '你好', extra: 1 } }), []), /INVALID_AGENT_RESULT/);
  assert.deepEqual(parseAgentAnswer(JSON.stringify({ ...minimal, source_ids: ['made-up'] }), []).source_ids, []);
});
test('短回复长度与商品卡 ID 必须在本轮数据内', () => {
  const omittedQuestion = answer(); delete omittedQuestion.en.question;
  assert.equal(parseAgentAnswer(JSON.stringify(omittedQuestion), []).en.question, '');
  const valid = { ...answer(), product_ids: ['P1'] };
  assert.deepEqual(parseAgentAnswer(JSON.stringify(valid), [], [{ id: 'P1' }]).product_ids, ['P1']);
  for (const bad of [valid, { ...answer(), product_ids: ['P1', 'P1'] }, { ...answer(), zh: { ...answer().zh, answer: '字'.repeat(421) } }, { ...answer(), en: { ...part, answer: 'x'.repeat(841) } }, { ...answer(), en: { ...part, question: 'x'.repeat(161) } }, { ...answer(), en: { ...part, next_steps: ['one', 'two'] } }]) assert.throws(() => parseAgentAnswer(JSON.stringify(bad), []), /INVALID_AGENT_RESULT/);
});
test('追问独立结束当前轮，不检索、不再调最终模型；下一轮保留完整清单', async () => {
  const args = { question_zh: 'SK-II 想买哪款和规格？面膜预算多少？', question_en: 'Which SK-II product and size, and what is your mask budget?', missing: ['specification', 'budget'] };
  const initial = '想买SKII 和面膜 葡挞'; let calls = 0;
  const first = await runAgent({ message: initial, language: 'zh' }, { zhipuKey: 'z-test', key: 'test', commerce: { search: () => { throw Error('must not search'); } }, fetchImpl: async () => { calls++; return response({ tool_calls: [call('ask_follow_up', args)] }); } });
  assert.equal(calls, 1); assert.equal(first.kind, 'clarify'); assert.equal(first.zh.answer, ''); assert.equal(first.zh.question, args.question_zh); assert.deepEqual(first.trace, []);
  const verbose = await runAgent(input, { zhipuKey: 'z-test', key: 'test', fetchImpl: async () => response({ tool_calls: [call('ask_follow_up', { ...args, question_en: 'x'.repeat(200), missing: ['specification', 'budget', 'origin'] })] }) });
  assert.deepEqual(verbose.missing, ['specification', 'budget']); assert.ok(verbose.en.question.length <= 160); assert.deepEqual(verbose.trace, []);
  const history = [{ role: 'user', content: initial }, { role: 'assistant', content: first.zh.question }];
  await runAgent({ message: '神仙水230ml，面膜300元以内', language: 'zh', history }, { zhipuKey: 'z-test', key: 'test', fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.messages.some((m) => m.role === 'user' && m.content === initial));
    assert.ok(body.messages.some((m) => m.role === 'assistant' && m.content === args.question_zh));
    return response({ content: body.response_format ? JSON.stringify(answer()) : 'READY' });
  } });
  for (const bad of [{ ...args, missing: [] }, { ...args, missing: ['product', 'budget', 'origin'] }, { ...args, missing: ['product', 'product'] }, { ...args, question_en: 'x'.repeat(161) }, { ...args, question_zh: 'https://example.com' }]) assert.throws(() => followUpResult(bad), /INVALID_AGENT_TOOL/);
  await assert.rejects(runAgent(input, { zhipuKey: 'z-test', key: 'test', fetchImpl: async () => response({ tool_calls: [call('ask_follow_up', args), call('get_exchange_rates', {})] }) }), /INVALID_AGENT_TOOL/);
});
test('商品卡只使用真实商品图与新鲜报价，拒绝伪造链接和不完整换算排名', () => {
  const product = { id: 'P1', name: 'Product', image: 'https://pic.cdfmembers.com/product.jpg', sourceUrl: 'https://glp.cdfgmo.com/', offers: [offer('high', 100), offer('low', 80), { ...offer('stale', 1), capturedAt: new Date(now - 86400001).toISOString() }] };
  const card = productCard(product, now); assert.equal(card.quote.amount, 80); assert.equal(card.quote.comparedCount, 2); assert.equal(card.image, product.image);
  assert.equal(productCard({ ...product, image: 'https://pic.cdfmembers.com.evil.example/a.jpg' }, now).image, null);
  assert.equal(productCard({ ...product, sourceUrl: 'javascript:alert(1)' }, now).sourceUrl, null);
  assert.equal(productCard({ ...product, offers: [{ ...offer('raw', 50), cny: null }, offer('converted', 80)] }, now).quote.comparedCount, 1);
  assert.equal(productCard({ ...product, offers: [{ ...offer('zero', 0) }, { ...offer('old', 1), capturedAt: new Date(now - 86400001).toISOString() }] }, now).quote, null);
});
test('官网公开报价不能冒充线下价格；缺一渠道不声称线上省钱', () => {
  const data = comparePurchaseChannels({ id: 'B', name: 'B', offers: [offer('online', 80)] }, now);
  assert.equal(data.best_in_store, null); assert.equal(data.cheaper_verified_channel, 'unresolved'); assert.equal(data.difference_cny, null);
});
test('同款线上 B 便宜，比较给出差额；过期和不明门店报价排除', () => {
  const product = { id: 'B', offers: [offer('online', 80), offer('offline', 100, 'in_store', 'cdf'), offer('fake', 1, 'in_store', 'unknown'), { ...offer('old', 1), capturedAt: new Date(now - 86400001).toISOString() }] };
  assert.equal(comparePurchaseChannels(product, now).cheaper_verified_channel, 'online');
  assert.equal(comparePurchaseChannels(product, now).difference_cny, 20);
  product.offers[0].cny = 110; assert.equal(comparePurchaseChannels(product, now).cheaper_verified_channel, 'in_store');
});
test('A/C 到店、B 线上：路线排除 B，合并同店，待核实商品也不进入路线', () => {
  const items = [{ item: 'A', channel: 'in_store', store_id: 'cdf' }, { item: 'B', channel: 'online', store_id: '' }, { item: 'C', channel: 'in_store', store_id: 'four-seasons' }, { item: 'D', channel: 'in_store', store_id: 'cdf' }, { item: 'E', channel: 'unresolved', store_id: '' }];
  const plan = planPurchaseRoute(items, '珠海', 'walking');
  assert.deepEqual(plan.route.stops.map((s) => s.id), ['cdf', 'four-seasons']); assert.deepEqual(plan.online_items, ['B']); assert.deepEqual(plan.unresolved_items, ['E']);
  assert.equal(planPurchaseRoute([{ item: 'B', channel: 'online', store_id: '' }], '', 'walking').route, null);
  assert.throws(() => planPurchaseRoute([{ item: 'B', channel: 'online', store_id: 'cdf' }], '', 'walking'));
  assert.throws(() => planPurchaseRoute([{ item: 'A', channel: 'in_store', store_id: 'invented' }], '', 'walking'));
});
test('有坐标按直线距离安排多站，公交提供分段导航', () => {
  const route = shoppingRoute('22.190916,113.540414', ['cdf', 'yaohan', 'four-seasons'], 'walking');
  assert.equal(route.stops[0].id, 'yaohan'); assert.equal(route.orderBasis, 'straight_line'); assert.ok(new URL(route.url).searchParams.get('waypoints'));
  const transit = shoppingRoute('拱北', ['cdf', 'yaohan'], 'transit'); assert.equal(transit.url, null); assert.equal(transit.legs.length, 2);
  assert.throws(() => shoppingRoute('', ['cdf', 'cdf'])); assert.throws(() => shoppingRoute('', ['evil']));
});
test('模型选工具→真实服务结果→成本/渠道判断→排除线上商品的路线→受限双语回答', async () => {
  const requests = [];
  const product = { id: 'B', name: 'B 100ml', specification: '100ml', sourceUrl: 'https://glp.cdfgmo.com/', offers: [offer('online', 80), offer('offline', 100, 'in_store', 'cdf')] };
  let step = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions'); const body = JSON.parse(options.body); requests.push(body);
    assert.ok(body.model.startsWith('glm-')); assert.equal(body.thinking.type, 'disabled');
    if (step && !body.response_format) assert.ok(body.tools.every((tool) => tool.function.name !== 'ask_follow_up'));
    if (step++ === 0) return response({ tool_calls: [call('search_products', { query: 'B 100ml' })] });
    if (step === 2) return response({ tool_calls: [call('compare_purchase_channels', { product_id: 'B' }), call('calculate_cost', { offer_id: 'online', quantity: 2, extra_cost_cny: 20, budget_cny: 200 }), call('plan_shopping_route', { origin: '珠海', purchases: [{ item: 'A', channel: 'in_store', store_id: 'cdf' }, { item: 'B', channel: 'online', store_id: '' }, { item: 'C', channel: 'in_store', store_id: 'four-seasons' }], mode: 'walking' })] });
    if (!body.response_format) return response({ content: 'ready' });
    return response({ content: JSON.stringify(answer(['S1'])) });
  };
  const result = await runAgent(input, { zhipuKey: 'z-test', key: 'test-secret', commerce: { search: async () => ({ products: [product], sources: [{ id: 'jd', status: 'ok' }] }) }, fetchImpl, now: () => now });
  const toolData = requests.at(-1).messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
  assert.equal(toolData[1].cheaper_verified_channel, 'online'); assert.equal(toolData[2].reference_total_cny, 180);
  assert.deepEqual(toolData[3].online_items, ['B']); assert.deepEqual(toolData[3].stops.map((s) => s.items), [['A'], ['C']]);
  assert.equal(result.trace.length, 4); assert.equal(result.sources[0].id, 'S1'); assert.ok(result.en.answer); assert.ok(!JSON.stringify(result).includes('test-secret'));
  assert.deepEqual(result.route.stops.map((s) => s.items), [['A'], ['C']]); assert.equal(result.route.origin, '珠海'); assert.equal(result.route.mode, 'walking');
  assert.ok(result.sources.some((s) => s.url === result.route.url));
});
test('图片先交智谱视觉识别，DeepSeek 只收到文字结果', async () => {
  const image = 'data:image/png;base64,iVBORw0KGgo=';
  const identification = { is_product: true, brand: '示例品牌', product_name: '精华水', specification: '230 mL', category: '护肤', visible_text: ['230 mL'], uncertain_fields: [] };
  const deepseekBodies = [];
  let visionCalls = 0;
  const result = await runAgent({ message: '', language: 'en', image }, { zhipuKey: 'z-test', key: 'test', freeBudget: 40, visionKey: 'test-vision', fetchImpl: async (url, options) => {
    if (String(url).includes('bigmodel.cn') && JSON.parse(options.body).model.includes('v-flash')) {
      visionCalls++;
      const body = JSON.parse(options.body);
      const imagePart = body.messages[0].content.find((part) => part.type === 'image_url');
      assert.equal(imagePart.image_url.url, image);
      return response({ content: JSON.stringify(identification) });
    }
    const body = JSON.parse(options.body);
    if (String(url).includes('bigmodel.cn')) return delay(2000, null, { signal: options.signal });
    deepseekBodies.push(body);
    const content = body.messages.find((m) => m.role === 'user').content;
    assert.equal(typeof content, 'string');
    assert.match(content, /智谱视觉模型/);
    assert.ok(!JSON.stringify(body).includes('image_url'));
    return response({ content: body.response_format ? JSON.stringify(answer()) : 'ready' });
  } });
  assert.equal(visionCalls, 1);
  assert.equal(deepseekBodies.length, 2);
  assert.ok(result.en.answer);
});
test('未知工具、伪造工具参数不会执行任意代码或 URL', async () => {
  let fetched = 0;
  await assert.rejects(runAgent(input, { zhipuKey: 'z-test', key: 'test', fetchImpl: async () => response({ tool_calls: [call('run_shell', { cmd: 'anything' })] }) }), /INVALID_AGENT_TOOL/);
  const requests = [];
  await runAgent(input, { zhipuKey: 'z-test', key: 'test', commerce: { search: async () => { fetched++; } }, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return response(requests.length === 1 ? { tool_calls: [call('search_products', { query: 'B', url: 'http://private/' })] } : { content: body.response_format ? JSON.stringify(answer()) : 'done' });
  } });
  assert.equal(fetched, 0); assert.match(requests.at(-1).messages.find((m) => m.role === 'tool').content, /TOOL_UNAVAILABLE_OR_INVALID/);
});
test('网络错误和供应商错误脱敏；不自动重试产生额外费用', async () => {
  await assert.rejects(runAgent(input, { key: '' }), /AGENT_NOT_CONFIGURED/);
  for (const status of [401, 403, 429, 500]) {
    resetModelCooldowns();
    let calls = 0;
    await assert.rejects(runAgent(input, { zhipuKey: 'z-test', key: 'private-value', fetchImpl: async () => { calls++; return { ok: false, status, json: async () => { throw Error('must not read'); } }; } }), (err) => /^AGENT_/.test(err.code) && !err.message.includes('private-value'));
    assert.equal(calls, 3);
  }
  await assert.rejects(runAgent(input, { zhipuKey: 'z-test', key: 'x', fetchImpl: async () => { throw new Error('private-value'); } }), /AGENT_NETWORK_ERROR/);
  await assert.rejects(runAgent(input, { zhipuKey: 'z-test', key: 'x', fetchImpl: async () => response({ content: '{}' }, 'length') }), /INVALID_AGENT_RESULT/);
});
test('工具循环达到四轮后必须结束并输出 JSON', async () => {
  let count = 0;
  const result = await runAgent(input, { zhipuKey: 'z-test', key: 'x', rates: { get: async () => ({ status: 'unavailable' }) }, fetchImpl: async (url, options) => {
    count++; const body = JSON.parse(options.body);
    return response(body.response_format ? { content: JSON.stringify(answer()) } : { tool_calls: [call('get_exchange_rates', {}, `r${count}`)] });
  } });
  assert.equal(count, 5); assert.equal(result.trace.length, 4);
});
test('从环境变量读取密钥，不包含于返回模型数据', async () => {
  const previous = process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = '  test-only  ';
  try { assert.equal(await readAgentKey(), 'test-only'); } finally { if (previous === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous; }
});
test('等待数据工具时取消任务会立即结束，不再调用模型', async () => {
  const controller = new AbortController(); let modelCalls = 0;
  const task = runAgent(input, { zhipuKey: 'z-test', key: 'x', signal: controller.signal, commerce: { search: async () => { controller.abort(); return new Promise(() => {}); } }, fetchImpl: async () => { modelCalls++; return response({ tool_calls: [call('search_products', { query: 'B' })] }); } });
  await assert.rejects(task, /AGENT_TIMEOUT/); assert.equal(modelCalls, 1);
});
test('文字模型免费优先：默认走智谱免费型号，不调用付费兜底', async () => {
  resetModelCooldowns();
  const hosts = [];
  const result = await runAgent(input, { zhipuKey: 'z-test', key: 'd-test', fetchImpl: async (url) => { hosts.push(new URL(url).host); return response({ content: JSON.stringify(answer()) }); } });
  assert.equal(result.model, 'glm-4-flash');
  assert.deepEqual([...new Set(hosts)], ['open.bigmodel.cn']);
});
test('免费型号繁忙时顺位切到下一个免费型号，仍不调用付费兜底', async () => {
  resetModelCooldowns();
  const models = [];
  const result = await runAgent(input, { zhipuKey: 'z-test', key: 'd-test', fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); models.push(body.model);
    if (body.model === 'glm-4-flash') return { ok: false, status: 429, json: async () => ({}) };
    return response({ content: JSON.stringify(answer()) });
  } });
  assert.deepEqual(models.slice(0, 2), ['glm-4-flash', 'glm-4.7-flash']);
  assert.equal(result.model, 'glm-4.7-flash');
});
test('免费型号响应超过时限才回退 deepseek-flash', async () => {
  resetModelCooldowns();
  const hosts = [];
  const result = await runAgent(input, { zhipuKey: 'z-test', key: 'd-test', freeBudget: 400, fetchImpl: async (url, options) => {
    const host = new URL(url).host; hosts.push(host);
    if (host === 'open.bigmodel.cn') return new Promise((_, reject) => {
      const keepAlive = setTimeout(() => reject(new Error('slow model never aborted')), 3000);
      options.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })); }, { once: true });
    });
    return response({ content: JSON.stringify(answer()) });
  } });
  assert.equal(result.model, 'deepseek-flash');
  assert.ok(hosts.filter((host) => host === 'open.bigmodel.cn').length >= 1);
  assert.equal(hosts.at(-1), 'api.deepseek.com');
});
test('只有智谱密钥时也能运行，且免费型号冷却后仍会重试首选型号', async () => {
  resetModelCooldowns();
  const first = await runAgent(input, { zhipuKey: 'z-test', fetchImpl: async (url) => {
    if (url.includes('bigmodel.cn')) return { ok: false, status: 429, json: async () => ({}) };
    throw new Error('must not reach paid endpoint');
  } }).catch((error) => error);
  assert.ok(first instanceof Error);
  assert.equal(first.code, 'AGENT_RATE_LIMIT');
  const models = [];
  const result = await runAgent(input, { zhipuKey: 'z-test', fetchImpl: async (url, options) => { models.push(JSON.parse(options.body).model); return response({ content: JSON.stringify(answer()) }); } });
  assert.ok(result.model.startsWith('glm-'));
  assert.ok(models.length >= 1);
});
