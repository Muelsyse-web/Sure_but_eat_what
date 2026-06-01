// 引入缓存工具模块
const { getCachedRestaurants, setCachedRestaurants } = require('../../utils/cache')
const { applyRestaurantBlacklist } = require('../../utils/restaurantBlacklist')
const {
  getSavedManualWheels,
  saveManualWheel,
  deleteManualWheel,
  renameManualWheel,
  updateManualWheelItems
} = require('../../utils/manualWheels')

const SLOT_ITEM_HEIGHT = 64
const MANUAL_WHEEL_SPIN_DURATION = 8300
const SLOT_SPIN_DURATION = 4460
const SLOT_RESULT_REVEAL_DELAY = 4560
const DONT_WANT_TABLE_DELAY = 4056
const FETCH_NEARBY_COOLDOWN_MS = 60 * 1000
const ASSET_URL_FUNCTION_NAME = 'getAssetUrls'
const DEFAULT_RADIUS = 1000
const MIN_RADIUS = 10
const MAX_RADIUS = 1000
const NEARBY_RESTAURANT_LIST_STORAGE_KEY = 'nearbyRestaurantList'
const INVALID_FILTER_MESSAGE = '输的什么玩意儿，我看你是舍不得这张帅案吧！'
const AUDIO_CLIPS = {
  boot: null,
  manual: null,
  nearby: null,
  wheelSpin: null,
  slotSpin: '/assets/audio/slot-spin.mp3',
  tap: '/assets/audio/tap.mp3',
  tianyi: '/assets/audio/Tianyi.mp3',
  noTianyi: '/assets/audio/NoTianyi.mp3',
  nameReveal: '/assets/audio/OnceSayMyNameITMXIASINI.mp3',
  dontWantTable: '/assets/audio/DontWantTable.mp3',
  suicide: '/assets/audio/Suicide.mp3',
  result: null
}
const AUDIO_VOLUMES = {
  wheelSpin: 1,
  slotSpin: 1,
  tap: 1,
  tianyi: 1,
  noTianyi: 1,
  nameReveal: 1,
  dontWantTable: 1,
  suicide: 0.2
}

// 餐厅类型对应 emoji
const CUISINE_EMOJI = {
  '川菜': '🌶️', '粤菜': '🥟', '日料': '🍣', '西餐': '🥩',
  '火锅': '🍲', '烧烤': '🔥', '小吃': '🍜', '韩餐': '🥘',
  '东南亚': '🍛', '快餐': '🍔', '茶馆': '🍵'
}

function normalizeCuisines(cuisines) {
  const raw = Array.isArray(cuisines) ? cuisines : [cuisines]
  return raw.filter(item => item && item !== '不限' && item !== '全部')
}

function buildCuisineTags(selectedCuisines, availableCuisineOptions = []) {
  const selected = normalizeCuisines(selectedCuisines)
  const names = ['不限'].concat(
    (Array.isArray(availableCuisineOptions) ? availableCuisineOptions : [])
      .map(item => typeof item === 'string' ? item : item.name)
      .filter(Boolean)
  )
  return names.map(name => ({
    name,
    selected: name === '不限' ? selected.length === 0 : selected.includes(name)
  }))
}

function parseOptionalIntegerInput(value) {
  const input = String(value == null ? '' : value).trim()
  if (input === '') return { valid: true, value: null }
  if (!/^\d+$/.test(input)) return { valid: false, value: null }
  return { valid: true, value: Number(input) }
}

function parseOptionalDecimalInput(value) {
  const input = String(value == null ? '' : value).trim()
  if (input === '') return { valid: true, value: null }
  if (!/^\d+(\.\d+)?$/.test(input)) return { valid: false, value: null }
  return { valid: true, value: Number(input) }
}

function normalizeRadius(radius) {
  if (radius === null) return null
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radius))
}

function normalizeRatingValue(rating) {
  if (rating === null) return null
  return Math.min(5, Math.max(0, Number(rating)))
}

function normalizeRatingRange(min, max) {
  const ratingMin = normalizeRatingValue(min)
  const ratingMax = max === null && ratingMin !== null ? 5 : normalizeRatingValue(max)
  return {
    rating_min: ratingMin,
    rating_max: ratingMax
  }
}

function validateFilterInputs(values) {
  const costMinInput = parseOptionalIntegerInput(values.costMinInput)
  const costMaxInput = parseOptionalIntegerInput(values.costMaxInput)
  const ratingMinInput = parseOptionalDecimalInput(values.ratingMinInput)
  const ratingMaxInput = parseOptionalDecimalInput(values.ratingMaxInput)
  const distanceInput = parseOptionalIntegerInput(values.distanceMaxInput)

  if (!costMinInput.valid || !costMaxInput.valid || !ratingMinInput.valid || !ratingMaxInput.valid || !distanceInput.valid) {
    return { valid: false }
  }

  const costMin = costMinInput.value
  const costMax = costMaxInput.value
  const ratingMin = ratingMinInput.value
  const ratingMax = ratingMaxInput.value

  if (costMax !== null && costMin !== null && costMax < costMin) return { valid: false }
  if (ratingMin !== null && (ratingMin < 0 || ratingMin > 5)) return { valid: false }
  if (ratingMax !== null && (ratingMax < 0 || ratingMax > 5)) return { valid: false }
  if (ratingMax !== null && ratingMin !== null && ratingMax < ratingMin) return { valid: false }
  if (distanceInput.value !== null && (distanceInput.value < MIN_RADIUS || distanceInput.value > MAX_RADIUS)) return { valid: false }

  return {
    valid: true,
    costMin,
    costMax,
    ratingMin,
    ratingMax,
    distanceMax: distanceInput.value === null ? null : distanceInput.value
  }
}

function hasKnownCost(restaurant) {
  const avgCost = restaurant && restaurant.avg_cost
  const bizCost = restaurant && restaurant.biz_ext && restaurant.biz_ext.cost
  return Number.isFinite(Number(avgCost)) || Number.isFinite(Number(bizCost))
}

function hasKnownRating(restaurant) {
  const rating = restaurant && restaurant.biz_ext && restaurant.biz_ext.rating
  return rating != null && String(rating).trim() !== '' && Number.isFinite(Number(rating))
}

function extractCategoryLeaf(category) {
  const parts = String(category || '')
    .split(/[;\uFF1B]/)
    .map(item => item.trim())
    .filter(Boolean)
  const leaf = parts[parts.length - 1] || ''
  return leaf
    .replace(/[（(].*?[）)]/g, '')
    .replace(/餐厅|中餐厅|小吃快餐店|快餐厅|餐饮服务/g, '')
    .trim()
}

function buildAvailableCuisineOptions(restaurants) {
  const options = []
  const seen = new Set()

  function addOption(name, source) {
    const normalized = String(name || '').trim()
    if (!normalized || normalized === '不限' || seen.has(normalized)) return
    seen.add(normalized)
    options.push({ name: normalized, source })
  }

  const items = Array.isArray(restaurants) ? restaurants : []
  items.forEach(item => {
    ;(Array.isArray(item.tags) ? item.tags : []).forEach(tag => addOption(tag, 'tag'))
  })
  items.forEach(item => {
    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      addOption(extractCategoryLeaf(item.category), 'category')
    }
  })

  return options.slice(0, 20)
}

// ==================== 客户端筛选 ====================

function getCostValue(item) {
  const avgCost = item && item.avg_cost
  if (avgCost != null && Number.isFinite(Number(avgCost))) return Number(avgCost)
  const bizCost = item && item.biz_ext && item.biz_ext.cost
  if (bizCost != null && Number.isFinite(Number(bizCost))) return Number(bizCost)
  return null
}

function getRatingValue(item) {
  const rating = item && item.biz_ext && item.biz_ext.rating
  if (rating == null || String(rating).trim() === '') return null
  const num = Number(rating)
  return Number.isFinite(num) ? num : null
}

function matchCuisine(category, cuisine) {
  if (!category || !cuisine) return true
  if (cuisine === '不限' || cuisine === '全部') return true
  const cat = String(category).toLowerCase()
  const cuisineMap = {
    '川菜': ['川菜', '四川', '成都', '麻辣', '火锅', '串串', '冒菜', '钵钵鸡'],
    '粤菜': ['粤菜', '广东', '广州', '茶餐厅', '烧腊', '煲仔', '蒸点', '糖水'],
    '日料': ['日本', '日式', '寿司', '刺身', '拉面', '居酒屋', '铁板烧', '鳗鱼'],
    '西餐': ['西餐', '牛排', '披萨', '意面', '汉堡', '沙拉', '法餐', '意大利'],
    '火锅': ['火锅', '涮', '锅底'],
    '烧烤': ['烧烤', '烤肉', '烤串', 'BBQ'],
    '小吃': ['小吃', '面', '粉', '饺', '包', '粥', '饼', '馄饨', '米线'],
    '韩餐': ['韩国', '韩式', '烤肉', '拌饭', '炸鸡'],
    '东南亚': ['泰国', '越南', '印度', '咖喱', '冬阴', '马来'],
    '快餐': ['快餐', '麦当劳', '肯德基', '汉堡', '炸鸡']
  }
  const keywords = cuisineMap[cuisine] || [cuisine]
  return keywords.some(kw => cat.includes(String(kw).toLowerCase()))
}

function restaurantMatchesCuisine(restaurant, cuisine) {
  if (!cuisine || cuisine === '不限' || cuisine === '全部') return true
  const target = String(cuisine).toLowerCase()
  const tags = Array.isArray(restaurant.tags) ? restaurant.tags : []
  if (tags.some(tag => String(tag).toLowerCase().includes(target) || target.includes(String(tag).toLowerCase()))) {
    return true
  }
  return matchCuisine(restaurant.category, cuisine)
}

function applyClientFilters(restaurants, filters) {
  const {
    cuisines = [],
    cost_min,
    cost_max,
    rating_min,
    rating_max,
    include_unrated = false,
    include_uncosted = false,
    distance_max
  } = filters
  const costMinActive = cost_min !== null && cost_min !== undefined
  const costMaxActive = cost_max !== null && cost_max !== undefined
  const ratingMinActive = rating_min !== null && rating_min !== undefined
  const ratingMaxActive = rating_max !== null && rating_max !== undefined
  const radius = distance_max != null ? distance_max : DEFAULT_RADIUS

  return restaurants.filter(item => {
    if (item.distance != null && Number(item.distance) > radius) return false
    if (cuisines.length > 0 && !cuisines.some(cuisine => restaurantMatchesCuisine(item, cuisine))) return false

    if (costMinActive || costMaxActive) {
      const cost = getCostValue(item)
      if (cost == null) return include_uncosted === true
      if (costMinActive && cost < Number(cost_min)) return false
      if (costMaxActive && cost > Number(cost_max)) return false
    }

    if (ratingMinActive || ratingMaxActive) {
      const rating = getRatingValue(item)
      if (rating == null) return include_unrated === true
      if (ratingMinActive && rating < Number(rating_min)) return false
      if (ratingMaxActive && rating > Number(rating_max)) return false
    }

    return true
  })
}

function formatSlotItem(restaurant, index) {
  const isManual = restaurant.source === 'manual'
  const cost = restaurant.biz_ext && restaurant.biz_ext.cost ? `¥${restaurant.biz_ext.cost}/人` : '钱包生死不明'
  const distance = restaurant.distance ? `${restaurant.distance}m` : '距离未知'
  return {
    slotKey: `${restaurant.id || restaurant.title || 'restaurant'}-${index}`,
    name: restaurant.title,
    emoji: isManual ? '🍽️' : getEmojiForCategory(restaurant.category),
    meta: isManual ? '名单候选 · 等天意发落' : `${distance} · ${cost}`
  }
}

/**
 * 根据餐厅 category 猜测匹配的 emoji
 */
function getEmojiForCategory(category) {
  if (!category) return '🍽️'
  for (const [cuisine, emoji] of Object.entries(CUISINE_EMOJI)) {
    if (category.includes(cuisine)) return emoji
  }
  // 默认匹配
  if (category.includes('面') || category.includes('粉')) return '🍜'
  if (category.includes('咖啡') || category.includes('茶')) return '☕'
  if (category.includes('甜') || category.includes('蛋糕')) return '🍰'
  return '🍽️'
}

function isSameRestaurant(a, b) {
  return a && b && a.title === b.title
}

Page({
  data: {
    appMode: 'choice',

    // 抽选状态
    spinning: false,
    interactionLocked: false,
    retryingDance: false,
    slotItems: [],
    slotTransform: 'translateY(0px)',
    slotAnimating: false,
    manualPickerType: 'wheel',
    showAddCandidateModal: false,
    showSaveWheelModal: false,
    showSavedWheelsModal: false,
    showRenameWheelModal: false,
    showEditWheelItemsModal: false,
    candidateInput: '',
    wheelNameInput: '',
    canSaveManualWheel: false,
    renameWheelInput: '',
    renamingWheelId: null,
    editingWheelId: null,
    editingWheelName: '',
    editingWheelItems: [],
    editingWheelItemInput: '',
    activeSavedWheelId: null,
    manualCandidates: [],
    savedWheels: [],
    showManageCandidatesModal: false,
    manageCandidatesInput: '',
    easterEggText: '',
    showResultSeal: false,
    showRewardModal: false,
    rewardCodeSrc: '',
    rewardCodeLoadFailed: false,

    // 结果数据
    result: null,

    // 模态卡片显示
    showModal: false,

    // 筛选条件
    filters: {
      cost_min: null,
      cost_max: null,
      rating_min: null,
      rating_max: null,
      cuisines: [],
      distance_max: null,
      include_unrated: false,
      include_uncosted: false
    },
    filterLabels: [], // 当前激活的筛选标签

    // 筛选面板状态
    showFilterPanel: false,
    cuisineTags: buildCuisineTags([], []),
    availableCuisineOptions: [],
    selectedCuisines: [],
    costMinInput: '',
    costMaxInput: '',
    ratingMinInput: '',
    ratingMaxInput: '',
    includeUnrated: false,
    includeUncosted: false,
    hasMissingCost: false,
    hasMissingRating: false,
    distanceMaxInput: '',

    // 餐厅数据
    allNearbyRestaurants: [], // 当前附近搜索全集，保留 biz_ext.rating、biz_ext.cost、avg_cost、category、distance 给子页面
    restaurants: [], // 当前可用餐厅列表（手动列表，或附近搜索中过滤黑名单后的转盘候选）
    restaurantCount: 0, // 可用餐厅数量
    nearbyHasFetched: false,
    nearbySnapshotRestaurants: [],
    nearbySnapshotHasFetched: false,
    lastFetchNearbyIntentAt: 0,

    // 加载状态
    loading: false
  },

  _slotStartTimer: null,
  _slotFinishTimer: null,
  _danceRetryTimer: null,
  _manualCanvasNode: null,
  _manualCanvasCtx: null,
  _manualDpr: 1,
  _audioContexts: null,
  _easterEggTimer: null,
  _resultSealTimer: null,

  onLoad() {
    this.resolveCloudAssetUrls()
  },

  onShow() {
    if (this.data.appMode === 'nearby' && this.data.allNearbyRestaurants.length > 0) {
      this.syncNearbyCandidates(this.data.allNearbyRestaurants)
    }
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

  resolveCloudAssetUrls() {
    if (!wx.cloud || !wx.cloud.callFunction || this._cloudAssetUrlResolving) return

    this._cloudAssetUrlResolving = true
    wx.cloud.callFunction({
      name: ASSET_URL_FUNCTION_NAME,
      success: (res) => {
        this._cloudAssetUrlResolving = false
        const result = res && res.result
        const assets = result && result.assets

        if (!assets) {
          console.warn('[Assets] 云端资源链接无效:', result)
          return
        }

        if (assets.wheelSpin && assets.wheelSpin.tempFileURL) {
          AUDIO_CLIPS.wheelSpin = assets.wheelSpin.tempFileURL
        }

        if (assets.rewardCode && assets.rewardCode.tempFileURL) {
          this.setData({
            rewardCodeSrc: assets.rewardCode.tempFileURL,
            rewardCodeLoadFailed: false
          })
        }
      },
      fail: (err) => {
        this._cloudAssetUrlResolving = false
        console.warn('[Assets] 云端资源链接获取失败:', err)
      }
    })
  },

  getAudioVolume(cue) {
    const volume = AUDIO_VOLUMES[cue]
    if (volume == null) return 1
    return Math.max(0, Math.min(1, volume))
  },

  playAudioCue(cue) {
    this.notifyAppUserGesture()

    if (!wx.createInnerAudioContext || !AUDIO_CLIPS[cue]) return

    if (!this._audioContexts) {
      this._audioContexts = {}
    }

    if (!this._audioContexts[cue]) {
      const audio = wx.createInnerAudioContext()
      audio.src = AUDIO_CLIPS[cue]
      audio.volume = this.getAudioVolume(cue)
      audio.obeyMuteSwitch = false
      audio.onError(() => {})
      this._audioContexts[cue] = audio
    }

    const audio = this._audioContexts[cue]
    try {
      audio.volume = this.getAudioVolume(cue)
      audio.stop()
      audio.seek(0)
      audio.play()
    } catch (err) {
      console.warn('播放音效失败:', cue, err)
    }
  },

  playTapCue() {
    this.playAudioCue('tap')
  },

  setInteractionLocked(locked) {
    this.setData({ interactionLocked: !!locked })
  },

  isInteractionLocked() {
    return this.data.interactionLocked === true
  },

  getFetchCooldownRemainingMs(now) {
    const last = Number(this.data.lastFetchNearbyIntentAt || 0)
    if (!last) return 0

    const elapsed = Math.max(0, now - last)
    return Math.max(0, FETCH_NEARBY_COOLDOWN_MS - elapsed)
  },

  playSpinCue() {
    if (this.data.appMode === 'manual' && this.data.manualPickerType === 'wheel') {
      this.playAudioCue('wheelSpin')
      return
    }

    this.playAudioCue('slotSpin')
  },

  showEasterEgg(text) {
    clearTimeout(this._easterEggTimer)
    this.setData({ easterEggText: text })
    this._easterEggTimer = setTimeout(() => {
      this.setData({ easterEggText: '' })
    }, 1200)
  },

  revealResultSeal() {
    clearTimeout(this._resultSealTimer)
    this.setData({ showResultSeal: true })
    this._resultSealTimer = setTimeout(() => {
      this.setData({ showResultSeal: false })
    }, 900)
  },

  showResultModal(restaurant) {
    console.log('[SlotDebug] ===== showResultModal 弹窗打开 =====')
    console.log('[SlotDebug] result.title:', restaurant && restaurant.title)
    console.log('[SlotDebug] result.source:', restaurant && restaurant.source)
    this.playAudioCue('nameReveal')
    this.revealResultSeal()
    this.setInteractionLocked(false)
    this.setData({
      spinning: false,
      retryingDance: false,
      result: restaurant,
      showModal: true
    })
  },

  onChooseManual() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    this.playAudioCue('manual')
    this.showEasterEgg('名单已开，接着奏乐')
    clearTimeout(this._slotStartTimer)
    clearTimeout(this._slotFinishTimer)
    clearTimeout(this._danceRetryTimer)
    this._manualCanvasNode = null
    this._manualCanvasCtx = null
    this.setData({
      appMode: 'manual',
      result: null,
      showModal: false,
      showSaveWheelModal: false,
      showSavedWheelsModal: false,
      showRenameWheelModal: false,
      showEditWheelItemsModal: false,
      showManageCandidatesModal: false,
      spinning: false,
      interactionLocked: false,
      retryingDance: false,
      slotItems: [],
      slotAnimating: false
    })
    this.syncManualCandidates(this.data.manualCandidates)
  },

  onChooseNearby() {
    if (this.isInteractionLocked()) return
    const snapshotRestaurants = this.data.nearbySnapshotRestaurants
    const hasNearbySnapshot = this.data.nearbySnapshotHasFetched
    this.playTapCue()
    this.playAudioCue('nearby')
    this.showEasterEgg('天意开机')
    this.setData({
      appMode: 'nearby',
      result: null,
      showModal: false,
      spinning: false,
      interactionLocked: false,
      retryingDance: false,
      allNearbyRestaurants: hasNearbySnapshot ? snapshotRestaurants : [],
      restaurants: [],
      restaurantCount: 0,
      slotItems: [],
      slotAnimating: false,
      slotTransform: 'translateY(0px)',
      loading: false,
      availableCuisineOptions: [],
      cuisineTags: buildCuisineTags([], []),
      nearbyHasFetched: hasNearbySnapshot
    })
    if (hasNearbySnapshot) {
      this.syncNearbyCandidates(snapshotRestaurants)
    }
  },

  onBackToChoice() {
    if (this.isInteractionLocked()) return
    this.playAudioCue('suicide')
    clearTimeout(this._slotStartTimer)
    clearTimeout(this._slotFinishTimer)
    clearTimeout(this._danceRetryTimer)
    this.setData({
      appMode: 'choice',
      spinning: false,
      interactionLocked: false,
      retryingDance: false,
      allNearbyRestaurants: [],
      restaurants: [],
      restaurantCount: 0,
      availableCuisineOptions: [],
      cuisineTags: buildCuisineTags([], []),
      showModal: false,
      showFilterPanel: false,
      showAddCandidateModal: false,
      showSaveWheelModal: false,
      showSavedWheelsModal: false,
      showRenameWheelModal: false,
      showEditWheelItemsModal: false,
      showManageCandidatesModal: false,
      showRewardModal: false
    })
  },

  onOpenReward() {
    this.playTapCue()
    this.setData({
      showRewardModal: true,
      rewardCodeLoadFailed: false
    })
  },

  onCloseReward() {
    this.playTapCue()
    this.setData({ showRewardModal: false })
  },

  onRewardCodeError() {
    this.setData({ rewardCodeLoadFailed: true })
  },

  onPreviewRewardCode() {
    if (this.data.rewardCodeLoadFailed || !this.data.rewardCodeSrc) return

    wx.previewImage({
      urls: [this.data.rewardCodeSrc],
      current: this.data.rewardCodeSrc
    })
  },

  // ==================== 手动候选 ====================

  onOpenAddCandidate() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    this.setData({
      showAddCandidateModal: true,
      candidateInput: ''
    })
  },

  onCandidateInput(e) {
    this.setData({ candidateInput: e.detail.value })
  },

  onCancelAddCandidate() {
    this.playTapCue()
    this.setData({
      showAddCandidateModal: false,
      candidateInput: ''
    })
  },

  onConfirmAddCandidate() {
    this.playTapCue()
    const name = String(this.data.candidateInput || '').trim()
    if (!name) {
      wx.showToast({
        title: '先说出饭名',
        icon: 'none'
      })
      return
    }

    if (this.data.manualCandidates.some(item => item.title === name)) {
      wx.showToast({
        title: '这饭名已经在名单里了',
        icon: 'none'
      })
      return
    }

    const manualCandidates = this.data.manualCandidates.concat({
      id: `manual-${Date.now()}-${this.data.manualCandidates.length}`,
      title: name,
      category: '自选',
      source: 'manual'
    })

    this.setData({
      manualCandidates,
      showAddCandidateModal: false,
      candidateInput: '',
      activeSavedWheelId: null
    })
    this.syncManualCandidates(manualCandidates)
  },

  onOpenSaveWheel() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    if (!this.data.canSaveManualWheel) {
      wx.showToast({
        title: this.data.manualCandidates.length === 0 ? '席上无人，存了也空' : '这盘已经入史册',
        icon: 'none'
      })
      return
    }

    this.setData({
      showSaveWheelModal: true,
      wheelNameInput: ''
    })
  },

  onWheelNameInput(e) {
    this.setData({ wheelNameInput: e.detail.value })
  },

  onCloseSaveWheel() {
    this.playTapCue()
    this.setData({
      showSaveWheelModal: false,
      wheelNameInput: ''
    })
  },

  onConfirmSaveWheel() {
    this.playTapCue()
    const name = String(this.data.wheelNameInput || '').trim()
    if (!name) {
      wx.showToast({
        title: '给转盘赐个名',
        icon: 'none'
      })
      return
    }

    const saved = saveManualWheel(name, this.data.manualCandidates)
    if (!saved) {
      wx.showToast({
        title: '存档失败，再试一次',
        icon: 'none'
      })
      return
    }

    this.setData({
      showSaveWheelModal: false,
      wheelNameInput: '',
      activeSavedWheelId: saved.id,
      canSaveManualWheel: false,
      savedWheels: getSavedManualWheels()
    })
    this.showEasterEgg('转盘已入史册')
    wx.showToast({
      title: '转盘已保存',
      icon: 'success'
    })
  },

  onOpenSavedWheels() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    this.setData({
      showSavedWheelsModal: true,
      savedWheels: getSavedManualWheels()
    })
  },

  onCloseSavedWheels() {
    this.playTapCue()
    this.setData({
      showSavedWheelsModal: false,
      showRenameWheelModal: false,
      showEditWheelItemsModal: false
    })
  },

  onLoadSavedWheel(e) {
    this.playTapCue()
    const id = e.currentTarget.dataset.id
    const wheel = this.data.savedWheels.find(item => item.id === id)
    if (!wheel || !Array.isArray(wheel.items) || wheel.items.length === 0) {
      wx.showToast({
        title: '这段往事空了',
        icon: 'none'
      })
      return
    }

    const manualCandidates = wheel.items.map((item, index) => ({
      id: item.id || `manual-${Date.now()}-${index}`,
      title: item.title,
      category: item.category || '自选',
      source: 'manual'
    }))

    this.setData({
      manualCandidates,
      activeSavedWheelId: wheel.id,
      canSaveManualWheel: false,
      showSavedWheelsModal: false,
      result: null,
      showModal: false,
      spinning: false
    })
    this.syncManualCandidates(manualCandidates)
    this.showEasterEgg('往日种种，今日重开')
  },

  onOpenRenameWheel(e) {
    this.playTapCue()
    const id = e.currentTarget.dataset.id
    const wheel = this.data.savedWheels.find(item => item.id === id)
    if (!wheel) return

    this.setData({
      showRenameWheelModal: true,
      renamingWheelId: id,
      renameWheelInput: wheel.name
    })
  },

  onRenameWheelInput(e) {
    this.setData({ renameWheelInput: e.detail.value })
  },

  onCloseRenameWheel() {
    this.playTapCue()
    this.setData({
      showRenameWheelModal: false,
      renamingWheelId: null,
      renameWheelInput: ''
    })
  },

  onConfirmRenameWheel() {
    this.playTapCue()
    const name = String(this.data.renameWheelInput || '').trim()
    if (!name) {
      wx.showToast({
        title: '新名字不能空',
        icon: 'none'
      })
      return
    }

    const renamed = renameManualWheel(this.data.renamingWheelId, name)
    if (!renamed) {
      wx.showToast({
        title: '改名失败，再试一次',
        icon: 'none'
      })
      return
    }

    this.setData({
      showRenameWheelModal: false,
      renamingWheelId: null,
      renameWheelInput: '',
      savedWheels: getSavedManualWheels()
    })
    this.showEasterEgg('名号已改')
  },

  onDeleteSavedWheel(e) {
    this.playTapCue()
    const id = e.currentTarget.dataset.id
    const wheel = this.data.savedWheels.find(item => item.id === id)
    if (!wheel) return

    wx.showModal({
      title: '删掉这盘？',
      content: `确定删除「${wheel.name}」吗？`,
      confirmText: '删除',
      confirmColor: '#c44a3a',
      success: res => {
        if (!res.confirm) return

        const deleted = deleteManualWheel(id)
        if (!deleted) {
          wx.showToast({
            title: '删除失败，再试一次',
            icon: 'none'
          })
          return
        }

        this.setData({
          savedWheels: getSavedManualWheels(),
          activeSavedWheelId: this.data.activeSavedWheelId === id ? null : this.data.activeSavedWheelId
        })
        this.showEasterEgg('这段往事已删')
      }
    })
  },

  onOpenEditWheelItems(e) {
    this.playTapCue()
    const id = e.currentTarget.dataset.id
    const wheel = this.data.savedWheels.find(item => item.id === id)
    if (!wheel) return

    const editingWheelItems = wheel.items.map((item, index) => ({
      id: item.id || `manual-${Date.now()}-${index}`,
      title: item.title,
      category: item.category || '自选',
      source: 'manual'
    }))

    this.setData({
      showEditWheelItemsModal: true,
      editingWheelId: id,
      editingWheelName: wheel.name,
      editingWheelItems,
      editingWheelItemInput: ''
    })
  },

  onEditingWheelItemInput(e) {
    this.setData({ editingWheelItemInput: e.detail.value })
  },

  onAddEditingWheelItem() {
    this.playTapCue()
    const title = String(this.data.editingWheelItemInput || '').trim()
    if (!title) {
      wx.showToast({
        title: '先写一道菜',
        icon: 'none'
      })
      return
    }

    const editingWheelItems = this.data.editingWheelItems.concat({
      id: `manual-${Date.now()}-${this.data.editingWheelItems.length}`,
      title,
      category: '自选',
      source: 'manual'
    })

    this.setData({
      editingWheelItems,
      editingWheelItemInput: ''
    })
  },

  onRemoveEditingWheelItem(e) {
    this.playTapCue()
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) return

    const editingWheelItems = this.data.editingWheelItems.filter((item, itemIndex) => itemIndex !== index)
    this.setData({ editingWheelItems })
  },

  onCloseEditWheelItems() {
    this.playTapCue()
    this.setData({
      showEditWheelItemsModal: false,
      editingWheelId: null,
      editingWheelName: '',
      editingWheelItems: [],
      editingWheelItemInput: ''
    })
  },

  onConfirmEditWheelItems() {
    this.playTapCue()
    if (this.data.editingWheelItems.length === 0) {
      wx.showToast({
        title: '至少留一道菜',
        icon: 'none'
      })
      return
    }

    const updated = updateManualWheelItems(this.data.editingWheelId, this.data.editingWheelItems)
    if (!updated) {
      wx.showToast({
        title: '修改失败，再试一次',
        icon: 'none'
      })
      return
    }

    const data = {
      showEditWheelItemsModal: false,
      editingWheelId: null,
      editingWheelName: '',
      editingWheelItems: [],
      editingWheelItemInput: '',
      savedWheels: getSavedManualWheels()
    }

    if (this.data.activeSavedWheelId === updated.id) {
      data.manualCandidates = updated.items
      data.result = null
      data.showModal = false
      data.spinning = false
    }

    this.setData(data)

    if (this.data.activeSavedWheelId === updated.id) {
      this.syncManualCandidates(updated.items)
    }

    this.showEasterEgg('菜单已重修')
  },

  // ==================== 管理当前未保存名单 ====================

  onOpenManageCandidates() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    this.setData({
      showManageCandidatesModal: true,
      manageCandidatesInput: ''
    })
  },

  onCloseManageCandidates() {
    this.playTapCue()
    this.setData({
      showManageCandidatesModal: false,
      manageCandidatesInput: ''
    })
  },

  onManageCandidateInput(e) {
    this.setData({ manageCandidatesInput: e.detail.value })
  },

  onRemoveCandidate(e) {
    this.playTapCue()
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) return

    const manualCandidates = this.data.manualCandidates.filter((_, i) => i !== index)

    this.setData({
      manualCandidates,
      activeSavedWheelId: null
    })
    this.syncManualCandidates(manualCandidates)
  },

  onAddCandidateInManage() {
    this.playTapCue()
    const title = String(this.data.manageCandidatesInput || '').trim()
    if (!title) {
      wx.showToast({
        title: '先写一道菜',
        icon: 'none'
      })
      return
    }

    if (this.data.manualCandidates.some(item => item.title === title)) {
      wx.showToast({
        title: '这饭名已经在名单里了',
        icon: 'none'
      })
      return
    }

    const manualCandidates = this.data.manualCandidates.concat({
      id: `manual-${Date.now()}-${this.data.manualCandidates.length}`,
      title,
      category: '自选',
      source: 'manual'
    })

    this.setData({
      manualCandidates,
      manageCandidatesInput: '',
      activeSavedWheelId: null
    })
    this.syncManualCandidates(manualCandidates)
  },

  syncManualCandidates(manualCandidates) {
    const manualPickerType = manualCandidates.length > 8 ? 'slot' : 'wheel'
    const data = {
      restaurants: manualCandidates,
      restaurantCount: manualCandidates.length,
      manualPickerType,
      spinning: false,
      canSaveManualWheel: manualCandidates.length > 0 && this.data.activeSavedWheelId == null
    }

    if (manualPickerType === 'slot') {
      this.setData(data)
      this.buildSlotPreview(manualCandidates)
      return
    }

    // 切换到轮盘模式时清除旧 canvas 引用（wx:if 会重建 DOM）
    this._manualCanvasNode = null
    this._manualCanvasCtx = null

    this.setData(Object.assign(data, {
      slotItems: [],
      slotAnimating: false,
      slotTransform: 'translateY(0px)'
    }))
    setTimeout(() => {
      this._drawManualWheel(0)
    }, 200)
  },

  syncNearbyCandidates(allNearbyRestaurants) {
    const allItems = Array.isArray(allNearbyRestaurants) ? allNearbyRestaurants : []
    const { filters } = this.data

    // 应用客户端筛选（服务端不再做筛选，始终返回全量数据）
    const filtered = applyClientFilters(allItems, {
      cuisines: normalizeCuisines(filters.cuisines),
      cost_min: filters.cost_min,
      cost_max: filters.cost_max,
      rating_min: filters.rating_min,
      rating_max: filters.rating_max,
      include_unrated: filters.include_unrated,
      include_uncosted: filters.include_uncosted,
      distance_max: filters.distance_max
    })
    const restaurants = applyRestaurantBlacklist(filtered)
    const hasMissingCost = allItems.some(item => !hasKnownCost(item))
    const hasMissingRating = allItems.some(item => !hasKnownRating(item))
    const availableCuisineOptions = buildAvailableCuisineOptions(allItems)
    const selectedCuisines = normalizeCuisines(filters.cuisines)

    this.setData({
      allNearbyRestaurants: allItems,
      restaurants,
      restaurantCount: restaurants.length,
      hasMissingCost,
      hasMissingRating,
      availableCuisineOptions,
      cuisineTags: buildCuisineTags(selectedCuisines, availableCuisineOptions),
      loading: false
    })
    this.buildSlotPreview(restaurants)
    return restaurants
  },

  _ensureManualCanvas(callback) {
    if (this._manualCanvasNode && this._manualCanvasCtx) {
      callback()
      return
    }

    const acquire = (retry) => {
      const query = wx.createSelectorQuery()
      query.select('#manualWheelCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res[0] && res[0].node) {
            this._manualCanvasNode = res[0].node
            this._manualCanvasCtx = res[0].node.getContext('2d')
            this._manualDpr = wx.getSystemInfoSync().pixelRatio
            callback()
          } else if (retry) {
            setTimeout(() => acquire(false), 200)
          } else {
            callback()
          }
        })
    }

    acquire(true)
  },

  _drawManualWheel(rotation) {
    this._ensureManualCanvas(() => {
      const restaurants = this.data.manualCandidates
      const ctx = this._manualCanvasCtx
      const canvas = this._manualCanvasNode
      const dpr = this._manualDpr

      if (!ctx || !canvas) return

      const size = 300
      canvas.width = size * dpr
      canvas.height = size * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const centerX = size / 2
      const centerY = size / 2
      const radius = 130

      ctx.clearRect(0, 0, size, size)
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 15
      ctx.fillStyle = '#f5efdf'
      ctx.fill()
      ctx.restore()

      if (restaurants.length === 0) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(44, 36, 22, 0.06)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(168, 134, 74, 0.22)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#2c2416'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('席上无人', centerX, centerY - 8)
        ctx.font = '12px sans-serif'
        ctx.fillStyle = 'rgba(44, 36, 22, 0.48)'
        ctx.fillText('先把饭名供上来', centerX, centerY + 16)
        return
      }

      const colors = [
        '#c44a3a', '#a8864a', '#2c2416', '#7a6e64',
        '#8b6d3f', '#5a4e42', '#c9a84c', '#94897e'
      ]
      const segmentAngle = (2 * Math.PI) / restaurants.length

      for (let i = 0; i < restaurants.length; i++) {
        const startAngle = rotation + (i * segmentAngle) - (Math.PI / 2)
        const endAngle = startAngle + segmentAngle
        const title = restaurants[i].title.length > 8 ? `${restaurants[i].title.slice(0, 7)}…` : restaurants[i].title

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, startAngle, endAngle)
        ctx.closePath()
        ctx.fillStyle = colors[i % colors.length]
        ctx.fill()
        ctx.strokeStyle = 'rgba(44, 36, 22, 0.3)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(startAngle + segmentAngle / 2)
        ctx.font = 'bold 13px sans-serif'
        ctx.fillStyle = '#f5efdf'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(title, radius * 0.58, 0)
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI)
      ctx.fillStyle = '#2c2416'
      ctx.fill()
      ctx.strokeStyle = '#a8864a'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#f5efdf'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('天意', centerX, centerY)

      ctx.beginPath()
      ctx.moveTo(centerX, centerY - radius - 15)
      ctx.lineTo(centerX - 12, centerY - radius + 5)
      ctx.lineTo(centerX + 12, centerY - radius + 5)
      ctx.closePath()
      ctx.fillStyle = '#c44a3a'
      ctx.fill()
      ctx.strokeStyle = '#c9a84c'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  },

  _animateManualWheel(targetIndex, callback) {
    const restaurants = this.data.manualCandidates
    if (restaurants.length === 0) return

    const segmentAngle = (2 * Math.PI) / restaurants.length
    const targetAngle = (2 * Math.PI) - (targetIndex * segmentAngle) - (segmentAngle / 2)
    const totalRotation = (5 * 2 * Math.PI) + targetAngle
    const duration = MANUAL_WHEEL_SPIN_DURATION
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      this._drawManualWheel(totalRotation * easeOut)

      if (progress < 1) {
        setTimeout(animate, 16)
      } else if (callback) {
        callback()
      }
    }

    animate()
  },

  // ==================== 数据获取 ====================

  /**
   * 获取大致位置，然后加载餐厅数据
   */
  onFetchNearbyIntent() {
    if (this.isInteractionLocked()) return
    const now = Date.now()
    const cooldownRemainingMs = this.getFetchCooldownRemainingMs(now)
    if (cooldownRemainingMs > 0) {
      wx.showToast({
        title: `天意刚开坛，稍等 ${Math.ceil(cooldownRemainingMs / 1000)} 秒`,
        icon: 'none',
        duration: 2000
      })
      return
    }

    this.playTapCue()
    this.showEasterEgg('天意开坛')
    this.setData({
      lastFetchNearbyIntentAt: now,
      nearbyHasFetched: true
    })
    this.loadRestaurants()
  },

  loadRestaurants() {
    const that = this
    this.setData({ loading: true })

    wx.getFuzzyLocation({
      type: 'gcj02',
      success(res) {
        that._currentLat = res.latitude
        that._currentLng = res.longitude
        that.fetchRestaurantData()
      },
      fail(err) {
        // 大致位置获取失败时，使用默认坐标（杭州）
        console.warn('wx.getFuzzyLocation 获取大致位置失败:', err)
        that._currentLat = 30.2741
        that._currentLng = 120.1551
        that.fetchRestaurantData()
        that._showLocationPermissionGuide(err)
        wx.showToast({
          title: '权限乱世，先用默认位置',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  /**
   * 获取餐厅数据：优先从缓存读取，缓存未命中则调用云函数
   */
  fetchRestaurantData() {
    const { filters } = this.data
    const lat = this._currentLat
    const lng = this._currentLng

    // 始终先尝试缓存（无论是否有筛选条件，筛选在客户端完成）
    const cachedItems = getCachedRestaurants(lat, lng)

    if (cachedItems) {
      // 缓存命中，客户端筛选
      this.setData({
        nearbySnapshotRestaurants: cachedItems,
        nearbySnapshotHasFetched: true
      })
      this.syncNearbyCandidates(cachedItems)
      return
    }

    // 缓存未命中，调用云函数（云函数返回全量数据，不做筛选）
    const that = this
    wx.cloud.callFunction({
      name: 'fetchRestaurants',
      data: {
        latitude: lat,
        longitude: lng,
        radius: filters.distance_max || DEFAULT_RADIUS,
        distance_max: filters.distance_max
      },
      success(res) {
        const response = res.result

        console.log('fetchRestaurants 云函数返回:', response)
        if (response && response.providerSummary) {
          console.log('餐厅数据源概况:', response.providerSummary)
        }

        if (!response) {
          console.error('fetchRestaurants 云函数返回为空:', res)
          wx.showToast({
            title: '天意断线了，请重试',
            icon: 'none'
          })
          that.setData({ loading: false })
          return
        }

        if (!response.success) {
          console.error('地图服务返回失败:', {
            error: response.error,
            detail: response.detail,
            status: response.status,
            request_id: response.request_id
          })
          wx.showToast({
            title: response.error || '天意断线了，请重试',
            icon: 'none'
          })
          that.setData({ loading: false })
          return
        }

        const restaurants = response.data || []
        that.setData({
          nearbySnapshotRestaurants: restaurants,
          nearbySnapshotHasFetched: true
        })

        // 始终缓存全量数据（云函数不再做服务端筛选）
        if (restaurants.length > 0) {
          setCachedRestaurants(lat, lng, restaurants)
        }

        const availableRestaurants = that.syncNearbyCandidates(restaurants)
        if (Array.isArray(response.availableCuisines) && response.availableCuisines.length > 0) {
          const selectedCuisines = normalizeCuisines(that.data.filters.cuisines)
          that.setData({
            availableCuisineOptions: response.availableCuisines,
            cuisineTags: buildCuisineTags(selectedCuisines, response.availableCuisines)
          })
        }

        if (restaurants.length === 0) {
          wx.showToast({
            title: '天意沉默了，换个条件',
            icon: 'none'
          })
        } else if (availableRestaurants.length === 0) {
          wx.showToast({
            title: '都被打入冷宫了',
            icon: 'none'
          })
        }
      },
      fail(err) {
        console.error('云函数调用失败:', err)
        wx.showToast({
          title: '天意断线了，请重试',
          icon: 'none'
        })
        that.setData({ loading: false })
      }
    })
  },

  /**
   * 大致定位失败时，引导用户重新开启位置权限
   */
  _showLocationPermissionGuide(err) {
    const message = err && (err.errMsg || err.message || '')

    wx.getSetting({
      success(settingRes) {
        const locationAuth = settingRes.authSetting['scope.userFuzzyLocation']
        if (locationAuth !== false) return

        wx.showModal({
          title: '是这个权限害了你啊',
          content: '开启大致定位后，才能看看附近吃什么。要去设置里放行吗？',
          confirmText: '去开启',
          cancelText: '容我再想',
          success(modalRes) {
            if (modalRes.confirm) {
              wx.openSetting({
                success(openSettingRes) {
                  console.log('位置权限设置结果:', openSettingRes.authSetting)
                },
                fail(openSettingErr) {
                  console.error('打开权限设置失败:', openSettingErr)
                }
              })
            }
          }
        })
      },
      fail(settingErr) {
        console.error('读取授权设置失败:', {
          locationError: message,
          settingError: settingErr
        })
      }
    })
  },

  // ==================== 老虎机抽选 ====================

  /**
   * 根据餐厅列表构建老虎机静态预览。
   */
  buildSlotPreview(restaurants, centerIndex = 0) {
    if (!restaurants || restaurants.length === 0) {
      this.setData({
        slotItems: [],
        slotTransform: 'translateY(0px)',
        slotAnimating: false
      })
      return
    }

    const count = restaurants.length
    const center = centerIndex % count
    const current = restaurants[center]

    let prevIndex = (center - 1 + count) % count
    let nextIndex = (center + 1) % count

    if (count > 2) {
      let attempts = 0
      while (isSameRestaurant(restaurants[prevIndex], current) && attempts < count) {
        prevIndex = Math.floor(Math.random() * count)
        attempts++
      }
      attempts = 0
      while (isSameRestaurant(restaurants[nextIndex], current) && attempts < count) {
        nextIndex = Math.floor(Math.random() * count)
        attempts++
      }
    }

    this.setData({
      slotItems: [restaurants[prevIndex], current, restaurants[nextIndex]].map(formatSlotItem),
      slotTransform: 'translateY(0px)',
      slotAnimating: false
    })
  },

  /**
   * 用户点击"开始旋转"
   */
  onSpin() {
    if (this.isInteractionLocked() && !this.data.retryingDance) return
    if (this.data.spinning) return
    if (this.data.restaurants.length === 0) {
      wx.showToast({
        title: this.data.appMode === 'manual' ? '席上无人，先加饭名' : '天意沉默，请调整条件',
        icon: 'none',
        duration: 2000
      })
      return
    }

    this.playSpinCue()
    this.showEasterEgg('优势在胃')
    this.setInteractionLocked(true)

    if (this.data.appMode === 'manual' && this.data.manualPickerType === 'wheel') {
      const targetIndex = Math.floor(Math.random() * this.data.manualCandidates.length)
      const targetRestaurant = this.data.manualCandidates[targetIndex]

      this.setData({
        spinning: true,
        retryingDance: false,
        showModal: false
      })
      this._animateManualWheel(targetIndex, () => {
        this.showResultModal(targetRestaurant)
      })
      return
    }

    clearTimeout(this._slotStartTimer)
    clearTimeout(this._slotFinishTimer)

    const restaurants = this.data.restaurants
    const targetIndex = Math.floor(Math.random() * restaurants.length)
    const targetRestaurant = restaurants[targetIndex]

    console.log('[SlotDebug] ===== 老虎机抽选开始 =====')
    console.log('[SlotDebug] restaurants.length:', restaurants.length)
    console.log('[SlotDebug] targetIndex:', targetIndex)
    console.log('[SlotDebug] targetRestaurant.name:', targetRestaurant.title)

    const spinItems = []
    const randomCount = Math.max(28, Math.min(48, restaurants.length * 4))

    for (let i = 0; i < randomCount; i++) {
      let candidate
      let attempts = 0
      do {
        candidate = restaurants[Math.floor(Math.random() * restaurants.length)]
        attempts++
      } while (
        restaurants.length > 2 &&
        i > 0 && isSameRestaurant(candidate, spinItems[i - 1]) &&
        attempts < restaurants.length
      )
      spinItems.push(candidate)
    }

    // 确保最后一个随机项和 target 不相邻相同
    if (restaurants.length > 2 && spinItems.length > 0 && isSameRestaurant(spinItems[spinItems.length - 1], targetRestaurant)) {
      for (let j = 0; j < restaurants.length; j++) {
        const alt = restaurants[Math.floor(Math.random() * restaurants.length)]
        if (!isSameRestaurant(alt, targetRestaurant)) {
          spinItems[spinItems.length - 1] = alt
          break
        }
      }
    }

    spinItems.push(targetRestaurant)

    // 确保 target 后面的 next 不与 target 相同
    let afterTarget = restaurants[(targetIndex + 1) % restaurants.length]
    if (restaurants.length > 2 && isSameRestaurant(afterTarget, targetRestaurant)) {
      for (let k = 0; k < restaurants.length; k++) {
        const alt = restaurants[Math.floor(Math.random() * restaurants.length)]
        if (!isSameRestaurant(alt, targetRestaurant)) {
          afterTarget = alt
          break
        }
      }
    }
    spinItems.push(afterTarget)

    // target 在 spinItems 中的位置 = 倒数第二项（最后一项是 afterTarget）
    const targetSlotIndex = spinItems.length - 2
    // 使 target 对齐到老虎机窗口中间高亮行（slot-window 第 2 行，top: 64px）
    // translateY = -(targetSlotIndex - 1) * SLOT_ITEM_HEIGHT
    // 验证：item[targetSlotIndex] 的视觉 top = targetSlotIndex*64 + translateY = 64 = 高亮行 top
    const finalOffset = (targetSlotIndex - 1) * SLOT_ITEM_HEIGHT

    // 日志：验证视觉中心和最终结果的一致性
    const visualCenterIndex = targetSlotIndex
    const visualRestaurantAtCenter = spinItems[visualCenterIndex]
    console.log('[SlotDebug] spinItems.length:', spinItems.length)
    console.log('[SlotDebug] randomCount:', randomCount)
    console.log('[SlotDebug] targetSlotIndex (visual center):', targetSlotIndex)
    console.log('[SlotDebug] finalOffset:', finalOffset, 'px')
    console.log('[SlotDebug] visualCenterIndex:', visualCenterIndex, '→ name:', visualRestaurantAtCenter.title)
    console.log('[SlotDebug] targetIndex (映回 restaurants):', targetIndex, '→ name:', restaurants[targetIndex].title)
    console.log('[SlotDebug] targetRestaurant === visualCenterRestaurant:', isSameRestaurant(targetRestaurant, visualRestaurantAtCenter))
    console.log('[SlotDebug] selectedIndex:', targetIndex)
    console.log('[SlotDebug] selectedRestaurant.name:', targetRestaurant.title)

    this.setData({
      spinning: true,
      retryingDance: false,
      showModal: false,
      slotAnimating: false,
      slotItems: spinItems.map(formatSlotItem),
      slotTransform: 'translateY(0px)'
    })

    this._slotStartTimer = setTimeout(() => {
      this.setData({
        slotAnimating: true,
        slotTransform: `translateY(-${finalOffset}px)`
      })
    }, 50)

    this._slotFinishTimer = setTimeout(() => {
      this.showResultModal(targetRestaurant)
    }, SLOT_RESULT_REVEAL_DELAY)
  },

  // ==================== 筛选面板 ====================

  /**
   * 打开筛选面板
   */
  onOpenFilter() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    const { filters } = this.data
    const selectedCuisines = normalizeCuisines(filters.cuisines)
    this.setData({
      showFilterPanel: true,
      selectedCuisines,
      cuisineTags: buildCuisineTags(selectedCuisines, this.data.availableCuisineOptions),
      costMinInput: filters.cost_min !== null ? String(filters.cost_min) : '',
      costMaxInput: filters.cost_max !== null ? String(filters.cost_max) : '',
      ratingMinInput: filters.rating_min !== null ? String(filters.rating_min) : '',
      ratingMaxInput: filters.rating_max !== null ? String(filters.rating_max) : '',
      includeUnrated: !!filters.include_unrated,
      includeUncosted: !!filters.include_uncosted,
      distanceMaxInput: filters.distance_max !== null ? String(filters.distance_max) : ''
    })
  },

  /**
   * 只在点击遮罩背景时关闭筛选面板。
   */
  onFilterOverlayTap(e) {
    const target = e && e.target
    const currentTarget = e && e.currentTarget

    if (target && currentTarget && target.id === currentTarget.id) {
      this.onCloseFilter()
    }
  },

  /**
   * 关闭筛选面板
   */
  onCloseFilter() {
    this.playAudioCue('noTianyi')
    this.setData({ showFilterPanel: false })
  },

  noop() {},

  showInvalidFilterToast() {
    wx.showToast({
      title: INVALID_FILTER_MESSAGE,
      icon: 'none',
      duration: 2200
    })
  },

  /**
   * 选择/取消菜系。
   */
  onSelectCuisine(e) {
    this.playTapCue()
    const cuisine = e.currentTarget.dataset.cuisine
    let selectedCuisines = normalizeCuisines(this.data.selectedCuisines)

    if (cuisine === '不限') {
      selectedCuisines = []
    } else if (selectedCuisines.includes(cuisine)) {
      selectedCuisines = selectedCuisines.filter(item => item !== cuisine)
    } else {
      selectedCuisines = selectedCuisines.concat(cuisine)
    }

    this.setData({
      selectedCuisines,
      cuisineTags: buildCuisineTags(selectedCuisines, this.data.availableCuisineOptions)
    })
  },

  /**
   * 人均最低消费输入
   */
  onCostMinInput(e) {
    this.setData({ costMinInput: e.detail.value })
  },

  /**
   * 人均最高消费输入
   */
  onCostMaxInput(e) {
    this.setData({ costMaxInput: e.detail.value })
  },

  onRatingMinInput(e) {
    this.setData({ ratingMinInput: e.detail.value })
  },

  onRatingMaxInput(e) {
    this.setData({ ratingMaxInput: e.detail.value })
  },

  onToggleIncludeUncosted() {
    this.playTapCue()
    this.setData({ includeUncosted: !this.data.includeUncosted })
  },

  onToggleIncludeUnrated() {
    this.playTapCue()
    this.setData({ includeUnrated: !this.data.includeUnrated })
  },

  /**
   * 最大距离输入
   */
  onDistanceMaxInput(e) {
    this.setData({ distanceMaxInput: e.detail.value })
  },

  /**
   * 应用筛选条件
   */
  onApplyFilter() {
    this.playAudioCue('tianyi')
    const validation = validateFilterInputs({
      costMinInput: this.data.costMinInput,
      costMaxInput: this.data.costMaxInput,
      ratingMinInput: this.data.ratingMinInput,
      ratingMaxInput: this.data.ratingMaxInput,
      distanceMaxInput: this.data.distanceMaxInput
    })
    if (!validation.valid) {
      this.showInvalidFilterToast()
      return
    }

    const costMin = validation.costMin
    const costMax = validation.costMax
    const ratingRange = normalizeRatingRange(validation.ratingMin, validation.ratingMax)
    const ratingMin = ratingRange.rating_min
    const ratingMax = ratingRange.rating_max
    const distanceInput = { value: validation.distanceMax }
    const distanceMax = distanceInput.value
    const cuisines = normalizeCuisines(this.data.selectedCuisines)
    const hasCostFilter = costMin !== null || costMax !== null
    const hasRatingFilter = ratingMin !== null || ratingMax !== null
    const includeUncosted = hasCostFilter && this.data.includeUncosted
    const includeUnrated = hasRatingFilter && this.data.includeUnrated

    // 构建筛选标签
    const labels = []
    if (hasCostFilter) {
      const minStr = costMin !== null ? `¥${costMin}` : '¥0'
      const maxStr = costMax !== null ? `¥${costMax}` : '不限'
      labels.push(`钱包 ${minStr}-${maxStr}`)
      if (includeUncosted) labels.push('含无价')
    }
    if (hasRatingFilter) {
      const minStr = ratingMin !== null ? ratingMin : 0
      const maxStr = ratingMax !== null ? ratingMax : 5
      labels.push(`星级 ${minStr}-${maxStr}`)
      if (includeUnrated) labels.push('含无星')
    }
    if (distanceMax !== null) {
      labels.push(`腿 ${distanceMax}m内`)
    }
    if (cuisines.length > 0) {
      labels.push(`偏向 ${cuisines.join('、')}`)
    }

    const fullList = this.data.allNearbyRestaurants
    const filtered = applyClientFilters(fullList, {
      cuisines,
      cost_min: costMin,
      cost_max: costMax,
      rating_min: ratingMin,
      rating_max: ratingMax,
      include_unrated: includeUnrated,
      include_uncosted: includeUncosted,
      distance_max: distanceMax
    })
    const restaurants = applyRestaurantBlacklist(filtered)

    this.setData({
      filters: {
        cost_min: costMin,
        cost_max: costMax,
        rating_min: ratingMin,
        rating_max: ratingMax,
        cuisines,
        distance_max: distanceMax,
        include_unrated: includeUnrated,
        include_uncosted: includeUncosted
      },
      filterLabels: labels,
      selectedCuisines: cuisines,
      cuisineTags: buildCuisineTags(cuisines, this.data.availableCuisineOptions),
      ratingMinInput: ratingMin !== null ? String(ratingMin) : '',
      ratingMaxInput: ratingMax !== null && hasRatingFilter ? String(ratingMax) : '',
      includeUnrated,
      includeUncosted,
      distanceMaxInput: distanceMax !== null ? String(distanceMax) : '',
      showFilterPanel: false,
      restaurants,
      restaurantCount: restaurants.length
    })
    this.buildSlotPreview(restaurants)
    this.showEasterEgg('天意已被干预')
  },

  /**
   * 重置筛选条件
   */
  resetFilters() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    const fullList = this.data.allNearbyRestaurants
    const restaurants = applyRestaurantBlacklist(fullList)

    this.setData({
      filters: {
        cost_min: null,
        cost_max: null,
        rating_min: null,
        rating_max: null,
        cuisines: [],
        distance_max: null,
        include_unrated: false,
        include_uncosted: false
      },
      filterLabels: [],
      selectedCuisines: [],
      cuisineTags: buildCuisineTags([], this.data.availableCuisineOptions),
      costMinInput: '',
      costMaxInput: '',
      ratingMinInput: '',
      ratingMaxInput: '',
      includeUnrated: false,
      includeUncosted: false,
      distanceMaxInput: '',
      restaurants,
      restaurantCount: restaurants.length
    })
    this.buildSlotPreview(restaurants)
    this.showEasterEgg('恢复天意')
  },

  // ==================== 结果模态卡片 ====================

  /**
   * 关闭结果卡片
   */
  onCloseModal() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    this.setData({ showModal: false })
  },

  /**
   * 点击"换一家"
   */
  onSpinAgain() {
    if (this.isInteractionLocked()) return
    this.playAudioCue('dontWantTable')
    this.setData({
      showModal: false,
      retryingDance: true
    })
    this.setInteractionLocked(true)
    this.showEasterEgg('换一家，接着奏乐')
    const that = this
    clearTimeout(this._danceRetryTimer)
    this._danceRetryTimer = setTimeout(() => {
      that.onSpin()
    }, DONT_WANT_TABLE_DELAY)
  },

  onOpenRestaurantList() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    // Preserve the full restaurant objects for the child page:
    // biz_ext.rating, biz_ext.cost, avg_cost, category, and distance stay intact.
    wx.setStorageSync(NEARBY_RESTAURANT_LIST_STORAGE_KEY, this.data.allNearbyRestaurants)
    wx.navigateTo({
      url: '/pages/restaurants/list'
    })
  },

  /**
   * 点击"导航去这里"
   */
  onNavigate() {
    if (this.isInteractionLocked()) return
    this.playTapCue()
    const { result } = this.data
    if (!result || !result.location) return

    wx.openLocation({
      latitude: result.location.lat,
      longitude: result.location.lng,
      name: result.title,
      address: result.address,
      scale: 16
    })
  }
})
