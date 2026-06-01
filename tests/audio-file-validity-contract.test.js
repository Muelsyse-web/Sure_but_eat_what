const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const audioFiles = [
  'assets/audio/wheel-spin.mp3',
  'assets/audio/slot-spin.mp3',
  'assets/audio/tap.mp3',
  'assets/audio/OnceSayMyNameITMXIASINI.mp3',
  'assets/audio/DontWantTable.mp3',
  'assets/audio/Suicide.mp3',
  'assets/audio/GetOut.mp3',
  'assets/audio/Luanshi.mp3',
  'assets/audio/bgm-guanyu.mp3'
]

function looksLikeMp3(buffer) {
  const hasId3Header = buffer.slice(0, 3).toString('ascii') === 'ID3'
  const hasMpegFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0
  return hasId3Header || hasMpegFrameSync
}

audioFiles.forEach(file => {
  const fullPath = path.join(root, file)
  const stat = fs.statSync(fullPath)
  const buffer = fs.readFileSync(fullPath)

  assert(stat.size > 0, `${file} should be non-empty`)
  assert(looksLikeMp3(buffer), `${file} should have an MP3 header or frame sync`)
})
