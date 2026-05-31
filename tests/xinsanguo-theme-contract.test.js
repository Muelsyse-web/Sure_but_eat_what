const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
const wxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const wxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')

assert(/陈留大食堂/.test(wxml), 'header should carry the Chenliu banquet theme')
assert(/是啊，吃什么？/.test(wxml), 'home screen should lead with the New Three Kingdoms eating meme')
assert(/我有饭局名单/.test(wxml), 'manual entry should use meal-list copy')
assert(/附近有什么？/.test(wxml), 'nearby entry should keep the eating indecision framing')
assert(/让天意决定/.test(wxml), 'spin button should package randomness as fate')
assert(/弹幕抽菜机/.test(wxml), 'picker should include a barrage-style meme framing')
assert(/说出吾名，吓汝一跳/.test(wxml), 'result card should use a New Three Kingdoms reveal gag')
assert(/接着抽/.test(wxml), 'spin-again button should keep the music-and-reroll gag concise')

assert(/BACKGROUND_MUSIC_FILE_ID/.test(appJs), 'app should define a CloudBase background music source')
assert(/bgm-guanyu\.mp3/.test(appJs), 'app should use the Guan Yu song copy as background music')

assert(/ambient-barrage/.test(wxss), 'page should include a lightweight barrage backdrop layer')
assert(/#120f13/.test(wxss) && /#8fd1cb/.test(wxss), 'theme should include the dark meme-stage palette with teal accent')
assert(/choice-button/.test(wxss) && /letter-spacing:\s*0/.test(wxss), 'themed buttons should keep stable letter spacing')
assert(
  /\.secondary-choice\s*{[\s\S]*background:\s*linear-gradient\(135deg,\s*#267c7a,\s*#4fb3a8\)/.test(wxss),
  'nearby entry button should use the brighter teal gradient'
)
assert(
  !/\.secondary-choice\s*{[\s\S]*background:\s*rgba\(20,\s*32,\s*36,\s*0\.78\)/.test(wxss),
  'nearby entry button should not keep the old dark background'
)
