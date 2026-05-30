const EARTH_RADIUS = 6371000
const PI = Math.PI
const X_PI = PI * 3000.0 / 180.0

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function haversineMeters(a, b) {
  if (!a || !b) return null
  const lat1 = toNumber(a.lat)
  const lng1 = toNumber(a.lng)
  const lat2 = toNumber(b.lat)
  const lng2 = toNumber(b.lng)
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null

  const dLat = (lat2 - lat1) * PI / 180
  const dLng = (lng2 - lng1) * PI / 180
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const c = s1 * s1 + Math.cos(lat1 * PI / 180) * Math.cos(lat2 * PI / 180) * s2 * s2
  return Math.round(2 * EARTH_RADIUS * Math.asin(Math.sqrt(c)))
}

function gcj02ToBd09(lat, lng) {
  const x = Number(lng)
  const y = Number(lat)
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * X_PI)
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * X_PI)
  return {
    lat: z * Math.sin(theta) + 0.006,
    lng: z * Math.cos(theta) + 0.0065
  }
}

module.exports = { haversineMeters, gcj02ToBd09, toNumber }
