const https = require('https')
const querystring = require('querystring')

function getJson(url, params, timeout = 10000) {
  const query = querystring.stringify(params)
  const target = `${url}?${query}`

  return new Promise((resolve, reject) => {
    const req = https.get(target, { timeout }, (res) => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (err) {
          reject(new Error(`响应解析失败: ${err.message}`))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
  })
}

module.exports = { getJson }
