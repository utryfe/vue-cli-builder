const logger = require('../../utils/logger')
//
module.exports = ({ plugin, isDev }, options) => {
  if (!options || isDev) {
    return
  }
  logger.info(`Register service 👉 'timeCost'`)
  // 构建耗时统计服务
  plugin.use('^time-cost', (args) => [Object.assign({}, args[0], options)])
}
