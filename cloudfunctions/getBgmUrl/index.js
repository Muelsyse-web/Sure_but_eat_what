const cloud = require('wx-server-sdk')

const BGM_FILE_ID = 'cloud://cloud1-d7g8vh3395ea46f9d.636c-cloud1-d7g8vh3395ea46f9d-1432599903/bgm-guanyu.mp3'

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async () => {
  try {
    const res = await cloud.getTempFileURL({
      fileList: [BGM_FILE_ID]
    })
    const file = res.fileList && res.fileList[0]

    if (!file || file.status !== 0 || !file.tempFileURL) {
      return {
        ok: false,
        fileID: BGM_FILE_ID,
        status: file && file.status,
        errMsg: file && file.errMsg
      }
    }

    return {
      ok: true,
      fileID: BGM_FILE_ID,
      tempFileURL: file.tempFileURL,
      maxAge: 3600
    }
  } catch (err) {
    return {
      ok: false,
      fileID: BGM_FILE_ID,
      errMsg: err && err.message ? err.message : String(err)
    }
  }
}
