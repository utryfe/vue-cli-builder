//
const debug = require('debug')('mock:socket:proxyStomp')
const stompManager = require('./stompManager')

const applyMiddleware = require('../../../../utils/middleware').apply

//
function createHandler(options, callback) {
  const manager = stompManager(options)
  //
  const handler = (socket, req) => {
    const stomp = manager.createStompServer({ socket, req })
    if (typeof callback === 'function') {
      callback(socket, req, stomp)
      // 外部处理
      debug('stomp connected. %s', req.url)
    } else {
      // 内部处理
      manager.connect(stomp)
    }
  }

  const { socketType } = options
  let middleware = null
  if (socketType === 'sockjs') {
    middleware = require('./proxySockJsServer').middleware(options, handler)
  } else {
    middleware = require('./proxyWebSocketServer').middleware(options, handler)
  }
  return (req, res, head) => {
    return new Promise((resolve) => {
      applyMiddleware(middleware, req, res, head, (err) => {
        if (err) {
          debug(err.message)
        }
        // socket服务没有处理该请求
        resolve()
      })
    })
  }
}

function middleware(options, callback) {
  //
  const handler = createHandler(options, callback)
  return (req, res, head, next) => {
    handler(req, res, head).then(() => next())
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
