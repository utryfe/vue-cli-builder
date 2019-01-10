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

//
function createHandler(options) {
  const { proxyContext, mockContext } = options
  const prefix = `(?:${proxyContext}/(?:${mockContext
    .map((ctx) => ctx.replace(/(\(\?:\/\|\$\))$/, '$1?'))
    .join('|')}))`
  //
  const server = sockjs.createServer({
    log: (severity, line) => {
      if (severity === 'error') {
        debug(line)
      }
    },
  })

  server.on('connection', (conn) => {
    if (!conn) {
      return
    }
    const { url } = conn
    debug('got connection from %s', url)
    const co = connection(
      (onData, onClose) => {
        conn.on('data', onData)
        conn.once('close', onClose)
      },
      () => {
        conn.close()
      },
      url,
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
          debug('sending data to client. [%s]', url)
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
