const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageJs = fs.readFileSync(path.join(root, 'pages/index/index.js'), 'utf8')
const pageWxml = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8')
const pageWxss = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8')
const audioReadme = fs.readFileSync(path.join(root, 'assets/audio/README.md'), 'utf8')

function getMethodBody(source, methodName) {
  const methodPattern = new RegExp(`\\n\\s{2}${methodName}\\(`)
  const match = source.match(methodPattern)
  const start = match ? match.index + 1 : source.indexOf(`${methodName}(`)
  assert(start >= 0, `${methodName} should exist`)

  const braceStart = source.indexOf('{', start)
  assert(braceStart >= 0, `${methodName} should have a body`)

  let depth = 0
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') depth--
    if (depth === 0) {
      return source.slice(braceStart + 1, i)
    }
  }

  throw new Error(`${methodName} body was not closed`)
}

function getRuleBody(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escapedSelector}\\s*{([\\s\\S]*?)}`))
  assert(match, `${selector} styles should exist`)
  return match[1]
}

function getMarginBottom(ruleBody) {
  const match = ruleBody.match(/margin-bottom:\s*(\d+)px/)
  return match ? Number(match[1]) : null
}

const applyFilterBody = getMethodBody(pageJs, 'onApplyFilter')
const closeFilterBody = getMethodBody(pageJs, 'onCloseFilter')
const fetchIntentBody = getMethodBody(pageJs, 'onFetchNearbyIntent')
const fetchRestaurantDataBody = getMethodBody(pageJs, 'fetchRestaurantData')
const chooseNearbyBody = getMethodBody(pageJs, 'onChooseNearby')
const spinBody = getMethodBody(pageJs, 'onSpin')
const spinAgainBody = getMethodBody(pageJs, 'onSpinAgain')
const showResultModalBody = getMethodBody(pageJs, 'showResultModal')

assert(
  /tianyi:\s*'\/assets\/audio\/Tianyi\.mp3'/.test(pageJs) &&
    /noTianyi:\s*'\/assets\/audio\/NoTianyi\.mp3'/.test(pageJs),
  'filter decision audio cues should map Tianyi and NoTianyi local clips'
)

assert(
  !/playTapCue\(\)/.test(applyFilterBody) &&
    /playAudioCue\('tianyi'\)/.test(applyFilterBody),
  'applying filters should play Tianyi without the generic tap cue'
)

assert(
  !/playTapCue\(\)/.test(closeFilterBody) &&
    /playAudioCue\('noTianyi'\)/.test(closeFilterBody),
  'closing filters from the cancel action should play NoTianyi without the generic tap cue'
)

assert(
  /FETCH_NEARBY_COOLDOWN_MS\s*=\s*60\s*\*\s*1000/.test(pageJs) &&
    /lastFetchNearbyIntentAt:\s*0/.test(pageJs) &&
    /getFetchCooldownRemainingMs\(now\)/.test(pageJs) &&
    /this\.getFetchCooldownRemainingMs\(now\)/.test(fetchIntentBody) &&
    /this\.setData\(\{[\s\S]*lastFetchNearbyIntentAt:\s*now[\s\S]*\}\)/.test(fetchIntentBody) &&
    /loadRestaurants\(\)/.test(fetchIntentBody),
  'fetch nearby intent should enforce a one-minute button-level cooldown before loading'
)

assert(
  /nearbySnapshotRestaurants:\s*\[\]/.test(pageJs) &&
    /nearbySnapshotHasFetched:\s*false/.test(pageJs) &&
    /nearbySnapshotRestaurants:\s*cachedItems/.test(fetchRestaurantDataBody) &&
    /nearbySnapshotRestaurants:\s*restaurants/.test(fetchRestaurantDataBody) &&
    /nearbySnapshotHasFetched:\s*true/.test(fetchRestaurantDataBody),
  'nearby fetch results should be saved as the reusable nearby snapshot'
)

assert(
  /const snapshotRestaurants = this\.data\.nearbySnapshotRestaurants/.test(chooseNearbyBody) &&
    /const hasNearbySnapshot = this\.data\.nearbySnapshotHasFetched/.test(chooseNearbyBody) &&
    /nearbyHasFetched:\s*hasNearbySnapshot/.test(chooseNearbyBody) &&
    /this\.syncNearbyCandidates\(snapshotRestaurants\)/.test(chooseNearbyBody),
  're-entering nearby mode should restore the previous fetched restaurant snapshot during cooldown'
)

assert(
  /interactionLocked:\s*false/.test(pageJs) &&
    /retryingDance:\s*false/.test(pageJs) &&
    /setInteractionLocked\(locked\)/.test(pageJs) &&
    /isInteractionLocked\(\)/.test(pageJs),
  'page should expose centralized interaction lock state and helpers'
)

assert(
  /this\.setInteractionLocked\(true\)/.test(spinBody) &&
    /this\.setInteractionLocked\(false\)/.test(showResultModalBody) &&
    /retryingDance:\s*true/.test(spinAgainBody) &&
    /DONT_WANT_TABLE_DELAY/.test(spinAgainBody),
  'spin and dance retry flows should lock controls until the result is shown or retry starts'
)

assert(
  /wx:if="\{\{appMode !== 'choice' && !interactionLocked\}\}".*bindtap="onBackToChoice"/.test(pageWxml) &&
    /wx:if="\{\{appMode === 'nearby' && !interactionLocked\}\}".*filter-icon/.test(pageWxml) &&
    /wx:if="\{\{appMode === 'nearby' && filterLabels\.length > 0 && !interactionLocked\}\}"/.test(pageWxml) &&
    /wx:if="\{\{appMode === 'manual' && !interactionLocked\}\}".*manual-wheel-actions/.test(pageWxml) &&
    /wx:if="\{\{appMode !== 'choice' && !interactionLocked\}\}".*spin-button-area/.test(pageWxml),
  'current-page interactive controls should be hidden while interactionLocked is true'
)

assert(
  !/slot-topline/.test(pageWxml) &&
    !/弹幕抽菜机|天意抽奖机|天意自由发挥/.test(pageWxml),
  'slot machine header copy should be removed'
)

const spinButtonIndex = pageWxml.indexOf('bindtap="onSpin"')
const nearbyFetchIndex = pageWxml.indexOf('bindtap="onFetchNearbyIntent"')
const nearbyListIndex = pageWxml.indexOf('bindtap="onOpenRestaurantList"')
const manualActionsIndex = pageWxml.indexOf('class="manual-wheel-actions"')
const savedWheelsIndex = pageWxml.indexOf('bindtap="onOpenSavedWheels"')
const manageCandidatesIndex = pageWxml.indexOf('bindtap="onOpenManageCandidates"')

assert(
  spinButtonIndex >= 0 &&
    nearbyFetchIndex > spinButtonIndex &&
    nearbyListIndex > nearbyFetchIndex,
  'nearby actions should render spin, then fetch, then list'
)

assert(
  manualActionsIndex >= 0 &&
    savedWheelsIndex > spinButtonIndex &&
    manageCandidatesIndex > savedWheelsIndex,
  'manual actions should render spin, then saved wheels, then manage candidates'
)

assert.strictEqual(
  getMarginBottom(getRuleBody(pageWxss, '.spin-button')),
  getMarginBottom(getRuleBody(pageWxss, '.fetch-nearby-button')),
  'nearby spin and fetch buttons should have the same edge spacing as fetch and list buttons'
)

assert(
  /Tianyi\.mp3/.test(audioReadme) &&
    /NoTianyi\.mp3/.test(audioReadme),
  'audio README should document the filter decision cues'
)
