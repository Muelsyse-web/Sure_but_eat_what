const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const wxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')

const canvasMatch = wxml.match(/<canvas[\s\S]*id="manualWheelCanvas"[\s\S]*?>/)

assert(canvasMatch, 'manual mode should render the wheel canvas')

const canvasTag = canvasMatch[0]

assert(
  /hidden="\{\{[^"]*showAddCandidateModal[^"]*\}\}"/.test(canvasTag),
  'manual wheel canvas should be hidden while the add-candidate dialog is open so it cannot cover the input layer'
)

assert(
  /hidden="\{\{[^"]*showModal[^"]*\}\}"/.test(canvasTag),
  'manual wheel canvas should also be hidden while the result modal is open'
)

assert(
  /hidden="\{\{[^"]*showSaveWheelModal[^"]*\}\}"/.test(canvasTag),
  'manual wheel canvas should be hidden while the save-wheel dialog is open'
)

assert(
  /hidden="\{\{[^"]*showSavedWheelsModal[^"]*\}\}"/.test(canvasTag),
  'manual wheel canvas should be hidden while the saved-wheels dialog is open'
)

const slotContainerStart = wxml.indexOf('<view wx:if="{{appMode === \'nearby\' || (appMode === \'manual\' && manualPickerType === \'slot\')}}" class="slot-container">')
const spinButtonAreaStart = wxml.indexOf('<!-- 旋转按钮 -->')
const slotContainerMarkup = slotContainerStart >= 0 && spinButtonAreaStart > slotContainerStart
  ? wxml.slice(slotContainerStart, spinButtonAreaStart)
  : ''

assert(
  slotContainerMarkup && !/<canvas\b/.test(slotContainerMarkup),
  'manual slot mode should not render a canvas that can cover save/load dialogs'
)

const wxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')

const slotContainerCssMatch = wxss.match(/\.slot-container\s*{([\s\S]*?)}/)
const saveOverlayCssMatch = wxss.match(/\.save-wheel-overlay,[\s\S]*?\.saved-wheels-overlay,[\s\S]*?{([\s\S]*?)}/)

assert(slotContainerCssMatch, 'slot container styles should be present')
assert(saveOverlayCssMatch, 'save/load overlay styles should be present')

const slotZIndex = Number((slotContainerCssMatch[1].match(/z-index:\s*(\d+)/) || [])[1])
const overlayZIndex = Number((saveOverlayCssMatch[1].match(/z-index:\s*(\d+)/) || [])[1])

assert(
  slotZIndex < overlayZIndex,
  'manual slot mode should stay below save/load overlays'
)
