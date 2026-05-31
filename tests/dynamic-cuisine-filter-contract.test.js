const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const cacheJs = fs.readFileSync(path.join(root, 'utils/cache.js'), 'utf8')
const cloudIndexPath = path.join(root, 'cloudfunctions/fetchRestaurants/index.js')
const cloudIndex = fs.readFileSync(cloudIndexPath, 'utf8')
const normalizers = require(path.join(root, 'cloudfunctions/fetchRestaurants/normalizers.js'))

const taggedRestaurant = normalizers.normalizeAmapPoi({
  id: 'B101',
  name: '军师烤鱼',
  type: '餐饮服务;中餐厅;川菜',
  typecode: '050102',
  location: '120.155100,30.274100',
  distance: '120',
  tag: '烤鱼,麻辣香锅、酸菜鱼',
  biz_ext: { rating: '4.5', cost: '78' }
})

assert.deepStrictEqual(
  taggedRestaurant.tags,
  ['烤鱼', '麻辣香锅', '酸菜鱼'],
  'AMap tag should be normalized into restaurant.tags'
)

assert(
  /CACHE_VERSION\s*=\s*3/.test(cacheJs),
  'restaurant cache version should bump so old cached records without tags are ignored'
)

assert(
  /availableCuisineOptions:\s*\[\]/.test(pageJs) &&
  /buildAvailableCuisineOptions/.test(pageJs) &&
  !/const CUISINE_OPTIONS\s*=/.test(pageJs),
  'page should use dynamic cuisine options instead of a fixed CUISINE_OPTIONS list'
)

assert(
  /先获取天意，再看附近口味/.test(pageWxml),
  'cuisine filter should show a fetch-first hint before dynamic options exist'
)

const sandbox = {
  module: { exports: {} },
  exports: {},
  require(request) {
    if (request === 'wx-server-sdk') {
      return { DYNAMIC_CURRENT_ENV: 'test', init() {} }
    }
    if (request === './providers/amap') return { searchAmapRestaurants: async () => [] }
    if (request === './providers/baidu') return { enrichMissingCostsWithBaidu: async ({ restaurants }) => restaurants }
    if (request === './providers/tencent') return { searchTencentFallback: async () => [] }
    if (request === './normalizers') return { dedupeRestaurants: restaurants => restaurants }
    throw new Error(`Unexpected require: ${request}`)
  },
  process: { env: {} },
  console
}
sandbox.exports = sandbox.module.exports
vm.runInNewContext(cloudIndex, sandbox, { filename: cloudIndexPath })

const { applyFilters, buildAvailableCuisineOptions } = sandbox.module.exports._test
assert.strictEqual(typeof buildAvailableCuisineOptions, 'function')

const cuisineOptions = buildAvailableCuisineOptions([
  { title: '鱼 A', tags: ['烤鱼', '酸菜鱼'], category: '餐饮服务;中餐厅;川菜' },
  { title: '饭 B', tags: [], category: '餐饮服务;中餐厅;粤菜' }
])

assert.strictEqual(
  JSON.stringify(cuisineOptions.slice(0, 3)),
  JSON.stringify([
    { name: '烤鱼', source: 'tag' },
    { name: '酸菜鱼', source: 'tag' },
    { name: '粤菜', source: 'category' }
  ]),
  'available cuisine options should prefer API tags and fall back to category leaf values'
)

assert.deepStrictEqual(
  applyFilters([
    { title: '命中标签', tags: ['烤鱼'], category: '餐饮服务;中餐厅;川菜', distance: 80, biz_ext: { rating: '4.3' } },
    { title: '命中类别', tags: [], category: '餐饮服务;中餐厅;粤菜', distance: 90, biz_ext: { rating: '4.4' } },
    { title: '无关项', tags: ['汉堡'], category: '餐饮服务;快餐厅', distance: 100, biz_ext: { rating: '4.2' } }
  ], {
    cuisineList: ['烤鱼', '粤菜'],
    cost_min: null,
    cost_max: null,
    rating_min: null,
    rating_max: null,
    include_unrated: false,
    include_uncosted: false,
    radius: 1000
  }).map(item => item.title),
  ['命中标签', '命中类别'],
  'cuisine filtering should match both restaurant.tags and category fallback'
)
