const BACKGROUND_MUSIC_FILE_ID = 'cloud://cloud1-d7g8vh3395ea46f9d.636c-cloud1-d7g8vh3395ea46f9d-1432599903/bgm-guanyu.mp3'
const BGM_URL_FUNCTION_NAME = 'getBgmUrl'
const BACKGROUND_MUSIC_TEMP_URL_TTL = 50 * 60 * 1000

App({
  _cloudReady: false,
  _cloudIniting: false,

  onLaunch: function () {
    this.configureInnerAudio()
    this.initCloud()
    this.startBackgroundMusic()
  },

  onShow: function () {
    this.startBackgroundMusic()
  },

  onHide: function () {
    this.pauseBackgroundMusic()
  },

  // ==================== 云开发初始化 ====================

  initCloud: function () {
    if (this._cloudReady || this._cloudIniting) return
    if (!wx.cloud) {
      console.warn('[BGM] wx.cloud 不可用，跳过云开发初始化')
      return
    }

    this._cloudIniting = true
    console.log('[BGM] 初始化云开发环境: cloud1-d7g8vh3395ea46f9d')
    wx.cloud.init({
      env: 'cloud1-d7g8vh3395ea46f9d',
      traceUser: true
    })
    this._cloudReady = true
    this._cloudIniting = false
    console.log('[BGM] 云开发初始化完成')
  },

  // ==================== 音频配置 ====================

  configureInnerAudio: function () {
    if (this._innerAudioConfigured || !wx.setInnerAudioOption) return

    this._innerAudioConfigured = true
    wx.setInnerAudioOption({
      mixWithOther: true,
      obeyMuteSwitch: false
    })
  },

  // ==================== 用户手势 ====================

  notifyUserGesture: function () {
    if (this._backgroundMusicUserGesture) return
    this._backgroundMusicUserGesture = true
    console.log('[BGM] 收到用户手势，尝试恢复播放')
    this.startBackgroundMusic()
  },

  // ==================== 背景音乐主流程 ====================

  startBackgroundMusic: function () {
    this.configureInnerAudio()

    if (!wx.createInnerAudioContext) {
      console.warn('[BGM] wx.createInnerAudioContext 不可用')
      return
    }

    if (!BACKGROUND_MUSIC_FILE_ID) {
      console.warn('[BGM] BACKGROUND_MUSIC_FILE_ID 未配置')
      return
    }

    this.ensureBackgroundMusicContext()

    // 检查临时链接是否过期
    if (
      this._backgroundMusicReady &&
      this._backgroundMusicResolvedAt &&
      Date.now() - this._backgroundMusicResolvedAt > BACKGROUND_MUSIC_TEMP_URL_TTL
    ) {
      console.log('[BGM] 临时链接已过期，重新获取')
      this._backgroundMusicReady = false
      this._backgroundMusic.src = ''
    }

    // 尚未获取临时链接，先去获取
    if (!this._backgroundMusicReady) {
      this.resolveBackgroundMusicTempUrl()
      return
    }

    // 已有链接，尝试播放
    this.playBackgroundMusic()
  },

  // ==================== 音频上下文 ====================

  ensureBackgroundMusicContext: function () {
    if (this._backgroundMusic) return

    const audio = wx.createInnerAudioContext()
    audio.loop = true
    audio.volume = 0.24
    audio.obeyMuteSwitch = false

    audio.onCanplay(() => {
      console.log('[BGM] 音频可播放:', audio.src)
    })

    audio.onPlay(() => {
      this._backgroundMusicPlaying = true
      this._backgroundMusicWaitingForGesture = false
      console.log('[BGM] 播放开始')
    })

    audio.onPause(() => {
      this._backgroundMusicPlaying = false
      console.log('[BGM] 播放暂停')
    })

    audio.onStop(() => {
      this._backgroundMusicPlaying = false
      console.log('[BGM] 播放停止')
    })

    audio.onError((err) => {
      // 播放错误不丢弃已解析的 URL——autoplay 被拦截也会触发 error，
      // URL 本身仍然有效，等用户手势后再试即可。
      // 链接过期由 TTL 检查处理。
      console.warn('[BGM] 播放出错（可能被 autoplay 拦截）:', err && err.errMsg)
      this._backgroundMusicResolving = false
      this._backgroundMusicWaitingForGesture = true
    })

    this._backgroundMusic = audio
    console.log('[BGM] 音频上下文已创建')
  },

  // ==================== 获取云存储临时链接 ====================

  resolveBackgroundMusicTempUrl: function () {
    if (!this._cloudReady) {
      console.warn('[BGM] 云开发未就绪，延迟获取临时链接')
      return
    }

    if (!wx.cloud || !wx.cloud.callFunction) {
      console.warn('[BGM] wx.cloud.callFunction 不可用')
      return
    }

    if (this._backgroundMusicResolving) {
      console.log('[BGM] 正在获取临时链接，跳过重复请求')
      return
    }

    console.log('[BGM] 调用云函数获取临时链接:', BGM_URL_FUNCTION_NAME)
    this._backgroundMusicResolving = true

    wx.cloud.callFunction({
      name: BGM_URL_FUNCTION_NAME,
      success: (res) => {
        this._backgroundMusicResolving = false
        const result = res && res.result

        if (!result || !result.ok || !result.tempFileURL) {
          this._backgroundMusicReady = false
          console.warn('[BGM] 临时链接无效:', result)
          return
        }

        this._backgroundMusicReady = true
        this._backgroundMusicResolvedAt = Date.now()
        this._backgroundMusic.src = result.tempFileURL
        console.log('[BGM] 临时链接获取成功:', result.tempFileURL)

        // 如果已有用户手势，立即尝试播放
        if (this._backgroundMusicUserGesture) {
          this.playBackgroundMusic()
        }
      },
      fail: (err) => {
        this._backgroundMusicResolving = false
        this._backgroundMusicReady = false
        console.warn('[BGM] 云函数调用失败:', err)
      }
    })
  },

  // ==================== 播放 / 暂停 ====================

  playBackgroundMusic: function () {
    if (!this._backgroundMusic) {
      console.warn('[BGM] 音频上下文不存在，无法播放')
      return
    }

    if (!this._backgroundMusic.src) {
      console.warn('[BGM] 音频 src 为空，无法播放')
      return
    }

    try {
      this._backgroundMusic.play()
      this._backgroundMusicPlayRequested = true
      console.log('[BGM] 已发起播放请求')
    } catch (err) {
      this._backgroundMusicWaitingForGesture = true
      console.warn('[BGM] 播放请求被拒绝，等待用户手势:', err)
    }
  },

  pauseBackgroundMusic: function () {
    if (!this._backgroundMusic) return

    try {
      this._backgroundMusic.pause()
      console.log('[BGM] 已暂停')
    } catch (err) {
      console.warn('[BGM] 暂停失败:', err)
    }
  }
})
