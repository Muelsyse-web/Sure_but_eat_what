const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')

function getMethodBody(source, methodName) {
  const start = source.indexOf(`${methodName}(`)
  assert(start >= 0, `${methodName} should exist`)

  const braceStart = source.indexOf('{', start)
  assert(braceStart >= 0, `${methodName} should have a body`)

  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') depth--
    if (depth === 0) {
      return source.slice(braceStart + 1, i)
    }
  }

  throw new Error(`${methodName} body was not closed`)
}

assert(
  /onFetchNearbyIntent\(\)/.test(pageJs),
  'nearby mode should expose a deliberate fetch handler'
)

assert(
  /bindtap="onFetchNearbyIntent"/.test(pageWxml) && /获取天意/.test(pageWxml),
  'WXML should render a 获取天意 button bound to the deliberate fetch handler'
)

assert(
  /nearbyHasFetched:\s*false/.test(pageJs),
  'nearby mode should track whether the user has deliberately fetched restaurants'
)

const chooseNearbyBody = getMethodBody(pageJs, 'onChooseNearby')
assert(
  !/loadRestaurants\(\)/.test(chooseNearbyBody),
  'entering nearby mode should not request location or call the Tencent Map proxy'
)

const applyFilterBody = getMethodBody(pageJs, 'onApplyFilter')
assert(
  !/loadRestaurants\(\)/.test(applyFilterBody),
  'applying filters should not automatically call the Tencent Map proxy'
)

const resetFiltersBody = getMethodBody(pageJs, 'resetFilters')
assert(
  !/loadRestaurants\(\)/.test(resetFiltersBody),
  'resetting filters should not automatically call the Tencent Map proxy'
)

const fetchIntentBody = getMethodBody(pageJs, 'onFetchNearbyIntent')
assert(
  /loadRestaurants\(\)/.test(fetchIntentBody),
  'only the 获取天意 handler should trigger the nearby restaurant loading flow'
)

assert(
  /天意尚未开坛/.test(pageWxml),
  'nearby placeholder should explain that no fetch has been requested yet'
)
