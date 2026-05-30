const { getJson } = require('../http')
const { gcj02ToBd09 } = require('../geo')
const { applyBaiduCost } = require('../normalizers')

const BAIDU_PLACE_URL = 'https://api.map.baidu.com/place/v2/search'
const MAX_BAIDU_ENRICHMENT_COUNT = 12
const BAIDU_BATCH_SIZE = 3
const BAIDU_TIMEOUT_MS = 2500

async function enrichOneRestaurant(key, restaurant) {
  const bd = gcj02ToBd09(restaurant.location.lat, restaurant.location.lng)
  const result = await getJson(BAIDU_PLACE_URL, {
    ak: key,
    query: restaurant.title,
    tag: '美食',
    location: `${bd.lat},${bd.lng}`,
    radius: 150,
    scope: 2,
    filter: 'industry_type:cater|sort_name:distance|sort_rule:1',
    page_size: 10,
    page_num: 0,
    output: 'json'
  }, BAIDU_TIMEOUT_MS)

  if (result.status !== 0 || !Array.isArray(result.results)) {
    return restaurant
  }

  for (const item of result.results) {
    const enriched = applyBaiduCost(restaurant, item)
    if (enriched !== restaurant) return enriched
  }
  return restaurant
}

async function enrichMissingCostsWithBaidu({ key, restaurants }) {
  if (!key) return restaurants

  const enriched = restaurants.slice()
  const targets = restaurants
    .map((restaurant, index) => ({ restaurant, index }))
    .filter(item => item.restaurant.avg_cost == null)
    .slice(0, MAX_BAIDU_ENRICHMENT_COUNT)

  for (let i = 0; i < targets.length; i += BAIDU_BATCH_SIZE) {
    const batch = targets.slice(i, i + BAIDU_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(item => enrichOneRestaurant(key, item.restaurant))
    )

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        enriched[batch[index].index] = result.value
      }
    })
  }

  return enriched
}

module.exports = {
  enrichMissingCostsWithBaidu,
  MAX_BAIDU_ENRICHMENT_COUNT,
  BAIDU_BATCH_SIZE
}
