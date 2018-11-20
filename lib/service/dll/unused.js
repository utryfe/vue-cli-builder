//
module.exports = ({ plugin }, options) => {
  if (!options) {
    return
  }
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
