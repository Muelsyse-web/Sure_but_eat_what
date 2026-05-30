const { gcj02ToBd09, haversineMeters, toNumber } = require('./geo')

const EXCLUDED_RESTAURANT_TERMS = [
  '食品公司', '食材供应', '批发', '菜市场', '生鲜超市', '便利店',
  '烟酒', '药房', '学校', '公司', '培训', '酒店用品'
]

const SOURCE_PRIORITY = {
  amap: 3,
  baidu: 2,
  tencent_fallback: 1,
  tencent: 1
}

function normalizeName(name) {
  return String(name || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[·•\s\-_/]/g, '')
    .replace(/店|餐厅|餐馆|饭店|美食|小吃/g, '')
    .trim()
    .toLowerCase()
}

function parseAmapLocation(location) {
  const parts = String(location || '').split(',')
  if (parts.length !== 2) return null
  const lng = toNumber(parts[0])
  const lat = toNumber(parts[1])
  if (lat == null || lng == null) return null
  return { lat, lng }
}

function normalizeTencentLocation(location) {
  if (!location) return null
  const lat = toNumber(location.lat)
  const lng = toNumber(location.lng)
  if (lat == null || lng == null) return null
  return { lat, lng }
}

function isNumericCost(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
}

function looksLikeRestaurant(name, category, typecode) {
  const text = `${name || ''} ${category || ''}`
  if (typecode && !String(typecode).startsWith('05')) return false
  if (category && !String(category).includes('餐饮服务')) return false
  return !EXCLUDED_RESTAURANT_TERMS.some(term => text.includes(term))
}

function normalizeAmapPoi(item) {
  const title = item.name || item.title
  const category = item.type || item.category
  const typecode = item.typecode
  if (!looksLikeRestaurant(title, category, typecode)) return null

  const location = parseAmapLocation(item.location)
  if (!location) return null

  const rawCost = item.biz_ext && item.biz_ext.cost
  const rawRating = item.biz_ext && item.biz_ext.rating
  const hasCost = isNumericCost(rawCost)

  return {
    id: `amap:${item.id}`,
    title,
    address: item.address || '',
    category,
    typecode,
    location,
    distance: toNumber(item.distance),
    biz_ext: {
      rating: rawRating || null,
      cost: hasCost ? String(rawCost) : null
    },
    source: 'amap',
    data_sources: ['amap'],
    avg_cost: hasCost ? Number(rawCost) : null,
    avg_cost_source: hasCost ? 'amap' : null,
    confidence: 0.9,
    provider_ids: {
      amap: item.id || null,
      baidu: null,
      tencent: null
    }
  }
}

function getBaiduLocationInGcjComparable(restaurant) {
  if (!restaurant || !restaurant.location) return null
  return gcj02ToBd09(restaurant.location.lat, restaurant.location.lng)
}

function baiduMatchesRestaurant(restaurant, baiduItem) {
  if (!baiduItem || !baiduItem.detail_info) return false
  const baiduType = baiduItem.detail_info.type || baiduItem.type
  if (baiduType && baiduType !== 'cater') return false

  const baiduLocation = baiduItem.location && {
    lat: baiduItem.location.lat,
    lng: baiduItem.location.lng
  }
  const comparableRestaurantLocation = getBaiduLocationInGcjComparable(restaurant)
  const distance = baiduLocation && comparableRestaurantLocation
    ? haversineMeters(comparableRestaurantLocation, baiduLocation)
    : null
  if (distance != null && distance > 120) return false

  const left = normalizeName(restaurant.title)
  const right = normalizeName(baiduItem.name)
  if (!left || !right) return false
  return left.includes(right) || right.includes(left)
}

function applyBaiduCost(restaurant, baiduItem) {
  if (!baiduMatchesRestaurant(restaurant, baiduItem)) return restaurant
  const price = baiduItem.detail_info && baiduItem.detail_info.price
  if (!isNumericCost(price)) return restaurant

  return {
    ...restaurant,
    biz_ext: {
      ...restaurant.biz_ext,
      cost: String(price),
      rating: restaurant.biz_ext.rating || baiduItem.detail_info.overall_rating || null
    },
    avg_cost: Number(price),
    avg_cost_source: 'baidu',
    data_sources: Array.from(new Set([...(restaurant.data_sources || []), 'baidu'])),
    provider_ids: {
      ...restaurant.provider_ids,
      baidu: baiduItem.uid || null
    },
    confidence: Math.max(restaurant.confidence || 0, 0.92)
  }
}

function normalizeTencentPoi(item) {
  const title = item.title
  const category = item.category
  const text = `${title || ''} ${category || ''}`
  if (!title || EXCLUDED_RESTAURANT_TERMS.some(term => text.includes(term))) return null

  const location = normalizeTencentLocation(item.location)
  if (!location) return null

  const rawCost = item.biz_ext && item.biz_ext.cost
  const hasCost = isNumericCost(rawCost)

  return {
    id: `tencent:${item.id || title}`,
    title,
    address: item.address || '',
    category,
    location,
    distance: toNumber(item._distance || item.distance),
    biz_ext: {
      rating: item.biz_ext ? item.biz_ext.rating : null,
      cost: hasCost ? String(rawCost) : null
    },
    source: 'tencent_fallback',
    data_sources: ['tencent'],
    avg_cost: hasCost ? Number(rawCost) : null,
    avg_cost_source: hasCost ? 'tencent' : null,
    confidence: 0.65,
    provider_ids: {
      amap: null,
      baidu: null,
      tencent: item.id || null
    }
  }
}

function shouldReplaceRestaurant(current, candidate) {
  return (SOURCE_PRIORITY[candidate.source] || 0) > (SOURCE_PRIORITY[current.source] || 0)
}

function isDuplicateRestaurant(left, right) {
  const leftName = normalizeName(left.title)
  const rightName = normalizeName(right.title)
  if (!leftName || !rightName) return false
  if (!(leftName.includes(rightName) || rightName.includes(leftName))) return false
  const distance = haversineMeters(left.location, right.location)
  return distance == null || distance <= 80
}

function dedupeRestaurants(restaurants) {
  const deduped = []
  for (const restaurant of restaurants) {
    const index = deduped.findIndex(item => isDuplicateRestaurant(item, restaurant))
    if (index === -1) {
      deduped.push(restaurant)
    } else if (shouldReplaceRestaurant(deduped[index], restaurant)) {
      deduped[index] = restaurant
    }
  }
  return deduped
}

module.exports = {
  normalizeName,
  normalizeAmapPoi,
  normalizeTencentPoi,
  applyBaiduCost,
  looksLikeRestaurant,
  dedupeRestaurants,
  isDuplicateRestaurant
}
