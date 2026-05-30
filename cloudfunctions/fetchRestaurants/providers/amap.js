const { getJson } = require('../http')
const { normalizeAmapPoi } = require('../normalizers')

const AMAP_AROUND_URL = 'https://restapi.amap.com/v3/place/around'

async function searchAmapRestaurants({ key, latitude, longitude, radius }) {
  if (!key) throw new Error('缺少 AMAP_MAP_KEY')

  const result = await getJson(AMAP_AROUND_URL, {
    key,
    location: `${longitude},${latitude}`,
    radius,
    types: '050000',
    extensions: 'all',
    sortrule: 'distance',
    offset: 25,
    page: 1,
    output: 'json'
  })

  if (String(result.status) !== '1') {
    const info = result.info || result.infocode || 'AMap API 返回异常'
    throw new Error(info)
  }

  const pois = Array.isArray(result.pois) ? result.pois : []
  return pois.map(normalizeAmapPoi).filter(Boolean)
}

module.exports = { searchAmapRestaurants }
