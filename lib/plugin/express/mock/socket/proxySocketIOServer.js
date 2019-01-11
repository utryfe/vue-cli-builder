const EventEmitter = require('events').EventEmitter
const SocketServer = require('socket.io')

const connection = require('./connection')

const debug = require('debug')('mock:socket:proxySockIOServer')

const proxyServer = require('./proxyServer')
const helper = require('../helper')

function incoming(socket, channel) {
  const url = socket.request.url
  const co = connection(
    (onData, onClose) => {
      socket.on(channel, onData)
      socket.once('disconnect', onClose)
    },
    () => {
      socket.disconnect(true)
    },
    url,
    channel,
    'socket.io'
  )
  //
  co.on('mock', (data) => {
    socket.emit(channel, data, (data) => {
      co.send(data)
    })
    debug('sending data to client. [%s][%s]', co.token, co.url)
  })
  //
  proxyServer.emit('connection', co)
}

//
function createHandler(options) {
  const { config, proxyContext } = options
  let { channel } = config
  if (!Array.isArray(channel)) {
    channel = [channel]
  }
  channel = Array.from(new Set(channel)).filter(
    (item) => !!item && typeof item === 'string'
  )
  if (!channel.includes('message')) {
    channel.push('message')
  }
  //
  const server = new SocketServer({
    serveClient: false,
    path: proxyContext,
  })
  //
  const fakedServer = new EventEmitter()
  server.listen(fakedServer, {})
  // root
  server.of('/', (socket) => {
    channel.forEach((event) => {
      incoming(socket, event)
    })
  })
  // sub
  server
    .of((name, query, next) => {
      next(null, true)
    })
    .on('connect', (socket) => {
      channel.forEach((event) => {
        incoming(socket, event)
      })
    })

  //
  return (req, res, head) => {
    if (helper.isWebSocketHandshake(req)) {
      fakedServer.emit('upgrade', req, res, head)
    } else {
      fakedServer.emit('request', req, res)
    }
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
    if (req.url.match(`^${proxyContext}/`)) {
      return handler(req, res, head)
    }
    next()
  }
}
