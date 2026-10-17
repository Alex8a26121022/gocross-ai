import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBocRates, createRateService, RATE_INTERVAL_MS } from '../rates.mjs';

const html = `<table><tr><th>货币名称</th><th>现汇买入价</th><th>现钞买入价</th><th>现汇卖出价</th><th>现钞卖出价</th><th>中行折算价</th><th>发布日期</th><th>发布时间</th></tr>
<tr><td>澳门元</td><td>82.63</td><td></td><td>83.01</td><td>83.01</td><td>83.17</td><td>2026/10/15 22:12:34</td><td>22:12:34</td></tr>
<tr><td>港币</td><td>85.12</td><td>85.12</td><td>85.46</td><td>85.46</td><td>85.70</td><td>2026/10/15</td><td>22:12:34</td></tr></table>`;
test('正确读取现汇卖出价并按 100 外币单位换算，不混用买入价或折算价', () => {
  const value = parseBocRates(html);
  assert.equal(value.rates.MOP.cnyPerUnit, 0.8301);
  assert.equal(value.rates.HKD.cnyPerUnit, 0.8546);
  assert.equal(value.rates.MOP.sourcePublishedAt, '2026-10-15T22:12:34+08:00');
  assert.equal(value.rates.HKD.sourcePublishedAt, '2026-10-15T22:12:34+08:00');
});
test('官网格式缺失或异常数值被拒绝，不生成虚假汇率', () => {
  assert.throws(() => parseBocRates('<h1>暂不可用</h1>'));
  assert.throws(() => parseBocRates(html.replace('<td>83.01</td>', '<td>0</td>')));
  assert.throws(() => parseBocRates(html.replaceAll('2026/10/15', 'invalid')));
});
test('30 分钟内并发请求共用一次获取，达到时间后刷新', async () => {
  let clock = Date.parse('2026-10-15T14:15:00Z'); let calls = 0;
  const service = createRateService({ storage: null, now: () => clock, fetchImpl: async () => { calls++; return new Response(html); } });
  await Promise.all([service.get(), service.get(), service.get()]); assert.equal(calls, 1);
  clock += RATE_INTERVAL_MS - 1; await service.get(); assert.equal(calls, 1);
  clock += 1; const result = await service.get(); assert.equal(calls, 2); assert.equal(result.refreshIntervalMinutes, 30);
});
test('刷新失败保留上次有效汇率、采集时间及过期状态', async () => {
  let failed = false;
  const service = createRateService({ storage: null, fetchImpl: async () => { if (failed) throw new Error('network'); return new Response(html); } });
  const first = await service.refresh(); failed = true;
  const next = await service.refresh(); assert.equal(next.status, 'stale'); assert.equal(next.rates.MOP.cnyPerUnit, 0.8301); assert.equal(next.fetchedAt, first.fetchedAt);
});
test('从未获取成功时明确不可用，不填入示例值冒充官方', async () => {
  const service = createRateService({ storage: null, fetchImpl: async () => new Response('', { status: 503 }) });
  const result = await service.get(); assert.equal(result.status, 'unavailable'); assert.equal(result.rates, undefined);
});
