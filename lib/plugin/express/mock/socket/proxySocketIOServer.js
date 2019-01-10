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
    debug('sending data to client. [%s]', url)
  })
  //
  proxyServer.emit('connection', co)
}

//
function createHandler(options) {
  const { config } = options
  let { channel } = config
  if (!Array.isArray(channel)) {
    channel = [channel]
  }
  channel = Array.from(new Set(channel)).filter(
    (item) => !!item && typeof item === 'string'
  )
  if (!channel.length) {
    channel.push('message')
  }
  //
  const server = new SocketServer({
    serveClient: false,
  })
  //
  const fakedServer = new EventEmitter()
  server.listen(fakedServer, {})
  //
  server.of('/').on('connect', (socket) => {
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
