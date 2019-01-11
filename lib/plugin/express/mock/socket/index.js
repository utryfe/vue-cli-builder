const http = require('http')
const chalk = require('chalk')
const debug = require('debug')('mock:socket')
const uuidv4 = require('uuid/v4')
const getPort = require('get-port')
const killable = require('killable')
const finalhandler = require('finalhandler')
const httpProxyMiddleware = require('http-proxy-middleware')
//
const getEnv = require('../../../../utils/env')
const commonUtils = require('../../../../utils/common')
const applyMiddleware = require('../../../../utils/middleware').apply
const logger = require('../../../../utils/console')
//
const helper = require('../helper')
const emitter = require('./emitter')

module.exports = class SocketMockServer {
  //
  constructor(config) {
    this.pluginName = getEnv().PLUGIN_NAME
    this.config = config = Object.assign({}, config)
    const {
      mockContext,
      contextPath,
      proxyContext: proxyMockContext,
    } = this.ensureMockContext(config.context)
    this.mockContext = mockContext
    this.proxyMockContext = proxyMockContext
    this.contextPath = contextPath
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
      const handler = this.getProxyHandler(
        this.combineMiddleware(),
        (req, res) => {
          this.echoNotFound(req, res)
        }
      )
      httpServer.addListener('request', handler)
      httpServer.addListener('upgrade', handler)
      httpServer.addListener('error', (err) => err && debug(err.message))
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

  echoNotFound(req, res) {
    debug('can not proxy the request: %s', req.url)
    const host = req.headers['x-proxy-origin'] || req.headers.host
    let err = null
    if (host) {
      err = {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': `http://${host.replace(
            /^https?:\/\//,
            ''
          )}`,
        },
      }
    }
    this.catchError(() => {
      finalhandler(req, res)(err)
    })
  }

  catchError(handler) {
    try {
      handler.call(this)
    } catch (e) {
      debug(e.message)
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
    if (clientType === 'socket.io') {
      context.push('/socket.io')
    }
    const proxyContext = []
    const mockContext = []
    const contextPath = []
    context.forEach((ctx) => {
      let proxyCtx = ''
      ctx = typeof ctx === 'string' ? ctx.trim() : ''
      ctx = ctx.replace(/^\/*([^/]?)/, '/$1').replace(/\/{2,}/g, '/')
      if (ctx === '/') {
        // mock所有
        ctx = ''
      } else {
        contextPath.push(ctx)
        proxyCtx = `${ctx.replace(/^[\^]*(.)/g, '$1').replace(/\/+$/g, '')}`
        ctx = ctx.replace(/^[\^]*(.)/g, '^$1').replace(/(\/+|\b)$/g, '(?:/|$)')
      }
      if (ctx && !mockContext.includes(ctx)) {
        proxyContext.push(proxyCtx)
        mockContext.push(ctx)
      }
    })
    //
    if (!this.isStandardClient() && !mockContext.length) {
      logger.error(
        `Must specify context for mock client. [${clientType}]`,
        true
      )
      process.exit(1)
    }
    return { mockContext, proxyContext, contextPath }
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
    const matcher = /^\s*(sockjs|stomp|socket\.io)\s*$/i.exec(client)
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
        commonUtils
          .printListeningAddress(httpServer, '  Mock socket served at:')
          .then(() => {
            console.log(
              `${chalk.white('  - Context: ')}${chalk.cyan(
                this.contextPath.join(', ')
              )}`
            )
            console.log(
              `${chalk.white('  - Client:  ')}${chalk.cyan(
                this.getClientType()
              )}`
            )
            console.log()
          })
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
    options.contextPath = [].concat(this.contextPath)
    options.proxyMockContext = [].concat(this.proxyMockContext)
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
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Proxy-Origin', req.headers.host)
      },
      onProxyRes: (proxyRes) => {
        proxyRes.headers['X-Mocked-By'] = this.pluginName //
      },
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
