const fs = require('fs')
const fileUtil = require('../../utils/file')
const logger = require('../../utils/logger')

module.exports = ({ plugin, isDev, modernApp, env }, options, projectOptions) => {
  if (!options) {
    if (options === false) {
      // 手动设置为false值时，清除dll目录
      const output = require('../../plugin/webpack/DllReference/config.dll').outputDir
      try {
        if (fs.existsSync(output)) {
          fileUtil.removeSync(output)
        }
      } catch (e) {}
    }
    return false
  }
  if (modernApp) {
    const { args } = env
    if (args['unsafe-inline'] !== false) {
      logger.error(
        '\nMust set the arg of "--no-unsafe-inline" when build app targeting modern browsers.\n'
      )
      process.exit(1)
    }
  }

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
      options,
      {
        outputDir,
        assetsDir,
      },
    ]
  )
}
