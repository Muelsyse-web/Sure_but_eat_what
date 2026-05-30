const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')

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
