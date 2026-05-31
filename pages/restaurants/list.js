const {
  getRestaurantKey,
  getRestaurantBlacklist,
  toggleRestaurantBlacklist
} = require('../../utils/restaurantBlacklist')

const NEARBY_RESTAURANT_LIST_STORAGE_KEY = 'nearbyRestaurantList'

function withBlacklistState(restaurants) {
  const blacklistKeys = new Set(getRestaurantBlacklist().map(item => item.key))
  return (Array.isArray(restaurants) ? restaurants : []).map(item => ({
    ...item,
    blacklistKey: getRestaurantKey(item),
    blacklisted: blacklistKeys.has(getRestaurantKey(item))
  }))
}

Page({
  data: {
    restaurants: []
  },

  onLoad() {
    this.refreshRestaurants()
  },

  onShow() {
    this.refreshRestaurants()
  },

  refreshRestaurants() {
    let restaurants = []
    try {
      const saved = wx.getStorageSync(NEARBY_RESTAURANT_LIST_STORAGE_KEY)
      restaurants = Array.isArray(saved) ? saved : []
    } catch (err) {
      console.error('读取当前餐厅列表失败:', err)
    }

    this.setData({
      restaurants: withBlacklistState(restaurants)
    })
  },

  onToggleBlacklist(e) {
    const key = e.currentTarget.dataset.key
    const restaurant = this.data.restaurants.find(item => item.blacklistKey === key)
    if (!restaurant) return

    const result = toggleRestaurantBlacklist(restaurant)
    this.refreshRestaurants()
    wx.showToast({
      title: result.blacklisted ? '已打入冷宫' : '已放回江湖',
      icon: 'none'
    })
  }
})
