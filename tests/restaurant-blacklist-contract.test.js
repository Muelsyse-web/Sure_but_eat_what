const assert = require('assert')
const path = require('path')

const storage = {}
global.wx = {
  getStorageSync(key) {
    return storage[key]
  },
  setStorageSync(key, value) {
    storage[key] = value
  },
  removeStorageSync(key) {
    delete storage[key]
  }
}

const blacklist = require(path.resolve(__dirname, '../utils/restaurantBlacklist.js'))

const restaurant = {
  id: 'amap:B001',
  title: '阿强川菜',
  address: '文三路 1 号',
  category: '餐饮服务;中餐厅;四川菜(川菜)',
  location: { lat: 30.2741, lng: 120.1551 },
  distance: 238,
  avg_cost: 62,
  biz_ext: {
    rating: '4.8',
    cost: '62'
  }
}

const added = blacklist.toggleRestaurantBlacklist(restaurant)
assert.strictEqual(added.blacklisted, true)
assert.strictEqual(blacklist.isRestaurantBlacklisted(restaurant), true)

const saved = blacklist.getRestaurantBlacklist()
assert.strictEqual(saved.length, 1)
assert.strictEqual(saved[0].title, '阿强川菜')
assert.strictEqual(saved[0].category, restaurant.category)
assert.strictEqual(saved[0].address, restaurant.address)
assert.strictEqual(saved[0].rating, undefined, 'blacklist summaries should not save rating')
assert.strictEqual(saved[0].biz_ext, undefined, 'blacklist summaries should not save biz_ext')
assert.strictEqual(saved[0].avg_cost, undefined, 'blacklist summaries should not save avg_cost')

const filtered = blacklist.applyRestaurantBlacklist([
  restaurant,
  { id: 'amap:B002', title: '小王面馆', location: { lat: 30.2742, lng: 120.1552 } }
])
assert.deepStrictEqual(filtered.map(item => item.title), ['小王面馆'])

const removed = blacklist.toggleRestaurantBlacklist(restaurant)
assert.strictEqual(removed.blacklisted, false)
assert.strictEqual(blacklist.isRestaurantBlacklisted(restaurant), false)
