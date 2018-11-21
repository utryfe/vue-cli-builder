// 监听模块变化
module.exports = ({ plugin, isDev }, options) => {
  if (!isDev) {
    return false
  }
  //
  options = Object.assign({}, options)

  plugin.use('^module-watch', (args) => [Object.assign({}, args[0], options)])
}
