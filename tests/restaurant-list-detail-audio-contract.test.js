const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const listJs = fs.readFileSync(path.join(root, 'pages/restaurants/list.js'), 'utf8')
const audioReadme = fs.readFileSync(path.join(root, 'assets/audio/README.md'), 'utf8')

const ignored = projectConfig.packOptions.ignore || []

assert(
  /DETAIL_AUDIO_SRC\s*=\s*'\/assets\/audio\/OnceSayMyNameITMXIASINI\.mp3'/.test(listJs),
  'restaurant list page should reference the say-my-name detail audio'
)

assert(
  /onLoad\(\)\s*{[\s\S]*this\.playDetailCue\(\)[\s\S]*this\.refreshRestaurants\(\)/.test(listJs),
  'restaurant list page should play the detail cue once when the page first loads'
)

assert(
  /onShow\(\)\s*{(?![\s\S]*this\.playDetailCue\(\))[\s\S]*this\.refreshRestaurants\(\)[\s\S]*}/.test(listJs),
  'restaurant list page should not replay the detail cue on every onShow refresh'
)

assert(
  /playDetailCue/.test(listJs) &&
    /_detailAudio/.test(listJs) &&
    /audio\.loop\s*=\s*false/.test(listJs) &&
    /audio\.obeyMuteSwitch\s*=\s*false/.test(listJs),
  'detail cue playback should be guarded, one-shot, and audible'
)

assert(
  !ignored.some(item => item.type === 'file' && item.value === 'assets/audio/OnceSayMyNameITMXIASINI.mp3'),
  'used detail audio should not be ignored from the local mini program package'
)

assert(
  /OnceSayMyNameITMXIASINI\.mp3/.test(audioReadme),
  'audio README should document the detail-page cue'
)
