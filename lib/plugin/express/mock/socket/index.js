const http = require('http')
const chalk = require('chalk')
const debug = require('debug')('mock:socket')
const uuidv4 = require('uuid/v4')
const getPort = require('get-port')
const killable = require('killable')
const httpProxyMiddleware = require('http-proxy-middleware')
//
const getEnv = require('../../../../utils/env')
const commonUtils = require('../../../../utils/common')
const applyMiddleware = require('../../../../utils/middleware').apply
//
const helper = require('../helper')
const emitter = require('./emitter')

module.exports = class SocketMockServer {
  //
  constructor(config) {
    this.pluginName = getEnv().PLUGIN_NAME
    this.config = config = Object.assign({}, config)
    this.mockContext = this.ensureMockContext(config.context)
    //
    this.context = `/${uuidv4()}`
    this.proxyContext = `/${uuidv4()}`
    debug('mock client context: %s', this.context)
    debug('proxy client context: %s', this.proxyContext)
    //
    const httpServer = this.createHttpServer()
    //
    this.listenHttpServer(httpServer, (port) => {
      this.port = port
      this.client = this.getClientType()
      const handler = this.getProxyHandler(this.combineMiddleware(), (req) => {
        debug('can not proxy the request: %s', req.url)
      })
      httpServer.addListener('request', handler)
      httpServer.addListener('upgrade', handler)
    }).catch(() => {})
  }

  getProxyHandler(middleware, next) {
    return (req, res, head) => {
      try {
        applyMiddleware(middleware, req, res, head, () => {
          next(req, res, head)
        })
      } catch (e) {
        debug(e.message)
      }
    }
  }

  getMockContext() {
    return [].concat(this.mockContext)
  }

  ensureMockContext(context) {
    const clientType = this.getClientType()
    if (!Array.isArray(context)) {
      context = [context]
    }
    context = context
      .reduce((list, ctx) => {
        ctx = typeof ctx === 'string' ? ctx.trim() : ''
        ctx.replace(/^\/*([^/]?)/, '/$1').replace(/\/{2,}/g, '/')
        if (ctx === '/') {
          // mock所有
          ctx = ''
        } else {
          ctx = ctx
            .replace(/^[\^]*(.)/g, '^$1')
            .replace(/(\/+|\b)$/g, '(?:/|$)')
        }
        if (!list.includes(ctx)) {
          list.push(ctx)
        }
        return list
      }, [])
      .filter((ctx) => !!ctx)
    if (!this.isStandardClient() && !context.length) {
      throw new Error(`Must specify context for mock client. [${clientType}]`)
    }
    return context
  }

  isStandardClient() {
    const { client } = this.config
    return !/^\s*(sockjs|stmop|socket\.io)\s*$/i.test(client)
  }

  createHttpServer() {
    const httpServer = http.createServer()
    killable(httpServer)
    httpServer.once('close', () => {
      emitter.emit('close-server')
      httpServer.kill()
      debug('socket server has been closed.')
    })
    return httpServer
  }

  getClientType() {
    const { config } = this
    const { client } = config
    const matcher = /^\s*(sockjs|stomp|socket.io)\s*$/i.exec(client)
    if (matcher) {
      return matcher[1].toLowerCase()
    }
    return 'websocket'
  }

  // 监听端口
  async listenHttpServer(httpServer, callback) {
    const { config } = this
    const { port } = config
    const actualPort = await getPort({ port: +port || 8080 })
    //
    httpServer.listen(actualPort, '0.0.0.0', (err) => {
      if (!err) {
        commonUtils.registerShutdown(() => httpServer.close())
        //
        commonUtils.printListeningAddress(
          httpServer,
          `  Mock ${chalk.cyan.underline.bold(this.getClientType())} served at:`
        )
        callback(actualPort)
      } else {
        debug('socket server startup failed. %s', err.message)
      }
    })
  }

  // 组合中间件
  combineMiddleware() {
    const clientType = this.getClientType()
    //
    const options = Object.keys(this).reduce((opts, key) => {
      opts[key] = this[key]
      return opts
    }, {})
    //
    options.mockContext = this.getMockContext()
    // default
    const middleware = [
      // static
      require('./staticServer')(options),
      // mockServer
      require('./mockServer')(options),
    ]
    // proxy
    let proxyMiddleware = null
    switch (clientType) {
      case 'sockjs':
        proxyMiddleware = require('./proxySockJSServer')(options)
        break
      case 'stomp':
        proxyMiddleware = require('./proxySTOMPServer')(options)
        break
      case 'socket.io':
        proxyMiddleware = require('./proxySocketIOServer')(options)
        break
      default:
        proxyMiddleware = require('./proxyWebSocketServer')(options)
    }
    middleware.push(proxyMiddleware)
    //
    return middleware
  }

  // 拦截开发服务器协议升级（外部调用）
  async over(devHttpServer) {
    if (devHttpServer) {
      this.httpProxyMiddleware = await this.createHttpProxyMiddleware(this.port)
      debug('overshadow http request and upgrade.')
      this.overshadowListeners(devHttpServer, 'request')
      this.overshadowListeners(devHttpServer, 'upgrade')
    }
  }

  // 创建http代理中间件，用于转发客户端socket请求至内部socket代理服务器
  async createHttpProxyMiddleware(port) {
    const { proxyContext } = this
    //
    let address = ''
    try {
      address = await commonUtils.getNetworkHostIP()
    } catch (e) {
      address = '127.0.0.1'
    }
    return httpProxyMiddleware({
      target: `http://${address}:${port}${proxyContext}`,
      secure: false,
      changeOrigin: true,
      preserveHeaderKeyCase: true,
      logLevel: 'error',
      headers: { 'X-Mocked-By': this.pluginName },
    })
  }

  handleDevHttpServerIncoming(req, socket, head) {
    const { httpProxyMiddleware } = this
    const { upgrade } = httpProxyMiddleware
    const url = req.originalUrl || req.url
    if (/^\/sockjs-node\//.test(url) || !this.shouldProxySocket(req)) {
      // 使用其他中间件服务
      return false
    } else {
      if (helper.isWebSocketHandshake(req)) {
        // 使用http代理转发upgrade请求
        upgrade(req, socket, head)
      } else {
        // 使用http代理转发普通http请求
        httpProxyMiddleware(req, socket, () => {})
      }
      return true
    }
  }

  shouldProxySocket(req) {
    const { mockContext } = this
    const url = req.originalUrl || req.url
    if (helper.isWebSocketHandshake(req)) {
      if (!mockContext.length) {
        return true
      }
    }
    for (const ctx of mockContext) {
      if (url.match(ctx)) {
        return true
      }
    }
    return false
  }

  overshadowListeners(devHttpServer, event) {
    const registeredListeners = devHttpServer.listeners(event).slice(0)
    const newHandler = (req, socket, head) => {
      if (!this.handleDevHttpServerIncoming(req, socket, head)) {
        // 使用外部中间件处理
        registeredListeners.forEach((listener) => {
          listener(req, socket, head)
        })
      }
    }
    devHttpServer.removeAllListeners(event)
    devHttpServer.addListener(event, newHandler)
  }
}
