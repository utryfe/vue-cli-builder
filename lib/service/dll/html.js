const logger = require('../../utils/logger')
//
module.exports = ({ plugin }, options, projectOptions) => {
  if (!options || typeof options !== 'object') {
    return
  }

  logger.info(`Register service 👉 'html'`)
  // HTML模板处理服务
  Object.keys(projectOptions.pages).forEach((page) => {
    plugin.use(`html-${page}`, (args) => [Object.assign({}, args[0], options)])
  })
}
