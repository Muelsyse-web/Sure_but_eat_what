const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const js = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const wxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const wxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')

assert(/AUDIO_CLIPS/.test(js), 'page should define audio clip slots')
assert(/manual:\s*null/.test(js), 'missing manual audio cue should be disabled until a cloud audio file is configured')
assert(/nearby:\s*null/.test(js), 'missing nearby audio cue should be disabled until a cloud audio file is configured')
assert(/result:\s*null/.test(js), 'missing result audio cue should be disabled until a cloud audio file is configured')
assert(/playAudioCue/.test(js), 'page should expose a guarded audio playback helper')
assert(/easterEggText:\s*''/.test(js), 'page should track short easter egg copy')
assert(/showResultSeal:\s*false/.test(js), 'page should track result seal animation state')

assert(/BACKGROUND_MUSIC_FILE_ID\s*=\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/bgm-guanyu\.mp3'/.test(appJs), 'app should point at the CloudBase Guan Yu background music')
assert(/wx\.cloud\.getTempFileURL/.test(appJs), 'app should resolve CloudBase background music before playback')
assert(/startBackgroundMusic/.test(appJs) && /loop\s*=\s*true/.test(appJs), 'app should start looping background music')
assert(/onHide[\s\S]*pauseBackgroundMusic/.test(appJs), 'app should pause background music when hidden')

assert(/easter-egg/.test(wxml), 'WXML should render the short easter egg copy')
assert(/result-seal/.test(wxml), 'WXML should render the result seal')
assert(/接着奏乐/.test(js) && /天意开机/.test(js), 'copy should include restrained meme references')

assert(/\.easter-egg/.test(wxss), 'WXSS should style easter egg copy')
assert(/@keyframes sealDrop/.test(wxss), 'WXSS should animate the result seal')
