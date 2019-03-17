// 系统通知
module.exports = ({ plugin }, options) => {
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

  // 未使用文件查找服务
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
          skipFirstNotification: false,
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
