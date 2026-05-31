const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')

const INVALID_COPY = '输的什么玩意儿，我看你是舍不得这张帅案吧！'

assert(
  pageJs.includes(`INVALID_FILTER_MESSAGE = '${INVALID_COPY}'`) &&
  /showInvalidFilterToast\(\)/.test(pageJs),
  'page should define a single invalid filter toast message helper'
)

assert(
  /parseOptionalIntegerInput/.test(pageJs) &&
  /parseOptionalDecimalInput/.test(pageJs) &&
  /valid:\s*false/.test(pageJs) &&
  /valid:\s*true/.test(pageJs),
  'page should parse optional integer and decimal inputs with explicit validity'
)

assert(
  /validateFilterInputs/.test(pageJs) &&
  /if\s*\(!validation\.valid\)\s*{[\s\S]*this\.showInvalidFilterToast\(\)[\s\S]*return[\s\S]*}/.test(pageJs),
  'onApplyFilter should stop before updating filters when validation fails'
)

assert(
  /costMax\s*!==\s*null\s*&&\s*costMin\s*!==\s*null\s*&&\s*costMax\s*<\s*costMin/.test(pageJs) &&
  /ratingMax\s*!==\s*null\s*&&\s*ratingMin\s*!==\s*null\s*&&\s*ratingMax\s*<\s*ratingMin/.test(pageJs),
  'validation should reject max values lower than min values'
)

assert(
  /distanceInput\.value\s*<\s*MIN_RADIUS/.test(pageJs) &&
  /distanceInput\.value\s*>\s*MAX_RADIUS/.test(pageJs),
  'distance validation should reject values outside 10-1000 instead of silently clamping'
)

assert(
  /ratingMinInput/.test(pageWxml) &&
  /placeholder="最低 0"/.test(pageWxml) &&
  !/最低 4\.2/.test(pageWxml),
  'rating filter placeholder should not imply 4.2 is the minimum rating'
)
