//
module.exports = ({ plugin, modernApp, modernBuild }, options) => {
  if (!options || (modernApp && !modernBuild)) {
    return false
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
