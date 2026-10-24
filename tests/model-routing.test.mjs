import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { runAgent, resetModelCooldowns } from '../agent.mjs';

const keys = { zhipuKey: 'free-test-key', key: 'paid-test-key' };
const input = { message: '从新八佰伴出发，查询护肤品并安排路线', language: 'zh' };
const answer = { zh: { answer: '请核实商品规格。' }, en: { answer: 'Please verify the product size.' } };
const response = message => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message }] }) });
const tool = (name, args) => ({ id: name, type: 'function', function: { name, arguments: JSON.stringify(args) } });
beforeEach(resetModelCooldowns);

test('路线、工具后的最终回答和格式修正均先免费，思考保持关闭', async () => {
  const hosts = []; let planning = 0, finals = 0;
  const result = await runAgent(input, { ...keys, commerce: { search: async () => ({ products: [], sources: [] }) }, fetchImpl: async (url, options) => {
    hosts.push(new URL(url).host);
    const body = JSON.parse(options.body);
    assert.equal(body.thinking.type, 'disabled');
    if (body.response_format) return response({ content: ++finals === 1 ? 'not JSON' : JSON.stringify(answer) });
    return response(++planning === 1 ? { tool_calls: [tool('search_products', { query: '护肤品' })] } : { content: 'READY' });
  } });
  assert.equal(finals, 2); assert.equal(result.trace[0].status, 'ok');
  assert.ok(hosts.length >= 4 && hosts.every(host => host === 'open.bigmodel.cn'));
});

test('规划、最终回答及修正都使用完整十秒免费窗口，不缩成五秒', async t => {
  const timeouts = []; let finals = 0;
  t.mock.method(AbortSignal, 'timeout', ms => { timeouts.push(ms); return new AbortController().signal; });
  await runAgent(input, { ...keys, fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    return response({ content: body.response_format && ++finals > 1 ? JSON.stringify(answer) : 'READY' });
  } });
  const modelTimeouts = timeouts.filter(ms => ms < 150000);
  assert.equal(modelTimeouts.length, 3);
  assert.ok(modelTimeouts.every(ms => ms > 9000 && ms <= 10000));
});

test('免费模型快速报错、截断或伪超时不允许付费', async () => {
  for (const failure of [401, 429, 500, 'network', 'timeout-name', 'truncated']) {
    resetModelCooldowns(); const hosts = [];
    await assert.rejects(runAgent(input, { ...keys, fetchImpl: async url => {
      hosts.push(new URL(url).host);
      if (failure === 'network') throw Error('unavailable');
      if (failure === 'timeout-name') throw new DOMException('fast failure', 'TimeoutError');
      if (failure === 'truncated') return { ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: {} }] }) };
      return { ok: false, status: failure };
    } }));
    assert.ok(hosts.length && hosts.every(host => host === 'open.bigmodel.cn'), String(failure));
  }
});

test('免费型号全部冷却后也不能跳过免费入口直接付费', async () => {
  await assert.rejects(runAgent(input, { ...keys, fetchImpl: async () => ({ ok: false, status: 429 }) }));
  const hosts = [];
  await runAgent(input, { ...keys, fetchImpl: async url => { hosts.push(new URL(url).host); return response({ content: JSON.stringify(answer) }); } });
  assert.ok(hosts.length && hosts.every(host => host === 'open.bigmodel.cn'));
});

test('只有真实免费等待超时才调用 DeepSeek，计时器早触发也不提前付费，下一次仍先免费', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, 'timeout', ms => timeout(ms <= 40 ? Math.max(1, ms - 2) : ms));
  const hosts = []; let freeCalls = 0; const started = performance.now();
  const result = await runAgent(input, { ...keys, freeBudget: 40, fetchImpl: async (url, options) => {
    const host = new URL(url).host; hosts.push(host);
    if (host === 'open.bigmodel.cn') {
      if (++freeCalls === 1) return delay(2000, null, { signal: options.signal });
      return response({ content: JSON.stringify(answer) });
    }
    assert.ok(performance.now() - started >= 40);
    return response({ content: 'READY' });
  } });
  assert.deepEqual(hosts, ['open.bigmodel.cn', 'api.deepseek.com', 'open.bigmodel.cn']);
  assert.equal(result.usage.routes.find(route => route.model === 'deepseek-flash').reason, 'free_timeout');
});

test('响应头先到但正文挂起也受免费十秒窗口约束', async () => {
  let freeCalls = 0, paidCalls = 0;
  await runAgent(input, { ...keys, freeBudget: 40, fetchImpl: async (url, options) => {
    if (new URL(url).host === 'api.deepseek.com') { paidCalls++; return response({ content: 'READY' }); }
    if (++freeCalls === 1) return { ok: true, json: () => delay(2000, null, { signal: options.signal }) };
    return response({ content: JSON.stringify(answer) });
  } });
  assert.equal(paidCalls, 1);
});

test('用户停止免费等待时不切到付费', async () => {
  const controller = new AbortController(); const hosts = [];
  const stopped = delay(10).then(() => controller.abort());
  await assert.rejects(runAgent(input, { ...keys, signal: controller.signal, freeBudget: 40, fetchImpl: async (url, options) => {
    hosts.push(new URL(url).host); return delay(2000, null, { signal: options.signal });
  } }), /AGENT_TIMEOUT/);
  await stopped; assert.deepEqual(hosts, ['open.bigmodel.cn']);
});

test('只有 DeepSeek 密钥时不能绕过免费入口', async () => {
  await assert.rejects(runAgent(input, { key: 'paid-only', fetchImpl: () => assert.fail('must not make a paid request') }), /AGENT_NOT_CONFIGURED/);
});

test('免费响应正常时不开放收费 Search/Fetch，伪造工具调用也不产生费用', async () => {
  const hosts = []; let planning = 0;
  const result = await runAgent(input, { ...keys, fetchImpl: async (url, options) => {
    hosts.push(new URL(url).host); const body = JSON.parse(options.body);
    if (body.tools) assert.ok(body.tools.every(tool => !['search_web', 'fetch_web_page'].includes(tool.function.name)));
    if (!body.response_format && ++planning === 1) return response({ tool_calls: [tool('search_web', { query: '澳门', scope: 'stores' })] });
    return response({ content: JSON.stringify(answer) });
  } });
  assert.equal(result.trace[0].status, 'unavailable');
  assert.ok(hosts.every(host => host === 'open.bigmodel.cn'));
});

test('实际免费超时后的兜底才可以使用收费联网工具', async () => {
  let freeCalls = 0, searches = 0;
  await runAgent(input, { ...keys, freeBudget: 40, fetchImpl: async (url, options) => {
    if (String(url).endsWith('/tools/search')) { searches++; return { ok: true, json: async () => ({ results: [] }) }; }
    if (new URL(url).host === 'api.deepseek.com') {
      assert.ok(JSON.parse(options.body).tools.some(tool => tool.function.name === 'search_web'));
      return response({ tool_calls: [tool('search_web', { query: '澳门', scope: 'stores' })] });
    }
    if (++freeCalls === 1) return delay(2000, null, { signal: options.signal });
    return response({ content: JSON.stringify(answer) });
  } });
  assert.equal(searches, 1);
});
