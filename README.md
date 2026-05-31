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

- Small interaction effects in `assets/audio` can be packaged locally when the total package remains comfortably below the WeChat limit.
- Large background music stays on CloudBase; `bgm-guanyu.mp3` should remain ignored from the local code package.
- Unused collected clips should also stay ignored in `project.config.json` until a page actually references them.
- Interaction polish such as tap sounds or `hover-class` press states must preserve the resting UI from `main`; compare styles before committing behavior-only work.
