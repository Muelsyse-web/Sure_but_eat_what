# Sure_but_eat_what
是啊吃什么

## Restaurant Provider Keys

`cloudfunctions/fetchRestaurants` reads provider keys from cloud function environment variables:

- `AMAP_MAP_KEY`: AMap Web Service API key. Required for primary restaurant search.
- `BAIDU_MAP_AK`: Baidu Place API AK. Optional but recommended for average-cost enrichment.
- `TENCENT_MAP_KEY`: Tencent Map WebService key. Optional fallback.

After changing these values or editing cloud function files, redeploy in WeChat DevTools:

1. Right-click `cloudfunctions/fetchRestaurants`.
2. Choose "Upload & Deploy" / "云端安装依赖".
3. Run the mini program simulator and fetch nearby restaurants.
4. Check cloud logs for `providerSummary`.

## Manual Restaurant Data Verification

Use one dense commercial area and one residential area.

- Confirm the mini program calls `wx.getFuzzyLocation`, not `wx.getLocation`; precise location review is not needed for the current nearby restaurant picker.
- Fetch with no filters: results should mostly be restaurants, cafes, snack shops, bakeries, or fast food.
- Fetch with cost filter: restaurants without `avg_cost` should be excluded after Baidu enrichment has had a chance to run.
- Fetch with cuisine filter: category matching should still work through the normalized `category` field.
- Confirm result card still shows `¥xx/人` when `biz_ext.cost` is present.
- Confirm navigation still opens with the selected restaurant coordinates.

## Audio and UI Notes

- Small interaction effects in `assets/audio` can be packaged locally when each file stays comfortably below the WeChat 200K quality-check threshold.
- Large background music stays on CloudBase; `bgm-guanyu.mp3` should remain ignored from the local code package.
- Oversized page assets such as `wheel-spin.mp3` and `reward-code.png` stay on CloudBase and are resolved by `cloudfunctions/getAssetUrls`.
- Deploy `cloudfunctions/getBgmUrl` after BGM changes; the client asks this cloud function for a temporary BGM URL to avoid CloudBase storage authority failures.
- Deploy `cloudfunctions/getAssetUrls` after changing oversized page asset file IDs.
- Local sound-effect helpers should notify `getApp().notifyUserGesture()` so the CloudBase BGM can retry after the user's first tap.
- Unused collected clips should also stay ignored in `project.config.json` until a page actually references them.
- Interaction polish such as tap sounds or `hover-class` press states must preserve the resting UI from `main`; compare styles before committing behavior-only work.
