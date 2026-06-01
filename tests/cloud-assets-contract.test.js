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

assert(
  ignored.some(item => item.type === 'file' && item.value === 'assets/audio/wheel-spin.mp3') &&
    ignored.some(item => item.type === 'file' && item.value === 'assets/images/reward-code.png'),
  'package config should ignore oversized wheel audio and reward code because they resolve from CloudBase'
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
    !/rewardCodeSrc:\s*'\/assets\/images\/reward-code\.png'/.test(pageJs),
  'oversized wheel audio and reward image should not be hardcoded to local package paths'
)

assert(
  /assets\.wheelSpin\.tempFileURL/.test(pageJs) &&
    /AUDIO_CLIPS\.wheelSpin\s*=\s*assets\.wheelSpin\.tempFileURL/.test(pageJs) &&
    /assets\.rewardCode\.tempFileURL/.test(pageJs) &&
    /rewardCodeSrc:\s*assets\.rewardCode\.tempFileURL/.test(pageJs),
  'index page should install resolved CloudBase URLs into the wheel audio cue and reward image state'
)

assert(
  /wx:if="\{\{rewardCodeSrc && !rewardCodeLoadFailed\}\}"/.test(pageWxml) &&
    /if\s*\(this\.data\.rewardCodeLoadFailed\s*\|\|\s*!this\.data\.rewardCodeSrc\)\s*return/.test(pageJs),
  'reward image should render and preview only after a CloudBase URL has resolved'
)

assert(
  /const ASSET_FILE_IDS\s*=\s*\{[\s\S]*wheelSpin:\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/wheel-spin\.mp3'[\s\S]*rewardCode:\s*'cloud:\/\/cloud1-d7g8vh3395ea46f9d\.636c-cloud1-d7g8vh3395ea46f9d-1432599903\/reward-code\.png'/.test(assetFunctionJs) &&
    /cloud\.getTempFileURL\(\{[\s\S]*fileList:\s*Object\.values\(ASSET_FILE_IDS\)/.test(assetFunctionJs) &&
    /wx-server-sdk/.test(assetFunctionPackage),
  'getAssetUrls cloud function should resolve the uploaded wheel audio and reward code file IDs'
)

assert(
  /assets:\s*resolvedAssets/.test(assetFunctionJs) &&
    /ok:\s*false/.test(assetFunctionJs),
  'getAssetUrls should return a keyed assets map and report failures without throwing to the page'
)

assert(
  !/把图片放到 assets\/images\/reward-code\.png 即可开坛/.test(pageWxml),
  'reward-code fallback copy should not tell users to package the ignored local image'
)
