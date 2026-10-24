// 常见澳门商品参考价（编辑整理，非实时报价）。
// 任何取值都只是区间参考，不得进入 calculate_cost 或渠道比价，也不得当作库存证据。
const mo = (min, max) => ({ min, max, currency: 'MOP' });

export const commonGoods = [
  { id: 'egg-tart', name: '葡式蛋挞', aliases: ['葡挞', '葡撻', '蛋挞', '蛋塔', '葡萄牙蛋挞', 'egg tart', 'pastel de nata'], category: '烘焙小吃', unit: '个', priceRange: mo(8, 12), typicalPrice: 10, shops: ['钜记饼家 Koi Kei', '咀香园 Choi Hei', '安德鲁饼店', '玛嘉烈蛋挞'], note: '澳门饼家与茶餐厅常见单个价位，不同门店略有差异', asOf: '2026-10' },
  { id: 'almond-cookie', name: '杏仁饼', aliases: ['杏仁餅', '杏仁糕', 'almond cookie', 'almond cake'], category: '手信糕点', unit: '盒', priceRange: mo(25, 45), typicalPrice: 35, shops: ['钜记饼家 Koi Kei', '咀香园 Choi Hei'], note: '常规礼盒装，按盒计', asOf: '2026-10' },
  { id: 'jerky', name: '猪肉干', aliases: ['猪肉乾', '豬肉乾', '牛肉干', '牛肉乾', 'jerky', 'beef jerky'], category: '手信零食', unit: '包', priceRange: mo(40, 70), typicalPrice: 55, shops: ['钜记饼家 Koi Kei', '咀香园 Choi Hei'], note: '按包计，重量与口味不同价格有差异', asOf: '2026-10' },
  { id: 'pork-chop-bun', name: '猪扒包', aliases: ['豬扒包', 'pork chop bun'], category: '茶餐厅小吃', unit: '个', priceRange: mo(25, 40), typicalPrice: 32, shops: ['澳门茶餐厅（街头常见）'], note: '茶餐厅常见价位', asOf: '2026-10' },
  { id: 'bottled-water', name: '瓶装水', aliases: ['矿泉水', 'bottled water', 'water'], category: '便利饮品', unit: '瓶', priceRange: mo(5, 10), typicalPrice: 7, shops: ['便利店（7-Eleven、Circle K 等）'], note: '500ml 常见价位', asOf: '2026-10' },
  { id: 'milk-tea', name: '奶茶', aliases: ['珍珠奶茶', 'milk tea', '咖啡', 'coffee'], category: '饮品', unit: '杯', priceRange: mo(15, 25), typicalPrice: 20, shops: ['连锁饮品店'], note: '常规中杯价位', asOf: '2026-10' },
];

const norm = (value = '') => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s`'"“”‘’·・,，。.!！?？()（）\-_/]/g, '');

export function lookupCommonGoods(query) {
  const q = norm(query);
  if (!q || q.length < 2) return [];
  return commonGoods.filter((item) => [item.name, ...item.aliases].some((word) => {
    const w = norm(word);
    return w.length >= 2 && (q.includes(w) || w.includes(q));
  })).map(({ priceRange, ...item }) => ({
    ...item,
    price_range: priceRange,
    kind: 'editorial_reference',
    limitation: '常见售价区间，供顾客预估；实际以门店当日标价为准，库存需到店确认。不得用于成本计算或渠道比价。',
  }));
}
