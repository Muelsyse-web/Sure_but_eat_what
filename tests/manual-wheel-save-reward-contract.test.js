const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')
const manualWheelsPath = path.join(root, 'utils/manualWheels.js')

assert(fs.existsSync(manualWheelsPath), 'manual wheel persistence helper should exist')

const manualWheelsJs = fs.readFileSync(manualWheelsPath, 'utf8')

assert(
  /savedManualWheels/.test(manualWheelsJs) && /MAX_SAVED_WHEELS\s*=\s*30/.test(manualWheelsJs),
  'manual wheel helper should use the savedManualWheels storage key and cap saves at 30'
)

assert(
  /saveManualWheel/.test(manualWheelsJs) &&
  /getSavedManualWheels/.test(manualWheelsJs),
  'manual wheel helper should expose save and read functions'
)

assert(
  /showSaveWheelModal:\s*false/.test(pageJs) &&
  /wheelNameInput:\s*''/.test(pageJs) &&
  /canSaveManualWheel:\s*false/.test(pageJs) &&
  /showSavedWheelsModal:\s*false/.test(pageJs) &&
  /savedWheels:\s*\[\]/.test(pageJs),
  'page state should include save/load modal state and save eligibility for manual wheels'
)

assert(
  /onOpenSaveWheel/.test(pageJs) &&
  /onConfirmSaveWheel/.test(pageJs) &&
  /onOpenSavedWheels/.test(pageJs) &&
  /onLoadSavedWheel/.test(pageJs),
  'page should expose handlers for saving and loading manual wheels'
)

assert(
  /class="save-wheel-button wheel-save-button[^"]*"\s+bindtap="onOpenSaveWheel"\s+disabled="\{\{!canSaveManualWheel\}\}"/.test(pageWxml) &&
  />保存<\/button>/.test(pageWxml) &&
  !/>保存转盘<\/button>/.test(pageWxml) &&
  /往日种种，你当真不记得了吗？/.test(pageWxml),
  'manual mode should render a circular save button and the load-wheel action'
)

assert(
  /activeSavedWheelId:\s*null/.test(pageJs) &&
  /activeSavedWheelId:\s*saved\.id/.test(pageJs) &&
  /canSaveManualWheel:\s*false/.test(pageJs) &&
  /activeSavedWheelId:\s*null[\s\S]*this\.syncManualCandidates\(manualCandidates\)/.test(pageJs),
  'saving should mark the current wheel as saved, while adding a candidate should make it saveable again'
)

assert(
  /if\s*\(!this\.data\.canSaveManualWheel\)/.test(pageJs),
  'onOpenSaveWheel should guard unsaveable states instead of relying only on disabled UI'
)

assert(
  /class="save-wheel-overlay[^"]*"\s+bindtap="onCloseSaveWheel"/.test(pageWxml) &&
  /class="saved-wheels-overlay[^"]*"\s+bindtap="onCloseSavedWheels"/.test(pageWxml) &&
  /catchtap="noop"/.test(pageWxml),
  'save and load overlays should close from the backdrop and catch inner taps'
)

assert(
  /赏些银两/.test(pageWxml) &&
  /showRewardModal/.test(pageJs) &&
  /rewardCodeSrc:\s*'\/assets\/images\/reward-code\.png'/.test(pageJs),
  'home screen should include a reward entry and reserve the reward-code image path'
)

assert(
  /wx\.previewImage/.test(pageJs),
  'reward code image should be previewable for long-press recognition'
)

assert(
  !/requestPayment/.test(pageJs + pageWxml + manualWheelsJs),
  'reward-code implementation should not introduce wx.requestPayment'
)

assert(
  /\.save-wheel-button::after/.test(pageWxss) &&
  /\.load-wheel-button::after/.test(pageWxss) &&
  /\.wheel-save-button\.disabled/.test(pageWxss) &&
  /\.load-wheel-button\s*{[^}]*background:\s*linear-gradient\(135deg,\s*#8b6d3f,\s*#a8864a\)/.test(pageWxss) &&
  /\.reward-button::after/.test(pageWxss),
  'new buttons should remove WeChat default pseudo borders and expose enabled/disabled styling'
)
