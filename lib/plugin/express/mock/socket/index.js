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
const applyMiddleware = require('../../../../utils/middleware')
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
      this.socketType = this.getWsClientType()
      emitter.emit('listening', port)
      //
      const handler = this.getProxyHandler(
        this.combineMiddleware(),
        (err) => err && debug(err.message)
      )
      httpServer.addListener('request', handler)
      httpServer.addListener('upgrade', handler)
      httpServer.addListener('error', (err) => err && debug(err.message))
      //
    }).catch((err) => {
      debug(err.message)
    })
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
    //
    context = (Array.isArray(context) ? context : [context]).reduce((list, ctx) => {
      ctx = typeof ctx === 'string' ? ctx.trim() : ''
      if (ctx && ctx !== '/') {
        list.push(ctx)
      }
      return list
    }, [])
    if (!context.length) {
      if (clientType === 'socket.io') {
        context.push('/socket.io')
      } else if (clientType === 'sockjs') {
        context.push('/sockjs')
      }
    }
    //
    const proxyContext = []
    const mockContext = []
    const contextPath = []
    context.forEach((ctx) => {
      ctx = ctx.replace(/^\/*([^/]?)/, '/$1').replace(/\/{2,}/g, '/')
      //
      contextPath.push(ctx)
      //
      if (!mockContext.includes(ctx)) {
        const proxy = `${ctx.replace(/^[\^]*(.)/g, '$1').replace(/\/+$/g, '')}`
        //
        const mock = ctx
          .replace(/^[\^]*(.)/g, '^$1')
          .replace(/(\/+|\b)$/g, '(?:/|$)')
        proxyContext.push(proxy)
        mockContext.push(mock)
      }
    })
    return { mockContext, proxyContext, contextPath }
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
    const matcher = /^\s*(sockjs|stomp|socket\.io)(#.*)?\s*$/i.exec(client)
    if (matcher) {
      return matcher[1].toLowerCase()
    }
    return 'websocket'
  }

  getWsClientType() {
    const clientType = this.getClientType()
    if (clientType === 'stomp') {
      const { config } = this
      const { client } = config
      const matcher = /^\s*stomp#(sockjs)?\s*$/i.exec(client)
      if (matcher) {
        return `${matcher[1].toLowerCase() || 'websocket'}`
      } else {
        return 'websocket'
      }
    }
    return ''
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
          .catch((err) => err && debug(err.message))
          .then(() => {
            callback(actualPort)
            //
            console.log(
              `${'  - Context: '}${chalk.cyan(this.contextPath.join(', ') || '/')}`
            )
            //
            const { client, socketType } = this
            console.log(
              `${'  - Client:  '}${chalk.cyan(
                `${client}${socketType ? `#${socketType}` : ''}`
              )}`
            )
            console.log()
          })
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
        proxyMiddleware = require('./proxySockJsServer')(options)
        break
      case 'stomp':
        proxyMiddleware = require('./proxyStompServer')(options)
        break
      case 'socket.io':
        proxyMiddleware = require('./proxySocketIoServer')(options)
        break
      default:
        proxyMiddleware = require('./proxyWebSocketServer')(options)
    }
    middleware.push(proxyMiddleware)
    //
    middleware.push(require('./proxyServerNotFound')(options))
    //
    return middleware
  }

  // 拦截开发服务器协议升级（外部调用）
  over(devHttpServer) {
    if (devHttpServer) {
      const catchRequest = async (port) => {
        this.httpProxyMiddleware = await this.createHttpProxyMiddleware(port)
        debug('overshadow http request and upgrade.')
        this.overshadowListeners(devHttpServer, 'request')
        this.overshadowListeners(devHttpServer, 'upgrade')
      }
      const { port } = this
      if (port) {
        catchRequest(port).catch(() => {})
      } else {
        emitter.once('listening', catchRequest)
      }
    }
  }

  // 创建http代理中间件，用于转发客户端socket请求至内部socket代理服务器
  async createHttpProxyMiddleware(port) {
    const { proxyContext } = this
    //
    const address = await commonUtils.getNetworkHostIP()
    //
    return httpProxyMiddleware({
      target: `http://${address}:${port}${proxyContext}`,
      secure: false,
      changeOrigin: true,
      preserveHeaderKeyCase: true,
      logLevel: 'error',
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
