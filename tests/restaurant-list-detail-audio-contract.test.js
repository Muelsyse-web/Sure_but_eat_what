const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const indexJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const listJs = fs.readFileSync(path.join(root, 'pages/restaurants/list.js'), 'utf8')
const audioReadme = fs.readFileSync(path.join(root, 'assets/audio/README.md'), 'utf8')

const ignored = projectConfig.packOptions.ignore || []

assert(
  /nameReveal:\s*'\/assets\/audio\/OnceSayMyNameITMXIASINI\.mp3'/.test(indexJs),
  'home result sheet should reference the say-my-name result reveal audio'
)

assert(
  /showResultModal\(restaurant\)\s*{[\s\S]*this\.playAudioCue\('nameReveal'\)[\s\S]*showModal:\s*true/.test(indexJs),
  'home page should play the say-my-name cue from the result modal helper'
)

assert(
  /_animateManualWheel\(targetIndex,\s*\(\)\s*=>\s*{[\s\S]*this\.showResultModal\(targetRestaurant\)/.test(indexJs) &&
    /_slotFinishTimer\s*=\s*setTimeout\(\(\)\s*=>\s*{[\s\S]*this\.showResultModal\(targetRestaurant\)/.test(indexJs),
  'both wheel and slot result flows should show the modal through the reveal helper'
)

assert(
  !/DETAIL_AUDIO_SRC/.test(listJs) &&
    !/playDetailCue/.test(listJs) &&
    !/_detailAudio/.test(listJs) &&
    !/OnceSayMyNameITMXIASINI\.mp3/.test(listJs),
  'restaurant list page should not play the say-my-name cue on page load'
)

assert(
  !ignored.some(item => item.type === 'file' && item.value === 'assets/audio/OnceSayMyNameITMXIASINI.mp3'),
  'used detail audio should not be ignored from the local mini program package'
)

assert(
  /OnceSayMyNameITMXIASINI\.mp3[\s\S]*result/.test(audioReadme),
  'audio README should document the result reveal cue'
)
