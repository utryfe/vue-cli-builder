const sockjs = require('sockjs')

const connection = require('./connection')
const proxyServer = require('./proxyServer')

const debug = require('debug')('mock:socket:proxySockJSServer')

function checkConnection(conn, co) {
  const readyState = conn.readyState
  const valid = readyState === 1
  if (!valid) {
    co.close()
    return false
  }
  return true
}

function matchPath(prefix, url) {
  const matcher = new RegExp(prefix, 'g').exec(url)
  if (matcher) {
    return matcher[1]
  }
  return url
}

//
function createHandler(options) {
  const { proxyContext, proxyMockContext } = options
  const prefix = `(?:${proxyContext}/?(?:${proxyMockContext.join('|')}))`
  //
  const server = sockjs.createServer({
    disable_cors: false,
    log: (severity, line) => {
      if (severity === 'error') {
        debug(line)
      }
    },
  })
  const prefixMatcher = prefix.replace(/\(\?:/g, '(')
  server.on('connection', (conn) => {
    if (!conn) {
      return
    }
    const { pathname } = conn
    const path = matchPath(prefixMatcher, pathname)
    debug('got connection from %s', path)
    const co = connection(
      (onData, onClose) => {
        conn.on('data', onData)
        conn.once('close', onClose)
      },
      () => {
        conn.close()
      },
      path,
      '',
      'sockjs'
    )
    // send mock data to client.
    co.on('mock', (data) => {
      if (checkConnection(conn, co)) {
        try {
          data = JSON.stringify(data)
        } catch (e) {
          debug('stringify error. %s', e.message)
          data = ''
        }
        if (data) {
          conn.write(data)
          debug('sending data to client. [%s][%s]', co.token, co.url)
        }
      }
    })
    //
    proxyServer.emit('connection', co)
  })

  return server.middleware({
    prefix,
  })
}

let handler = null

//
module.exports = (options) => {
  if (!handler) {
    handler = createHandler(options)
  }
  //
  return (req, res, head, next) => {
    if (!handler(req, res, head)) {
      next()
    }
  }
}
