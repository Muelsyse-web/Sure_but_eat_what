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

function normalizeRadius(radius) {
  const num = Number(radius)
  if (!Number.isFinite(num)) return 1000
  return Math.min(1000, Math.max(10, Math.floor(num)))
}

function hasCostFilter(costMin, costMax) {
  return costMin !== null && costMin !== undefined ||
         costMax !== null && costMax !== undefined
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

function applyFilters(restaurants, { cuisineList, cost_min, cost_max, radius }) {
  const costMinActive = cost_min !== null && cost_min !== undefined
  const costMaxActive = cost_max !== null && cost_max !== undefined

  return restaurants.filter(item => {
    if (item.distance != null && Number(item.distance) > radius) return false
    if (cuisineList.length > 0 && !cuisineList.some(cuisine => matchCuisine(item.category, cuisine))) return false

    if (costMinActive || costMaxActive) {
      if (item.avg_cost == null || !Number.isFinite(Number(item.avg_cost))) return false
      if (costMinActive && Number(item.avg_cost) < Number(cost_min)) return false
      if (costMaxActive && Number(item.avg_cost) > Number(cost_max)) return false
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

    const filtered = applyFilters(dedupeRestaurants(restaurants), {
      cuisineList,
      cost_min,
      cost_max,
      radius: searchRadius
    }).slice(0, 50)

    return {
      success: true,
      data: filtered,
      total: filtered.length,
      providerSummary,
      costFilterRequiresPrice: hasCostFilter(cost_min, cost_max),
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
