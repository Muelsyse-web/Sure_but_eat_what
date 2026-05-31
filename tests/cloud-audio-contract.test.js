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
  /_backgroundMusicResolving/.test(appJs) &&
    /fail:\s*\(err\)\s*=>\s*{[\s\S]*this\._backgroundMusicResolving\s*=\s*false/.test(appJs) &&
    /if\s*\(!file\s*\|\|\s*file\.status\s*!==\s*0\s*\|\|\s*!file\.tempFileURL\)/.test(appJs) &&
    /this\._backgroundMusicReady\s*=\s*true[\s\S]*this\._backgroundMusic\.src\s*=\s*file\.tempFileURL/.test(appJs),
  'background music should retry CloudBase URL resolution unless a usable temp URL has been resolved'
)

assert(
  /_backgroundMusic[\s\S]*obeyMuteSwitch\s*=\s*false/.test(appJs),
  'background music should not be silenced by the hardware mute switch'
)

assert(
  !/BACKGROUND_MUSIC_SRC\s*=\s*'\/assets\/audio\/bgm-guanyu\.mp3'/.test(appJs),
  'background music should not reference the ignored local audio path'
)

assert(
  /boot:\s*null/.test(pageJs) &&
    /manual:\s*null/.test(pageJs) &&
    /nearby:\s*null/.test(pageJs) &&
    /result:\s*null/.test(pageJs),
  'missing optional sound-effect files should stay disabled until configured'
)

assert(
  /wheelSpin:\s*'\/assets\/audio\/wheel-spin\.mp3'/.test(pageJs) &&
    /slotSpin:\s*'\/assets\/audio\/slot-spin\.mp3'/.test(pageJs) &&
    /tap:\s*'\/assets\/audio\/tap\.mp3'/.test(pageJs),
  'small interaction sound effects should be referenced from local assets/audio files'
)
