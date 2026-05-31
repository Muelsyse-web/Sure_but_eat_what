const cloud = require('wx-server-sdk')
const { searchAmapRestaurants } = require('./providers/amap')
const { enrichMissingCostsWithBaidu } = require('./providers/baidu')
const { searchTencentFallback } = require('./providers/tencent')
const { dedupeRestaurants } = require('./normalizers')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function normalizeCuisines(cuisines, cuisine) {
  const raw = Array.isArray(cuisines) && cuisines.length > 0 ? cuisines : [cuisine]
  return raw.filter(item => item && item !== '不限' && item !== '全部')
}

function normalizeOptionName(name) {
  return String(name || '').trim()
}

function extractCategoryLeaf(category) {
  const parts = String(category || '')
    .split(/[;\uFF1B]/)
    .map(item => item.trim())
    .filter(Boolean)
  const leaf = parts[parts.length - 1] || ''
  return leaf
    .replace(/[（(].*?[）)]/g, '')
    .replace(/餐厅|中餐厅|小吃快餐店|快餐厅|餐饮服务/g, '')
    .trim()
}

function buildAvailableCuisineOptions(restaurants) {
  const options = []
  const seen = new Set()

  function addOption(name, source) {
    const normalized = normalizeOptionName(name)
    if (!normalized || normalized === '不限' || seen.has(normalized)) return
    seen.add(normalized)
    options.push({ name: normalized, source })
  }

  for (const restaurant of Array.isArray(restaurants) ? restaurants : []) {
    ;(restaurant.tags || []).forEach(tag => addOption(tag, 'tag'))
  }

  for (const restaurant of Array.isArray(restaurants) ? restaurants : []) {
    if (!Array.isArray(restaurant.tags) || restaurant.tags.length === 0) {
      addOption(extractCategoryLeaf(restaurant.category), 'category')
    }
  }

  return options.slice(0, 20)
}

function normalizeRadius(radius) {
  const num = Number(radius)
  if (!Number.isFinite(num)) return 1000
  return Math.min(1000, Math.max(10, Math.floor(num)))
}

function hasCostFilter(costMin, costMax) {
  return costMin !== null && costMin !== undefined ||
         costMax !== null && costMax !== undefined
}

function hasRatingFilter(ratingMin, ratingMax) {
  return ratingMin !== null && ratingMin !== undefined ||
         ratingMax !== null && ratingMax !== undefined
}

function getCostValue(item) {
  const avgCost = item && item.avg_cost
  if (avgCost != null && Number.isFinite(Number(avgCost))) return Number(avgCost)

  const bizCost = item && item.biz_ext && item.biz_ext.cost
  if (bizCost != null && Number.isFinite(Number(bizCost))) return Number(bizCost)

  return null
}

function getRatingValue(item) {
  const rating = item && item.biz_ext && item.biz_ext.rating
  if (rating == null || String(rating).trim() === '') return null

  const num = Number(rating)
  return Number.isFinite(num) ? num : null
}

function normalizeRatingValue(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.min(5, Math.max(0, num))
}

function normalizeRatingRange(ratingMin, ratingMax) {
  const normalizedMin = normalizeRatingValue(ratingMin)
  const normalizedMax = ratingMax === null || ratingMax === undefined || ratingMax === ''
    ? (normalizedMin !== null ? 5 : null)
    : normalizeRatingValue(ratingMax)

  return {
    rating_min: normalizedMin,
    rating_max: normalizedMax
  }
}

function matchCuisine(category, cuisine) {
  if (!category || !cuisine) return true
  if (cuisine === '不限' || cuisine === '全部') return true

  const cat = String(category).toLowerCase()
  const cuisineMap = {
    '川菜': ['川菜', '四川', '成都', '麻辣', '火锅', '串串', '冒菜', '钵钵鸡'],
    '粤菜': ['粤菜', '广东', '广州', '茶餐厅', '烧腊', '煲仔', '蒸点', '糖水'],
    '日料': ['日本', '日式', '寿司', '刺身', '拉面', '居酒屋', '铁板烧', '鳗鱼'],
    '西餐': ['西餐', '牛排', '披萨', '意面', '汉堡', '沙拉', '法餐', '意大利'],
    '火锅': ['火锅', '涮', '锅底'],
    '烧烤': ['烧烤', '烤肉', '烤串', 'BBQ'],
    '小吃': ['小吃', '面', '粉', '饺', '包', '粥', '饼', '馄饨', '米线'],
    '韩餐': ['韩国', '韩式', '烤肉', '拌饭', '炸鸡'],
    '东南亚': ['泰国', '越南', '印度', '咖喱', '冬阴', '马来'],
    '快餐': ['快餐', '麦当劳', '肯德基', '汉堡', '炸鸡']
  }

  const keywords = cuisineMap[cuisine] || [cuisine]
  return keywords.some(kw => cat.includes(String(kw).toLowerCase()))
}

function restaurantMatchesCuisine(restaurant, cuisine) {
  if (!cuisine || cuisine === '不限' || cuisine === '全部') return true
  const target = String(cuisine).toLowerCase()
  const tags = Array.isArray(restaurant.tags) ? restaurant.tags : []
  if (tags.some(tag => String(tag).toLowerCase().includes(target) || target.includes(String(tag).toLowerCase()))) {
    return true
  }
  return matchCuisine(restaurant.category, cuisine)
}

function applyFilters(restaurants, {
  cuisineList,
  cost_min,
  cost_max,
  rating_min,
  rating_max,
  include_unrated,
  include_uncosted,
  radius
}) {
  const costMinActive = cost_min !== null && cost_min !== undefined
  const costMaxActive = cost_max !== null && cost_max !== undefined
  const ratingRange = normalizeRatingRange(rating_min, rating_max)
  const ratingMinActive = ratingRange.rating_min !== null
  const ratingMaxActive = ratingRange.rating_max !== null

  return restaurants.filter(item => {
    if (item.distance != null && Number(item.distance) > radius) return false
    if (cuisineList.length > 0 && !cuisineList.some(cuisine => restaurantMatchesCuisine(item, cuisine))) return false

    if (costMinActive || costMaxActive) {
      const cost = getCostValue(item)
      if (cost == null) return include_uncosted === true
      if (costMinActive && cost < Number(cost_min)) return false
      if (costMaxActive && cost > Number(cost_max)) return false
    }

    if (ratingMinActive || ratingMaxActive) {
      const rating = getRatingValue(item)
      if (rating == null) return include_unrated === true
      if (ratingMinActive && rating < ratingRange.rating_min) return false
      if (ratingMaxActive && rating > ratingRange.rating_max) return false
    }

    return true
  })
}

function buildProviderSummary() {
  return {
    amap: { attempted: false, count: 0, error: null },
    baidu: { attempted: false, enriched: 0, error: null },
    tencent: { attempted: false, count: 0, error: null }
  }
}

exports.main = async (event) => {
  const {
    latitude,
    longitude,
    radius = 1000,
    cost_min = null,
    cost_max = null,
    rating_min = null,
    rating_max = null,
    include_unrated = false,
    include_uncosted = false,
    cuisine = null,
    cuisines = [],
    distance_max = null
  } = event

  const providerSummary = buildProviderSummary()

  if (latitude == null || longitude == null) {
    return { success: false, error: '缺少必要参数：latitude 和 longitude', providerSummary }
  }

  if (!process.env.AMAP_MAP_KEY && !process.env.TENCENT_MAP_KEY) {
    return {
      success: false,
      error: '缺少餐厅数据源配置',
      detail: '请在 fetchRestaurants 云函数环境变量中配置 AMAP_MAP_KEY，或至少配置 TENCENT_MAP_KEY 作为兜底。',
      providerSummary
    }
  }

  const searchRadius = normalizeRadius(distance_max != null ? distance_max : radius)
  const cuisineList = normalizeCuisines(cuisines, cuisine)

  try {
    let restaurants = []

    if (process.env.AMAP_MAP_KEY) {
      try {
        providerSummary.amap.attempted = true
        restaurants = await searchAmapRestaurants({
          key: process.env.AMAP_MAP_KEY,
          latitude,
          longitude,
          radius: searchRadius
        })
        providerSummary.amap.count = restaurants.length
      } catch (err) {
        providerSummary.amap.error = err.message
      }
    }

    if (restaurants.length < 4 && process.env.TENCENT_MAP_KEY) {
      try {
        providerSummary.tencent.attempted = true
        const fallback = await searchTencentFallback({
          key: process.env.TENCENT_MAP_KEY,
          latitude,
          longitude,
          radius: searchRadius
        })
        providerSummary.tencent.count = fallback.length
        restaurants = dedupeRestaurants(restaurants.concat(fallback))
      } catch (err) {
        providerSummary.tencent.error = err.message
      }
    }

    if (process.env.BAIDU_MAP_AK && restaurants.length > 0) {
      try {
        const before = restaurants.filter(item => item.avg_cost != null).length
        providerSummary.baidu.attempted = true
        restaurants = await enrichMissingCostsWithBaidu({
          key: process.env.BAIDU_MAP_AK,
          restaurants
        })
        const after = restaurants.filter(item => item.avg_cost != null).length
        providerSummary.baidu.enriched = Math.max(0, after - before)
      } catch (err) {
        providerSummary.baidu.error = err.message
      }
    }

    const dedupedRestaurants = dedupeRestaurants(restaurants)
    const availableCuisines = buildAvailableCuisineOptions(dedupedRestaurants)
    const filtered = applyFilters(dedupedRestaurants, {
      cuisineList,
      cost_min,
      cost_max,
      rating_min,
      rating_max,
      include_unrated,
      include_uncosted,
      radius: searchRadius
    }).slice(0, 50)

    return {
      success: true,
      data: filtered,
      total: filtered.length,
      availableCuisines,
      providerSummary,
      costFilterRequiresPrice: hasCostFilter(cost_min, cost_max),
      ratingFilterRequiresRating: hasRatingFilter(rating_min, rating_max),
      message: filtered.length === 0 ? '附近暂无符合条件的餐厅' : `找到 ${filtered.length} 家餐厅`
    }
  } catch (err) {
    return {
      success: false,
      error: '地图服务暂不可用',
      detail: err.message,
      providerSummary
    }
  }
}

exports._test = {
  applyFilters,
  normalizeRatingRange,
  buildAvailableCuisineOptions
}
