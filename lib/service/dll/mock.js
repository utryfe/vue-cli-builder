//
module.exports = ({ api, plugin, isDev }, options) => {
  if (!options || !isDev) {
    return
  }
  const { ws } = Object.assign({}, options)
  const MockMiddleware = require('../../plugin/express/mock/MockMiddleware')
  const WebSocketServer = require('../../plugin/express/mock/WebSocketServer')
  const middleware = new MockMiddleware(options)
  let websocketServer = null
  if (ws) {
    // websocket mock服务器
    websocketServer = new WebSocketServer(ws)
    const mockContext = websocketServer.getMockContext()
    plugin.configureProxyServer((config, ctx, ctxModifier) => {
      if (!mockContext.length) {
        // 所有websocket请求由mock来处理
        config.ws = false
      } else {
        // 修改代理上下文，排除mock上下文
        mockContext.forEach((context) => {
          ctx = `(?:^(?!${context}))${ctx}`
        })
        ctxModifier(ctx)
      }
    })
  }
  //
  api.configureDevServer((express, devServer) => {
    //
    express.use(middleware.apply.bind(middleware))
    //
    if (websocketServer) {
      // 对websocket请求进行mock
      setImmediate(() => {
        const httpServer = devServer.listeningApp
        if (httpServer) {
          websocketServer.over(httpServer).catch((err) => {
            console.error(err.message)
          })
        }
      })
    }
  })
}
