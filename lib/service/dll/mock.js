// mock服务

module.exports = ({ api, plugin, isDev }, options) => {
  if (!options || !isDev) {
    return
  }
  const mockMiddleware = require('../../plugin/express/mockMiddleware')
  const { middleware, apply } = mockMiddleware(options)
  plugin.configureProxyServer((context, config) =>
    middleware.configureProxyServer(context, config)
  )
  //
  api.configureDevServer((express) => {
    express.use(apply)
  })
}
