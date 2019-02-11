const EventEmitter = require('events').EventEmitter

const urlUtils = require('url')
//
const SocketServer = require('socket.io')

const debug = require('debug')('mock:socket:mockServer')

//
const emitter = require('./emitter')
const helper = require('../helper')

class MockServer extends EventEmitter {
  //
  constructor(options) {
    super()
    this.options = Object.assign({}, options)
    this.channel = 'message'
    this.sockets = []
    this.server = this.createServer()
    //
    emitter.on('client-connect', (connection) => {
      this.incoming(connection)
    })
    emitter.on('reconnection', ({ socket, connections }) => {
      this.reconnection(socket, connections)
      debug('reconnected to mock client.')
    })
    //
    emitter.once('close-server', () => {
      debug('mock server closing.')
      for (const socket of this.sockets) {
        try {
          socket.disconnect(true)
        } catch (e) {
          debug('socket close error. %s', e.message)
        }
      }
      this.sockets.length = 0
    })
  }

  createServer() {
    const { context } = this.options
    const server = new SocketServer({
      serveClient: false,
      path: context,
    })
    //
    const fakedServer = new EventEmitter()
    this.fakedServer = fakedServer
    server.listen(fakedServer, {})

    // root
    server.of('/', (socket) => {
      this.listen(socket)
      debug('listening root mock client. [%s]', socket.nsp.name)
    })
    // sub
    server
      .of((name, query, next) => {
        next(null, true)
      })
      .on('connect', (socket) => {
        this.listen(socket)
        debug('listening sub mock client. [%s]', socket.nsp.name)
      })
    return server
  }

  getUrlPathName(url, channel) {
    const { proxyContext } = this.options
    const originalUrl = proxyContext
      ? url.replace(new RegExp(`^${proxyContext}`), '')
      : url
    //
    const path =
      originalUrl && originalUrl !== '/'
        ? urlUtils.parse(originalUrl).pathname
        : '/'
    //
    return `${path}${channel ? `#${channel}` : ''}`
  }

  send(message, sock) {
    debug('sending message to mock client. [%s][%s]', message.type, message.path)
    const channel = this.channel
    for (const socket of this.sockets) {
      try {
        if (sock) {
          if (sock === socket) {
            socket.emit(channel, message)
            break
          }
        } else {
          socket.emit(channel, message)
        }
      } catch (e) {
        debug('send message to mock client error. %s', e.message)
      }
    }
  }

  reconnection(socket, connections) {
    for (const conn of connections) {
      const { token, url, channel, client, timestamp, messages } = conn
      this.send(
        {
          type: 'connection',
          path: this.getUrlPathName(url, channel),
          token,
          channel,
          client,
          timestamp,
          messages,
        },
        socket
      )
    }
  }

  incoming(connection) {
    const { token, url, channel, client, timestamp } = connection
    const path = this.getUrlPathName(url, channel)
    debug('client connected. [%s][%s]', path, token)
    //
    this.send({
      type: 'connection',
      path,
      token,
      channel,
      client,
      timestamp,
    })
    //
    connection.on('data', (data) => {
      this.send({
        type: 'data',
        path,
        token,
        data,
        channel,
        client,
        timestamp,
        dataTimestamp: Date.now(),
      })
    })
    // 特定客户端的消息
    connection.on('message', (message) => {
      message = Object.assign({}, message)
      const { socket } = message
      delete message.socket
      this.send(
        Object.assign(message, {
          path,
          token,
          channel,
          client,
          timestamp,
          dataTimestamp: Date.now(),
        }),
        socket
      )
    })
    //
    connection.once('close', () => {
      this.send({
        type: 'disconnect',
        path,
        token,
        channel,
        client,
        timestamp,
        closeTimestamp: Date.now(),
      })
    })
  }

  listen(socket) {
    this.sockets.push(socket)
    // the channel is 'message'
    socket.on(this.channel, (message) => {
      debug('receive message from mock client.')
      const { token, data, type } = Object.assign({}, message)
      if (type === 'data') {
        emitter.emit('mock-data', { token, data })
      } else if (type === 'disconnect') {
        emitter.emit('close-connection', token)
      } else if (type === 'clear-messages') {
        emitter.emit('clear-messages', token)
      } else if (type === 'message') {
        emitter.emit('message', Object.assign({}, message, { socket }))
      } else {
        debug('can not resolve the message. %o', message)
      }
    })
    //
    socket.once('disconnect', () => {
      const sockets = this.sockets
      const index = sockets.indexOf(socket)
      if (index !== -1) {
        sockets.splice(index, 1)
      }
      debug('mock client has been closed.')
    })
    //
    emitter.emit('mock-connection', socket)
  }

  middleware() {
    const { fakedServer } = this
    return (req, res, head) => {
      if (helper.isWebSocketHandshake(req)) {
        fakedServer.emit('upgrade', req, res, head)
      } else {
        fakedServer.emit('request', req, res)
      }
    }
  }
}

let handler = null

//
module.exports = (options) => {
  const { context } = options
  if (!handler) {
    handler = new MockServer(options).middleware()
  }
  //
  return (req, res, head, next) => {
    if (req.url.match(`^${context}(?:/|$)`)) {
      return handler(req, res, head)
    }
    next()
  }
}
