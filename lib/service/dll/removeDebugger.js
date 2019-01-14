const logger = require('../../utils/logger')
// 移除debugger
module.exports = ({ config, merge, isDev }, options) => {
  if (!options || isDev) {
    return
  }
  logger.info(`Register service 👉 'removeDebugger'`)
  config.module
    .rule('js')
    .use('babel-loader')
    .loader('babel-loader')
    .tap((options) =>
      merge(options, {
        plugins: [['transform-remove-debugger', Object.assign({}, options)]],
      })
    )
}
