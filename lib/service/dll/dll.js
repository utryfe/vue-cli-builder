const fs = require('fs')
const fileUtil = require('../../utils/file')

module.exports = ({ plugin, isDev }, options, projectOptions) => {
  if (!options || !isDev) {
    if (options === false) {
      // 手动设置为false值时，清除dll目录
      const output = require('../../plugin/webpack/DllReference/config.dll')
        .outputDir
      try {
        if (fs.existsSync(output)) {
          fileUtil.removeSync(output)
        }
      } catch (e) {}
    }
    return false
  }
  //
  let { outputDir, assetsDir } = projectOptions
  if (!fileUtil.isAbsolute(outputDir)) {
    outputDir = fileUtil.resolvePath(outputDir)
  }
  assetsDir = fileUtil.joinPath(outputDir, assetsDir)
  //
  plugin.use(
    {
      pluginName: 'DllReference',
      configName: 'cached-dll-ref',
    },
    () => [
      Object.assign({}, options, {
        assetsDir,
      }),
    ]
  )
}
