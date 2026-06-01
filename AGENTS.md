# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project overview

"WeChat Mini Program" (微信小程序) — a "What should I eat today?" spinning-wheel picker. Single-page app that fetches nearby restaurants through a WeChat Cloud Base proxy, caches results locally, and picks one randomly with a slot-machine animation.

## Development workflow

There is no CLI build/lint/test toolchain. All development happens inside **WeChat DevTools** (微信开发者工具):
1. Open the project root in WeChat DevTools.
2. The simulator runs the mini program locally.
3. Cloud functions must be **deployed separately**: right-click `cloudfunctions/fetchRestaurants` and `cloudfunctions/getBgmUrl` → "Upload & Deploy" (云端安装依赖). They do not run from the local simulator unless you have the cloud SDK emulator configured.
4. The cloud environment ID is hardcoded in `app.js:5` — change it if the environment changes.

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
    → filters by cuisine/cost on server side after enrichment
    → returns trimmed restaurant list
  → cache hit? use cached data
  → manual mode with <=8 items uses Canvas wheel; nearby and >8 manual items use slot list
  → user taps "让天意决定"
  → local spin sound plays (`wheel-spin.mp3` or `slot-spin.mp3`)
  → wheel/slot animation duration should match the active spin audio
  → modal card with rating/cost/distance + "就吃这家" (wx.openLocation)
```

### Key files

| File | Role |
|------|------|
| `app.js` | Cloud Base init, app lifecycle |
| `app.json` | Page registration, cloud flag, fuzzy location permission, `requiredPrivateInfos` |
| `project.config.json` | WeChat DevTools project config, `cloudfunctionRoot` directory |
| `pages/index/index.js` | All page logic — data fetching, wheel drawing/animation, filters, modal |
| `pages/index/index.wxml` | Page template — Canvas, buttons, bottom sheet, modal card |
| `pages/index/index.wxss` | All styles (dark gradient theme, orange accent `#ff4400`) |
| `assets/audio/README.md` | Audio slot notes, packaging expectations, and which clips are local vs CloudBase |
| `utils/cache.js` | `wx.Storage`-backed cache with Haversine distance gating (200m, max 50 items) |
| `cloudfunctions/fetchRestaurants/index.js` | Cloud function orchestrator — AMap primary, Baidu cost enrichment, Tencent fallback |
| `cloudfunctions/fetchRestaurants/providers/*.js` | Provider modules for AMap, Baidu, and Tencent |
| `cloudfunctions/fetchRestaurants/normalizers.js` | Normalizes provider records, filters non-restaurants, dedupes results |
| `cloudfunctions/fetchRestaurants/geo.js` | Haversine and GCJ-02/BD-09 coordinate helpers |
| `cloudfunctions/fetchRestaurants/http.js` | JSON GET helper for provider calls |
| `cloudfunctions/fetchRestaurants/package.json` | Cloud function dependencies (`wx-server-sdk ~2.6.3`) |
| `cloudfunctions/getBgmUrl/index.js` | Cloud function that resolves a temporary URL for the CloudBase Guan Yu BGM |

### Cache behavior

- Cache is used **only when no filters are active** (cost, cuisine, or distance). Any filter bypasses the cache and calls the cloud function.
- Cache stores lat/lng + up to 50 restaurant items. On next load, checks whether the user has moved >200m from the cached location.
- Cache includes a data version. Provider pipeline upgrades should bump `CACHE_VERSION` in `utils/cache.js` so stale provider data is ignored.
- `resetFilters()` triggers `loadRestaurants()`, which will hit the cache (since filters are now `null`/`'不限'`).

### Canvas 2D wheel

- Canvas node, 2D context, and DPR are cached once in `onReady()` — not re-queried per frame.
- `_drawWheel(rotation)` redraws the full wheel at the given angle. 8 color segments with emoji + truncated name.
- `_animateManualWheel(targetIndex, callback)` should stay aligned with `assets/audio/wheel-spin.mp3` duration.

### Audio and package size

- Small interaction effects may be packaged locally under `assets/audio/`.
- Large or unused clips must be excluded in `project.config.json` until the code actually references them. The WeChat single package limit is tight; do not include large background music in the code package.
- `bgm-guanyu.mp3` is intentionally loaded from CloudBase in `app.js`, not from the local `assets/audio` path.
- The client must not read the BGM storage file directly; `app.js` calls the deployed `getBgmUrl` cloud function because client-side `getTempFileURL` can fail with `STORAGE_EXCEED_AUTHORITY`.
- BGM startup can be blocked until a user gesture; page-level audio helpers should call `getApp().notifyUserGesture()` before playing local effects so `app.js` can retry the looping CloudBase BGM.
- If a new local audio file is added, update `assets/audio/README.md`, `project.config.json`, and a contract test so package-size behavior is explicit.
- Keep `wx.createInnerAudioContext` calls guarded; missing or unsupported audio should fail silently except for a console warning in caught playback errors.

### UI stability

- Do not change resting UI colors, gradients, typography, layout, or copy while adding behavior such as sound, hover states, or timers unless the user explicitly asks for a redesign.
- For style work, compare against `main` before finishing: `git diff main -- pages/index/index.wxss pages/index/index.wxml pages/restaurants/list.wxss pages/restaurants/list.wxml`.
- Press/hover feedback should be transient (`hover-class`) and must not alter the normal, unpressed appearance.
- If an existing contract test expects a style that disagrees with `main`, update the test to protect the current `main` UI instead of changing the UI to satisfy stale expectations.

### Cloud function details

- Provider keys live only in cloud function environment variables (by design — not exposed to client): `AMAP_MAP_KEY`, `BAIDU_MAP_AK`, and optional `TENCENT_MAP_KEY`.
- AMap is the primary restaurant recall provider using restaurant POI types.
- Baidu is used only to enrich missing average cost, with capped batched requests to avoid slow cloud function runs.
- Tencent is fallback only when AMap is unavailable or returns too few usable restaurants.
- `matchCuisine()` has a hardcoded keyword map for 10 cuisine types.
- Provider response status is checked before data extraction.
- Items with missing `avg_cost` are excluded when cost filters are active.

## Gotchas

- **WeChat privacy compliance**: use fuzzy location for nearby restaurant search. `app.json` must declare `requiredPrivateInfos: ["getFuzzyLocation"]` and `permission.scope.userFuzzyLocation`. Do not switch back to `wx.getLocation` unless the app has passed the stricter precise-location interface audit.
- **Cloud function deployment**: Changes to `cloudfunctions/fetchRestaurants/` must be manually re-deployed in WeChat DevTools. The local simulator calls the deployed version, not the local file.
- **Provider key setup**: Configure `AMAP_MAP_KEY` before testing nearby search. Add `BAIDU_MAP_AK` for better human average cost coverage. Keep `TENCENT_MAP_KEY` only as fallback.
- **Null checks**: Use `== null` (not `!value`) for coordinate/field validation — latitude 0 is a valid value.
- **`catchtap` vs `bindtap`**: Modal and bottom sheet panels use `catchtap=""` on the inner container to prevent tap events from bubbling to the overlay's close handler.
- **WeChat button `::after` borders**: All `<button>` elements get a default `::after` pseudo-border from WeChat's base styles. Every button in `index.wxss` needs `::after { border: none }` to remove it.
- **UI regression risk**: Button audio/press feedback should not restyle the app. Preserve the main branch palette unless a UI change is explicitly requested.
- **Audio packaging**: `project.config.json` ignores large/unused audio files individually. Do not re-ignore the whole `assets/audio` folder if local interaction effects are used.
- **`project.private.config.json`**: Contains personal DevTools settings (appid, etc.) and is gitignored — don't rely on it for project-level config.
