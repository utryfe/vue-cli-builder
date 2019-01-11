//
const { Stomp, FrameImpl, Versions } = require('@stomp/stompjs')
const sockjs = require('sockjs')
const WebSocket = require('ws')

const debug = require('debug')('mock:socket:proxySTOMPServer')

const proxyServer = require('./proxyServer')
const connection = require('./connection')
const helper = require('../helper')

if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

//
function createSockJSServer(options) {
  //
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
        debug('incoming stomp connection. [%s]', req.url)
        server.emit('connection', ws, req)
      })
      return true
    }
    return false
  }
  return { server, handler }
}

function closeSocket(ws) {
  try {
    ws.close()
  } catch (e) {
    debug('close socket error. %s', e.message)
  }
}

function incoming(server, ws, channel, url) {
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
      closeSocket(ws)
    },
    url,
    channel,
    'stomp'
  )
  //
  co.on('mock', (data) => {
    server.publish({ destination: channel, body: data })
    debug('sending data to client. [%s][%s]', co.token, co.url)
  })
  //
  ws.once('close', () => {
    co.close()
  })
  //
  proxyServer.emit('connection', co)
}

function transmit(
  ws,
  {
    command,
    headers,
    body,
    binaryBody,
    skipContentLengthHeader,
    escapeHeaderValues,
  }
) {
  const frame = new FrameImpl({
    command,
    headers,
    body,
    binaryBody,
    skipContentLengthHeader,
    escapeHeaderValues,
  })
  const rawChunk = frame.serialize()

  debug(`>>> ${frame}`)

  ws.send(rawChunk)
}

function createSTOMPServer(ws, req, channel) {
  //
  const stompServer = Stomp.over(() => {
    ws.url = req.url
    return ws
  })

  ws.once('message', () => {
    setImmediate(() => {
      // 发送连接成功事件
      const connectHeaders = {}
      connectHeaders['accept-version'] = Versions.default.supportedVersions()
      connectHeaders['heart-beat'] = [10000, 10000].join(',')
      connectHeaders['server'] = req.headers.host || req.headers.origin
      //
      transmit(ws, {
        command: 'CONNECTED',
        headers: connectHeaders,
      })
      // 订阅客户端事件
      channel.forEach((event) => {
        incoming(stompServer, ws, event, req.url)
      })
    })
  })

  //
  stompServer.configure({
    onStompError: (frame) => {
      debug('Broker reported error: %s', frame.headers['message'])
      debug('Additional details: %s', frame.body)
    },
    onWebSocketClose: () => {
      debug('stomp server has been disconnected.')
    },
    // 必须返回一个promise来进行下一步初始化
    beforeConnect: () => Promise.resolve(true),
    //
    debug,
  })
  //
  stompServer.activate()
  //
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

  server.on('connection', (ws, req) => {
    createSTOMPServer(ws, req, channel)
  })

  //
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
