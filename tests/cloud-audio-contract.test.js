const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')

assert(
  /BACKGROUND_MUSIC_FILE_ID\s*=\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/bgm-guanyu\.mp3'/.test(appJs),
  'background music should use the uploaded CloudBase file ID'
)

assert(
  /wx\.cloud\.getTempFileURL/.test(appJs),
  'background music should resolve the cloud file ID to a temporary URL before playback'
)

assert(
  !/BACKGROUND_MUSIC_SRC\s*=\s*'\/assets\/audio\/bgm-guanyu\.mp3'/.test(appJs),
  'background music should not reference the ignored local audio path'
)

assert(
  /boot:\s*null/.test(pageJs) &&
    /manual:\s*null/.test(pageJs) &&
    /nearby:\s*null/.test(pageJs) &&
    /spin:\s*null/.test(pageJs) &&
    /result:\s*null/.test(pageJs),
  'missing local sound-effect files should be disabled instead of referenced from assets/audio'
)
