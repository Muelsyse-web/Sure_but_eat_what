const STORAGE_KEY = 'restaurantBlacklist'
const MAX_BLACKLIST_SIZE = 200

function normalizeText(value) {
  return String(value == null ? '' : value).trim()
}

function getRestaurantKey(restaurant) {
  if (!restaurant) return ''
  const id = normalizeText(restaurant.id)
  if (id) return id

  const title = normalizeText(restaurant.title)
  const location = restaurant.location || {}
  const lat = location.lat == null ? '' : String(location.lat)
  const lng = location.lng == null ? '' : String(location.lng)
  return [title, lat, lng].filter(Boolean).join('|')
}

function normalizeBlacklistItem(item) {
  const key = normalizeText(item && item.key)
  const title = normalizeText(item && item.title)
  if (!key || !title) return null

  return {
    key,
    title,
    category: normalizeText(item.category),
    address: normalizeText(item.address),
    addedAt: Number(item.addedAt) || Date.now()
  }
}

function getRestaurantBlacklist() {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (!Array.isArray(saved)) return []
    return saved.map(normalizeBlacklistItem).filter(Boolean).slice(0, MAX_BLACKLIST_SIZE)
  } catch (err) {
    console.error('读取餐厅黑名单失败:', err)
    return []
  }
}

function setRestaurantBlacklist(items) {
  try {
    const normalized = Array.isArray(items)
      ? items.map(normalizeBlacklistItem).filter(Boolean).slice(0, MAX_BLACKLIST_SIZE)
      : []
    wx.setStorageSync(STORAGE_KEY, normalized)
    return normalized
  } catch (err) {
    console.error('写入餐厅黑名单失败:', err)
    return getRestaurantBlacklist()
  }
}

function buildBlacklistRecord(restaurant) {
  const key = getRestaurantKey(restaurant)
  const title = normalizeText(restaurant && restaurant.title)
  if (!key || !title) return null

  return {
    key,
    title,
    category: normalizeText(restaurant.category),
    address: normalizeText(restaurant.address),
    addedAt: Date.now()
  }
}

function isRestaurantBlacklisted(restaurant) {
  const key = getRestaurantKey(restaurant)
  if (!key) return false
  return getRestaurantBlacklist().some(item => item.key === key)
}

function toggleRestaurantBlacklist(restaurant) {
  const key = getRestaurantKey(restaurant)
  if (!key) return { blacklisted: false, items: getRestaurantBlacklist() }

  const current = getRestaurantBlacklist()
  const exists = current.some(item => item.key === key)
  if (exists) {
    const items = setRestaurantBlacklist(current.filter(item => item.key !== key))
    return { blacklisted: false, items }
  }

  const record = buildBlacklistRecord(restaurant)
  if (!record) return { blacklisted: false, items: current }
  const items = setRestaurantBlacklist([record].concat(current))
  return { blacklisted: true, items }
}

function applyRestaurantBlacklist(restaurants) {
  if (!Array.isArray(restaurants)) return []
  const blockedKeys = new Set(getRestaurantBlacklist().map(item => item.key))
  return restaurants.filter(restaurant => !blockedKeys.has(getRestaurantKey(restaurant)))
}

module.exports = {
  STORAGE_KEY,
  getRestaurantKey,
  getRestaurantBlacklist,
  isRestaurantBlacklisted,
  toggleRestaurantBlacklist,
  applyRestaurantBlacklist
}
