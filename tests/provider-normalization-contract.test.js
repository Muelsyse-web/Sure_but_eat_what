const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const cloudIndex = fs.readFileSync(path.join(root, 'cloudfunctions/fetchRestaurants/index.js'), 'utf8')
const cacheJs = fs.readFileSync(path.join(root, 'utils/cache.js'), 'utf8')
const normalizersPath = path.join(root, 'cloudfunctions/fetchRestaurants/normalizers.js')
const geoPath = path.join(root, 'cloudfunctions/fetchRestaurants/geo.js')
const baiduProviderPath = path.join(root, 'cloudfunctions/fetchRestaurants/providers/baidu.js')

assert(
  /process\.env\.AMAP_MAP_KEY/.test(cloudIndex),
  'cloud function should read AMap key from environment variables'
)

assert(
  /process\.env\.BAIDU_MAP_AK/.test(cloudIndex),
  'cloud function should read Baidu AK from environment variables'
)

assert(
  !/const TENCENT_MAP_KEY\s*=\s*['"][A-Z0-9-]+['"]/.test(cloudIndex),
  'Tencent key should not be hardcoded in source'
)

assert(
  /CACHE_VERSION\s*=\s*3/.test(cacheJs),
  'restaurant cache should include a version bump so stale entries without dynamic cuisine tags are ignored'
)

assert(fs.existsSync(normalizersPath), 'provider normalizers should live in a focused module')
assert(fs.existsSync(geoPath), 'geo helpers should live in a focused module')
assert(fs.existsSync(baiduProviderPath), 'Baidu enrichment should live in a provider module')

const normalizers = require(normalizersPath)
const geo = require(geoPath)
const baiduProviderJs = fs.readFileSync(baiduProviderPath, 'utf8')

const amapRestaurant = normalizers.normalizeAmapPoi({
  id: 'B001',
  name: '阿强川菜',
  address: '文三路 1 号',
  type: '餐饮服务;中餐厅;四川菜(川菜)',
  typecode: '050102',
  location: '120.155100,30.274100',
  distance: '238',
  biz_ext: { rating: '4.6', cost: '62' }
})

assert.strictEqual(amapRestaurant.title, '阿强川菜')
assert.deepStrictEqual(amapRestaurant.location, { lat: 30.2741, lng: 120.1551 })
assert.strictEqual(amapRestaurant.biz_ext.cost, '62')
assert.deepStrictEqual(amapRestaurant.tags, [])
assert.strictEqual(amapRestaurant.avg_cost, 62)
assert.strictEqual(amapRestaurant.avg_cost_source, 'amap')
assert.deepStrictEqual(amapRestaurant.data_sources, ['amap'])

const badPoi = normalizers.normalizeAmapPoi({
  id: 'B002',
  name: '阿强食品公司',
  type: '公司企业;公司',
  typecode: '170000',
  location: '120.155100,30.274100'
})

assert.strictEqual(badPoi, null)

const bdLocation = geo.gcj02ToBd09(amapRestaurant.location.lat, amapRestaurant.location.lng)
const enriched = normalizers.applyBaiduCost(amapRestaurant, {
  uid: 'baidu-1',
  name: '阿强川菜馆',
  location: bdLocation,
  detail_info: { type: 'cater', price: '68', overall_rating: '4.7' }
})

assert.strictEqual(enriched.biz_ext.cost, '68')
assert.strictEqual(enriched.avg_cost, 68)
assert.strictEqual(enriched.avg_cost_source, 'baidu')
assert(enriched.data_sources.includes('baidu'))
assert.strictEqual(enriched.provider_ids.baidu, 'baidu-1')

const ratingOnlyCandidate = {
  ...amapRestaurant,
  biz_ext: {
    ...amapRestaurant.biz_ext,
    rating: null
  }
}
const ratingEnriched = normalizers.applyBaiduCost(ratingOnlyCandidate, {
  uid: 'baidu-rating',
  name: '阿强川菜馆',
  location: bdLocation,
  detail_info: { type: 'cater', overall_rating: '4.8' }
})

assert.strictEqual(ratingEnriched.biz_ext.rating, '4.8')
assert.strictEqual(ratingEnriched.biz_ext.cost, '62')
assert.strictEqual(ratingEnriched.avg_cost, 62)
assert.strictEqual(ratingEnriched.avg_cost_source, 'amap')

const farBaiduLocation = geo.gcj02ToBd09(amapRestaurant.location.lat + 0.02, amapRestaurant.location.lng + 0.02)
assert.strictEqual(
  normalizers.applyBaiduCost(amapRestaurant, {
    uid: 'baidu-far',
    name: '阿强川菜馆',
    location: farBaiduLocation,
    detail_info: { type: 'cater', price: '88' }
  }),
  amapRestaurant,
  'Baidu matching should compare coordinates in the same coordinate system and reject far matches'
)

const duplicateAmap = {
  ...amapRestaurant,
  id: 'amap:B001-copy',
  source: 'amap',
  location: { lat: 30.274105, lng: 120.155105 }
}
const duplicateTencent = {
  ...amapRestaurant,
  id: 'tencent:T001',
  source: 'tencent_fallback',
  provider_ids: { amap: null, baidu: null, tencent: 'T001' }
}

const deduped = normalizers.dedupeRestaurants([duplicateTencent, duplicateAmap])
assert.strictEqual(deduped.length, 1)
assert.strictEqual(deduped[0].source, 'amap', 'dedupe should prefer AMap over Tencent fallback')

assert(
  /MAX_BAIDU_ENRICHMENT_COUNT/.test(baiduProviderJs) && /Promise\.allSettled/.test(baiduProviderJs),
  'Baidu enrichment should be capped and concurrency-safe instead of doing unbounded serial requests'
)

assert(
  /avg_cost\s*==\s*null/.test(baiduProviderJs) && /biz_ext\.rating\s*==\s*null/.test(baiduProviderJs),
  'Baidu enrichment should target restaurants missing either average cost or rating'
)
