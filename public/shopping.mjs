import { canonicalQuery } from './identity.mjs';
export function searchTerm(value) {
  return canonicalQuery(value).replace(/^(?:请|帮我|我|想|要|准备|打算|购买|买|找|搜索|一下|看看|周末去澳门玩[，,]?|去澳门[，,]?)+/g, '').replace(/(?:\d+|[一二两三四五六七八九十]+)\s*(?:瓶|支|盒|件|个)/g, '').split(/[，,。？?！!\n]/)[0].replace(/(?:在哪买.*|哪里买.*|多少钱.*|价格如何.*|怎么选.*|更划算.*|好不好.*|值得买吗.*|帮我.*)$/, '').trim().slice(0, 120);
}

export function identificationQuery(item) {
  if (item.search_keywords?.[0]) return item.search_keywords[0].slice(0, 120);
  const name = item.product_name || '';
  return [item.brand && !name.toLowerCase().includes(item.brand.toLowerCase()) ? item.brand : '', name || item.category || item.visible_text?.[0]].filter(Boolean).join(' ').slice(0, 120);
}
