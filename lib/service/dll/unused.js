const logger = require('../../utils/logger')
//
module.exports = ({ plugin }, options) => {
  if (!options) {
    return
  }
  logger.info(`Register service 👉 'unused'`)
  // 未使用文件查找服务
  plugin.use('^unused-files', (args) => [
    Object.assign(
      {
        patterns: ['src/**/*.vue', 'src/**/*.js', 'src/**/*.css'],
      },
      args[0],
      options
    ),
  ])
}
