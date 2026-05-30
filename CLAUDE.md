# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"WeChat Mini Program" (微信小程序) — a "What should I eat today?" spinning-wheel picker. Single-page app that fetches nearby restaurants via Tencent Map API through a WeChat Cloud Base proxy, caches results locally, and picks one randomly with a Canvas 2D spinning-wheel animation.

## Development workflow

There is no CLI build/lint/test toolchain. All development happens inside **WeChat DevTools** (微信开发者工具):
1. Open the project root in WeChat DevTools.
2. The simulator runs the mini program locally.
3. Cloud functions must be **deployed separately**: right-click `cloudfunctions/fetchRestaurants` → "Upload & Deploy" (云端安装依赖). They do not run from the local simulator unless you have the cloud SDK emulator configured.
4. The cloud environment ID is hardcoded in `app.js:5` — change it if the environment changes.

## Architecture

### Data flow

```
User opens app
  → wx.getLocation (gcj02)
  → check utils/cache.js (Haversine, 200m threshold)
  → cache miss? call cloud function fetchRestaurants
    → cloud function hits Tencent Map API /ws/place/v1/search (key hidden from client)
    → filters by cuisine/cost on server side
    → returns trimmed restaurant list
  → cache hit? use cached data
  → buildWheelSegments (max 8 items)
  → user taps "开始旋转"
  → Canvas 2D easeOutCubic animation (4s, 5+ rotations)
  → modal card with rating/cost/distance + "导航去这里" (wx.openLocation)
```

### Key files

| File | Role |
|------|------|
| `app.js` | Cloud Base init, app lifecycle |
| `app.json` | Page registration, cloud flag, location permission, `requiredPrivateInfos` |
| `project.config.json` | WeChat DevTools project config, `cloudfunctionRoot` directory |
| `pages/index/index.js` | All page logic — data fetching, wheel drawing/animation, filters, modal |
| `pages/index/index.wxml` | Page template — Canvas, buttons, bottom sheet, modal card |
| `pages/index/index.wxss` | All styles (dark gradient theme, orange accent `#ff4400`) |
| `utils/cache.js` | `wx.Storage`-backed cache with Haversine distance gating (200m, max 50 items) |
| `cloudfunctions/fetchRestaurants/index.js` | Cloud function — proxies Tencent Map API, server-side cuisine/cost filtering |
| `cloudfunctions/fetchRestaurants/package.json` | Cloud function dependencies (`wx-server-sdk ~2.6.3`) |

### Cache behavior

- Cache is used **only when no filters are active** (cost or cuisine). Any filter bypasses the cache and calls the cloud function.
- Cache stores lat/lng + up to 50 restaurant items. On next load, checks whether the user has moved >200m from the cached location.
- `resetFilters()` triggers `loadRestaurants()`, which will hit the cache (since filters are now `null`/`'不限'`).

### Canvas 2D wheel

- Canvas node, 2D context, and DPR are cached once in `onReady()` — not re-queried per frame.
- `_drawWheel(rotation)` redraws the full wheel at the given angle. 8 color segments with emoji + truncated name.
- `_animateWheel(targetIndex, callback)` uses `canvasNode.requestAnimationFrame` with easeOutCubic over 4 seconds.

### Cloud function details

- API key `TENCENT_MAP_KEY` lives only in the cloud function (by design — not exposed to client).
- `matchCuisine()` has a hardcoded keyword map for 10 cuisine types.
- API response status is checked **before** data extraction (`result.status !== 0` → error).
- Items with missing `biz_ext.cost` are excluded when cost filters are active.

## Gotchas

- **WeChat privacy compliance**: `app.json` must declare `requiredPrivateInfos: ["getLocation"]` and `permission.scope.userLocation`. Removing either will cause `wx.getLocation` to fail silently.
- **Cloud function deployment**: Changes to `cloudfunctions/fetchRestaurants/` must be manually re-deployed in WeChat DevTools. The local simulator calls the deployed version, not the local file.
- **Null checks**: Use `== null` (not `!value`) for coordinate/field validation — latitude 0 is a valid value.
- **`catchtap` vs `bindtap`**: Modal and bottom sheet panels use `catchtap=""` on the inner container to prevent tap events from bubbling to the overlay's close handler.
- **WeChat button `::after` borders**: All `<button>` elements get a default `::after` pseudo-border from WeChat's base styles. Every button in `index.wxss` needs `::after { border: none }` to remove it.
- **`project.private.config.json`**: Contains personal DevTools settings (appid, etc.) and is gitignored — don't rely on it for project-level config.
