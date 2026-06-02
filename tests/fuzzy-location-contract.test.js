const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')

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
  appJson.requiredPrivateInfos && appJson.requiredPrivateInfos.includes('getFuzzyLocation'),
  'app.json should declare getFuzzyLocation for approximate nearby search'
)

assert(
  !appJson.requiredPrivateInfos.includes('getLocation'),
  'app.json should not declare wx.getLocation after precise-location review rejection'
)

assert(
  appJson.permission && appJson.permission['scope.userFuzzyLocation'],
  'app.json should request fuzzy location permission copy'
)

assert(
  /wx\.getFuzzyLocation\(\{/.test(pageJs),
  'nearby search should call wx.getFuzzyLocation instead of wx.getLocation'
)

assert(
  !/wx\.getLocation\(\{/.test(pageJs),
  'nearby search should not call wx.getLocation in production code'
)

assert(
  /scope\.userFuzzyLocation/.test(pageJs),
  'permission recovery guide should check scope.userFuzzyLocation'
)

const loadRestaurantsBody = getMethodBody(pageJs, 'loadRestaurants')

assert(
  !/30\.2741|120\.1551/.test(loadRestaurantsBody),
  'location failure should not continue with the old Hangzhou default coordinates'
)

assert(
  /fail\(err\)[\s\S]*?loading:\s*false/.test(loadRestaurantsBody),
  'location failure should stop the loading state instead of continuing a nearby fetch'
)

assert(
  !/fail\(err\)[\s\S]*?fetchRestaurantData\(\)/.test(loadRestaurantsBody),
  'location failure should not fetch nearby restaurants with a fallback location'
)

assert(
  /fail\(err\)[\s\S]*?nearbyHasFetched:\s*false/.test(loadRestaurantsBody),
  'location failure should reset fetched state so stale nearby results are not presented as current'
)

assert(
  /fail\(err\)[\s\S]*?allNearbyRestaurants:\s*\[\]/.test(loadRestaurantsBody) &&
    /fail\(err\)[\s\S]*?restaurants:\s*\[\]/.test(loadRestaurantsBody) &&
    /fail\(err\)[\s\S]*?restaurantCount:\s*0/.test(loadRestaurantsBody),
  'location failure should clear stale nearby restaurant results'
)

assert(
  /fail\(err\)[\s\S]*?nearbySnapshotRestaurants:\s*\[\]/.test(loadRestaurantsBody) &&
    /fail\(err\)[\s\S]*?nearbySnapshotHasFetched:\s*false/.test(loadRestaurantsBody) &&
    /fail\(err\)[\s\S]*?slotItems:\s*\[\]/.test(loadRestaurantsBody),
  'location failure should clear stale nearby snapshots and slot preview'
)
