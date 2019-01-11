const WebSocket = require('ws')
const debug = require('debug')('mock:socket:proxyWebSocketServer')

const proxyServer = require('./proxyServer')
const connection = require('./connection')
//
const helper = require('../helper')

function createHandler() {
  const server = new WebSocket.Server({ noServer: true })
  //
  server.on('connection', (conn, req) => {
    if (!conn) {
      return
    }
    const url = req.url
    debug('got connection from %s', url)
    const co = connection(
      (onData, onClose) => {
        conn.on('message', onData)
        conn.once('close', onClose)
      },
      () => {
        conn.close()
      },
      url,
      '',
      'websocket'
    )
    co.on('mock', (data) => {
      conn.send(data)
      debug('sending data to client. [%s][%s]', co.token, co.url)
    })
    proxyServer.emit('connection', co)
  })

  //
  return (req, res, head) => {
    server.handleUpgrade(req, res, head, (ws) => {
      server.emit('connection', ws, req)
    })
  }
}

let handler = null

//
module.exports = (options) => {
  const { proxyContext } = options

  if (!handler) {
    handler = createHandler(options)
  }
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
