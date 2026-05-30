const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')

assert(
  /appMode:\s*'choice'/.test(pageJs),
  'app should start on a choice screen instead of immediately loading nearby restaurants'
)

const onLoadMatch = pageJs.match(/onLoad\(\)\s*{([^}]*)}/)

assert(
  onLoadMatch && !/this\.loadRestaurants\(\)/.test(onLoadMatch[1]),
  'onLoad should not request location before the user chooses nearby mode'
)

assert(
  /onChooseManual/.test(pageJs) && /onChooseNearby/.test(pageJs),
  'page should expose handlers for manual candidates and nearby mode choices'
)

assert(
  /manualCandidates:\s*\[\]/.test(pageJs) && /showAddCandidateModal:\s*false/.test(pageJs),
  'manual mode should keep candidate names and add-candidate modal state'
)

assert(
  /manualPickerType:\s*'wheel'/.test(pageJs) && /manualCandidates\.length\s*>\s*8/.test(pageJs),
  'manual mode should use a wheel up to 8 items and switch to slot after 8'
)

assert(
  /class="mode-choice/.test(pageWxml) &&
  /bindtap="onChooseManual"/.test(pageWxml) &&
  /bindtap="onChooseNearby"/.test(pageWxml) &&
  /我有饭局名单/.test(pageWxml) &&
  /附近有什么？/.test(pageWxml),
  'WXML should render the two entry choices'
)

assert(
  /id="manualWheelCanvas"/.test(pageWxml) &&
  /class="add-candidate-button"/.test(pageWxml),
  'manual mode should render a canvas wheel and a plus button'
)

assert(
  !/点击下方按钮\\n寻找美食/.test(pageWxml) &&
  !/placeholder-emoji/.test(pageWxml),
  'empty picker placeholder should not show the old emoji or instruction text'
)
