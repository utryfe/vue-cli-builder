//
module.exports = ({ plugin }, options) => {
  if (!options) {
    return
  }
  // 构建耗时统计服务
  plugin.use('^time-cost', (args) => [Object.assign({}, args[0], options)])
}
