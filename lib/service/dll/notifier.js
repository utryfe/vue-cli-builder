// 系统通知
module.exports = ({ plugin, modernApp, modernBuild }, options) => {
  if (!options) {
    return false
  }

  const fileUtil = require('../../utils/file')
  const { contentImage } = Object.assign({}, options)

  let absContentImage = ''
  if (typeof contentImage === 'string') {
    absContentImage = fileUtil.isAbsolute(contentImage)
      ? contentImage
      : fileUtil.resolvePath(contentImage)
  }

  if (!fileUtil.existsSync(absContentImage)) {
    absContentImage = fileUtil.resolvePath('notifier.png')
    if (!fileUtil.existsSync(absContentImage)) {
      absContentImage = ''
    }
  }

  const skipFirst = modernApp && !modernBuild

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
