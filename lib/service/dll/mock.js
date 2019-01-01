// mock服务

module.exports = ({ api, plugin, isDev }, options) => {
  if (!options || !isDev) {
    return
  }
  const MockMiddleware = require('../../plugin/express/mock/MockMiddleware')
  const middleware = new MockMiddleware(options)
  //
  api.configureDevServer((express) => {
    express.use(middleware.apply.bind(middleware))
  })
}
