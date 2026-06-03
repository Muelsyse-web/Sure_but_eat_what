const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const assetFunctionJsPath = path.join(root, 'cloudfunctions/getAssetUrls/index.js')
const assetFunctionPackagePath = path.join(root, 'cloudfunctions/getAssetUrls/package.json')
const assetFunctionJs = fs.existsSync(assetFunctionJsPath) ? fs.readFileSync(assetFunctionJsPath, 'utf8') : ''
const assetFunctionPackage = fs.existsSync(assetFunctionPackagePath) ? fs.readFileSync(assetFunctionPackagePath, 'utf8') : ''
const ignored = projectConfig.packOptions.ignore || []
const removedImagePath = ['assets/images', 're' + 'ward-code.png'].join('/')
const removedAssetTerms = [
  '赏' + '些' + '银' + '两',
  '赞' + '赏' + '码',
  're' + 'wardCode',
  're' + 'ward-code',
  're' + 'wardCodeSrc',
  're' + 'wardCodeLoadFailed'
]

assert(
  ignored.some(item => item.type === 'file' && item.value === 'assets/audio/wheel-spin.mp3') &&
    !ignored.some(item => item.type === 'file' && item.value === removedImagePath),
  'package config should ignore oversized wheel audio without retaining the removed funding image'
)

assert(
  /ASSET_URL_FUNCTION_NAME\s*=\s*'getAssetUrls'/.test(pageJs) &&
    /resolveCloudAssetUrls/.test(pageJs) &&
    /wx\.cloud\.callFunction\(\{[\s\S]*name:\s*ASSET_URL_FUNCTION_NAME/.test(pageJs),
  'index page should ask getAssetUrls for CloudBase temp URLs'
)

assert(
  /wheelSpin:\s*null/.test(pageJs) &&
    !/wheelSpin:\s*'\/assets\/audio\/wheel-spin\.mp3'/.test(pageJs) &&
    !pageJs.includes('re' + 'wardCodeSrc') &&
    !pageJs.includes(removedImagePath),
  'oversized wheel audio and removed funding image should not be hardcoded to local package paths'
)

assert(
  /assets\.wheelSpin\.tempFileURL/.test(pageJs) &&
    /AUDIO_CLIPS\.wheelSpin\s*=\s*assets\.wheelSpin\.tempFileURL/.test(pageJs) &&
    removedAssetTerms.every(term => !pageJs.includes(term)),
  'index page should install resolved CloudBase URLs into the wheel audio cue only'
)

assert(
  /const ASSET_FILE_IDS\s*=\s*\{[\s\S]*wheelSpin:\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/wheel-spin\.mp3'/.test(assetFunctionJs) &&
    removedAssetTerms.every(term => !assetFunctionJs.includes(term)) &&
    /cloud\.getTempFileURL\(\{[\s\S]*fileList:\s*Object\.values\(ASSET_FILE_IDS\)/.test(assetFunctionJs) &&
    /wx-server-sdk/.test(assetFunctionPackage),
  'getAssetUrls cloud function should resolve only the uploaded wheel audio file ID'
)

assert(
  /assets:\s*resolvedAssets/.test(assetFunctionJs) &&
    /ok:\s*false/.test(assetFunctionJs),
  'getAssetUrls should return a keyed assets map and report failures without throwing to the page'
)

assert(
  removedAssetTerms.every(term => !(pageJs + pageWxml + assetFunctionJs).includes(term)),
  'removed funding UI, state, and CloudBase asset references should stay absent'
)
