const WebSocket = require('ws')
const debug = require('debug')('mock:socket:proxyWebSocketServer')

const proxyServer = require('./proxyServer')
const connection = require('./connection')
//
const helper = require('../helper')

function incoming(conn, req) {
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
    if (typeof data !== 'string') {
      try {
        data = JSON.stringify(data)
      } catch (e) {
        data = ''
        debug('error occurred while stringify data. %s', e.message)
      }
    }
    if (data) {
      conn.send(data)
      debug('sending data to client. [%s][%s]', co.token, co.url)
    }
  })
  proxyServer.emit('connection', co)
}

function createHandler(options, callback) {
  const { proxyContext } = options
  const server = new WebSocket.Server({ noServer: true })
  //
  server.on('connection', (conn, req) => {
    if (!conn) {
      return
    }
    if (proxyContext) {
      req.url = req.url.replace(new RegExp(`^${proxyContext}`), '')
    }
    if (typeof callback === 'function') {
      debug('incoming connection. %s', req.url)
      callback(conn, req, server)
    } else {
      incoming(conn, req)
    }
  })

  //
  return (req, res, head) => {
    server.handleUpgrade(req, res, head, (ws) => {
      server.emit('connection', ws, req, server)
    })
  }
}

function middleware(options, callback) {
  const { proxyContext } = options
  const handler = createHandler(options, callback)
  //
  return (req, res, head, next) => {
    if (req.url.match(`^${proxyContext}/`) && helper.isWebSocketHandshake(req)) {
      return handler(req, res, head)
    }
    next()
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

//
module.exports.createHandler = createHandler
module.exports.middleware = middleware
