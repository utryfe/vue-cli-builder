const WebSocket = require('ws')
const debug = require('debug')('mock:socket:proxyWebSocketServer')

const proxyServer = require('./proxyServer')
const connection = require('./connection')
//
const helper = require('../helper')

function createHandler() {
  const server = new WebSocket.Server({ noServer: true })
  //
  server.on('connection', (conn, url) => {
    if (!conn) {
      return
    }
    debug('got connection from %s', url)
    const co = connection(
      (onData, onClose) => {
        conn.on('message', onData)
        conn.on('close', onClose)
      },
      () => {
        conn.close()
      },
      url
    )
    co.on('mock', (data) => {
      conn.send(data)
      debug('send data to client. [%s]', url)
    })
    proxyServer.emit('connection', co)
  })

  //
  return (req, res, head) => {
    server.handleUpgrade(req, res, head, (ws) => {
      server.emit('connection', ws, req.url)
      // 兼容sockjs的单独websocket请求
      ws.send('o')
    })
  }
}

//
module.exports = (options) => {
  const { proxyContext } = options
  //
  const handler = createHandler(options)
  //
  return (req, res, head, next) => {
    if (
      req.url.match(`^${proxyContext}/`) &&
      helper.isWebSocketHandshake(req)
    ) {
      return handler(req, res, head)
    }
    next()
  }
}
