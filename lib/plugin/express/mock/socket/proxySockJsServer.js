const sockjs = require('sockjs')

const connection = require('./connection')
const proxyServer = require('./proxyServer')

const debug = require('debug')('mock:socket:proxySockJs')

function checkConnection(conn) {
  return conn.readyState === 1
}

function matchPath(prefix, proxyContext, conn) {
  let { url, pathname } = conn
  const matcher = new RegExp(prefix, 'g').exec(pathname)
  if (matcher) {
    pathname = matcher[2]
  }
  url = proxyContext ? url.replace(new RegExp(`^${proxyContext}`), '') : url
  return { url, pathname }
}

function incoming(conn) {
  const co = connection(
    (onData, onClose) => {
      conn.on('data', onData)
      conn.once('close', onClose)
    },
    () => {
      conn.close()
    },
    conn.pathname,
    '',
    'sockjs'
  )
  // send mock data to client.
  co.on('mock', (data) => {
    if (conn.send(data)) {
      debug('sending data to client. [%s][%s]', co.token, co.url)
    } else {
      co.close()
    }
  })
  //
  proxyServer.emit('connection', co)
}

function setListener(conn) {
  conn.on('data', (message) => {
    if (typeof conn.onmessage === 'function') {
      conn.onmessage({ data: message })
    }
  })
  conn.on('error', () => {
    if (typeof conn.onerror === 'function') {
      conn.onerror({ type: 'error' })
    }
  })
  conn.once('close', () => {
    if (typeof conn.onclose === 'function') {
      conn.onclose({ type: 'close' })
    }
  })
}

//
function createHandler(options, callback) {
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
    const { pathname, url } = matchPath(prefixMatcher, proxyContext, conn)
    //
    debug('got connection from %s', pathname)
    conn.pathname = pathname
    //
    conn.send = (data) => {
      if (!checkConnection(conn)) {
        debug('socket has been closed. %s', url)
        return false
      }
      if (typeof data !== 'string') {
        try {
          data = JSON.stringify(data)
        } catch (e) {
          debug('stringify error. %s', e.message)
          data = ''
        }
      }
      if (data) {
        conn.write(data)
      }
      return true
    }
    if (typeof callback === 'function') {
      debug('incoming connection. %s', url)
      setListener(conn)
      //
      callback(conn, { url: pathname, headers: conn.headers }, server)
      //
    } else {
      incoming(conn)
    }
  })

  return server.middleware({
    prefix,
  })
}

function middleware(options, callback) {
  const handler = createHandler(options, callback)
  return (req, res, head, next) => {
    if (!handler(req, res, head)) {
      next()
    }
  }
}

let handler = null

//
module.exports = (options) => {
  if (!handler) {
    handler = middleware(options)
  }
  //
  return handler
}

module.exports.createHandler = createHandler
module.exports.middleware = middleware
