import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customsFacts, customsAllowance, inferCustomsRequest, customsFallback, validateCustomsNumbers, customsIntent } from '../customs.mjs';
import { parseAgentAnswer, runAgent } from '../agent.mjs';

test('adult residents returning from Macau/Hong Kong get the conditional 12,000/15,000 rule', () => {
  for (const origin of ['macau', 'hongkong']) {
    const result = customsAllowance({ origin, traveller: 'resident' });
    assert.equal(result.allowance_cny, 12000); assert.equal(result.combined_inbound_shop_cny, 15000);
    assert.equal(result.allowance.value.resident_means_mainland_usual_residence, true);
  }
  assert.ok(Object.isFrozen(customsFacts['hk-macau'].tobacco.value));
  assert.match(customsFacts['hk-macau'].allowance.source_url, /^https:/);
  assert.equal(customsFacts.general.allowance.as_of, '2026-10-19');
});
test('Hong Kong/Macau limits use 200 cigarettes OR 10 cigars OR 250g, e-liquid 6ml, alcohol 0.75L', () => {
  const result = customsAllowance({ origin: 'macau', traveller: 'resident' });
  assert.deepEqual([result.tobacco.value.cigarettes, result.tobacco.value.cigars, result.tobacco.value.tobacco_g, result.tobacco.value.liquid_ml], [200, 10, 250, 6]);
  assert.equal(result.alcohol.value.litres, .75); assert.equal(result.tobacco.value.alternatives, true);
});
test('general and unknown origins fall back to 5,000 residents / 2,000 non-residents', () => {
  assert.equal(customsAllowance({ origin: 'unknown', traveller: 'resident' }).allowance_cny, 5000);
  const result = customsAllowance({ origin: 'macau', traveller: 'non_resident' });
  assert.equal(result.allowance_cny, 2000); assert.equal(result.combined_inbound_shop_cny, null);
  const general = customsAllowance({ origin: 'other', traveller: 'resident' });
  assert.deepEqual([general.tobacco.value.cigarettes, general.tobacco.value.cigars, general.tobacco.value.tobacco_g, general.tobacco.value.liquid_ml, general.alcohol.value.litres], [400, 20, 500, 12, 1.5]);
});
test('frequent travellers have necessities-only treatment and daily 40/2/40 tobacco, no duty-free alcohol', () => {
  const result = customsAllowance({ origin: 'macau', traveller: 'frequent' });
  assert.equal(result.allowance_cny, null); assert.equal(result.conditions.necessities_only, true);
  assert.deepEqual([result.tobacco.value.cigarettes, result.tobacco.value.cigars, result.tobacco.value.tobacco_g, result.tobacco.value.times_per_day, result.alcohol.value.litres], [40, 2, 40, 1, 0]);
  assert.equal(customsAllowance({ origin: 'macau', traveller: 'minor' }).tobacco.value.exemption_applies, false);
});
test('Macao entry is the other direction: 19/1/25 tobacco and alcohol over 30% ABV', () => {
  const result = customsAllowance({ origin: 'other', traveller: 'resident', destination: 'macau' });
  assert.equal(result.allowance_cny, null); assert.equal(result.allowance.value.not_a_duty_free_value_allowance, true);
  assert.deepEqual([result.tobacco.value.cigarettes, result.tobacco.value.cigars, result.tobacco.value.tobacco_g, result.alcohol.value.litres, result.alcohol.value.abv_over_percent], [19, 1, 25, 1, 30]);
  assert.equal(inferCustomsRequest('我要入境澳门，海关烟酒限额多少').destination, 'macau');
  assert.equal(inferCustomsRequest('澳门回内地海关限额').destination, 'mainland');
});
test('customs detection leaves ordinary duty-free shopping questions alone and recognises minors', () => {
  assert.equal(customsIntent('澳门免税店面霜多少钱'), false);
  assert.equal(customsIntent('Where can I buy duty-free perfume?'), false);
  assert.equal(customsIntent('澳门免税额度多少'), true);
  assert.equal(inferCustomsRequest('我17岁，澳门回内地带酒').traveller, 'minor');
  assert.equal(inferCustomsRequest('去澳门买东西再回内地，海关限额是多少').destination, 'mainland');
});
test('the answer validator rejects invented customs numbers and preserves the source caveat', () => {
  const facts = customsAllowance({ origin: 'macau', traveller: 'resident' });
  const good = customsFallback(facts);
  assert.doesNotThrow(() => validateCustomsNumbers(good, facts));
  assert.doesNotThrow(() => parseAgentAnswer(JSON.stringify(good), [], [], facts));
  for (const text of ['免税额为9000元。', '免税额为九千元。', 'Duty-free allowance: 9999 CNY.']) {
    const bad = { ...good, zh: { ...good.zh, answer: text } };
    assert.throws(() => parseAgentAnswer(JSON.stringify(bad), [], [], facts), /INVALID_AGENT_RESULT/);
  }
});
test('customs questions always obtain the facts and correct invented model limits without changing model routing', async () => {
  let finals = 0;
  const facts = customsAllowance({ origin: 'macau', traveller: 'resident' });
  const result = await runAgent({ message: '澳门回内地海关免税额度是多少', language: 'zh' }, { zhipuKey: 'z-test', key: 'test', fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    const answer = customsFallback(facts); answer.zh.answer = '免税额度9999元'; answer.en.answer = 'Allowance: 9999 CNY';
    if (body.response_format) finals++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: body.response_format ? JSON.stringify(answer) : 'READY' }, finish_reason: 'stop' }] }) };
  } });
  assert.equal(finals, 2); assert.ok(result.trace.some(entry => entry.tool === 'customs_allowance'));
  assert.match(result.zh.answer, /12,000/); assert.doesNotMatch(result.zh.answer, /9999/);
  assert.match(result.zh.considerations[0], /12360/); assert.ok(result.sources.length >= 2);
});
