const asOf = '2026-10-19';
const sources = {
  allowance: ['https://jx.mof.gov.cn/xxgk/zhengcefagui/202407/t20240703_3938585.htm', '财政部等公告2024年第7号 / MOF announcement 7 (2024)'],
  general: ['https://gss.mof.gov.cn/gzdt/zhengcefabu/202411/t20241129_3948540.htm', '税委会公告2024年第11号 / Tariff Commission announcement 11 (2024)'],
  limits: ['https://gss.mof.gov.cn/gzdt/zhengcefabu/202411/P020241129682518318359.pdf', '进境行李物品免税限量表 / Duty-free baggage quantity table'],
  declaration: ['https://www.jining.gov.cn/art/2024/12/4/art_77111_2891119.html', '海关总署公告2024年第176号（政府转载） / Customs announcement 176 (2024), government republication'],
  macau: ['https://www.customs.gov.mo/cn/notice_passengers_item3.html', '澳门海关供个人自用或消费之货物表 / Macao Customs personal-use goods table'],
};
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const fact = (value, source) => ({ value, as_of: asOf, source_url: sources[source][0], source_label: sources[source][1] });
const tobacco = (cigarettes, cigars, tobacco_g, devices, pods, liquid_ml) => ({ cigarettes, cigars, tobacco_g, devices, pods, liquid_ml, alternatives: true, adult_min_age: 18 });

export const customsFacts = freeze({
  'hk-macau': {
    allowance: fact({ resident_cny: 12000, combined_inbound_shop_cny: 15000, adult_min_age: 18, personal_reasonable_use: true, resident_means_mainland_usual_residence: true }, 'allowance'),
    tobacco: fact(tobacco(200, 10, 250, 1, 3, 6), 'limits'),
    alcohol: fact({ litres: .75, min_abv_percent: 12, adult_min_age: 18 }, 'limits'),
    declaration: fact({ cigarettes_over: 200, cigars_over: 10, tobacco_g_over: 250, devices_over: 1, pods_over: 3, liquid_ml_over: 6, alcohol_ml_over: 750, min_abv_percent: 12 }, 'declaration'),
  },
  general: {
    allowance: fact({ resident_cny: 5000, non_resident_cny: 2000, personal_reasonable_use: true, excess_only_except_indivisible_item: true }, 'general'),
    tobacco: fact(tobacco(400, 20, 500, 2, 6, 12), 'limits'),
    alcohol: fact({ litres: 1.5, min_abv_percent: 12, adult_min_age: 18 }, 'limits'),
    declaration: fact({ cigarettes_over: 400, cigars_over: 20, tobacco_g_over: 500, devices_over: 2, pods_over: 6, liquid_ml_over: 12, alcohol_ml_over: 1500, min_abv_percent: 12 }, 'declaration'),
  },
  frequent: {
    allowance: fact({ monetary_allowance_cny: null, necessities_only: true, more_than_one_entry_within_days: 15 }, 'general'),
    tobacco: fact({ ...tobacco(40, 2, 40, 1, 1, 2), times_per_day: 1 }, 'limits'),
    alcohol: fact({ litres: 0, min_abv_percent: 12 }, 'limits'),
  },
  'macau-inbound': {
    allowance: fact({ declaration_threshold_mop: 5000, personal_use_exceptions_apply: true, not_a_duty_free_value_allowance: true, restricted_goods_need_separate_declaration: true }, 'macau'),
    tobacco: fact({ cigarettes: 19, cigars: 1, cigar_weight_under_g: 3, tobacco_g: 25, combined_daily_tobacco_weight_g: 25 }, 'macau'),
    alcohol: fact({ litres: 1, abv_over_percent: 30, per_day: true }, 'macau'),
    declaration: fact({ value_over_mop: 5000, personal_use_exceptions_apply: true, restricted_goods_need_separate_declaration: true }, 'macau'),
  },
});

export function customsAllowance({ origin, traveller, destination = 'mainland' }) {
  if (!['resident', 'non_resident', 'frequent', 'minor'].includes(traveller) || !['mainland', 'macau'].includes(destination)) throw new Error('INVALID_CUSTOMS_ARGUMENTS');
  const region = destination === 'macau' ? 'macau-inbound' : ['macau', 'hongkong'].includes(origin) ? 'hk-macau' : 'general';
  const facts = customsFacts[region];
  const limited = destination === 'mainland' && ['frequent', 'minor'].includes(traveller);
  const allowance = destination === 'macau' ? facts.allowance : limited ? customsFacts.frequent.allowance : traveller === 'non_resident' ? customsFacts.general.allowance : facts.allowance;
  return freeze({
    origin: ['macau', 'hongkong'].includes(origin) ? origin : 'other', destination, traveller, region, as_of: asOf,
    allowance, allowance_cny: destination === 'macau' || limited ? null : traveller === 'non_resident' ? 2000 : allowance.value.resident_cny,
    combined_inbound_shop_cny: destination === 'mainland' && !limited && traveller === 'resident' && region === 'hk-macau' ? 15000 : null,
    tobacco: traveller === 'minor' && destination === 'mainland' ? fact({ exemption_applies: false, adult_min_age: 18 }, 'limits') : traveller === 'frequent' && destination === 'mainland' ? customsFacts.frequent.tobacco : facts.tobacco,
    alcohol: traveller === 'minor' && destination === 'mainland' ? fact({ exemption_applies: false, adult_min_age: 18 }, 'limits') : traveller === 'frequent' && destination === 'mainland' ? customsFacts.frequent.alcohol : facts.alcohol,
    declaration: facts.declaration,
    conditions: { adult_resident_rule_is_conditional: traveller === 'resident', necessities_only: limited, excess_only_except_indivisible_item: destination === 'mainland', tax_estimation: false },
  });
}

export function inferCustomsRequest(message) {
  const age = message.match(/(\d{1,2})\s*(?:岁|歲|years? old)/i);
  return {
    origin: /香港|hong\s*kong/i.test(message) ? 'hongkong' : /澳门|澳門|macau|macao/i.test(message) ? 'macau' : 'other',
    traveller: age && Number(age[1]) < 18 || /未满18|不满18|未成年|minor|under\s*18/i.test(message) ? 'minor' : /经常|頻繁|频繁|多次|一天.*[两二2]次|15(?:天|日).*(?:第二次|再次)|frequent/i.test(message) ? 'frequent' : /非居民|non.?resident/i.test(message) ? 'non_resident' : 'resident',
    destination: /(?:入境|进入|進入|入)(?:澳门|澳門)|(?:enter(?:ing)?|into)\s+(?:macau|macao)/i.test(message) && !/澳门(?:回|返|进|入).*(?:内地|大陆)|from\s+(?:macau|macao)/i.test(message) ? 'macau' : 'mainland',
  };
}

export const customsIntent = message => /海关|海關|报关|申报|免[税稅](?:额度|額度|限|多少(?!钱|錢)|能带)|关税|带.{0,8}(?:烟|菸|酒)|(?:烟|酒).{0,8}(?:带|限)|customs|(?:duty.?free|tax.?free).{0,12}(?:allowance|limit)|tobacco.{0,12}limit|(?:bring|carry).{0,30}(?:wine|alcohol|cigarette|cigar|vape)/i.test(message);
export const customsDisclaimer = {
  zh: '以入境口岸海关现场审核为准，内地海关热线 12360。',
  en: 'The border customs office has the final say. Mainland customs hotline: 12360.',
};

export function validateCustomsNumbers(answer, facts, extraNumbers = []) {
  const allowed = new Set([0, 1, 2, 3, 12, 18, 30, 12360, ...extraNumbers]);
  const visit = value => {
    if (typeof value === 'number') allowed.add(value);
    else if (value && typeof value === 'object') Object.entries(value).filter(([key]) => !['source_url', 'source_label', 'declaration'].includes(key)).forEach(([, item]) => visit(item));
  };
  visit(facts);
  for (const value of facts.as_of.split('-')) allowed.add(Number(value));
  const text = ['zh', 'en'].flatMap(lang => [answer[lang].answer, ...(answer[lang].considerations || []), ...(answer[lang].next_steps || []), answer[lang].question || '']).join('\n');
  const numbers = [...text.matchAll(/\d[\d,]*(?:\.\d+)?\s*[万千]?/g)].map(match => Number(match[0].replace(/[,\s万千]/g, '')) * (match[0].includes('万') ? 10000 : match[0].includes('千') ? 1000 : 1));
  if (numbers.some(number => !allowed.has(number)) || /[零一二三四五六七八九十百千万两]+(?:元|支|枝|克|毫升|升|瓶|周岁)/.test(text) || /(?:税额|税率|tax rate|tax amount|duty rate)\s*[:：为是]?\s*\d/i.test(text)) throw new Error('INVALID_CUSTOMS_NUMBERS');
  return answer;
}

export function customsFallback(facts) {
  const tobacco = facts.tobacco.value, alcohol = facts.alcohol.value;
  const amountZh = facts.destination === 'macau' ? '入境澳门：MOP 5,000是一般申报门槛，并非统一免税额度；个人自用例外及受管制货物须另行判断。' : facts.conditions.necessities_only ? '经常出入境人员或未成年人仅免税放行旅途必需物品，不适用普通购物免税额。' : `${facts.region === 'hk-macau' && facts.traveller === 'resident' ? '18岁及以上居民旅客自港澳入境，' : '一般进境规则下，'}${facts.traveller === 'non_resident' ? '非居民' : '居民'}个人合理自用物品额度为 CNY ${facts.allowance_cny.toLocaleString('en-US')}。${facts.combined_inbound_shop_cny ? '连同口岸进境免税店购物合计不超过 CNY 15,000。' : ''}`;
  const amountEn = facts.destination === 'macau' ? 'Entering Macao: MOP 5,000 is a general declaration threshold, not a blanket duty-free allowance. Personal-use exceptions and controlled goods are assessed separately.' : facts.conditions.necessities_only ? 'Frequent travellers and minors qualify only for travel necessities, not the ordinary shopping allowance.' : `${facts.region === 'hk-macau' && facts.traveller === 'resident' ? 'For resident travellers aged 18+ entering from Hong Kong/Macao, ' : 'Under the general entry rule, '}${facts.traveller === 'non_resident' ? 'non-resident' : 'resident'} personal-use goods: CNY ${facts.allowance_cny.toLocaleString('en-US')}.${facts.combined_inbound_shop_cny ? ' Including purchases at an inbound duty-free shop, the combined ceiling is CNY 15,000.' : ''}`;
  const limitsZh = tobacco.exemption_applies === false ? '未成年人不适用烟酒免税规定。' : `香烟 ${tobacco.cigarettes} 支，或雪茄 ${tobacco.cigars} 支，或烟丝 ${tobacco.tobacco_g} g。${tobacco.devices ? `电子烟烟具 ${tobacco.devices} 个、烟弹 ${tobacco.pods} 个、烟液合计不超过 ${tobacco.liquid_ml} ml。` : '澳门烟草每日合计重量不得超过25 g，雪茄每支须少于3 g。'}${alcohol.litres ? `酒精度${facts.destination === 'macau' ? '超过30%' : '12度以上'}的酒精饮料 ${alcohol.litres} L。` : '12度以上酒精饮料不得免税携入。'}${facts.traveller === 'frequent' && facts.destination === 'mainland' ? '烟草限额一天一次。' : ''}`;
  const limitsEn = tobacco.exemption_applies === false ? 'Minors do not qualify for tobacco or alcohol duty-free concessions.' : `Cigarettes ${tobacco.cigarettes}, or cigars ${tobacco.cigars}, or tobacco ${tobacco.tobacco_g} g.${tobacco.devices ? ` E-cigarette devices ${tobacco.devices}, pods ${tobacco.pods}, total liquid ${tobacco.liquid_ml} ml.` : ' Macao daily combined tobacco weight: 25 g; each cigar under 3 g.'}${alcohol.litres ? ` Alcohol at ${facts.destination === 'macau' ? 'over 30%' : '12% ABV or above'}: ${alcohol.litres} L.` : ' No duty-free alcohol at 12% ABV or above.'}${facts.traveller === 'frequent' && facts.destination === 'mainland' ? ' Tobacco allowance: once per day.' : ''}`;
  return { zh: { answer: `${amountZh}\n${limitsZh}\n核验日期：${facts.as_of}。`, considerations: [customsDisclaimer.zh], next_steps: [], question: '' }, en: { answer: `${amountEn}\n${limitsEn}\nVerified: ${facts.as_of}.`, considerations: [customsDisclaimer.en], next_steps: [], question: '' }, source_ids: [], product_ids: [] };
}
