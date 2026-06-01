const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const indexJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const listJs = fs.readFileSync(path.join(root, 'pages/restaurants/list.js'), 'utf8')

assert(
  /const AUDIO_VOLUMES = \{[\s\S]*tap:\s*1(?:\.0)?[\s\S]*nameReveal:\s*1(?:\.0)?[\s\S]*suicide:\s*0\.2[\s\S]*\}/.test(indexJs),
  'home page should set requested local cue volumes, capping louder clips at WeChat max volume'
)

assert(
  /audio\.volume\s*=\s*this\.getAudioVolume\(cue\)/.test(indexJs) &&
    /const audio = this\._audioContexts\[cue\][\s\S]*audio\.volume\s*=\s*this\.getAudioVolume\(cue\)/.test(indexJs),
  'home page should apply configured volume when creating and replaying audio contexts'
)

assert(
  /const AUDIO_VOLUMES = \{[\s\S]*tap:\s*1(?:\.0)?[\s\S]*getOut:\s*1(?:\.0)?[\s\S]*luanshi:\s*1(?:\.0)?[\s\S]*\}/.test(listJs),
  'restaurant list should set requested blacklist cue volumes, capped at WeChat max volume'
)

assert(
  /audio\.volume\s*=\s*this\.getAudioVolume\(key\)/.test(listJs) &&
    /const audio = this\._audioContexts\[key\][\s\S]*audio\.volume\s*=\s*this\.getAudioVolume\(key\)/.test(listJs),
  'restaurant list should apply configured volume when creating and replaying audio contexts'
)
