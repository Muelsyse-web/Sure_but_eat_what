/**
 * 本地缓存工具模块
 * 提供餐厅数据缓存和距离计算功能，减少重复 API 调用
 */

// 缓存存储键名
const CACHE_KEY = 'restaurantCache'

// 数据源升级版本：v3 起缓存高德 tag/动态菜品选项数据，忽略缺少 tags 的旧缓存
const CACHE_VERSION = 3

// 位置变化阈值（米），超出此距离需重新获取
const DISTANCE_THRESHOLD = 200

// 最大缓存条目数
const MAX_CACHE_SIZE = 50

/**
 * 使用 Haversine 公式计算两点间距离
 * @param {number} lat1 - 点1 纬度
 * @param {number} lng1 - 点1 经度
 * @param {number} lat2 - 点2 纬度
 * @param {number} lng2 - 点2 经度
 * @returns {number} 距离（米）
 */
function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 尝试从本地缓存获取餐厅列表
 * 仅当缓存存在且用户位置变化不超过阈值时返回缓存数据
 * @param {number} currentLat - 当前纬度
 * @param {number} currentLng - 当前经度
 * @returns {Array|null} 缓存的餐厅列表，或 null（缓存未命中）
 */
function getCachedRestaurants(currentLat, currentLng) {
  try {
    const cached = wx.getStorageSync(CACHE_KEY)
    if (!cached || cached.version !== CACHE_VERSION || cached.lat == null || cached.lng == null || !Array.isArray(cached.items)) {
      return null
    }

    // 检查位置是否在阈值内
    const dist = distance(currentLat, currentLng, cached.lat, cached.lng)
    if (dist > DISTANCE_THRESHOLD) {
      return null
    }

    return cached.items
  } catch (err) {
    console.error('读取缓存失败:', err)
    return null
  }
}

/**
 * 保存餐厅列表到本地缓存
 * @param {number} lat - 记录缓存时的纬度
 * @param {number} lng - 记录缓存时的经度
 * @param {Array} restaurants - 餐厅列表
 */
function setCachedRestaurants(lat, lng, restaurants) {
  try {
    // 确保 restaurants 是数组，防止 slice() 抛出 TypeError
    const items = Array.isArray(restaurants) ? restaurants : []
    const cacheData = {
      version: CACHE_VERSION,
      lat,
      lng,
      items: items.slice(0, MAX_CACHE_SIZE),
      updatedAt: Date.now()
    }
    wx.setStorageSync(CACHE_KEY, cacheData)
  } catch (err) {
    console.error('写入缓存失败:', err)
  }
}

/**
 * 清除缓存
 */
function clearCache() {
  try {
    wx.removeStorageSync(CACHE_KEY)
  } catch (err) {
    console.error('清除缓存失败:', err)
  }
}

module.exports = {
  distance,
  getCachedRestaurants,
  setCachedRestaurants,
  clearCache
}
