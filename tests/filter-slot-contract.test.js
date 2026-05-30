const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const cloudJs = fs.readFileSync(path.join(root, 'cloudfunctions/fetchRestaurants/index.js'), 'utf8')
const tencentProviderJs = fs.readFileSync(path.join(root, 'cloudfunctions/fetchRestaurants/providers/tencent.js'), 'utf8')

assert(
  /selectedCuisines:\s*\[\]/.test(pageJs),
  'page state should store selected cuisines as an array for multi-select'
)

assert(
  /distanceMaxInput:\s*''/.test(pageJs) && /distance_max:\s*null/.test(pageJs),
  'page state should include a max distance filter input and filter value'
)

assert(
  /class="slot-machine/.test(pageWxml) && !/id="wheelCanvas"/.test(pageWxml),
  'main picker should render a slot machine instead of the old canvas wheel'
)

assert(
  /天意偏向哪一口/.test(pageWxml) && !/别整这些/.test(pageWxml),
  'cuisine filter label should clearly mean preferred cuisine, not excluded cuisine'
)

assert(
  /labels\.push\(`偏向 \${cuisines\.join\('、'\)}`\)/.test(pageJs),
  'selected cuisine chip should clearly describe a preference instead of an exclusion'
)

assert(
  /data:\s*{[\s\S]*cuisines:/.test(pageJs),
  'cloud function payload should send a cuisines array'
)

assert(
  /process\.env\.AMAP_MAP_KEY/.test(cloudJs) && /process\.env\.BAIDU_MAP_AK/.test(cloudJs),
  'cloud function should use AMap primary search and Baidu price enrichment keys from env'
)

assert(
  /nearby\(\$\{latitude\},\$\{longitude\},\$\{radius\},0\)/.test(tencentProviderJs),
  'Tencent fallback should disable auto_extend for strict distance filtering'
)

assert(
  /cuisines\s*=\s*\[\]/.test(cloudJs) || /normalizeCuisines/.test(cloudJs),
  'cloud function should accept multiple cuisines'
)
