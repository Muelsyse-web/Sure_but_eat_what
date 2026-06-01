const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')
const listWxml = fs.readFileSync(path.join(root, 'pages/restaurants/list.wxml'), 'utf8')
const listWxss = fs.readFileSync(path.join(root, 'pages/restaurants/list.wxss'), 'utf8')

const ignored = projectConfig.packOptions.ignore || []

assert(
  !ignored.some(item => item.type === 'folder' && item.value === 'assets/audio'),
  'package config should not ignore the whole assets/audio folder because small effects ship locally'
)

assert(
  ignored.some(item => item.type === 'file' && item.value === 'assets/audio/bgm-guanyu.mp3'),
  'package config should ignore the large local background music file'
)

assert(
  !ignored.some(item => item.type === 'file' && item.value === 'assets/audio/DontWantTable.mp3') &&
    !ignored.some(item => item.type === 'file' && item.value === 'assets/audio/GetOut.mp3') &&
    !ignored.some(item => item.type === 'file' && item.value === 'assets/audio/Luanshi.mp3') &&
    !ignored.some(item => item.type === 'file' && item.value === 'assets/audio/Suicide.mp3') &&
    ignored.some(item => item.type === 'file' && item.value === 'assets/images/陈留大食堂封面.jpg'),
  'referenced local audio should be packaged while the unused large image stays ignored'
)

assert(
  /wheelSpin:\s*null/.test(pageJs) &&
    /AUDIO_CLIPS\.wheelSpin\s*=\s*assets\.wheelSpin\.tempFileURL/.test(pageJs) &&
    /slotSpin:\s*'\/assets\/audio\/slot-spin\.mp3'/.test(pageJs) &&
    /tap:\s*'\/assets\/audio\/tap\.mp3'/.test(pageJs),
  'page should load oversized wheel audio from CloudBase while keeping small slot and tap effects local'
)

assert(
  /MANUAL_WHEEL_SPIN_DURATION\s*=\s*8300/.test(pageJs) &&
    /SLOT_SPIN_DURATION\s*=\s*4460/.test(pageJs) &&
    /SLOT_RESULT_REVEAL_DELAY\s*=\s*4560/.test(pageJs),
  'spin animation constants should match the local audio clip durations'
)

assert(
  /\.slot-reel\.animating\s*{[\s\S]*transition:\s*transform 4\.46s/.test(pageWxss),
  'slot reel transition should match the trimmed slot-spin audio duration'
)

assert(
  /playSpinCue/.test(pageJs) &&
    /manualPickerType === 'wheel'[\s\S]*playAudioCue\('wheelSpin'\)/.test(pageJs) &&
    /playAudioCue\('slotSpin'\)/.test(pageJs),
  'spin should play wheel audio for wheel mode and slot audio for slot mode'
)

assert(
  /playTapCue/.test(pageJs) &&
    /onChooseManual\(\)\s*{[\s\S]*this\.playTapCue\(\)/.test(pageJs) &&
    /onOpenFilter\(\)\s*{[\s\S]*this\.playTapCue\(\)/.test(pageJs) &&
    !/onSpin\(\)\s*{[\s\S]{0,220}this\.playTapCue\(\)/.test(pageJs),
  'non-spin actions should play tap audio while spin actions avoid tap overlap'
)

assert(
  /hover-class="button-press"/.test(pageWxml) &&
    /hover-class="button-press-subtle"/.test(pageWxml) &&
    /hover-class="button-press"/.test(listWxml),
  'main pages should opt buttons and button-like controls into press feedback'
)

assert(
  /\.button-press\s*{[\s\S]*filter:\s*brightness\(0\.86\)[\s\S]*transform:\s*translateY\(2px\) scale\(0\.98\)/.test(pageWxss) &&
    /\.button-press-subtle\s*{[\s\S]*filter:\s*brightness\(0\.9\)[\s\S]*transform:\s*translateY\(1px\) scale\(0\.99\)/.test(pageWxss) &&
    /\.button-press\s*{[\s\S]*filter:\s*brightness\(0\.86\)/.test(listWxss),
  'WXSS should define darker pressed states for primary and subtle buttons'
)
