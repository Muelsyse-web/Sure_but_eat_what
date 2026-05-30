const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const wxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const js = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')

assert(
  /class="filter-overlay[^"]*"\s+bindtap="onFilterOverlayTap"/.test(wxml),
  'filter overlay should route taps through a guarded handler, not close directly'
)

assert(
  /id="filterOverlay"/.test(wxml),
  'filter overlay needs a stable id so the guarded handler can detect backdrop taps'
)

assert(
  /class="filter-panel[^"]*"\s+catchtap="noop"/.test(wxml),
  'filter panel should explicitly catch inner taps with a real no-op handler'
)

assert(
  /onFilterOverlayTap\(e\)\s*{[\s\S]*target\.id[\s\S]*currentTarget\.id[\s\S]*onCloseFilter\(\)/.test(js),
  'onFilterOverlayTap should close only when the original tap target is the overlay itself'
)

assert(
  /noop\(\)\s*{[\s\S]*}/.test(js),
  'noop handler should exist for catchtap bindings'
)
