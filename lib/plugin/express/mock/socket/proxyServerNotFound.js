const debug = require('debug')('mock:socket:proxyNotFound')

function setHeaders(req, headers) {
  headers = headers || {}
  //
  if (req.headers.origin) {
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers['Access-Control-Allow-Origin'] = req.headers.origin
  } else {
    headers['Access-Control-Allow-Origin'] = '*'
  }
  return headers
}

module.exports = () => (req, res) => {
  const headers = setHeaders(req, {
    'X-Proxy-Remote': req.headers.host,
  })
  if ('OPTIONS' === req.method) {
    const res = req.res
    headers['Access-Control-Allow-Headers'] = 'Content-Type'
    res.writeHead(200, headers)
  } else {
    debug('not found the resource. %s', req.url)
    const ua = req.headers['user-agent']
    if (ua && (~ua.indexOf(';MSIE') || ~ua.indexOf('Trident/'))) {
      headers['X-XSS-Protection'] = '0'
    }
    res.writeHead(404, headers)
  }
  res.end()
}
