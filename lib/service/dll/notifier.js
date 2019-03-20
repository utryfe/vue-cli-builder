// 系统通知
module.exports = ({ plugin, modernApp, modernBuild }, options) => {
  if (!options) {
    return false
  }

  const fileUtil = require('../../utils/file')

  const { contentImage } = Object.assign({}, options)

  const images = [
    contentImage,
    'notifier.png',
    fileUtil.joinPath(__dirname, '../../assets/webpack.png'),
  ]

  const skipFirst = modernApp && !modernBuild

  let absContentImage = ''
  for (const img of images) {
    const path = typeof img === 'string' ? img.trim() : ''
    if (path) {
      const absPath = fileUtil.isAbsolute(path) ? path : fileUtil.resolvePath(path)
      if (fileUtil.existsSync(absPath)) {
        absContentImage = absPath
        break
      }
    }
  }

  // 构建结果，系统通知服务
  plugin.use(
    {
      configName: 'notifier',
      pluginName: 'webpack-notifier',
    },
    (args) => [
      Object.assign(
        {
          title: 'Webpack',
          alwaysNotify: false,
          excludeWarnings: true,
          skipFirstNotification: skipFirst,
        },
        args[0],
        options,
        {
          contentImage: absContentImage,
        }
      ),
    ]
  )
}
