const BACKGROUND_MUSIC_FILE_ID = 'cloud://cloud1-d7g8vh3395ea46f9d.636c-cloud1-d7g8vh3395ea46f9d-1432599903/bgm-guanyu.mp3'

App({
  onLaunch: function () {
    // 初始化微信云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d7g8vh3395ea46f9d', // TODO: 替换为你的云环境 ID
        traceUser: true
      })
    }

    this.startBackgroundMusic()
  },

  onShow: function () {
    this.startBackgroundMusic()
  },

  onHide: function () {
    this.pauseBackgroundMusic()
  },

  startBackgroundMusic: function () {
    if (!wx.createInnerAudioContext || !wx.cloud || !wx.cloud.getTempFileURL || !BACKGROUND_MUSIC_FILE_ID) return

    if (!this._backgroundMusic) {
      const audio = wx.createInnerAudioContext()
      audio.loop = true
      audio.volume = 0.24
      audio.obeyMuteSwitch = false
      audio.onError((err) => {
        console.warn('背景音乐播放错误:', err)
        this._backgroundMusicReady = false
        this._backgroundMusicResolving = false
      })
      this._backgroundMusic = audio
    }

    if (!this._backgroundMusicReady) {
      if (this._backgroundMusicResolving) return
      this._backgroundMusicResolving = true
      wx.cloud.getTempFileURL({
        fileList: [BACKGROUND_MUSIC_FILE_ID],
        success: (res) => {
          const file = res.fileList && res.fileList[0]
          this._backgroundMusicResolving = false
          if (!file || file.status !== 0 || !file.tempFileURL) {
            this._backgroundMusicReady = false
            console.warn('背景音乐临时链接无效:', file)
            return
          }
          this._backgroundMusicReady = true
          this._backgroundMusic.src = file.tempFileURL
          this.startBackgroundMusic()
        },
        fail: (err) => {
          this._backgroundMusicResolving = false
          this._backgroundMusicReady = false
          console.warn('背景音乐临时链接获取失败:', err)
        }
      })
      return
    }

    if (!this._backgroundMusic.src) return

    try {
      this._backgroundMusic.play()
    } catch (err) {
      console.warn('背景音乐播放失败:', err)
    }
  },

  pauseBackgroundMusic: function () {
    if (!this._backgroundMusic) return

    try {
      this._backgroundMusic.pause()
    } catch (err) {
      console.warn('背景音乐暂停失败:', err)
    }
  }
})
