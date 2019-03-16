const commonUtil = require('../../utils/common')

//
module.exports = ({ api, plugin, isDev, env: { args } }, options, projectOptions) => {
  if (!options || !isDev) {
    return false
  }

  const { ws, http } = Object.assign({}, options)
  let mockHttp = null
  if (http !== false) {
    const MockMiddleware = require('../../plugin/express/mock/http/MockMiddleware')
    mockHttp = new MockMiddleware(options)
  }
  const SocketMockServer = require('../../plugin/express/mock/socket/index')

  let mockSocket = null
  if (ws) {
    // websocket mock服务器
    mockSocket = new SocketMockServer(ws)
    const mockContext = mockSocket.getMockContext()
    plugin.configureProxyServer((config, ctx, ctxModifier) => {
      // 修改代理上下文，排除mock上下文
      mockContext.forEach((context) => {
        ctx = `(?:^(?!${context}))${ctx}`
      })
      ctxModifier(ctx)
    })
    const open = args.open || Object.assign({}, projectOptions.devServer).open
    //
    let isFirstCompile = true
    plugin.use(
      {
        pluginName: 'CompilerEvent',
        configName: 'CompilerEventMockSocket',
      },
      () => [
        'MockSocketWebpackPlugin',
        {
          done: () => {
            return new Promise((resolve) => {
              mockSocket.printListenAddress((address) => {
                if (isFirstCompile) {
                  isFirstCompile = false
                  if (address && open) {
                    commonUtil.openBrowser(address.local)
                  }
                }
                //
                resolve()
              })
            })
          },
        },
      ]
    )
  }
  //
  api.configureDevServer((express, devServer) => {
    //
    if (mockHttp) {
      express.use(mockHttp.apply.bind(mockHttp))
    }

    //
    if (mockSocket) {
      // 对websocket请求进行mock
      setImmediate(() => {
        const httpServer = devServer.listeningApp
        if (httpServer) {
          mockSocket.over(httpServer)
        }
      })
    }
  })
}
