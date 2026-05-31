const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJson = fs.readFileSync(path.join(root, 'app.json'), 'utf8')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const listJsPath = path.join(root, 'pages/restaurants/list.js')
const listWxmlPath = path.join(root, 'pages/restaurants/list.wxml')

assert(
  /"pages\/restaurants\/list"/.test(appJson),
  'app.json should register the restaurant list child page'
)

assert(fs.existsSync(listJsPath), 'restaurant list page logic should exist')
assert(fs.existsSync(listWxmlPath), 'restaurant list page template should exist')

const listJs = fs.readFileSync(listJsPath, 'utf8')
const listWxml = fs.readFileSync(listWxmlPath, 'utf8')

assert(
  /item\.biz_ext\s*&&\s*item\.biz_ext\.rating\s*\?\s*item\.biz_ext\.rating\s*:\s*'暂无'/.test(listWxml),
  'restaurant list should display stars directly from item.biz_ext.rating with 暂无 fallback'
)

assert(
  !/ratingText|ratingStars|displayRating|score/.test(listJs + listWxml),
  'restaurant list should not introduce derived frontend rating fields'
)

assert(
  /NEARBY_RESTAURANT_LIST_STORAGE_KEY/.test(pageJs) &&
  /wx\.setStorageSync\(\s*NEARBY_RESTAURANT_LIST_STORAGE_KEY,\s*this\.data\.allNearbyRestaurants\s*\)/.test(pageJs),
  'index page should pass the full current restaurant objects to the list page without trimming biz_ext'
)

assert(
  /biz_ext\.rating/.test(pageJs) &&
  /biz_ext\.cost/.test(pageJs) &&
  /avg_cost/.test(pageJs) &&
  /category/.test(pageJs) &&
  /distance/.test(pageJs),
  'index page should document the complete restaurant fields preserved for the child page'
)
