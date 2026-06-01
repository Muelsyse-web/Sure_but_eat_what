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
assert(/天意尚未开坛/.test(wxml), 'picker should keep the fate-driven empty-state framing')
assert(/说出吾名，吓汝一跳/.test(wxml), 'result card should use a New Three Kingdoms reveal gag')
assert(/接着奏乐，接着舞/.test(wxml), 'spin-again button should use the requested dance-and-music copy')

assert(/BACKGROUND_MUSIC_FILE_ID/.test(appJs), 'app should define a CloudBase background music source')
assert(/bgm-guanyu\.mp3/.test(appJs), 'app should use the Guan Yu song copy as background music')

assert(
  !/ambient-barrage/.test(wxml + wxss) && !/ambient-line/.test(wxml + wxss),
  'home page should remove the small ambient background text'
)
assert(
  /\.page\s*{[\s\S]*background:\s*#f5efdf;/.test(wxss) &&
    !/\.page::before/.test(wxss) &&
    !/\.page::after/.test(wxss) &&
    !/url\(/.test(wxss) &&
    !/陈留大食堂封面/.test(wxml + wxss),
  'home page should use a plain warm solid background without image or gradient overlays'
)
assert(/#2c2416/.test(wxss) && /#a8864a/.test(wxss), 'theme should keep the main branch warm banquet palette')
assert(/choice-button/.test(wxss) && /letter-spacing:\s*0/.test(wxss), 'themed buttons should keep stable letter spacing')
assert(
  /\.secondary-choice\s*{[^}]*background:\s*linear-gradient\(135deg,\s*#8b6d3f,\s*#a8864a\)/.test(wxss),
  'nearby entry button should keep the main branch brown-gold gradient'
)
assert(
  !/\.secondary-choice\s*{[^}]*background:\s*rgba\(20,\s*32,\s*36,\s*0\.78\)/.test(wxss),
  'nearby entry button should not keep the old dark background'
)
