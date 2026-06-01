const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const listJs = fs.readFileSync(path.join(root, 'pages/restaurants/list.js'), 'utf8')
const listWxml = fs.readFileSync(path.join(root, 'pages/restaurants/list.wxml'), 'utf8')
const bgmFunctionJsPath = path.join(root, 'cloudfunctions/getBgmUrl/index.js')
const bgmFunctionPackagePath = path.join(root, 'cloudfunctions/getBgmUrl/package.json')
const bgmFunctionJs = fs.existsSync(bgmFunctionJsPath) ? fs.readFileSync(bgmFunctionJsPath, 'utf8') : ''
const bgmFunctionPackage = fs.existsSync(bgmFunctionPackagePath) ? fs.readFileSync(bgmFunctionPackagePath, 'utf8') : ''

assert(
  /BACKGROUND_MUSIC_FILE_ID\s*=\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/bgm-guanyu\.mp3'/.test(appJs),
  'background music should use the uploaded CloudBase file ID'
)

assert(
  /BGM_URL_FUNCTION_NAME\s*=\s*'getBgmUrl'/.test(appJs) &&
    /wx\.cloud\.callFunction\(\{[\s\S]*name:\s*BGM_URL_FUNCTION_NAME/.test(appJs),
  'background music should ask a cloud function for the temp URL because client storage reads can exceed authority'
)

assert(
  /wx\.setInnerAudioOption\(\{[\s\S]*mixWithOther:\s*true[\s\S]*obeyMuteSwitch:\s*false[\s\S]*\}\)/.test(appJs),
  'background music should configure global inner audio to mix and ignore the mute switch'
)

assert(
  /resolveBackgroundMusicTempUrl/.test(appJs) &&
    /wx\.cloud\.callFunction/.test(appJs) &&
    /fail:\s*\(err\)\s*=>\s*{[\s\S]*this\._backgroundMusicResolving\s*=\s*false/.test(appJs) &&
    /if\s*\(!result\s*\|\|\s*!result\.ok\s*\|\|\s*!result\.tempFileURL\)/.test(appJs) &&
    /this\._backgroundMusicReady\s*=\s*true[\s\S]*this\._backgroundMusic\.src\s*=\s*result\.tempFileURL/.test(appJs),
  'background music should resolve a service-side temp URL before playback'
)

assert(
  /const BGM_FILE_ID\s*=\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/bgm-guanyu\.mp3'/.test(bgmFunctionJs) &&
    /cloud\.getTempFileURL\(\{[\s\S]*fileList:\s*\[BGM_FILE_ID\]/.test(bgmFunctionJs) &&
    /wx-server-sdk/.test(bgmFunctionPackage),
  'getBgmUrl cloud function should return a temp URL for the fixed BGM file ID'
)

assert(
  /_backgroundMusic[\s\S]*obeyMuteSwitch\s*=\s*false/.test(appJs),
  'background music should not be silenced by the hardware mute switch'
)

assert(
  /notifyUserGesture:\s*function\s*\(\)\s*{[\s\S]*this\._backgroundMusicUserGesture\s*=\s*true[\s\S]*this\.startBackgroundMusic\(\)/.test(appJs),
  'background music should retry after the first user gesture when autoplay is blocked'
)

assert(
  /notifyUserGesture:\s*function\s*\(\)\s*{[\s\S]*this\._backgroundMusicUserGesture\s*=\s*true[\s\S]*this\.startBackgroundMusic\(\)/.test(appJs) &&
    /startBackgroundMusic:\s*function\s*\(\)\s*{[\s\S]*this\.ensureBackgroundMusicContext\(\)[\s\S]*if\s*\(!this\._backgroundMusicReady/.test(appJs),
  'user-gesture retry should request or replay the service-side BGM URL'
)

assert(
  /playBackgroundMusic:\s*function\s*\(\)\s*{[\s\S]*this\._backgroundMusic\.play\(\)/.test(appJs) &&
    !/onError\(\(err\)\s*=>\s*{[\s\S]{0,220}this\._backgroundMusicReady\s*=\s*false/.test(appJs),
  'BGM play errors should not discard the resolved CloudBase URL needed for a gesture retry'
)

assert(
  /bindtap="onPageTap"/.test(pageWxml) &&
    /onPageTap\(\)\s*{[\s\S]*this\.notifyAppUserGesture\(\)/.test(pageJs) &&
    /bindtap="onPageTap"/.test(listWxml) &&
    /onPageTap\(\)\s*{[\s\S]*this\.notifyAppUserGesture\(\)/.test(listJs),
  'page roots should notify the app on ordinary taps so BGM can start even without a sound-effect button'
)

assert(
  /notifyAppUserGesture/.test(pageJs) &&
    /getApp\(\)/.test(pageJs) &&
    /app\.notifyUserGesture\(\)/.test(pageJs) &&
    /playAudioCue\(cue\)\s*{[\s\S]*this\.notifyAppUserGesture\(\)/.test(pageJs),
  'page audio cues should notify the app about user gestures so BGM can start'
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
  /wheelSpin:\s*null/.test(pageJs) &&
    /AUDIO_CLIPS\.wheelSpin\s*=\s*assets\.wheelSpin\.tempFileURL/.test(pageJs) &&
    /slotSpin:\s*'\/assets\/audio\/slot-spin\.mp3'/.test(pageJs) &&
    /tap:\s*'\/assets\/audio\/tap\.mp3'/.test(pageJs),
  'small interaction sound effects should stay local while oversized wheel audio resolves from CloudBase'
)
