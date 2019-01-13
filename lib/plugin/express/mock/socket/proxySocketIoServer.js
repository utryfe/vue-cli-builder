const EventEmitter = require('events').EventEmitter
const SocketServer = require('socket.io')

const connection = require('./connection')

const debug = require('debug')('mock:socket:proxySockIo')

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

function setChannel(channel, server, listen) {
  // root
  server.of('/', (socket) => {
    channel.forEach((event, index) => {
      listen(socket, event, index)
    })
  })
  // sub
  server
    .of((name, query, next) => {
      next(null, true)
    })
    .on('connect', (socket) => {
      channel.forEach((event, index) => {
        listen(socket, event, index)
      })
    })
}

//
function createHandler(options, callback) {
  const { proxyContext, config } = options
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

  //
  if (typeof callback === 'function') {
    // 外部使用
    setChannel(channel, server, (socket, channel, index) => {
      if (!index) {
        const request = socket.request
        let url = request.url
        if (proxyContext) {
          url = url.replace(new RegExp(`^${proxyContext}`), '')
        }
        request.url = url
        debug('incoming connection. %s', url)
        socket.on('error', () => {
          if (typeof socket.onerror === 'function') {
            socket.onerror({ type: 'error' })
          }
        })
        socket.once('disconnect', () => {
          if (typeof socket.onclose === 'function') {
            socket.onclose({ type: 'close' })
          }
        })
      }
      //
      socket.on(channel, (message) => {
        if (typeof socket.onmessage === 'function') {
          socket.onmessage({ data: message })
        }
      })

      if (index === channel.length - 1) {
        socket.send = (data) => {
          channel.forEach((event) => {
            socket.emit(event, data)
          })
        }
        //
        callback(socket, socket.request, server)
      }
    })
    //
  } else {
    //
    setChannel(channel, server, incoming)
  }

  //
  return (req, res, head) => {
    if (helper.isWebSocketHandshake(req)) {
      fakedServer.emit('upgrade', req, res, head)
    } else {
      fakedServer.emit('request', req, res)
    }
  }
}

function middleware(options, callback) {
  const { proxyContext } = options
  const handler = createHandler(options, callback)
  return (req, res, head, next) => {
    if (req.url.match(`^${proxyContext}/`)) {
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

module.exports.createHandler = createHandler
module.exports.middleware = middleware
