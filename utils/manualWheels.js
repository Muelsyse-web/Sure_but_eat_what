/**
 * 手动转盘本地存档。
 * 仅保存饭名所需的精简字段，避免把运行时状态写进 storage。
 */

const STORAGE_KEY = 'savedManualWheels'
const MAX_SAVED_WHEELS = 30

function normalizeItems(items) {
  if (!Array.isArray(items)) return []

  return items
    .map((item, index) => {
      const title = String(item && item.title ? item.title : '').trim()
      if (!title) return null

      return {
        id: item.id || `manual-${Date.now()}-${index}`,
        title,
        category: item.category || '自选',
        source: 'manual'
      }
    })
    .filter(Boolean)
}

function getSavedManualWheels() {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (!Array.isArray(saved)) return []

    return saved
      .filter(item => item && item.id && item.name && Array.isArray(item.items))
      .map(item => ({
        id: item.id,
        name: item.name,
        items: normalizeItems(item.items),
        createdAt: item.createdAt || Date.now(),
        updatedAt: item.updatedAt || item.createdAt || Date.now()
      }))
      .filter(item => item.items.length > 0)
      .slice(0, MAX_SAVED_WHEELS)
  } catch (err) {
    console.error('读取转盘存档失败:', err)
    return []
  }
}

function saveManualWheel(name, items) {
  const trimmedName = String(name || '').trim()
  const normalizedItems = normalizeItems(items)

  if (!trimmedName || normalizedItems.length === 0) {
    return null
  }

  const now = Date.now()
  const record = {
    id: `wheel-${now}`,
    name: trimmedName,
    items: normalizedItems,
    createdAt: now,
    updatedAt: now
  }

  try {
    const nextSaved = [record].concat(getSavedManualWheels()).slice(0, MAX_SAVED_WHEELS)
    wx.setStorageSync(STORAGE_KEY, nextSaved)
    return record
  } catch (err) {
    console.error('保存转盘存档失败:', err)
    return null
  }
}

function deleteManualWheel(id) {
  const targetId = String(id || '')
  if (!targetId) return false

  try {
    const saved = getSavedManualWheels()
    const nextSaved = saved.filter(item => item.id !== targetId)
    if (nextSaved.length === saved.length) return false

    wx.setStorageSync(STORAGE_KEY, nextSaved)
    return true
  } catch (err) {
    console.error('删除转盘存档失败:', err)
    return false
  }
}

function renameManualWheel(id, name) {
  const targetId = String(id || '')
  const trimmedName = String(name || '').trim()
  if (!targetId || !trimmedName) return null

  try {
    const saved = getSavedManualWheels()
    const now = Date.now()
    let updatedRecord = null
    const nextSaved = saved.map(item => {
      if (item.id !== targetId) return item

      updatedRecord = Object.assign({}, item, {
        name: trimmedName,
        updatedAt: now
      })
      return updatedRecord
    })

    if (!updatedRecord) return null

    wx.setStorageSync(STORAGE_KEY, nextSaved)
    return updatedRecord
  } catch (err) {
    console.error('重命名转盘存档失败:', err)
    return null
  }
}

function updateManualWheelItems(id, items) {
  const targetId = String(id || '')
  const normalizedItems = normalizeItems(items)
  if (!targetId || normalizedItems.length === 0) return null

  try {
    const saved = getSavedManualWheels()
    const now = Date.now()
    let updatedRecord = null
    const nextSaved = saved.map(item => {
      if (item.id !== targetId) return item

      updatedRecord = Object.assign({}, item, {
        items: normalizedItems,
        updatedAt: now
      })
      return updatedRecord
    })

    if (!updatedRecord) return null

    wx.setStorageSync(STORAGE_KEY, nextSaved)
    return updatedRecord
  } catch (err) {
    console.error('修改转盘餐厅失败:', err)
    return null
  }
}

module.exports = {
  MAX_SAVED_WHEELS,
  getSavedManualWheels,
  saveManualWheel,
  deleteManualWheel,
  renameManualWheel,
  updateManualWheelItems
}
