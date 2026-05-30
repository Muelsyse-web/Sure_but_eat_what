const { getJson } = require('../http')
const { normalizeTencentPoi } = require('../normalizers')

const TENCENT_SEARCH_URL = 'https://apis.map.qq.com/ws/place/v1/search'

async function searchTencentFallback({ key, latitude, longitude, radius }) {
  if (!key) return []

  const result = await getJson(TENCENT_SEARCH_URL, {
    key,
    keyword: '餐厅',
    boundary: `nearby(${latitude},${longitude},${radius},0)`,
    page_size: 20,
    orderby: '_distance'
  })

  if (result.status !== 0) return []
  const data = Array.isArray(result.data) ? result.data : []
  return data.map(normalizeTencentPoi).filter(Boolean)
}

module.exports = { searchTencentFallback }
