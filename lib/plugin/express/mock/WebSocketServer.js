const fs = require('fs')
const http = require('http')
const path = require('path')
//
const chalk = require('chalk')
const lodash = require('lodash')
const WebSocket = require('ws')
const sockjs = require('sockjs')
const socketIO = require('socket.io')
const Stomp = require('@stomp/stompjs').Stomp
const getPort = require('get-port')
const killable = require('killable')
const httpProxyMiddleware = require('http-proxy-middleware')
const serveStatic = require('serve-static')
const finalhandler = require('finalhandler')
//
const getEnv = require('../../../utils/env')
const console = require('../../../utils/console')
const commonUtils = require('../../../utils/common')
//
const helper = require('./helper')

//
const excludeStaticRegExp =
  '(?:^(?!/(?:index\\.(?:html|js|css)|sockjs\\.min\\.js(?:\\.map)?)$))'
//

module.exports = class WebSocketServer {
  //
  constructor(config) {
    this.config = config = Object.assign({}, config)
    this.mockContext = this.ensureMockContext(config.context)
    this.sockets = []
    //
    this.context = `/${Math.floor(Math.random() * 10e8) + Date.now()}`
    // this.proxyContext = `/${Math.floor(Math.random() * 10e8) + Date.now()}`
    this.pluginName = getEnv().PLUGIN_NAME
    //
    this.httpServer = this.createHttpServer(this.context)
    //
    this.listenHttpServer(this.httpServer, (port) => {
      this.port = port
      this.proxySocketServer = this.createProxySocketServer()
      this.socketServer = this.createSocketServer()
      this.combineServer(
        this.proxySocketServer,
        this.socketServer,
        this.httpServer
      )
      //
      commonUtils.printListeningAddress(
        this.httpServer,
        `  Mock ${chalk.cyan.underline.bold(this.getServerType())} served at:`
      )
      //
    }).catch(() => {})
    this.httpServer.once('close', () => {
      this.sockets.forEach((socket) => {
        socket.close()
      })
      this.sockets = []
      this.httpServer.kill()
    })
  }

  getMockContext() {
    return this.mockContext
  }

  ensureMockContext(context) {
    if (!Array.isArray(context)) {
      context = [context]
    }
    context = context.reduce((list, ctx) => {
      ctx = typeof ctx === 'string' ? ctx.trim() : ''
      if (ctx === '/') {
        // mock所有
        ctx = ''
      } else {
        ctx = ctx.replace(/^[\^]*(.)/g, '^$1').replace(/(\/+|\b)$/g, '(?:/|$)')
      }
      if (!list.includes(ctx)) {
        list.push(ctx)
      }
      return list
    }, [])
    if (!this.isStandardClient()) {
      if (context.some((ctx) => !ctx)) {
        throw new Error(`Must specify context for mock client. [${RegExp.$1}]`)
      }
    } else {
      context = context.filter((ctx) => !!ctx)
    }
    return context
  }

  isStandardClient() {
    const { client } = this.config
    return !/^\s*(sockjs|stmop|socket\.io)\s*$/i.test(client)
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
        callback(actualPort)
      } else {
        throw err
      }
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
        // 使用http代理转发处理
        upgrade(req, socket, head)
      } else if (this.requestHandler) {
        // 普通http请求
        this.requestHandler(req, socket, head)
      } else {
        // 无法处理，让其他中间件处理
        return false
      }
      return true
    }
  }

  //
  listenSocketServer() {
    const { config, proxySocketServer, socketServer } = this
    const {} = config
    const servers = [proxySocketServer, socketServer]
    //
    servers.forEach((server) => {
      server.on('connection', (conn) => {
        if (!conn) {
          return
        }
        this.sockets.push(conn)
        this.incoming(conn, server)
        //
        conn.on('close', () => {
          const idx = this.sockets.indexOf(conn)
          if (idx >= 0) {
            this.sockets.splice(idx, 1)
          }
          this.closed(conn)
        })
      })
    })
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

  // 组合各服务器
  combineServer(proxySocketServer, socketServer, httpServer) {
    this.combineSocketServer(socketServer, httpServer)
    this.combineProxySocketServer(proxySocketServer, httpServer)
    this.listenSocketServer()
  }

  // 绑定内部socket服务器
  combineSocketServer(socketServer, httpServer) {
    const { context } = this
    const handler = socketServer.middleware({
      prefix: context,
    })
    httpServer.addListener('request', (req, socket, head) => {
      if ((req.originalUrl || req.url).match(`^${context}/`)) {
        handler(req, socket, head)
      }
    })
    httpServer.addListener('upgrade', (req, socket, head) => {
      if ((req.originalUrl || req.url).match(`^${context}/`)) {
        handler(req, socket, head)
      }
    })
  }

  // 绑定代理socket服务器
  combineProxySocketServer(proxySocketServer, httpServer) {
    const { socketServerFactory, mockContext, context, pluginName } = this
    let proxyHandler = null
    if (socketServerFactory === sockjs) {
      proxyHandler = proxySocketServer.middleware({
        prefix: `(?:${mockContext
          // 组合上下文
          .map((ctx) => ctx.replace(/(\(\?:\/\|\$\))$/, '$1?'))
          .join('|')})`,
      })
      httpServer.addListener(
        'request',
        (this.requestHandler = (req, socket, head) => {
          if (!(req.originalUrl || req.url).match(`^${context}/`)) {
            proxyHandler(req, socket, head)
          }
        })
      )
    } else if (socketServerFactory === Stomp) {
      //
    } else if (socketServerFactory === socketIO) {
      proxySocketServer.listen(httpServer)
    } else {
      proxyHandler = (req, socket, head) => {
        proxySocketServer.handleUpgrade(req, socket, head, (ws) => {
          proxySocketServer.emit('connection', ws, req)
          // 兼容sockjs的单独websocket请求
          ws.send('o')
        })
      }
    }
    if (proxyHandler) {
      httpServer.addListener('upgrade', (req, socket, head) => {
        if (!(req.originalUrl || req.url).match(`^${context}/`)) {
          proxyHandler(req, socket, head)
        }
      })
      proxySocketServer.on('headers', (headers) => {
        if (Array.isArray(headers)) {
          headers.push(`X-Mocked-By: ${pluginName}`)
        }
      })
    }
  }

  createHttpServer(context) {
    const rootDir = path.join(__dirname, 'static')
    const serve = serveStatic(rootDir, {
      index: ['index.html'],
    })
    let address = ''
    const httpServer = http.createServer((req, res) => {
      const url = req.originalUrl || req.url
      const done = finalhandler(req, res)
      if (/^\/index\.js$/.test(url)) {
        fs.readFile(`${rootDir}/index.js`, async (err, buf) => {
          if (err) {
            return done(err)
          }
          if (!address) {
            try {
              address = await commonUtils.getNetworkHostIP()
            } catch (e) {
              address = '127.0.0.1'
            }
          }
          const port = this.port
          res.setHeader('Content-Type', 'application/javascript')
          res.end(
            lodash.template(buf.toString())({
              context,
              server: this.getServerType(),
              address: `${address}${port === '80' ? '' : `:${port}`}`,
            })
          )
        })
      } else if (!url.match(`^${context}`)) {
        serve(req, res, done)
      }
    })
    killable(httpServer)
    return httpServer
  }

  getServerType() {
    const { socketServerFactory } = this
    if (socketServerFactory === sockjs) {
      return 'sockjs'
    } else if (socketServerFactory === Stomp) {
      return 'stmop'
    } else if (socketServerFactory === socketIO) {
      return 'socket.io'
    } else {
      return 'websocket'
    }
  }

  // 创建http代理中间件，用于转发客户端socket请求至内部socket代理服务器
  async createHttpProxyMiddleware(port) {
    //
    let address = ''
    try {
      address = await commonUtils.getNetworkHostIP()
    } catch (e) {
      address = '127.0.0.1'
    }
    return httpProxyMiddleware({
      target: `http://${address}:${port}`,
      secure: false,
      changeOrigin: true,
      preserveHeaderKeyCase: true,
      logLevel: 'error',
      headers: { 'X-Mocked-By': this.pluginName },
      onError(err) {
        console.error(err.message, true)
      },
    })
  }

  // 创建内部socket服务器
  createSocketServer() {
    return sockjs.createServer({
      log: (severity, line) => {
        if (severity === 'error') {
          console.error(line, true)
        }
      },
    })
  }

  // 创建代理socket服务器
  createProxySocketServer() {
    const { config } = this
    const { client } = config
    // 创建代理socket服务器
    if (/^\s*(sockjs|stmop)\s*$/i.test(client)) {
      const type = RegExp.$1.toLowerCase()
      this.socketServerFactory = type === 'sockjs' ? sockjs : Stomp
      const socketServer = sockjs.createServer({
        log: (severity, line) => {
          if (severity === 'error') {
            console.error(line, true)
          }
        },
      })
      return type === 'sockjs' ? socketServer : Stomp.over(socketServer)
      //
    } else if (/^\s*socket\.io\s*$/i.test(client)) {
      this.socketServerFactory = socketIO
      return socketIO({
        serveClient: false,
      })
      //
    } else {
      this.socketServerFactory = WebSocket
      return new WebSocket.Server({ noServer: true })
    }
  }

  // 拦截开发服务器协议升级（外部调用）
  async over(httpServer) {
    if (httpServer) {
      this.httpProxyMiddleware = await this.createHttpProxyMiddleware(this.port)
      if (!this.isStandardClient()) {
        this.overshadowListeners(httpServer, 'request')
      }
      this.overshadowListeners(httpServer, 'upgrade')
    }
  }

  overshadowListeners(httpServer, event) {
    const registeredListeners = httpServer.listeners(event).slice(0)
    const newHandler = (req, socket, head) => {
      if (!this.handleDevHttpServerIncoming(req, socket, head)) {
        // 使用外部中间件处理
        registeredListeners.forEach((listener) => {
          listener(req, socket, head)
        })
      }
    }
    httpServer.removeAllListeners(event)
    httpServer.addListener(event, newHandler)
  }

  receive(message, conn, server) {
    console.raw.log(message)
  }

  //
  incoming(conn, server) {
    const { socketServerFactory, proxySocketServer } = this
    let messageEvent = ''
    if (server === proxySocketServer) {
      if (
        socketServerFactory === WebSocket ||
        socketServerFactory === socketIO
      ) {
        messageEvent = 'message'
      } else {
        messageEvent = 'data'
      }
    } else {
      messageEvent = 'data'
    }
    conn.on(messageEvent, (message) => {
      this.receive(message, conn, server)
    })
  }

  closed(conn) {}

  write() {}
}
