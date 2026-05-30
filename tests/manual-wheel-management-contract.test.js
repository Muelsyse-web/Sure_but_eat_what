const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')

let storage = []
global.wx = {
  getStorageSync(key) {
    assert.strictEqual(key, 'savedManualWheels')
    return storage
  },
  setStorageSync(key, value) {
    assert.strictEqual(key, 'savedManualWheels')
    storage = value
  }
}

delete require.cache[require.resolve('../utils/manualWheels')]
const manualWheels = require('../utils/manualWheels')

assert.strictEqual(typeof manualWheels.deleteManualWheel, 'function', 'manual wheel helper should delete saved wheels by id')
assert.strictEqual(typeof manualWheels.renameManualWheel, 'function', 'manual wheel helper should rename saved wheels by id')
assert.strictEqual(typeof manualWheels.updateManualWheelItems, 'function', 'manual wheel helper should update saved wheel restaurant items by id')

storage = [
  {
    id: 'wheel-a',
    name: '旧名',
    items: [{ id: 'a-1', title: '米线', category: '自选', source: 'manual' }],
    createdAt: 1,
    updatedAt: 1
  },
  {
    id: 'wheel-b',
    name: '待删',
    items: [{ id: 'b-1', title: '炒饭', category: '自选', source: 'manual' }],
    createdAt: 2,
    updatedAt: 2
  }
]

const renamed = manualWheels.renameManualWheel('wheel-a', '  新名  ')
assert(renamed && renamed.name === '新名', 'rename should trim and persist the new wheel name')
assert.strictEqual(storage[0].name, '新名', 'renamed wheel should be written back to storage')
assert.strictEqual(manualWheels.renameManualWheel('wheel-a', '   '), null, 'rename should reject blank names')

const updated = manualWheels.updateManualWheelItems('wheel-a', [
  { title: '拉面' },
  { title: '   ' },
  { id: 'kept', title: '咖喱饭', category: '自选' }
])
assert(updated && updated.items.length === 2, 'update should persist only non-empty restaurant names')
assert.deepStrictEqual(storage[0].items.map(item => item.title), ['拉面', '咖喱饭'])
assert.strictEqual(manualWheels.updateManualWheelItems('wheel-a', []), null, 'update should reject empty restaurant lists')

assert.strictEqual(manualWheels.deleteManualWheel('wheel-b'), true, 'delete should remove an existing saved wheel')
assert.strictEqual(storage.some(item => item.id === 'wheel-b'), false, 'deleted wheel should be absent from storage')
assert.strictEqual(manualWheels.deleteManualWheel('missing'), false, 'delete should report missing ids')

assert(
  /showRenameWheelModal:\s*false/.test(pageJs) &&
  /renameWheelInput:\s*''/.test(pageJs) &&
  /showEditWheelItemsModal:\s*false/.test(pageJs) &&
  /editingWheelItems:\s*\[\]/.test(pageJs) &&
  /activeSavedWheelId:\s*null/.test(pageJs),
  'page state should track saved-wheel rename, item editing, and active saved wheel identity'
)

assert(
  /onOpenRenameWheel/.test(pageJs) &&
  /onConfirmRenameWheel/.test(pageJs) &&
  /onDeleteSavedWheel/.test(pageJs) &&
  /onOpenEditWheelItems/.test(pageJs) &&
  /onConfirmEditWheelItems/.test(pageJs),
  'page should expose saved-wheel management handlers'
)

assert(
  /deleteManualWheel/.test(pageJs) &&
  /renameManualWheel/.test(pageJs) &&
  /updateManualWheelItems/.test(pageJs),
  'page should call the manual wheel persistence helpers'
)

assert(
  /catchtap="onOpenEditWheelItems"/.test(pageWxml) &&
  /catchtap="onOpenRenameWheel"/.test(pageWxml) &&
  /catchtap="onDeleteSavedWheel"/.test(pageWxml),
  'saved wheel row actions should use catchtap so they do not load the wheel'
)

assert(
  /编辑/.test(pageWxml) &&
  /改名/.test(pageWxml) &&
  /删除/.test(pageWxml),
  'saved wheel rows should render edit, rename, and delete actions'
)

assert(
  /class="rename-wheel-overlay/.test(pageWxml) &&
  /class="edit-wheel-items-overlay/.test(pageWxml),
  'rename and restaurant-edit dialogs should be rendered'
)

assert(
  /hidden="\{\{[^"]*showEditWheelItemsModal[^"]*\}\}"/.test(pageWxml),
  'manual wheel canvas should be hidden while editing saved wheel restaurants'
)

assert(
  /activeSavedWheelId[\s\S]*syncManualCandidates/.test(pageJs),
  'saving edits to the active saved wheel should resync candidates so wheel and slot modes match the edited count'
)

assert(
  /\.saved-wheel-action::after/.test(pageWxss) &&
  /\.edit-wheel-item-remove::after/.test(pageWxss),
  'new saved-wheel management buttons should remove WeChat default pseudo borders'
)
