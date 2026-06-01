const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const indexJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const indexWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const listJs = fs.readFileSync(path.join(root, 'pages/restaurants/list.js'), 'utf8')

assert(
  /dontWantTable:\s*'\/assets\/audio\/DontWantTable\.mp3'/.test(indexJs) &&
    /suicide:\s*'\/assets\/audio\/Suicide\.mp3'/.test(indexJs),
  'home page should map dedicated retry and back-button audio clips'
)

assert(
  /DONT_WANT_TABLE_DELAY\s*=\s*4056/.test(indexJs) &&
    /onSpinAgain\(\)\s*{[\s\S]*this\.playAudioCue\('dontWantTable'\)[\s\S]*setTimeout\(\(\)\s*=>\s*{[\s\S]*that\.onSpin\(\)[\s\S]*},\s*DONT_WANT_TABLE_DELAY\)/.test(indexJs),
  'change-restaurant action should wait for DontWantTable before starting the next spin'
)

assert(
  /接着奏乐，接着舞/.test(indexWxml) && !/换一家/.test(indexWxml) && !/接着抽/.test(indexWxml),
  'result sheet retry button should use the requested dance-and-music copy'
)

assert(
  /onBackToChoice\(\)\s*{(?![\s\S]{0,160}this\.playTapCue\(\))[\s\S]{0,220}this\.playAudioCue\('suicide'\)/.test(indexJs),
  'back-to-choice should play Suicide instead of the generic tap cue'
)

assert(
  /GET_OUT_AUDIO_SRC\s*=\s*'\/assets\/audio\/GetOut\.mp3'/.test(listJs) &&
    /LUANSHI_AUDIO_SRC\s*=\s*'\/assets\/audio\/Luanshi\.mp3'/.test(listJs),
  'restaurant list should map blacklist add/remove audio clips'
)

assert(
  /onToggleBlacklist\(e\)\s*{(?![\s\S]{0,220}this\.playTapCue\(\))[\s\S]*const result = toggleRestaurantBlacklist\(restaurant\)[\s\S]*this\.playBlacklistCue\(result\.blacklisted\)/.test(listJs),
  'blacklist toggles should play the dedicated add/remove cue instead of generic tap'
)
