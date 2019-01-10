//
const Stomp = require('@stomp/stompjs').Stomp
const sockjs = require('sockjs')
const WebSocket = require('ws')

const debug = require('debug')('mock:socket:proxySTOMPServer')

const proxyServer = require('./proxyServer')
const connection = require('./connection')
const helper = require('../helper')

//
function createSockJSServer(options) {
  const { proxyContext, mockContext } = options
  //
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
  const handler = server.middleware({
    prefix,
  })
  return { server, handler }
}

function createWebSocketServer(options) {
  const { proxyContext } = options
  const server = new WebSocket.Server({ noServer: true })
  const handler = (req, res, head) => {
    if (
      req.url.match(`^${proxyContext}/`) &&
      helper.isWebSocketHandshake(req)
    ) {
      server.handleUpgrade(req, res, head, (ws) => {
        server.emit('connection', ws, req)
      })
      return true
    }
    return false
  }
  return { server, handler }
}

function incoming(server, channel, url) {
  let co = null
  let subscription = server.subscribe(channel, (message) => {
    const { body } = message
    if (co && body) {
      co.send(body)
    }
  })
  //
  co = connection(
    null,
    () => {
      subscription.unsubscribe()
    },
    url,
    channel,
    'stomp'
  )
  //
  co.on('mock', (data) => {
    server.publish({ destination: channel, body: data })
    debug('sending data to client. [%s]', url)
  })
  //
  proxyServer.emit('connection', co)
}

function createHandler(options) {
  const { config } = options
  let { client, channel } = config
  if (!Array.isArray(channel)) {
    channel = [channel]
  }
  channel = Array.from(new Set(channel)).filter(
    (item) => !!item && typeof item === 'string'
  )
  if (!channel.length) {
    channel.push('/message')
  }
  //
  const { server, handler } = /\bsockjs\b/.test(client)
    ? createSockJSServer(options)
    : createWebSocketServer(options)

  //
  const stompServer = Stomp.over(server)
  stompServer.onConnect = (frame) => {
    channel.forEach((event) => {
      incoming(stompServer, event, frame.headers.host)
    })
  }
  stompServer.onStompError = (frame) => {
    debug('Broker reported error: %s', frame.headers['message'])
    debug('Additional details: %s', frame.body)
  }

  return handler
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
