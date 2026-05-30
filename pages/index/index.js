// 引入缓存工具模块
const { getCachedRestaurants, setCachedRestaurants } = require('../../utils/cache')
const {
  getSavedManualWheels,
  saveManualWheel,
  deleteManualWheel,
  renameManualWheel,
  updateManualWheelItems
} = require('../../utils/manualWheels')

// 菜系选项列表
const CUISINE_OPTIONS = ['不限', '川菜', '粤菜', '日料', '西餐', '火锅', '烧烤', '小吃', '韩餐', '东南亚', '快餐']
const SLOT_ITEM_HEIGHT = 64
const DEFAULT_RADIUS = 1000
const MIN_RADIUS = 10
const MAX_RADIUS = 1000
const AUDIO_CLIPS = {
  boot: null,
  manual: null,
  nearby: null,
  spin: null,
  result: null
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

function buildCuisineTags(selectedCuisines) {
  const selected = normalizeCuisines(selectedCuisines)
  return CUISINE_OPTIONS.map(name => ({
    name,
    selected: name === '不限' ? selected.length === 0 : selected.includes(name)
  }))
}

function parseIntegerInput(value) {
  const input = String(value == null ? '' : value).trim()
  return /^\d+$/.test(input) ? Number(input) : null
}

function normalizeRadius(radius) {
  if (radius === null) return null
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, radius))
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

Page({
  data: {
    appMode: 'choice',

    // 抽选状态
    spinning: false,
    slotItems: [],
    slotTransform: 'translateY(-64px)',
    slotAnimating: false,
    manualPickerType: 'wheel',
    showAddCandidateModal: false,
    showSaveWheelModal: false,
    showSavedWheelsModal: false,
    showRenameWheelModal: false,
    showEditWheelItemsModal: false,
    candidateInput: '',
    wheelNameInput: '',
    renameWheelInput: '',
    renamingWheelId: null,
    editingWheelId: null,
    editingWheelName: '',
    editingWheelItems: [],
    editingWheelItemInput: '',
    activeSavedWheelId: null,
    manualCandidates: [],
    savedWheels: [],
    easterEggText: '',
    showResultSeal: false,
    showRewardModal: false,
    rewardCodeSrc: '/assets/images/reward-code.png',
    rewardCodeLoadFailed: false,

    // 结果数据
    result: null,

    // 模态卡片显示
    showModal: false,

    // 筛选条件
    filters: {
      cost_min: null,
      cost_max: null,
      cuisines: [],
      distance_max: null
    },
    filterLabels: [], // 当前激活的筛选标签

    // 筛选面板状态
    showFilterPanel: false,
    cuisineTags: buildCuisineTags([]),
    selectedCuisines: [],
    costMinInput: '',
    costMaxInput: '',
    distanceMaxInput: '',

    // 餐厅数据
    restaurants: [], // 当前可用餐厅列表（来自缓存或云函数）
    restaurantCount: 0, // 可用餐厅数量
    nearbyHasFetched: false,

    // 加载状态
    loading: false
  },

  _slotStartTimer: null,
  _slotFinishTimer: null,
  _manualCanvasNode: null,
  _manualCanvasCtx: null,
  _manualDpr: 1,
  _audioContexts: null,
  _easterEggTimer: null,
  _resultSealTimer: null,

  onLoad() {},

  playAudioCue(cue) {
    if (!wx.createInnerAudioContext || !AUDIO_CLIPS[cue]) return

    if (!this._audioContexts) {
      this._audioContexts = {}
    }

    if (!this._audioContexts[cue]) {
      const audio = wx.createInnerAudioContext()
      audio.src = AUDIO_CLIPS[cue]
      audio.obeyMuteSwitch = false
      audio.onError(() => {})
      this._audioContexts[cue] = audio
    }

    const audio = this._audioContexts[cue]
    try {
      audio.stop()
      audio.seek(0)
      audio.play()
    } catch (err) {
      console.warn('播放音效失败:', cue, err)
    }
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

  onChooseManual() {
    this.playAudioCue('manual')
    this.showEasterEgg('名单已开，接着奏乐')
    clearTimeout(this._slotStartTimer)
    clearTimeout(this._slotFinishTimer)
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
      spinning: false,
      slotItems: [],
      slotAnimating: false
    })
    this.syncManualCandidates(this.data.manualCandidates)
  },

  onChooseNearby() {
    this.playAudioCue('nearby')
    this.showEasterEgg('天意开机')
    this.setData({
      appMode: 'nearby',
      result: null,
      showModal: false,
      spinning: false,
      restaurants: [],
      restaurantCount: 0,
      slotItems: [],
      slotAnimating: false,
      slotTransform: 'translateY(-64px)',
      loading: false,
      nearbyHasFetched: false
    })
  },

  onBackToChoice() {
    this.playAudioCue('boot')
    clearTimeout(this._slotStartTimer)
    clearTimeout(this._slotFinishTimer)
    this.setData({
      appMode: 'choice',
      spinning: false,
      showModal: false,
      showFilterPanel: false,
      showAddCandidateModal: false,
      showSaveWheelModal: false,
      showSavedWheelsModal: false,
      showRenameWheelModal: false,
      showEditWheelItemsModal: false,
      showRewardModal: false
    })
  },

  onOpenReward() {
    this.setData({
      showRewardModal: true,
      rewardCodeLoadFailed: false
    })
  },

  onCloseReward() {
    this.setData({ showRewardModal: false })
  },

  onRewardCodeError() {
    this.setData({ rewardCodeLoadFailed: true })
  },

  onPreviewRewardCode() {
    if (this.data.rewardCodeLoadFailed) return

    wx.previewImage({
      urls: [this.data.rewardCodeSrc],
      current: this.data.rewardCodeSrc
    })
  },

  // ==================== 手动候选 ====================

  onOpenAddCandidate() {
    this.setData({
      showAddCandidateModal: true,
      candidateInput: ''
    })
  },

  onCandidateInput(e) {
    this.setData({ candidateInput: e.detail.value })
  },

  onCancelAddCandidate() {
    this.setData({
      showAddCandidateModal: false,
      candidateInput: ''
    })
  },

  onConfirmAddCandidate() {
    const name = String(this.data.candidateInput || '').trim()
    if (!name) {
      wx.showToast({
        title: '先说出饭名',
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
    if (this.data.manualCandidates.length === 0) {
      wx.showToast({
        title: '席上无人，存了也空',
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
    this.setData({
      showSaveWheelModal: false,
      wheelNameInput: ''
    })
  },

  onConfirmSaveWheel() {
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
      savedWheels: getSavedManualWheels()
    })
    this.showEasterEgg('转盘已入史册')
    wx.showToast({
      title: '转盘已保存',
      icon: 'success'
    })
  },

  onOpenSavedWheels() {
    this.setData({
      showSavedWheelsModal: true,
      savedWheels: getSavedManualWheels()
    })
  },

  onCloseSavedWheels() {
    this.setData({
      showSavedWheelsModal: false,
      showRenameWheelModal: false,
      showEditWheelItemsModal: false
    })
  },

  onLoadSavedWheel(e) {
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
      showSavedWheelsModal: false,
      result: null,
      showModal: false,
      spinning: false
    })
    this.syncManualCandidates(manualCandidates)
    this.showEasterEgg('往日种种，今日重开')
  },

  onOpenRenameWheel(e) {
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
    this.setData({
      showRenameWheelModal: false,
      renamingWheelId: null,
      renameWheelInput: ''
    })
  },

  onConfirmRenameWheel() {
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
    const id = e.currentTarget.dataset.id
    const wheel = this.data.savedWheels.find(item => item.id === id)
    if (!wheel) return

    wx.showModal({
      title: '删掉这盘？',
      content: `确定删除「${wheel.name}」吗？`,
      confirmText: '删除',
      confirmColor: '#b83d45',
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
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isInteger(index)) return

    const editingWheelItems = this.data.editingWheelItems.filter((item, itemIndex) => itemIndex !== index)
    this.setData({ editingWheelItems })
  },

  onCloseEditWheelItems() {
    this.setData({
      showEditWheelItemsModal: false,
      editingWheelId: null,
      editingWheelName: '',
      editingWheelItems: [],
      editingWheelItemInput: ''
    })
  },

  onConfirmEditWheelItems() {
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

  syncManualCandidates(manualCandidates) {
    const manualPickerType = manualCandidates.length > 8 ? 'slot' : 'wheel'
    const data = {
      restaurants: manualCandidates,
      restaurantCount: manualCandidates.length,
      manualPickerType,
      spinning: false
    }

    if (manualPickerType === 'slot') {
      this.setData(data)
      this.buildSlotPreview(manualCandidates)
      return
    }

    this.setData(Object.assign(data, {
      slotItems: [],
      slotAnimating: false,
      slotTransform: 'translateY(-64px)'
    }))
    setTimeout(() => {
      this._drawManualWheel(0)
    }, 50)
  },

  _ensureManualCanvas(callback) {
    if (this._manualCanvasNode && this._manualCanvasCtx) {
      callback()
      return
    }

    const query = wx.createSelectorQuery()
    query.select('#manualWheelCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0] && res[0].node) {
          this._manualCanvasNode = res[0].node
          this._manualCanvasCtx = res[0].node.getContext('2d')
          this._manualDpr = wx.getSystemInfoSync().pixelRatio
        }
        callback()
      })
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
      ctx.fillStyle = '#120f13'
      ctx.fill()
      ctx.restore()

      if (restaurants.length === 0) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgba(255, 247, 223, 0.06)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(143, 209, 203, 0.22)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'rgba(245, 221, 170, 0.7)'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('席上无人', centerX, centerY - 8)
        ctx.font = '12px sans-serif'
        ctx.fillStyle = 'rgba(245, 221, 170, 0.48)'
        ctx.fillText('先把饭名供上来', centerX, centerY + 16)
        return
      }

      const colors = [
        '#b83d45', '#267c7a', '#d99b50', '#6d5f8d',
        '#dc6c78', '#3d6a58', '#c7793f', '#455b62'
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
        ctx.strokeStyle = 'rgba(255, 247, 223, 0.84)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(startAngle + segmentAngle / 2)
        ctx.font = 'bold 13px sans-serif'
        ctx.fillStyle = '#fff7df'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(title, radius * 0.58, 0)
        ctx.restore()
      }

      ctx.beginPath()
      ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI)
      ctx.fillStyle = '#142024'
      ctx.fill()
      ctx.strokeStyle = '#8fd1cb'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#fff7df'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('天意', centerX, centerY)

      ctx.beginPath()
      ctx.moveTo(centerX, centerY - radius - 15)
      ctx.lineTo(centerX - 12, centerY - radius + 5)
      ctx.lineTo(centerX + 12, centerY - radius + 5)
      ctx.closePath()
      ctx.fillStyle = '#fff7df'
      ctx.fill()
      ctx.strokeStyle = '#dc6c78'
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
    const duration = 3500
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
    this.showEasterEgg('天意开坛')
    this.setData({ nearbyHasFetched: true })
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
    const cuisines = normalizeCuisines(filters.cuisines)
    const radius = filters.distance_max || DEFAULT_RADIUS

    // 检查是否有有效筛选条件（有筛选条件时不使用缓存，需重新请求）
    const hasFilters = filters.cost_min !== null ||
                       filters.cost_max !== null ||
                       cuisines.length > 0 ||
                       filters.distance_max !== null

    // 无筛选条件时尝试缓存
    let cachedItems = null
    if (!hasFilters) {
      cachedItems = getCachedRestaurants(lat, lng)
    }

    if (cachedItems) {
      // 缓存命中
      this.setData({
        restaurants: cachedItems,
        restaurantCount: cachedItems.length,
        loading: false
      })
      this.buildSlotPreview(cachedItems)
      return
    }

    // 缓存未命中，调用云函数
    const that = this
    wx.cloud.callFunction({
      name: 'fetchRestaurants',
      data: {
        latitude: lat,
        longitude: lng,
        radius,
        cost_min: filters.cost_min,
        cost_max: filters.cost_max,
        cuisines,
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

        // 只有无筛选条件时才缓存（缓存全量数据）
        if (!hasFilters && restaurants.length > 0) {
          setCachedRestaurants(lat, lng, restaurants)
        }

        that.setData({
          restaurants: restaurants,
          restaurantCount: restaurants.length,
          loading: false
        })

        if (restaurants.length === 0) {
          wx.showToast({
            title: '天意沉默了，换个条件',
            icon: 'none'
          })
        }

        that.buildSlotPreview(restaurants)
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
        slotTransform: 'translateY(-64px)',
        slotAnimating: false
      })
      return
    }

    const count = restaurants.length
    const prev = restaurants[(centerIndex - 1 + count) % count]
    const current = restaurants[centerIndex % count]
    const next = restaurants[(centerIndex + 1) % count]

    this.setData({
      slotItems: [prev, current, next].map(formatSlotItem),
      slotTransform: 'translateY(-64px)',
      slotAnimating: false
    })
  },

  /**
   * 用户点击"开始旋转"
   */
  onSpin() {
    if (this.data.spinning) return
    if (this.data.restaurants.length === 0) {
      wx.showToast({
        title: this.data.appMode === 'manual' ? '席上无人，先加饭名' : '天意沉默，请调整条件',
        icon: 'none',
        duration: 2000
      })
      return
    }

    this.playAudioCue('spin')
    this.showEasterEgg('优势在胃')

    if (this.data.appMode === 'manual' && this.data.manualPickerType === 'wheel') {
      const targetIndex = Math.floor(Math.random() * this.data.manualCandidates.length)
      const targetRestaurant = this.data.manualCandidates[targetIndex]

      this.setData({
        spinning: true,
        showModal: false
      })
      this._animateManualWheel(targetIndex, () => {
        this.playAudioCue('result')
        this.revealResultSeal()
        this.setData({
          spinning: false,
          result: targetRestaurant,
          showModal: true
        })
      })
      return
    }

    clearTimeout(this._slotStartTimer)
    clearTimeout(this._slotFinishTimer)

    const restaurants = this.data.restaurants
    const targetIndex = Math.floor(Math.random() * restaurants.length)
    const targetRestaurant = restaurants[targetIndex]
    const spinItems = []
    const randomCount = Math.max(28, Math.min(48, restaurants.length * 4))

    for (let i = 0; i < randomCount; i++) {
      const randomRestaurant = restaurants[Math.floor(Math.random() * restaurants.length)]
      spinItems.push(randomRestaurant)
    }

    spinItems.push(targetRestaurant)
    spinItems.push(restaurants[(targetIndex + 1) % restaurants.length])

    const targetSlotIndex = spinItems.length - 2
    const finalOffset = (targetSlotIndex - 1) * SLOT_ITEM_HEIGHT

    this.setData({
      spinning: true,
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
      this.playAudioCue('result')
      this.revealResultSeal()
      this.setData({
        spinning: false,
        result: targetRestaurant,
        showModal: true
      })
    }, 4100)
  },

  // ==================== 筛选面板 ====================

  /**
   * 打开筛选面板
   */
  onOpenFilter() {
    const { filters } = this.data
    const selectedCuisines = normalizeCuisines(filters.cuisines)
    this.setData({
      showFilterPanel: true,
      selectedCuisines,
      cuisineTags: buildCuisineTags(selectedCuisines),
      costMinInput: filters.cost_min !== null ? String(filters.cost_min) : '',
      costMaxInput: filters.cost_max !== null ? String(filters.cost_max) : '',
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
    this.setData({ showFilterPanel: false })
  },

  noop() {},

  /**
   * 选择/取消菜系。
   */
  onSelectCuisine(e) {
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
      cuisineTags: buildCuisineTags(selectedCuisines)
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
    const costMin = parseIntegerInput(this.data.costMinInput)
    const costMax = parseIntegerInput(this.data.costMaxInput)
    const distanceInput = parseIntegerInput(this.data.distanceMaxInput)
    const distanceMax = normalizeRadius(distanceInput)
    const cuisines = normalizeCuisines(this.data.selectedCuisines)

    // 构建筛选标签
    const labels = []
    if (costMin !== null || costMax !== null) {
      const minStr = costMin !== null ? `¥${costMin}` : '¥0'
      const maxStr = costMax !== null ? `¥${costMax}` : '不限'
      labels.push(`钱包 ${minStr}-${maxStr}`)
    }
    if (distanceMax !== null) {
      labels.push(`腿 ${distanceMax}m内`)
    }
    if (cuisines.length > 0) {
      labels.push(`偏向 ${cuisines.join('、')}`)
    }

    this.setData({
      filters: { cost_min: costMin, cost_max: costMax, cuisines, distance_max: distanceMax },
      filterLabels: labels,
      selectedCuisines: cuisines,
      cuisineTags: buildCuisineTags(cuisines),
      distanceMaxInput: distanceMax !== null ? String(distanceMax) : '',
      showFilterPanel: false,
      restaurants: [],
      restaurantCount: 0,
      slotItems: [],
      slotAnimating: false,
      slotTransform: 'translateY(-64px)',
      nearbyHasFetched: false
    })
    this.showEasterEgg('天意已被干预，等你开坛')
  },

  /**
   * 重置筛选条件
   */
  resetFilters() {
    this.setData({
      filters: { cost_min: null, cost_max: null, cuisines: [], distance_max: null },
      filterLabels: [],
      selectedCuisines: [],
      cuisineTags: buildCuisineTags([]),
      costMinInput: '',
      costMaxInput: '',
      distanceMaxInput: '',
      restaurants: [],
      restaurantCount: 0,
      slotItems: [],
      slotAnimating: false,
      slotTransform: 'translateY(-64px)',
      nearbyHasFetched: false
    })
    this.showEasterEgg('恢复天意，等你开坛')
  },

  // ==================== 结果模态卡片 ====================

  /**
   * 关闭结果卡片
   */
  onCloseModal() {
    this.setData({ showModal: false })
  },

  /**
   * 点击"再来一次"
   */
  onSpinAgain() {
    this.setData({ showModal: false })
    this.showEasterEgg('接着奏乐接着抽')
    // 短暂延迟后再次旋转
    const that = this
    setTimeout(() => {
      that.onSpin()
    }, 300)
  },

  /**
   * 点击"导航去这里"
   */
  onNavigate() {
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
