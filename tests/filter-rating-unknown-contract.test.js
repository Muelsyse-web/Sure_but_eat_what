const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')
const cloudIndexPath = path.join(root, 'cloudfunctions/fetchRestaurants/index.js')
const cloudIndex = fs.readFileSync(cloudIndexPath, 'utf8')

assert(
  /窥探全部天意/.test(pageWxml),
  'restaurant list button should use the 新三国-inspired 天意 copy'
)

assert(
  /\.restaurant-list-button\s*{[^}]*linear-gradient\(135deg,\s*#a8864a,\s*#2c2416\)/.test(pageWxss) &&
  /\.restaurant-list-button\s*{[^}]*color:\s*#f5efdf/.test(pageWxss) &&
  /\.restaurant-list-button::after[\s\S]*border:\s*none/.test(pageWxss),
  'restaurant list button should keep the main branch brown-dark style and remove WeChat pseudo border'
)

assert(
  /rating_min:\s*null/.test(pageJs) &&
  /rating_max:\s*null/.test(pageJs) &&
  /include_unrated:\s*false/.test(pageJs) &&
  /include_uncosted:\s*false/.test(pageJs),
  'page filter state should include rating range and unknown-value toggles'
)

assert(
  /ratingMinInput:\s*''/.test(pageJs) &&
  /ratingMaxInput:\s*''/.test(pageJs) &&
  /hasMissingCost:\s*false/.test(pageJs) &&
  /hasMissingRating:\s*false/.test(pageJs),
  'page state should include rating inputs and missing-info visibility flags'
)

assert(
  /bindinput="onRatingMinInput"/.test(pageWxml) &&
  /bindinput="onRatingMaxInput"/.test(pageWxml) &&
  /bindtap="onToggleIncludeUncosted"/.test(pageWxml) &&
  /bindtap="onToggleIncludeUnrated"/.test(pageWxml),
  'filter panel should render rating inputs and unknown-value toggles'
)

assert(
  /wx:if="\{\{hasMissingCost/.test(pageWxml) &&
  /wx:if="\{\{hasMissingRating/.test(pageWxml),
  'unknown-value toggles should only render when current results contain missing cost or rating data'
)

assert(
  /rating_min:\s*filters\.rating_min/.test(pageJs) &&
  /rating_max:\s*filters\.rating_max/.test(pageJs) &&
  /include_unrated:\s*filters\.include_unrated/.test(pageJs) &&
  /include_uncosted:\s*filters\.include_uncosted/.test(pageJs),
  'cloud payload should include rating range and unknown-value toggles'
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

assert(
  sandbox.module.exports._test && typeof sandbox.module.exports._test.applyFilters === 'function',
  'cloud function should expose applyFilters for contract tests'
)

const { applyFilters, normalizeRatingRange } = sandbox.module.exports._test
const restaurants = [
  { title: '高分有价', category: '餐饮服务;中餐厅', distance: 100, avg_cost: 80, biz_ext: { rating: '4.7', cost: '80' } },
  { title: '低分有价', category: '餐饮服务;中餐厅', distance: 120, avg_cost: 50, biz_ext: { rating: '3.9', cost: '50' } },
  { title: '无星有价', category: '餐饮服务;中餐厅', distance: 130, avg_cost: 45, biz_ext: { rating: null, cost: '45' } },
  { title: '高分无价', category: '餐饮服务;中餐厅', distance: 140, avg_cost: null, biz_ext: { rating: '4.8', cost: null } }
]

assert.deepStrictEqual(
  applyFilters(restaurants, {
    cuisineList: [],
    cost_min: null,
    cost_max: null,
    rating_min: 4.5,
    rating_max: null,
    include_unrated: false,
    include_uncosted: false,
    radius: 1000
  }).map(item => item.title),
  ['高分有价', '高分无价'],
  'rating filter should keep restaurants inside the rating range and default max to 5'
)

assert.deepStrictEqual(
  applyFilters(restaurants, {
    cuisineList: [],
    cost_min: null,
    cost_max: null,
    rating_min: 4.5,
    rating_max: null,
    include_unrated: true,
    include_uncosted: false,
    radius: 1000
  }).map(item => item.title),
  ['高分有价', '无星有价', '高分无价'],
  'include_unrated should keep restaurants missing rating when rating filter is active'
)

assert.deepStrictEqual(
  applyFilters(restaurants, {
    cuisineList: [],
    cost_min: 40,
    cost_max: 90,
    rating_min: null,
    rating_max: null,
    include_unrated: false,
    include_uncosted: true,
    radius: 1000
  }).map(item => item.title),
  ['高分有价', '低分有价', '无星有价', '高分无价'],
  'include_uncosted should keep restaurants missing average cost when cost filter is active'
)

const defaultedRatingRange = normalizeRatingRange(4.2, null)
assert.strictEqual(defaultedRatingRange.rating_min, 4.2)
assert.strictEqual(defaultedRatingRange.rating_max, 5, 'missing max rating should default to 5')
