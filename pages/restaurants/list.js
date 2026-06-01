const {
  getRestaurantKey,
  getRestaurantBlacklist,
  toggleRestaurantBlacklist
} = require('../../utils/restaurantBlacklist')

const NEARBY_RESTAURANT_LIST_STORAGE_KEY = 'nearbyRestaurantList'
const TAP_AUDIO_SRC = '/assets/audio/tap.mp3'
const GET_OUT_AUDIO_SRC = '/assets/audio/GetOut.mp3'
const LUANSHI_AUDIO_SRC = '/assets/audio/Luanshi.mp3'
const AUDIO_VOLUMES = {
  tap: 1,
  getOut: 1,
  luanshi: 1
}

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

  _audioContexts: null,

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

  notifyAppUserGesture() {
    if (typeof getApp !== 'function') return

    const app = getApp()
    if (app && typeof app.notifyUserGesture === 'function') {
      app.notifyUserGesture()
    }
  },

  onPageTap() {
    this.notifyAppUserGesture()
  },

  getAudioVolume(key) {
    const volume = AUDIO_VOLUMES[key]
    if (volume == null) return 1
    return Math.max(0, Math.min(1, volume))
  },

  playAudio(src, key) {
    this.notifyAppUserGesture()

    if (!wx.createInnerAudioContext || !src) return

    if (!this._audioContexts) {
      this._audioContexts = {}
    }

    if (!this._audioContexts[key]) {
      const audio = wx.createInnerAudioContext()
      audio.src = src
      audio.volume = this.getAudioVolume(key)
      audio.obeyMuteSwitch = false
      audio.onError(() => {})
      this._audioContexts[key] = audio
    }

    const audio = this._audioContexts[key]
    try {
      audio.volume = this.getAudioVolume(key)
      audio.stop()
      audio.seek(0)
      audio.play()
    } catch (err) {
      console.warn('播放音效失败:', key, err)
    }
  },

  playTapCue() {
    this.playAudio(TAP_AUDIO_SRC, 'tap')
  },

  playBlacklistCue(blacklisted) {
    this.playAudio(blacklisted ? GET_OUT_AUDIO_SRC : LUANSHI_AUDIO_SRC, blacklisted ? 'getOut' : 'luanshi')
  },

  onToggleBlacklist(e) {
    const key = e.currentTarget.dataset.key
    const restaurant = this.data.restaurants.find(item => item.blacklistKey === key)
    if (!restaurant) return

    const result = toggleRestaurantBlacklist(restaurant)
    this.playBlacklistCue(result.blacklisted)
    this.refreshRestaurants()
    wx.showToast({
      title: result.blacklisted ? '已打入冷宫' : '已放回江湖',
      icon: 'none'
    })
  }
})
