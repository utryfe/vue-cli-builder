// mock服务

module.exports = ({ api, isDev }, options) => {
  if (!options || !isDev) {
    return
  }
  const mockMiddleware = require('../../plugin/express/mockMiddleware')(options)
  api.configureDevServer((express) => {
    express.use(mockMiddleware)
  })
}
