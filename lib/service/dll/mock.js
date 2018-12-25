// mock服务

module.exports = ({ api, plugin, merge, isDev }, options) => {
  if (!options || !isDev) {
    return
  }
  const mockMiddleware = require('../../plugin/express/mockMiddleware')(options)
  api.configureDevServer((express) => {
    express.use(mockMiddleware)
  })
}
