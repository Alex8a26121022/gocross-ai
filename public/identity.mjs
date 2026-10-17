export function canonicalQuery(value = '') {
  return String(value ?? '').normalize('NFKC').replace(/[‐‑‒–—−]/g, '-').replace(/\bsk[\s._-]*(?:ii|2)(?=$|[^a-z0-9])/gi, 'SK-II').replace(/\s+/g, ' ').trim();
}
export const normalise = (value = '') => canonicalQuery(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function specification(value = '') {
  const text = canonicalQuery(value).toLowerCase().replace(/毫升/g, 'ml').replace(/毫克/g, 'mg').replace(/千克|公斤/g, 'kg').replace(/克/g, 'g').replace(/[×✕]/g, '*');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(ml|mg|kg|g|l)(?:\s*[*x]\s*(\d+))?/i);
  if (!match) return null;
  let amount = Number(match[1]), unit = match[2].toLowerCase();
  if (unit === 'l') { amount *= 1000; unit = 'ml'; }
  if (unit === 'kg') { amount *= 1000; unit = 'g'; }
  if (unit === 'mg') { amount /= 1000; unit = 'g'; }
  const pack = text.match(/(\d+)\s*(?:瓶|支|件|片)装?/);
  const count = Number(match[3] || pack?.[1] || (/双瓶|双支|两支|两瓶/.test(text) ? 2 : 1));
  if (amount <= 0 || count < 1) return null;
  return { amount, unit, count, key: `${amount}${unit}*${count}` };
}

export function productFamily(value = '') {
  const rules = [
    ['clear-lotion', /清莹|清瑩|clear\s*lotion/i],
    ['treatment-essence', /神仙水|护肤精华露|facial\s*treatment\s*essence/i],
    ['eye', /眼霜|眼部|eye\s*(?:cream|serum)/i],
    ['mask', /面膜|面贴膜|facial\s*mask|sheet\s*mask/i],
    ['toner', /护肤水|化妆水|爽肤水|精华水|精萃水|toner|essence\s*lotion/i],
    ['perfume', /香水|香氛|perfume|parfum|eau de/i],
    ['cream', /面霜|乳霜|凝霜|cream/i],
    ['serum', /精华液|精华露|serum/i],
  ];
  return rules.find(([, pattern]) => pattern.test(canonicalQuery(value)))?.[0] || null;
}

export function sameProduct(a, b) {
  const specA = specification(a.specification || a.name), specB = specification(b.specification || b.name);
  if (specA && specB && specA.key !== specB.key) return false;
  const barcodesA = (a.variants || []).map((v) => v.barcode).filter(Boolean);
  if ((b.variants || []).some((v) => v.barcode && barcodesA.includes(v.barcode))) return true;
  const brandA = normalise(a.brand), brandB = normalise(b.brand);
  if (brandA && brandB && brandA !== brandB) return false;
  if (!specA || !specB || specA.key !== specB.key) return false;
  const familyA = productFamily(a.name), familyB = productFamily(b.name);
  if (familyA && familyB && familyA !== familyB) return false;
  const removeSpec = (name) => normalise(name.replace(/\d+(?:\.\d+)?\s*(?:ml|毫升|g|克)(?:\s*[*×x]\s*\d+)?/gi, '').replace(/官方旗舰店|旗舰店|京东自营|正品|包邮/g, ''));
  return removeSpec(a.name) === removeSpec(b.name);
}
