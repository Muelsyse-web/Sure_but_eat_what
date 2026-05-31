# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"WeChat Mini Program" (微信小程序) — a "What should I eat today?" spinning-wheel picker. Single-page app that fetches nearby restaurants through a WeChat Cloud Base proxy, caches results locally, and picks one randomly with a slot-machine animation or Canvas 2D spinning wheel.

## Development workflow

There is no CLI build/lint/test toolchain. All development happens inside **WeChat DevTools** (微信开发者工具):
1. Open the project root in WeChat DevTools.
2. The simulator runs the mini program locally.
3. Cloud functions must be **deployed separately**: right-click `cloudfunctions/fetchRestaurants` → "Upload & Deploy" (云端安装依赖). They do not run from the local simulator unless you have the cloud SDK emulator configured.
4. The cloud environment ID is hardcoded in `app.js:8` — change it if the environment changes.

## Architecture

### Data flow

```
User opens app
  → wx.getFuzzyLocation (gcj02)
  → check utils/cache.js (Haversine, 200m threshold)
  → cache miss? call cloud function fetchRestaurants
    → cloud function calls AMap nearby POI search for restaurant recall
    → Baidu Place search enriches missing average cost
    → Tencent Map search is a fallback only
    → filters by cuisine/cost/rating/distance on server side
    → returns trimmed restaurant list
  → cache hit? use cached data
  → apply blacklist filter (utils/restaurantBlacklist.js)
  → buildWheelSegments / buildSlotPreview (max 8 for wheel, >8 for slot)
  → user taps "让天意决定"
  → Canvas 2D easeOutCubic animation (3.5s, 5+ rotations) or CSS slot-machine scroll (4s)
  → modal card with rating/cost/distance + "就吃这家" (wx.openLocation)
```

### Key files

| File | Role |
|------|------|
| `app.js` | Cloud Base init, app lifecycle, background music |
| `app.json` | Page registration, cloud flag, fuzzy location permission, `requiredPrivateInfos` |
| `project.config.json` | WeChat DevTools project config, `cloudfunctionRoot` directory |
| `pages/index/index.js` | All page logic — data fetching, wheel/slot animation, filters, manual candidates, saved wheels, modal |
| `pages/index/index.wxml` | Page template — Canvas, slot machine, buttons, bottom sheet, modal card, overlays |
| `pages/index/index.wxss` | All styles (dark gradient theme, orange accent `#ff4400`) |
| `pages/restaurants/list.js` | Restaurant list sub-page with blacklist toggle |
| `pages/restaurants/list.wxml` | Restaurant card list with blacklist badge |
| `pages/restaurants/list.wxss` | List page styles (dark theme) |
| `utils/cache.js` | `wx.Storage`-backed cache with Haversine distance gating (200m, max 50 items, versioned) |
| `utils/manualWheels.js` | Saved manual wheel CRUD (max 30 saved wheels) |
| `utils/restaurantBlacklist.js` | Restaurant blacklist storage, key-based dedup, filter utility |
| `cloudfunctions/fetchRestaurants/index.js` | Cloud function orchestrator — AMap primary, Baidu cost enrichment, Tencent fallback |
| `cloudfunctions/fetchRestaurants/providers/amap.js` | AMap around-search provider (type=050000 dining) |
| `cloudfunctions/fetchRestaurants/providers/baidu.js` | Baidu Place search for avg_cost enrichment (batched, max 12) |
| `cloudfunctions/fetchRestaurants/providers/tencent.js` | Tencent Map fallback provider |
| `cloudfunctions/fetchRestaurants/normalizers.js` | Normalizes provider records, filters non-restaurants, dedupes results |
| `cloudfunctions/fetchRestaurants/geo.js` | Haversine and GCJ-02/BD-09 coordinate helpers |
| `cloudfunctions/fetchRestaurants/http.js` | JSON GET helper for provider calls |
| `cloudfunctions/fetchRestaurants/package.json` | Cloud function dependencies (`wx-server-sdk ~2.6.3`) |

### Cache behavior

- Cache is used **only when no filters are active** (cost, cuisine, or distance). Any filter bypasses the cache and calls the cloud function.
- Cache stores lat/lng + up to 50 restaurant items. On next load, checks whether the user has moved >200m from the cached location.
- Cache includes a data version (`CACHE_VERSION` in `utils/cache.js`). Provider pipeline upgrades should bump this so stale provider data is ignored.
- `resetFilters()` triggers a full reload (clears nearby data), which will hit the cache on next fetch (since filters are now `null`/`'不限'`).

### Pickers

- **Manual mode** (`appMode === 'manual'`): User adds restaurant names. ≤8 candidates → Canvas 2D spinning wheel. >8 candidates → slot-machine (CSS scroll animation).
- **Nearby mode** (`appMode === 'nearby'`): Fetches from cloud function, always uses slot-machine picker.
- Manual candidates can be saved as named wheels (max 30) and reloaded later.

### Canvas 2D wheel (manual mode, ≤8 items)

- Canvas node, 2D context, and DPR are lazily cached via `_ensureManualCanvas()` — not re-queried per frame.
- `_drawWheel(rotation)` redraws the full wheel at the given angle. 8 color segments with truncated name.
- `_animateManualWheel(targetIndex, callback)` uses `setTimeout` with easeOutCubic over 3.5 seconds.

### Slot machine (nearby + manual >8 items)

- 3 visible rows in a window, middle row highlighted as the result.
- `buildSlotPreview(restaurants, centerIndex)` builds static 3-item preview.
- `onSpin()` builds a random sequence (28–48 items + target + next), then CSS `transition: transform 4s cubic-bezier(0.12, 0.76, 0.18, 1)` scrolls to the target.

### Cloud function details

- Provider keys live only in cloud function environment variables (by design — not exposed to client): `AMAP_MAP_KEY`, `BAIDU_MAP_AK`, and optional `TENCENT_MAP_KEY`.
- AMap is the primary restaurant recall provider using restaurant POI types (typecode `050000`).
- Baidu is used only to enrich missing average cost (and rating), with capped batched requests (max 12 restaurants, 3 per batch, 2.5s timeout each) to avoid slow cloud function runs.
- Tencent is fallback only when AMap returns fewer than 4 usable restaurants.
- `matchCuisine()` has a hardcoded keyword map for 10 cuisine types.
- Provider response status is checked before data extraction (`result.status !== '1'` for AMap, `!== 0` for Baidu/Tencent).
- Items with missing `avg_cost` are excluded when cost filters are active (unless `include_uncosted` is toggled on).
- Items with missing rating are excluded when rating filters are active (unless `include_unrated` is toggled on).

## Gotchas

- **WeChat privacy compliance**: use fuzzy location for nearby restaurant search. `app.json` must declare `requiredPrivateInfos: ["getFuzzyLocation"]` and `permission.scope.userFuzzyLocation`. Do not switch back to `wx.getLocation` unless the app has passed the stricter precise-location interface audit.
- **Cloud function deployment**: Changes to `cloudfunctions/fetchRestaurants/` must be manually re-deployed in WeChat DevTools. The local simulator calls the deployed version, not the local file.
- **Provider key setup**: Configure `AMAP_MAP_KEY` before testing nearby search. Add `BAIDU_MAP_AK` for better human average cost coverage. Keep `TENCENT_MAP_KEY` only as fallback.
- **Null checks**: Use `== null` (not `!value`) for coordinate/field validation — latitude 0 is a valid value.
- **`catchtap` vs `bindtap`**: Modal and bottom sheet panels use `catchtap=""` on the inner container to prevent tap events from bubbling to the overlay's close handler. The overlay itself uses `bindtap` on the outer container with an ID check in the handler.
- **WeChat button `::after` borders**: All `<button>` elements get a default `::after` pseudo-border from WeChat's base styles. Every button in `index.wxss` needs `::after { border: none }` to remove it.
- **`project.private.config.json`**: Contains personal DevTools settings (appid, etc.) and is gitignored — don't rely on it for project-level config.
