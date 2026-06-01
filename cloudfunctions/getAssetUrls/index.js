const cloud = require('wx-server-sdk')

const ASSET_FILE_IDS = {
  wheelSpin: 'cloud://cloud1-d7g8vh3395ea46f9d.636c-cloud1-d7g8vh3395ea46f9d-1432599903/wheel-spin.mp3',
  rewardCode: 'cloud://cloud1-d7g8vh3395ea46f9d.636c-cloud1-d7g8vh3395ea46f9d-1432599903/reward-code.png'
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async () => {
  try {
    const res = await cloud.getTempFileURL({
      fileList: Object.values(ASSET_FILE_IDS)
    })
    const files = res.fileList || []
    const resolvedAssets = {}
    const failedAssets = {}

    Object.keys(ASSET_FILE_IDS).forEach((key, index) => {
      const file = files[index]

      if (!file || file.status !== 0 || !file.tempFileURL) {
        failedAssets[key] = {
          fileID: ASSET_FILE_IDS[key],
          status: file && file.status,
          errMsg: file && file.errMsg
        }
        return
      }

      resolvedAssets[key] = {
        fileID: ASSET_FILE_IDS[key],
        tempFileURL: file.tempFileURL
      }
    })

    return {
      ok: Object.keys(failedAssets).length === 0,
      assets: resolvedAssets,
      failedAssets,
      maxAge: 3600
    }
  } catch (err) {
    return {
      ok: false,
      assets: {},
      failedAssets: Object.keys(ASSET_FILE_IDS).reduce((acc, key) => {
        acc[key] = {
          fileID: ASSET_FILE_IDS[key],
          errMsg: err && err.message ? err.message : String(err)
        }
        return acc
      }, {})
    }
  }
}
