// 监听重编译
// watchRun done invalid
module.exports = ({ plugin, isDev }, options) => {
  if (!isDev) {
    return false
  }
  plugin.use('^compile-watch', () => [options])
}
